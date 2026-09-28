import { StrictMode } from 'react';
import { LocalizedText } from '@pepbits/ops-ui';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { DEFAULT_PREFERENCES } from '@pepbits/erp-config';
import { ReferenceHostProvider, type ReferenceHost } from '@pepbits/reference-host';
import { createEntityApi, listUrl, ReferenceScopeStore, useFetch, useRefOptions, useStoredState } from './lib/client';
import { createReferenceFormat } from './lib/format';
import { useManagedPreference } from './lib/preferences';
import { csvOf, exportFileName, xlsxOf } from './lib/export';
import { hydratePageDef, lookupsUrl, useProcessRunner, type LookupResponse } from './lib/api';
import { playProcessEvents, type RunLogLine, type StepState } from './lib/process';
import { optionsFromChildren, splitFieldClasses } from './components/ui';
import { ReadyPage } from './components/ReadyPage';
import type { PageDef } from './lib/types';

function hostFor(tenantId: string, request: ReferenceHost['request'], extra: Partial<ReferenceHost> = {}, moduleId = 'reference-erp1'): ReferenceHost {
  return { scope: { tenantId, applicationId: 'app', branchId: 'b1', userId: 'u1', roles: ['admin'], moduleId }, preferences: DEFAULT_PREFERENCES, request, navigate: () => {}, ...extra };
}
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
const scoped = (host: ReferenceHost) => ({ children }: { children: ReactNode }) => <ReferenceHostProvider host={host}><ReferenceScopeStore>{children}</ReferenceScopeStore></ReferenceHostProvider>;

const DEF: PageDef = {
  slug: 'leave-requests', section: 'transactions', group: 'People', title: 'Leave requests', description: '', icon: 'Plane', template: 'request', entity: 'leave-requests',
  fields: [{ key: 'type', label: 'Type', type: 'select', lookupKind: 'options' }, { key: 'item', label: 'Item', type: 'text', lookupKind: 'pool' }, { key: 'status', label: 'Status', type: 'status', options: ['Pending', 'Approved'] }],
  lines: { fields: [{ key: 'uom', label: 'Unit', type: 'select', lookupKind: 'options' }] },
  params: [{ key: 'branch', label: 'Branch', type: 'select', lookupKind: 'options' }],
  sections: [{ title: 'General', description: '', fields: [{ key: 'currency', label: 'Currency', type: 'select', lookupKind: 'options' }] }],
};
const LOOKUPS: LookupResponse = {
  fields: { type: ['Annual', 'Sick'], item: ['Widget'] }, lines: { uom: ['Box'] }, params: { branch: ['North'] }, sections: { currency: ['AED'] },
  resources: ['Room 1'], balances: [{ label: 'Annual', total: 21, used: 3 }], approvers: ['Approver A', 'Approver B'],
};

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
});

