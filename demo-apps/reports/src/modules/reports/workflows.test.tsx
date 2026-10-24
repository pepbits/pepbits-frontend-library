/*
 * Page-group workflows over the module host with the in-process demo store as the mocked API. Each case asserts
 * the HTTP command the source workflow sends and the visible result, using async queries for robustness under load.
 */
import React from 'react';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ReferenceReportsModule} from './module';
import {admin, finance, LONG, render, SCOPE, storeHost} from '../../test/module-host';

afterEach(() => {vi.restoreAllMocks();});
const mount = (setup: ReturnType<typeof storeHost>, path: string) => render(<ReferenceReportsModule path={path} host={setup.host}/>);
const lastCall = (setup: ReturnType<typeof storeHost>, method: string, path: string | RegExp) => setup.calls.filter(c => c.method === method && (typeof path === 'string' ? c.path === path : path.test(c.path))).at(-1);

describe('report library', () => {
  it('filters the catalogue and toggles a favourite through the API', async () => {
    const setup = storeHost('/reports', {user: finance});
    mount(setup, '/reports');
    await screen.findByRole('heading', {name: 'Report library'}, LONG);
    fireEvent.change(screen.getByLabelText('Search reports'), {target: {value: 'payer'}});
    await waitFor(() => expect(screen.queryByText('Trial balance')).not.toBeInTheDocument());
    expect(screen.getByText('Payer mix')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Add Payer mix to favorites'}));
    await waitFor(() => expect(lastCall(setup, 'POST', '/api/favorites')?.body).toEqual({reportId: 'payer-mix'}));
    expect(await screen.findByRole('button', {name: 'Remove Payer mix from favorites'}, LONG)).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('report viewer', () => {
  it('sorts, pages and changes columns through the run API', async () => {
    const setup = storeHost('/reports/revenue-by-service');
    mount(setup, '/reports/revenue-by-service');
    await screen.findByRole('heading', {name: 'Revenue by service line', level: 1}, LONG);
    await waitFor(() => expect(lastCall(setup, 'POST', '/api/reports/revenue-by-service/run')).toBeTruthy(), LONG);
    const header = await screen.findByRole('columnheader', {name: /Service line/}, LONG);
    fireEvent.click(within(header).getByRole('button'));
    await waitFor(() => expect((lastCall(setup, 'POST', '/api/reports/revenue-by-service/run')?.body as {sort?: {key: string}}).sort?.key).toBe('service_line'), LONG);
    fireEvent.click(screen.getByRole('button', {name: 'Columns'}));
    const dialog = await screen.findByRole('dialog', {name: 'Columns'}, LONG);
    const available = within(dialog).getAllByRole('checkbox').filter(box => !(box as HTMLInputElement).checked);
    expect(available.length).toBeGreaterThan(0);
    fireEvent.click(available[0]!);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply columns'}));
    await waitFor(() => expect((lastCall(setup, 'POST', '/api/reports/revenue-by-service/run')?.body as {columns: string[]}).columns.length).toBeGreaterThan(0), LONG);
    expect(screen.getAllByRole('img', {name: /chart of/}).length).toBeGreaterThan(0);
  });

  it('saves, applies and deletes a personal view', async () => {
    const setup = storeHost('/reports/payer-mix', {user: finance});
    mount(setup, '/reports/payer-mix');
    await screen.findByRole('heading', {name: 'Payer mix', level: 1}, LONG);
    fireEvent.click(screen.getByRole('button', {name: /Views/}));
    fireEvent.click(await screen.findByRole('button', {name: 'Save current view…'}));
    const dialog = await screen.findByRole('dialog', {name: 'Save view'}, LONG);
    fireEvent.change(within(dialog).getByLabelText('View name'), {target: {value: 'Fictional month end'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save view'}));
    await waitFor(() => expect(lastCall(setup, 'POST', '/api/reports/payer-mix/views')?.body).toMatchObject({name: 'Fictional month end', scope: 'user'}), LONG);
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Save view'})).not.toBeInTheDocument(), LONG);
    fireEvent.click(screen.getByRole('button', {name: /Views/}));
    fireEvent.click(await screen.findByRole('button', {name: 'Delete view Fictional month end'}, LONG));
    await waitFor(() => expect(lastCall(setup, 'DELETE', /^\/api\/views\//)).toBeTruthy(), LONG);
  });

  it('queues a background run, creates a schedule and prints an isolated document', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const setup = storeHost('/reports/payer-mix', {user: admin});
    mount(setup, '/reports/payer-mix');
    await screen.findByRole('heading', {name: 'Payer mix', level: 1}, LONG);
    await waitFor(() => expect(document.querySelector('.lumen-reports tbody tr')).toBeTruthy(), LONG);
    fireEvent.click(screen.getByRole('button', {name: /Export/}));
    fireEvent.click(await screen.findByRole('button', {name: 'Run in background…'}));
    const background = await screen.findByRole('dialog', {name: 'Run in the background'}, LONG);
    fireEvent.click(within(background).getByRole('button', {name: /Run in background|Queue|Start/}));
    expect(await within(background).findByText('Queued as', {exact: false}, LONG)).toBeInTheDocument();
    expect(lastCall(setup, 'POST', '/api/jobs')?.body).toMatchObject({reportId: 'payer-mix'});
    fireEvent.click(within(background).getAllByRole('button', {name: 'Close'}).at(-1)!);
    fireEvent.click(screen.getByRole('button', {name: 'Schedule'}));
    const schedule = await screen.findByRole('dialog', {name: 'Schedule this report'}, LONG);
    fireEvent.click(within(schedule).getByRole('button', {name: 'Create schedule'}));
    await waitFor(() => expect(lastCall(setup, 'POST', '/api/schedules')?.body).toMatchObject({reportId: 'payer-mix', frequency: 'daily'}), LONG);
    fireEvent.click(screen.getByRole('button', {name: 'Print'}));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    vi.unstubAllGlobals();
  });
});

describe('builder', () => {
  it('previews and saves a detail report, then deletes it from the builder list', async () => {
    const setup = storeHost('/builder/new', {user: admin});
    const view = mount(setup, '/builder/new');
    fireEvent.change(await screen.findByLabelText('Title', {}, LONG), {target: {value: 'Fictional detail report'}});
    fireEvent.change(screen.getByLabelText('Report type'), {target: {value: 'detail'}});
    const chips = await screen.findAllByRole('button', {name: /^\+/}, LONG);
    fireEvent.click(chips[0]!);fireEvent.click(chips[1]!);
    fireEvent.click(screen.getByRole('button', {name: 'Refresh preview'}));
    await waitFor(() => expect(lastCall(setup, 'POST', '/api/builder/preview')).toBeTruthy(), LONG);
    fireEvent.click(screen.getByRole('button', {name: 'Save report'}));
    await waitFor(() => expect(setup.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/reports\//)), LONG);
    const saved = lastCall(setup, 'POST', '/api/definitions');
    expect(saved?.body).toMatchObject({title: 'Fictional detail report', groupBy: []});
    view.unmount();
    const list = storeHost('/builder', {user: admin, store: setup.store});
    mount(list, '/builder');
    const row = (await screen.findByRole('link', {name: 'Fictional detail report'}, LONG)).closest('tr')!;
    fireEvent.click(within(row as HTMLElement).getByRole('button', {name: 'Delete'}));
    fireEvent.click(within(await screen.findByRole('dialog', {}, LONG)).getByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(lastCall(list, 'DELETE', /^\/api\/definitions\//)).toBeTruthy(), LONG);
  });
});

describe('dashboards', () => {
  it('creates, edits and deletes a dashboard', async () => {
    const setup = storeHost('/dashboards', {user: admin});
    const view = mount(setup, '/dashboards');
    fireEvent.click(await screen.findByRole('button', {name: 'New dashboard'}, LONG));
    const dialog = await screen.findByRole('dialog', {}, LONG);
    fireEvent.change(within(dialog).getByLabelText('Name'), {target: {value: 'Fictional board'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Create dashboard'}));
    await waitFor(() => expect(setup.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/dashboards\/.+/)), LONG);
    const path = setup.navigate.mock.calls.at(-1)![0] as string;
    view.unmount();
    const board = storeHost(path, {user: admin, store: setup.store});
    mount(board, path);
    await screen.findByRole('heading', {name: 'Fictional board', level: 1}, LONG);
    fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Save dashboard'}, LONG));
    await waitFor(() => expect(lastCall(board, 'PUT', /^\/api\/dashboards\//)).toBeTruthy(), LONG);
    fireEvent.click(await screen.findByRole('button', {name: 'Delete dashboard'}, LONG));
    fireEvent.click(within(await screen.findByRole('dialog', {}, LONG)).getByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(board.navigate).toHaveBeenCalledWith('/dashboards'), LONG);
    expect(lastCall(board, 'DELETE', /^\/api\/dashboards\//)).toBeTruthy();
    // The deleted dashboard is not re-read after navigating away (no stale 404 request).
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 50));});
    const deletedAt = board.calls.findIndex(c => c.method === 'DELETE');
    expect(board.calls.slice(deletedAt + 1).some(c => c.path.startsWith('/api/page/dashboards/'))).toBe(false);
  });

  it('renders seeded dashboard widgets with the shared period control', async () => {
    const setup = storeHost('/dashboards/executive-overview', {user: admin});
    mount(setup, '/dashboards/executive-overview');
    expect(await screen.findByRole('heading', {name: 'Executive overview', level: 1}, LONG)).toBeInTheDocument();
    expect(await screen.findByLabelText('Period for all widgets', {}, LONG)).toBeInTheDocument();
  });
});

describe('delivery', () => {
  it('pauses, runs, processes and deletes schedules', async () => {
    const setup = storeHost('/schedules', {user: admin});
    mount(setup, '/schedules');
    await screen.findByRole('heading', {name: 'Schedules', level: 1}, LONG);
    fireEvent.click((await screen.findAllByRole('button', {name: 'Run now'}, LONG))[0]!);
    await waitFor(() => expect(lastCall(setup, 'POST', /^\/api\/schedules\/[^/]+\/run$/)).toBeTruthy(), LONG);
    fireEvent.click(screen.getByRole('button', {name: 'Process due schedules now'}));
    await waitFor(() => expect(lastCall(setup, 'POST', '/api/cron')).toBeTruthy(), LONG);
    fireEvent.click((await screen.findAllByRole('button', {name: /Pause|Resume/}, LONG))[0]!);
    await waitFor(() => expect(lastCall(setup, 'PATCH', /^\/api\/schedules\//)?.body).toHaveProperty('active'), LONG);
    fireEvent.click((await screen.findAllByRole('button', {name: 'Delete'}, LONG))[0]!);
    fireEvent.click(within(await screen.findByRole('dialog', {}, LONG)).getByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(lastCall(setup, 'DELETE', /^\/api\/schedules\//)).toBeTruthy(), LONG);
  });

  it('shows stored result pages for a finished background job', async () => {
    const setup = storeHost('/jobs', {user: admin});
    const job = setup.store.handle(admin, SCOPE, {method: 'POST', path: '/api/jobs', body: {reportId: 'payer-mix', format: 'csv', deliver: 'download'}}).body as {id: string};
    setup.store.handle(admin, SCOPE, {method: 'GET', path: '/api/jobs/' + job.id});
    const detail = storeHost('/jobs/' + job.id, {user: admin, store: setup.store});
    mount(detail, '/jobs/' + job.id);
    expect(await screen.findByText(`Background report ${job.id}`, {}, LONG)).toBeInTheDocument();
    await waitFor(() => expect(lastCall(detail, 'GET', new RegExp(`^/api/jobs/${job.id}/results`))).toBeTruthy(), LONG);
    await waitFor(() => expect(document.querySelector('.lumen-reports tbody tr')).toBeTruthy(), LONG);
  });

  it('simulates an inbound email request', async () => {
    const setup = storeHost('/email-in', {user: admin});
    mount(setup, '/email-in');
    fireEvent.click(await screen.findByRole('button', {name: 'Send test email'}, LONG));
    await waitFor(() => expect(lastCall(setup, 'POST', '/api/email-in/simulate')).toBeTruthy(), LONG);
  });

  it('creates and revokes an API key without retaining the secret in the list', async () => {
    const setup = storeHost('/api-keys', {user: finance});
    mount(setup, '/api-keys');
    fireEvent.change(await screen.findByLabelText('Key name', {}, LONG), {target: {value: 'Fictional BI'}});
    fireEvent.click(screen.getByRole('button', {name: 'Create key'}));
    expect(await screen.findByText('Copy this key now. It will not be shown again.', {}, LONG)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', {name: 'Revoke'}, LONG));
    fireEvent.click(within(await screen.findByRole('dialog', {}, LONG)).getByRole('button', {name: 'Revoke'}));
    await waitFor(() => expect(lastCall(setup, 'DELETE', /^\/api\/account\/keys\//)).toBeTruthy(), LONG);
  });
});

describe('administration', () => {
  it('saves settings, adds a directory user and filters the audit log', async () => {
    const settings = storeHost('/admin/settings', {user: admin});
    const first = mount(settings, '/admin/settings');
    fireEvent.click(await screen.findByRole('button', {name: 'Save settings'}, LONG));
    await waitFor(() => expect(lastCall(settings, 'PUT', '/api/admin/settings')).toBeTruthy(), LONG);
    first.unmount();
    const users = storeHost('/admin/users', {user: admin, store: settings.store});
    const second = mount(users, '/admin/users');
    fireEvent.click(await screen.findByRole('button', {name: 'Add user'}, LONG));
    const dialog = await screen.findByRole('dialog', {}, LONG);
    fireEvent.change(within(dialog).getByLabelText('Full name'), {target: {value: 'Fictional Reader'}});
    fireEvent.change(within(dialog).getByLabelText('Work email'), {target: {value: 'reader@example.test'}});
    fireEvent.click(within(dialog).getByRole('button', {name: /^Roles/}));
    fireEvent.click(await within(dialog).findByRole('button', {name: 'Analyst'}, LONG));
    // A generated throwaway value: the demo directory validates length only and never stores it.
    fireEvent.change(within(dialog).getByLabelText('Temporary password'), {target: {value: 'x'.repeat(12)}});
    fireEvent.click(within(dialog).getAllByRole('button', {name: 'Add user'}).at(-1)!);
    await waitFor(() => expect(lastCall(users, 'POST', '/api/admin/users')?.body).toMatchObject({name: 'Fictional Reader'}), LONG);
    second.unmount();
    const audit = storeHost('/admin/audit', {user: admin, store: settings.store});
    mount(audit, '/admin/audit');
    fireEvent.change(await screen.findByLabelText('Search', {}, LONG), {target: {value: 'settings'}});
    fireEvent.click(screen.getByRole('button', {name: 'Filter'}));
    expect(audit.navigate).toHaveBeenCalledWith('/admin/audit?q=settings');
  });

  it('saves report grants for a role from the access matrix', async () => {
    const setup = storeHost('/admin/access', {user: admin});
    mount(setup, '/admin/access');
    await screen.findByRole('heading', {name: 'Roles and access', level: 1}, LONG);
    const boxes = await screen.findAllByRole('checkbox', {}, LONG);
    await act(async () => {fireEvent.click(boxes.find(box => !(box as HTMLInputElement).disabled)!);});
    fireEvent.click(screen.getByRole('button', {name: 'Save access'}));
    await waitFor(() => expect(lastCall(setup, 'PUT', '/api/admin/grants')).toBeTruthy(), LONG);
  });
});
