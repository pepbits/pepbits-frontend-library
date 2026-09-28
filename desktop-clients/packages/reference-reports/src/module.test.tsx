/*
 * Module integration tests: the public ReferenceReportsModule rendered with a host adapter backed by the
 * fictional in-memory demo store (dummy-api/reference-reports-store.mjs). No network, no real backend.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences } from '@pepbits/erp-config';
import type { ReferenceHost } from '@pepbits/reference-host';
// @ts-ignore -- plain ESM demo store without type declarations
import { createReferenceReportsStore } from '../../../../dummy-api/reference-reports-store.mjs';
import { ReferenceReportsModule } from './index';

type StoreResult = { status: number; headers?: Record<string, string>; body: unknown };
const finance = { id: 'USR-00311', tenantId: 'NEX-AE-001', name: 'Aisha Rahman', email: 'aisha.rahman@nexora.example', role: 'finance-manager' };
const admin = { id: 'USR-00301', tenantId: 'NEX-AE-001', name: 'Prakash Mathew', email: 'prakash@nexora.example', role: 'enterprise-admin' };

let store: { handle: (u: unknown, s: unknown, r: unknown) => StoreResult };
beforeEach(() => { store = createReferenceReportsStore({ jobStepMs: 0 }); });
afterEach(() => { vi.restoreAllMocks(); });

interface HostOptions { user?: typeof finance; branchId?: string; preferences?: Partial<UserPreferences>; policy?: PreferencePolicy; withFetch?: boolean; delay?: (path: string) => Promise<void> }

function makeHost(path: string, o: HostOptions = {}) {
  const user = o.user ?? finance;
  const scope = { applicationId: 'nexora', branchId: o.branchId ?? 'dubai' };
  const calls: { path: string; method: string; body?: unknown }[] = [];
  const navigate = vi.fn();
  const call = async (p: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ path: p, method: init?.method ?? 'GET', body });
    await o.delay?.(p);
    return store.handle(user, scope, { method: init?.method ?? 'GET', path: p, body });
  };
  const preferences = { ...DEFAULT_PREFERENCES, ...o.preferences } as UserPreferences;
  const host: ReferenceHost = {
    scope: { tenantId: user.tenantId, applicationId: scope.applicationId, branchId: scope.branchId, userId: user.id, roles: [user.role] },
    preferences,
    preferenceHost: { preferences, preferencePolicy: o.policy ?? { revision: 0, rules: {} }, preferencesAvailable: true, onPreferenceChange: vi.fn() },
    path,
    navigate,
    // Same rejection shape as the erp-screens host adapter: Error + status + parsed body as details.
    request: async <T,>(p: string, init?: RequestInit) => {
      const r = await call(p, init);
      if (r.status >= 400) throw Object.assign(new Error((r.body as { error?: string }).error ?? 'failed'), { status: r.status, details: r.body });
      return r.body as T;
    },
    ...(o.withFetch === false ? {} : {
      fetch: async (p: string, init?: RequestInit) => {
        const r = await call(p, init);
        const payload = r.headers?.['Content-Type'] && !r.headers['Content-Type'].includes('json') ? (r.body as Uint8Array) : JSON.stringify(r.body);
        return new Response(payload as BodyInit, { status: r.status, headers: r.headers ?? { 'Content-Type': 'application/json' } });
      },
    }),
  };
  return { host, calls, navigate };
}

const LONG = { timeout: 8000 };

describe('ReferenceReportsModule', () => {
  it('renders the report library through the host adapter using original /api paths', async () => {
    const { host, calls } = makeHost('/reports');
    render(<ReferenceReportsModule path="/reports" host={host} />);
    expect(await screen.findByRole('heading', { name: 'Report library' }, LONG)).toBeInTheDocument();
    expect(screen.getByText('Trial balance')).toBeInTheDocument();
    expect(screen.queryByText('Admissions register')).not.toBeInTheDocument();
    expect(calls.every((c) => c.path.startsWith('/api/'))).toBe(true);
    expect(calls.map((c) => c.path)).toEqual(expect.arrayContaining(['/api/session', '/api/page/reports']));
  });

  it('runs a report with the effective page size and follows preference changes', async () => {
    const setup = makeHost('/reports/trial-balance', { preferences: { pageSize: 20, currencyCode: 'USD', numberLocale: 'en-US' } });
    const view = render(<ReferenceReportsModule path="/reports/trial-balance" host={setup.host} />);
    expect(await screen.findByRole('heading', { name: 'Trial balance' }, LONG)).toBeInTheDocument();
    await waitFor(() => expect(setup.calls.some((c) => c.path === '/api/reports/trial-balance/run')).toBe(true), LONG);
    expect(setup.calls.find((c) => c.path === '/api/reports/trial-balance/run')!.body).toMatchObject({ pageSize: 20, page: 1 });
    // Currency formatting uses the host preference, not the source organisation's INR.
    await waitFor(() => expect(document.body.textContent).toMatch(/\$[\d,]+/), LONG);
    const next = makeHost('/reports/trial-balance', { preferences: { pageSize: 50 } });
    next.calls.length = 0;
    view.rerender(<ReferenceReportsModule path="/reports/trial-balance" host={{ ...setup.host, preferences: next.host.preferences, request: next.host.request }} />);
    await waitFor(() => expect(next.calls.some((c) => c.path.endsWith('/run') && (c.body as { pageSize: number }).pageSize === 50)).toBe(true), LONG);
  });

  it('retains builder drafts when effective preferences update with a new host request callback', async () => {
    const setup = makeHost('/builder/new', {user: admin});
    const view = render(<ReferenceReportsModule path="/builder/new" host={setup.host} />);
    const title = await screen.findByLabelText('Title', {}, LONG);
    fireEvent.change(title, {target: {value: 'Unsaved original report'}});
    const next = makeHost('/builder/new', {user: admin, preferences: {density: 'spacious'}});
    view.rerender(<ReferenceReportsModule path="/builder/new" host={next.host} />);
    expect(screen.getByLabelText('Title')).toHaveValue('Unsaved original report');
    await act(async () => { await Promise.resolve(); });
    expect(next.calls.filter(call => call.path === '/api/page/builder/new')).toHaveLength(0);
  });

  it('disables the page-size control when the tenant locks page size', async () => {
    const { host } = makeHost('/reports/trial-balance', { policy: { revision: 1, rules: { pageSize: { value: 20, locked: true } } } });
    render(<ReferenceReportsModule path="/reports/trial-balance" host={host} />);
    const select = await screen.findByLabelText(/rows per page/i, {}, LONG);
    expect(select).toBeDisabled();
  });

  it('rejects a page size outside the tenant policy allowed values, keeps the last permitted one', async () => {
    const setup = makeHost('/reports/trial-balance', {
      preferences: { pageSize: 20 },
      policy: { revision: 1, rules: { pageSize: { value: 20, locked: false, allowedValues: [10, 20] } } },
    });
    render(<ReferenceReportsModule path="/reports/trial-balance" host={setup.host} />);
    await screen.findByRole('heading', { name: 'Trial balance' }, LONG);
    const select = await screen.findByLabelText(/rows per page/i, {}, LONG);
    expect(select).toBeEnabled();
    await waitFor(() => expect(setup.calls.some((c) => c.path.endsWith('/run'))).toBe(true), LONG);
    setup.calls.length = 0;
    // 100 is not in the policy's allowed values: the control stays enabled (not locked) but the choice is refused.
    fireEvent.change(select, { target: { value: '100' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(setup.calls.some((c) => c.path.endsWith('/run'))).toBe(false);
    expect((select as HTMLSelectElement).value).toBe('20');
    // 10 is allowed: the change goes through.
    fireEvent.change(select, { target: { value: '10' } });
    await waitFor(() => expect(setup.calls.some((c) => c.path.endsWith('/run') && (c.body as { pageSize: number }).pageSize === 10)).toBe(true), LONG);
  });

  it('applies a tenant page-size lock that starts after the report is already mounted', async () => {
    const setup = makeHost('/reports/trial-balance', { preferences: { pageSize: 50 } });
    const view = render(<ReferenceReportsModule path="/reports/trial-balance" host={setup.host} />);
    await screen.findByRole('heading', { name: 'Trial balance' }, LONG);
    const before = await screen.findByLabelText(/rows per page/i, {}, LONG);
    expect(before).toBeEnabled();
    await waitFor(() => expect(setup.calls.some((c) => c.path.endsWith('/run') && (c.body as { pageSize: number }).pageSize === 50)).toBe(true), LONG);
    // A policy that locks page size to 20 arrives while the report is mounted with a local choice of 50.
    const locked = makeHost('/reports/trial-balance', { policy: { revision: 1, rules: { pageSize: { value: 20, locked: true } } } });
    view.rerender(<ReferenceReportsModule path="/reports/trial-balance" host={{ ...setup.host, preferences: locked.host.preferences, preferenceHost: locked.host.preferenceHost, request: locked.host.request }} />);
    const after = await screen.findByLabelText(/rows per page/i, {}, LONG);
    expect(after).toBeDisabled();
    await waitFor(() => expect((after as HTMLSelectElement).value).toBe('20'), LONG);
  });

  it('shows the background-run path when the server answers ASYNC_REQUIRED', async () => {
    const { host } = makeHost('/reports/revenue-transactions');
    render(<ReferenceReportsModule path="/reports/revenue-transactions" host={host} />);
    await screen.findByRole('heading', { name: 'Revenue transaction detail' }, LONG);
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'last_year' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));
    expect(await screen.findByText('This request is too large to show on screen', {}, LONG)).toBeInTheDocument();
  });

  it('exports through authenticated host.fetch as a blob; without host.fetch export is disabled', async () => {
    const create = vi.fn(() => 'blob:mock');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { host, calls } = makeHost('/reports/payer-mix');
    render(<ReferenceReportsModule path="/reports/payer-mix" host={host} />);
    await screen.findByRole('heading', { name: 'Payer mix' }, LONG);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'CSV' }));
    await waitFor(() => expect(click).toHaveBeenCalled(), LONG);
    expect(calls.find((c) => c.path === '/api/reports/payer-mix/export')?.method).toBe('POST');
    expect(create).toHaveBeenCalled();
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.href).toBe('blob:mock');
    expect(anchor.download).toMatch(/^payer-mix-.*\.csv$/);

    const noFetch = makeHost('/reports/payer-mix', { withFetch: false });
    const second = render(<ReferenceReportsModule path="/reports/payer-mix" host={noFetch.host} />);
    await within(second.container).findByRole('heading', { name: 'Payer mix' }, LONG);
    fireEvent.click(within(second.container).getByRole('button', { name: /Export/ }));
    expect(await within(second.container).findByRole('button', { name: 'CSV' })).toBeDisabled();
  });

  it('offers only the locked export format', async () => {
    const { host } = makeHost('/reports/payer-mix', { policy: { revision: 2, rules: { exportFormat: { value: 'csv', locked: true } } } });
    render(<ReferenceReportsModule path="/reports/payer-mix" host={host} />);
    await screen.findByRole('heading', { name: 'Payer mix' }, LONG);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(await screen.findByRole('button', { name: 'CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excel (.xlsx)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'JSON' })).not.toBeInTheDocument();
  });

  it('redirects a page the role may not open to the denied overview', async () => {
    const { host, navigate } = makeHost('/admin/access');
    render(<ReferenceReportsModule path="/admin/access" host={host} />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/?denied=1'), LONG);
  });

  it('renders admin pages for an administrator', async () => {
    const { host } = makeHost('/admin/access', { user: admin });
    render(<ReferenceReportsModule path="/admin/access" host={host} />);
    expect(await screen.findByRole('heading', { name: 'Roles and access' }, LONG)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finance manager/ })).toBeInTheDocument();
  });

  it('represents sign-in as a host boundary without a password form', async () => {
    const { host } = makeHost('/login');
    render(<ReferenceReportsModule path="/login" host={host} />);
    expect(await screen.findByText('Every report your role allows, from one place.', {}, LONG)).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(await screen.findByText(/Aisha Rahman/, {}, LONG)).toBeInTheDocument();
  });

  it('shows not found for unknown module paths', async () => {
    const { host } = makeHost('/nowhere');
    render(<ReferenceReportsModule path="/nowhere" host={host} />);
    expect(await screen.findByText('This page does not exist or you cannot open it')).toBeInTheDocument();
  });

  it('discards a response from a previous scope after the branch changes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const first = makeHost('/reports', { delay: (p) => (p === '/api/page/reports' ? gate : Promise.resolve()) });
    const view = render(<ReferenceReportsModule path="/reports" host={first.host} />);
    const second = makeHost('/reports', { branchId: 'sharjah' });
    await act(async () => { await store.handle(finance, { applicationId: 'nexora', branchId: 'sharjah' }, { method: 'POST', path: '/api/favorites', body: { reportId: 'payer-mix' } }); });
    view.rerender(<ReferenceReportsModule path="/reports" host={second.host} />);
    await screen.findByRole('heading', { name: 'Report library' }, LONG);
    await act(async () => { release(); await gate; });
    // Sharjah partition has payer-mix starred; the stale Dubai response (no favorite) must not replace it.
    const star = await screen.findByRole('button', { name: 'Remove Payer mix from favorites' }, LONG);
    expect(star).toHaveAttribute('aria-pressed', 'true');
  });

  it('binds the module search shortcut only while keyboard shortcuts are enabled', async () => {
    const off = makeHost('/reports', { preferences: { keyboardShortcuts: false } });
    const view = render(<ReferenceReportsModule path="/reports" host={off.host} />);
    await screen.findByRole('heading', { name: 'Report library' }, LONG);
    fireEvent.keyDown(window, { code: 'KeyK', key: 'K', ctrlKey: true, shiftKey: true });
    expect(screen.queryByRole('dialog', { name: 'Find a report or page' })).not.toBeInTheDocument();
    const on = makeHost('/reports', { preferences: { keyboardShortcuts: true } });
    view.rerender(<ReferenceReportsModule path="/reports" host={{ ...off.host, preferences: on.host.preferences }} />);
    fireEvent.keyDown(window, { code: 'KeyK', key: 'K', ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole('dialog', { name: 'Find a report or page' })).toBeInTheDocument();
  });

  it('queues a background job and shows it in My reports', async () => {
    const { host } = makeHost('/jobs');
    await store.handle(finance, { applicationId: 'nexora', branchId: 'dubai' }, { method: 'POST', path: '/api/jobs', body: { reportId: 'payer-mix', format: 'csv', deliver: 'download' } });
    render(<ReferenceReportsModule path="/jobs" host={host} />);
    expect(await screen.findByRole('link', { name: 'Payer mix' }, LONG)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Download' }, LONG)).toBeEnabled();
  });
  it('downloads an authenticated signed result through the host and keeps failures inline',async()=>{
    const scope={applicationId:'nexora',branchId:'dubai'};
    const result=store.handle(admin,scope,{method:'POST',path:'/api/jobs',body:{reportId:'admissions-register',format:'csv',deliver:'email',recipients:[]}}).body as {id:string};
    store.handle(admin,scope,{method:'GET',path:'/api/jobs/'+result.id});
    const outbox=store.handle(admin,scope,{method:'GET',path:'/api/page/admin/outbox'}).body as {mails:{jobId:string;text:string}[]};
    const token=outbox.mails.find(m=>m.jobId===result.id)!.text.match(/\/api\/downloads\/(\S+)/)![1];
    const setup=makeHost('/downloads/'+token,{user:admin});
    const download=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:result'),revokeObjectURL:vi.fn()}));
    const view=render(<ReferenceReportsModule path={'/downloads/'+token} host={setup.host}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Download'},LONG));
    await waitFor(()=>expect(download).toHaveBeenCalled());
    expect(setup.calls.some(c=>c.path==='/api/downloads/'+token)).toBe(true);
    const denied=makeHost('/downloads/'+token);
    view.rerender(<ReferenceReportsModule path={'/downloads/'+token} host={denied.host}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Download'},LONG));
    expect(await screen.findByRole('alert')).toHaveTextContent('This link was sent to someone else.');
    vi.unstubAllGlobals();
  });

});