describe('reference-keystone-core API adapter', () => {
  it('keeps the source URL and payload contract on the supplied request', async () => {
    const request = vi.fn(async () => ({}) as never);
    const api = createEntityApi(request);
    const params = { q: 'a', page: 2, size: 20, sort: 'name', filters: { status: ['Active'] }, facet: 'status', asOf: '2026-09-01', period: '2026-09' };
    await api.list('customers', params);
    await api.get('customers', 'C 1', '2026-09');
    await api.create('customers', { name: 'N' });
    await api.update('customers', 'C1', { name: 'M' });
    await api.remove('customers', 'C1');
    const calls = request.mock.calls as unknown as [string, RequestInit | undefined][];
    expect(calls[0][0]).toBe(listUrl('customers', params));
    expect(calls[0][0]).toContain('dir=asc');
    expect(calls[1][0]).toBe('/api/entities/customers/C%201?period=2026-09');
    expect(calls[2][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ name: 'N' }) });
    expect(calls[3][1]?.method).toBe('PUT');
    expect(calls[4][1]?.method).toBe('DELETE');
  });
  it('does not share reference-dropdown caches between host scopes', async () => {
    function Probe() { const o = useRefOptions('customers'); return <span>{o.join(',')}</span>; }
    const a = vi.fn(async () => ({ rows: [{ id: '1', name: 'Tenant A' }] }) as never);
    const b = vi.fn(async () => ({ rows: [{ id: '2', name: 'Tenant B' }] }) as never);
    const view = (host: ReferenceHost) => <ReferenceHostProvider host={host}><ReferenceScopeStore><Probe /></ReferenceScopeStore></ReferenceHostProvider>;
    const { container, rerender } = render(view(hostFor('A', a)));
    await waitFor(() => expect(container.textContent).toBe('Tenant A'));
    rerender(view(hostFor('B', b)));
    // Not even one render of tenant A's options under tenant B.
    expect(container.textContent).not.toContain('Tenant A');
    await waitFor(() => expect(container.textContent).toBe('Tenant B'));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
describe('reference-keystone-core scope isolation', () => {
  it('useFetch never returns data for a changed or null url', async () => {
    const request = vi.fn(async (path: string) => ({ path }) as never);
    const host = hostFor('A', request);
    const wrapper = ({ children }: { children: ReactNode }) => <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>;
    const { result, rerender } = renderHook(({ url }: { url: string | null }) => useFetch<{ path: string }>(url), { wrapper, initialProps: { url: '/api/one' as string | null } });
    await waitFor(() => expect(result.current.data).toEqual({ path: '/api/one' }));
    rerender({ url: '/api/two' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    rerender({ url: null });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

});
describe('reference-keystone-core managed preferences', () => {
  const policyHost = (rules: Record<string, unknown>, onPreferenceChange?: (...a: unknown[]) => void) => hostFor('A', vi.fn(), {
    preferences: { ...DEFAULT_PREFERENCES, pageSize: 20 },
    preferenceHost: { preferences: { ...DEFAULT_PREFERENCES, pageSize: 20 }, preferencePolicy: { revision: 1, rules: rules as never }, onPreferenceChange: onPreferenceChange as never },
  });
  it('is unavailable without the central update path', () => {
    const host = hostFor('A', vi.fn());
    const { result } = renderHook(() => useManagedPreference('pageSize'), { wrapper: ({ children }) => <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider> });
    expect(result.current.disabled).toBe(true);
    expect(result.current.set(50)).toBe(false);
  });
  it('refuses disallowed values and replaces them when allowed values change', () => {
    const change = vi.fn();
    let host = policyHost({ pageSize: { value: 20, locked: false, allowedValues: [20, 50] } }, change);
    const wrapper = ({ children }: { children: ReactNode }) => <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>;
    const { result, rerender } = renderHook(() => useManagedPreference('pageSize'), { wrapper });
    expect(result.current.set(100)).toBe(false);
    act(() => { expect(result.current.set(50)).toBe(true); });
    expect(change).toHaveBeenCalledWith('pageSize', 50);
    expect(result.current.value).toBe(50);
    host = policyHost({ pageSize: { value: 20, locked: false, allowedValues: [10, 20] } }, change);
    rerender();
    expect(result.current.value).toBe(20);
    host = policyHost({ pageSize: { value: 20, locked: true } }, change);
    rerender();
    expect(result.current.disabled).toBe(true);
    expect(result.current.set(10)).toBe(false);
  });
});
describe('reference-keystone-core export', () => {
  it('writes formula-safe CSV and typed xlsx cells in the host format', () => {
    expect(csvOf(['Name', 'Amount'], [['=cmd()', -1500.25], ['a,b', 3]])).toBe("Name,Amount\r\n'=cmd(),-1500.25\r\n\"a,b\",3");
    const book = XLSX.read(xlsxOf(['Name', 'Amount'], [['=cmd()', 12.5]], 'customers'), { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    expect(sheet.A2.t).toBe('s');
    expect(sheet.A2.v).toBe('=cmd()');
    expect(sheet.B2.t).toBe('n');
    expect(exportFileName('customers.csv', 'xlsx')).toBe('customers.xlsx');
    expect(exportFileName('customers.csv', 'csv')).toBe('customers.csv');
  });
});
describe('reference-keystone-core adapters', () => {
  it('formats with host preferences instead of the fixed source locale', () => {
    const aed = createReferenceFormat({ ...DEFAULT_PREFERENCES, currencyCode: 'AED', numberLocale: 'en-US', decimalPlaces: 2 });
    expect(aed.fmtCurrency(1200)).toContain('1,200.00');
    expect(aed.fmtCurrency('x')).toBe('—');
    expect(aed.fmtDate('')).toBe('—');
  });
  it('applies currency display, negative style, date format and time format everywhere', () => {
    const f = createReferenceFormat({ ...DEFAULT_PREFERENCES, currencyCode: 'USD', numberLocale: 'en-US', currencyDisplay: 'code', negativeStyle: 'parentheses', dateFormat: 'dmy', timeFormat: '24h' });
    expect(f.fmtCompact(-1_500_000)).toMatch(/^\(USD\s?1\.5M\)$/);
    expect(createReferenceFormat({ ...DEFAULT_PREFERENCES, currencyDisplay: 'none', negativeStyle: 'parentheses', numberLocale: 'en-US' }).fmtCompact(-2500)).toBe('(2.5K)');
    expect(f.fmtDate('2026-09-28')).toBe('28/09/2026');
    expect(f.fmtDate('2026-09-28', false)).toBe('28/09');
    expect(createReferenceFormat({ ...DEFAULT_PREFERENCES, dateFormat: 'iso' }).fmtDate('2026-09-28', false)).toBe('09-28');
    expect(f.fmtValue({ key: 't', label: 'T', type: 'time' }, '14:30')).toBe('14:30');
    expect(createReferenceFormat({ ...DEFAULT_PREFERENCES, timeFormat: '12h', language: 'en' }).fmtTime('14:30')).toBe('2:30 PM');
  });
  it('uses the effective form font scale for source control sizes', () => {
    expect(splitFieldClasses('text-[length:calc(12.5px*var(--fs-scale))]').style.fontSize).toBe('calc(12.5px * var(--fs-form))');
  });
  it('bridges source <option> children to shared select options', () => {
    const { options, placeholder } = optionsFromChildren(<><option value="">All</option>{['A', 'B'].map((x) => <option key={x} value={x}>{x} label</option>)}<option>Plain</option></>);
    expect(optionsFromChildren(<option value="stable-id"><LocalizedText message="Annual" /></option>).options).toEqual([{ value: 'stable-id', label: 'Annual' }]);
    expect(placeholder).toBe('All');
    expect(options).toEqual([{ value: 'A', label: 'A label' }, { value: 'B', label: 'B label' }, { value: 'Plain', label: 'Plain' }]);
  });
});

describe('keystone-core server metadata', () => {
  it('hydrates options, pools, line/param/section fields and page extras from lookups', () => {
    const def = hydratePageDef(DEF, LOOKUPS);
    expect(def.fields[0].options).toEqual(['Annual', 'Sick']);
    expect(def.fields[1].pool).toEqual(['Widget']);
    expect(def.fields[2].options).toEqual(['Pending', 'Approved']);
    expect(def.lines?.fields[0].options).toEqual(['Box']);
    expect(def.params?.[0].options).toEqual(['North']);
    expect(def.sections?.[0].fields[0].options).toEqual(['AED']);
    expect(def.resources).toEqual(['Room 1']);
    expect(def.balances?.[0].total).toBe(21);
    expect(def.approvers).toEqual(['Approver A', 'Approver B']);
    expect(lookupsUrl(DEF)).toBe('/api/lookups?entity=leave-requests&page=transactions%2Fleave-requests');
  });
  it('rejects omitted lookup values instead of supplying invented lists', () => {
    expect(() => hydratePageDef(DEF, { ...LOOKUPS, fields: {} })).toThrow(/Missing or invalid lookup/);
    expect(hydratePageDef(DEF, { ...LOOKUPS, fields: { ...LOOKUPS.fields, type: [] } })).toBeTruthy();
  });
  it('honors disabled loading skeletons with accessible loading text', async () => {
    const pending = deferred<LookupResponse>();
    render(<ReadyPage def={DEF}>{() => <span>ready</span>}</ReadyPage>, { wrapper: scoped(hostFor('A', () => pending.promise as never, { preferences: { ...DEFAULT_PREFERENCES, loadingSkeletons: false } })) });
    expect(screen.getByRole('status').textContent).toContain('Loading field values');
    expect(screen.queryByText('ready')).toBeNull();
    await act(async () => { pending.resolve(LOOKUPS); await pending.promise; });
    expect(await screen.findByText('ready')).toBeTruthy();
  });
  it('ReadyPage shows a skeleton, then a retryable error, and renders only the hydrated definition', async () => {
    let attempt = 0;
    const first = deferred<unknown>();
    const request = vi.fn((path: string) => { attempt += 1; return (attempt === 1 ? first.promise : Promise.resolve(LOOKUPS)) as never; });
    const seen: PageDef[] = [];
    render(<ReadyPage def={DEF}>{(d) => { seen.push(d); return <span>ready {d.fields[0].options?.join(',')}</span>; }}</ReadyPage>, { wrapper: scoped(hostFor('A', request)) });
    expect(screen.queryByText(/ready/)).toBeNull();
    await act(async () => { first.reject(new Error('lookup outage')); await first.promise.catch(() => {}); });
    expect(await screen.findByText(/lookup outage/)).toBeTruthy();
    expect(seen).toHaveLength(0);
    act(() => { screen.getByRole('button', { name: /try again|retry/i }).click(); });
    expect(await screen.findByText('ready Annual,Sick')).toBeTruthy();
    expect(request.mock.calls.every(([p]) => String(p).startsWith('/api/lookups?'))).toBe(true);
    expect(seen.every((d) => d.fields[0].options?.length === 2)).toBe(true);
  });
});

describe('keystone-core view state', () => {
  it('only GETs on mount, keeps a user change over a late GET, and PUTs the change', async () => {
    const get = deferred<unknown>();
    const calls: [string, RequestInit | undefined][] = [];
    const request = vi.fn((path: string, init?: RequestInit) => { calls.push([path, init]); return (init?.method === 'PUT' ? Promise.resolve(JSON.parse(String(init.body))) : get.promise) as never; });
    const { result } = renderHook(() => useStoredState<string[]>('keystone.cols.customers', ['a'], { persist: true }), { wrapper: scoped(hostFor('A', request)) });
    expect(calls.map(([p, i]) => `${i?.method ?? 'GET'} ${p}`)).toEqual(['GET /api/view-state?key=keystone.cols.customers']);
    expect(result.current[2].status).toBe('loading');
    act(() => result.current[1](['user']));
    await act(async () => { get.resolve({ key: 'keystone.cols.customers', value: ['server'] }); await get.promise; });
    expect(result.current[0]).toEqual(['user']);
    await waitFor(() => expect(result.current[2].status).toBe('idle'));
    const puts = calls.filter(([, i]) => i?.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(JSON.parse(String(puts[0][1]?.body))).toEqual({ key: 'keystone.cols.customers', value: ['user'] });
  });
  it('settles hydration after StrictMode cancels its first effect', async () => {
    const request = vi.fn(async () => ({ key: 'k', value: ['server'] }) as never);
    const Scope = scoped(hostFor('A', request));
    const { result } = renderHook(() => useStoredState<string[]>('k', [], { persist: true }), { wrapper: ({ children }) => <StrictMode><Scope>{children}</Scope></StrictMode> });
    await waitFor(() => expect(result.current[2].status).toBe('idle'));
    expect(result.current[0]).toEqual(['server']);
  });
  it('applies the server value when the user has not changed it, and never PUTs without a change', async () => {
    const request = vi.fn(async (_p: string, init?: RequestInit) => (init?.method === 'PUT' ? {} : { key: 'k', value: ['server'] }) as never);
    const { result } = renderHook(() => useStoredState<string[]>('k', ['default'], { persist: true }), { wrapper: scoped(hostFor('A', request)) });
    await waitFor(() => expect(result.current[0]).toEqual(['server']));
    expect(request.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });
  it('keeps the value and exposes retry when saving fails', async () => {
    let fail = true;
    const request = vi.fn(async (_p: string, init?: RequestInit) => { if (init?.method === 'PUT') { if (fail) throw new Error('save refused'); return {}; } return { key: 'k', value: null }; });
    const { result } = renderHook(() => useStoredState<string[]>('k', [], { persist: true }), { wrapper: scoped(hostFor('A', request as never)) });
    await waitFor(() => expect(result.current[2].status).toBe('idle'));
    act(() => result.current[1](['x']));
    await waitFor(() => expect(result.current[2].status).toBe('error'));
    expect(result.current[0]).toEqual(['x']);
    expect(result.current[2].error).toBe('save refused');
    fail = false;
    act(() => result.current[2].retry());
    await waitFor(() => expect(result.current[2].status).toBe('idle'));
  });
  it('isolates stored state per tenant and per ERP variant (moduleId)', async () => {
    const request = vi.fn(async (_p: string, init?: RequestInit) => (init?.method === 'PUT' ? {} : { key: 'k', value: null }) as never);
    const a = renderHook(() => useStoredState<string[]>('k', []), { wrapper: scoped(hostFor('A', request, {}, 'reference-erp1')) });
    act(() => a.result.current[1](['tenant A erp1']));
    const otherTenant = renderHook(() => useStoredState<string[]>('k', []), { wrapper: scoped(hostFor('B', request, {}, 'reference-erp1')) });
    const otherVariant = renderHook(() => useStoredState<string[]>('k', []), { wrapper: scoped(hostFor('A', request, {}, 'reference-erp2')) });
    expect(otherTenant.result.current[0]).toEqual([]);
    expect(otherVariant.result.current[0]).toEqual([]);
    expect(request).not.toHaveBeenCalled(); // not persisted unless asked
  });
});

describe('keystone-core process runs', () => {
  it('posts the page parameters and uses only the server row and events', async () => {
    const response = { row: { id: 'r1', code: 'PR-9', gross: 1234 }, events: [{ time: '09:00:01', text: 'Loaded', tone: 'info' as const, step: 0, progress: 100 }, { time: '09:00:02', text: 'Review', tone: 'warn' as const, step: 1 }] };
    const request = vi.fn(async () => response as never);
    const { result } = renderHook(() => useProcessRunner('payroll-run'), { wrapper: scoped(hostFor('A', request)) });
    const out = await result.current({ period: 'September 2026', branch: 'North' });
    expect(request).toHaveBeenCalledWith('/api/processes/payroll-run/run', expect.objectContaining({ method: 'POST', body: JSON.stringify({ period: 'September 2026', branch: 'North' }) }));
    expect(out.row).toBe(response.row);
    vi.useFakeTimers();
    let states: StepState[] = ['idle', 'idle', 'idle'];
    let log: RunLogLine[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const took = playProcessEvents(out.events, 3, { setStates: (u) => { states = typeof u === 'function' ? u(states) : u; }, setLog: (u) => { log = typeof u === 'function' ? u(log) : u; }, timers });
    vi.advanceTimersByTime(took);
    vi.useRealTimers();
    expect(states).toEqual(['done', 'warn', 'idle']);
    expect(log.map((l) => l.text)).toEqual(['Loaded', 'Review']);
    expect(log[1].warn).toBe(true);
  });
});
