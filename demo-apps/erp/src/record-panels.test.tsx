import {useState} from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES, type UserPreferences} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {TestHostProvider, type TestHostValue} from './test/host';
import {mockApi} from './test/mock-api';
import {PAGES} from './modules/keystone/catalog';
import {ReadyPage} from './modules/keystone/ReadyPage';
import {EntityAccess} from './modules/keystone/access';
import {RecordEditor} from './modules/keystone/record';
import {hierarchyPath, RecordSupport} from './modules/keystone/record-panels';
import {pageId, type ErpTarget, type Variant} from './navigation';

function hostFor(request: JsonRequest, variant: Variant = 'erp2'): TestHostValue {
  return {scope: {tenantId: 'fictional', applicationId: 'nexora', branchId: 'head-office', userId: 'fixture', roles: ['admin'], moduleId: variant}, preferences: DEFAULT_PREFERENCES, request, navigate: vi.fn()};
}
function Record({slug, id, host, mode = 'view', close = vi.fn()}: {slug: string; id: string; host: TestHostValue; mode?: 'view' | 'edit'; close?: () => void}) {
  const def = PAGES.find(page => page.slug === slug)!, variant = host.scope.moduleId as Variant;
  const [target, setTarget] = useState<ErpTarget>({pageId: pageId(variant, def), recordId: id, mode});
  return <TestHostProvider host={host}><main dir={host.preferences.language === 'ar' ? 'rtl' : 'ltr'}><ReadyPage def={def}>{ready => <EntityAccess entity={def.entity}><RecordEditor def={ready} target={target} onOpen={setTarget} onClose={close} onSaved={row => setTarget({pageId: target.pageId, recordId: row.id, mode: 'view'})}/></EntityAccess>}</ReadyPage></main></TestHostProvider>;
}
const support = {activities: [{when: '2026-10-24T09:00:00Z', who: 'Fictional operator', text: 'Record reviewed'}], documents: [{name: 'Fictional terms.pdf', size: '12 KB', when: '2026-10-23'}], processEvents: [{time: '09:00', text: 'Fictional run completed', tone: 'ok', step: 0, progress: 100}]};

test.each(['erp1', 'erp2'] as const)('%s keeps unsent case inputs across other acknowledged property saves', async variant => {
  const api = mockApi(), slug = 'support-tickets', row = api.rows.get(slug)![0]!;row.version = 1;
  const request = vi.fn<JsonRequest>(async <T,>(path: string, init?: RequestInit) => {
    if (init?.method !== 'PUT') return api.request<T>(path, init);
    const previous = Number(api.rows.get(slug)!.find(item => item.id === row.id)!.version);
    const saved = await api.request<Record<string, unknown>>(path, init);saved.version = previous + 1;api.rows.get(slug)!.find(item => item.id === row.id)!.version = previous + 1;return structuredClone(saved) as T;
  });
  const {container} = render(<Record slug={slug} id={row.id} host={hostFor(request as JsonRequest, variant)}/>);
  const reply = await screen.findByRole('textbox', {name: 'Add an update or reply'});
  fireEvent.change(reply, {target: {value: 'Fictional unsent reply'}});
  fireEvent.change(screen.getByRole('textbox', {name: 'Assignee'}), {target: {value: 'Fictional pending assignee'}});
  const priority = screen.getByRole('combobox', {name: 'Priority'}) as HTMLSelectElement;
  const next = [...priority.options].find(option => option.value && option.value !== priority.value)!.value;
  fireEvent.change(priority, {target: {value: next}});
  await waitFor(() => {
    expect(container.querySelector('[data-erp-record]')).toHaveAttribute('data-erp-record-version', '2');
    expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });
  expect(screen.getByRole('textbox', {name: 'Add an update or reply'})).toHaveValue('Fictional unsent reply');
  expect(screen.getByRole('textbox', {name: 'Assignee'})).toHaveValue('Fictional pending assignee');
  fireEvent.click(screen.getByRole('button', {name: 'Post update'}));
  await waitFor(() => expect(container.querySelector('[data-erp-record]')).toHaveAttribute('data-erp-record-version', '3'));
  await waitFor(() => expect(screen.getByRole('textbox', {name: 'Add an update or reply'})).toHaveValue(''));
  expect(screen.getByRole('textbox', {name: 'Assignee'})).toHaveValue('Fictional pending assignee');
  fireEvent.click(screen.getByRole('button', {name: 'Save assignee'}));
  await waitFor(() => expect(container.querySelector('[data-erp-record]')).toHaveAttribute('data-erp-record-version', '4'));
  await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => JSON.parse(String(init!.body)).expectedVersion)).toEqual([1, 2, 3]));
  expect(api.rows.get(slug)!.find(item => item.id === row.id)!.assignee).toBe('Fictional pending assignee');
});

test.each(['erp1', 'erp2'] as const)('%s profile shows source groups, statistics, activity/documents and changes', async variant => {
  const api = mockApi(), row = api.rows.get('customers')![0]!, request: JsonRequest = async (path, init) => path.includes('/support') ? structuredClone(support) as never : api.request(path, init);
  const {container} = render(<Record slug="customers" id={row.id} host={hostFor(request as JsonRequest, variant)}/>);
  expect(await screen.findByText('Record reviewed')).toBeVisible();expect(screen.getByText('Fictional terms.pdf')).toBeVisible();
  expect(container.querySelector('[data-profile-summary]')).toHaveTextContent('Credit limit');
  fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
  fireEvent.change(await screen.findByRole('textbox', {name: 'Customer'}), {target: {value: 'Fictional changed customer'}});
  expect(await screen.findByRole('heading', {name: 'Changes'})).toBeVisible();expect(container.querySelector('[data-record-aside]')).toHaveTextContent('Fictional changed customer');
});

test('support distinguishes failure, retry, empty and version refresh', async () => {
  let fail = true;const request = vi.fn<JsonRequest>(async () => {if (fail) throw new Error('Offline');return {activities: [], documents: []} as never;});
  const host = hostFor(request as JsonRequest), view = render(<TestHostProvider host={host}><RecordSupport entity="customers" id="one" revision={1} kind="documents"/></TestHostProvider>);
  fireEvent.click(await screen.findByRole('button', {name: 'Retry'}));await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  fail = false;fireEvent.click(await screen.findByRole('button', {name: 'Retry'}));expect(await screen.findByText('No documents are stored for this record.')).toBeVisible();
  view.rerender(<TestHostProvider host={host}><RecordSupport entity="customers" id="one" revision={2} kind="activity"/></TestHostProvider>);
  expect(await screen.findByText('No activity recorded for this record yet.')).toBeVisible();await waitFor(() => expect(request.mock.calls.some(([path]) => path.endsWith('revision=2'))).toBe(true));
});

test('profile file selection stays local and can be removed without an HTTP write', async () => {
  const api = mockApi(), request = vi.fn(api.request), row = api.rows.get('customers')![0]!;
  const {container} = render(<Record slug="customers" id={row.id} host={hostFor(request as JsonRequest)}/>);
  await screen.findByText('Selected on this screen only — not uploaded or saved.');
  fireEvent.change(container.querySelector('input[type=file]')!, {target: {files: [new File(['fictional'], 'Fictional.pdf', {type: 'application/pdf'})]}});
  expect(await screen.findByRole('list', {name: 'Selected files'})).toHaveTextContent('Fictional.pdf');
  fireEvent.click(screen.getByRole('button', {name: 'Remove Fictional.pdf'}));expect(screen.getByRole('list', {name: 'Selected files'})).not.toHaveTextContent('Fictional.pdf');expect(request.mock.calls.filter(([, init]) => init?.method)).toHaveLength(0);
});

test.each(['erp1', 'erp2'] as const)('%s case retains a failed comment and retries the identical versioned command', async variant => {
  const api = mockApi(), row = api.rows.get('support-tickets')![0]!;row.version = 4;let fail = true;
  const request = vi.fn<JsonRequest>(async (path, init) => {if (init?.method === 'PUT' && fail) throw Object.assign(new Error('Offline'), {status: 503});return api.request(path, init);});
  render(<Record slug="support-tickets" id={row.id} host={hostFor(request as JsonRequest, variant)}/>);
  fireEvent.change(await screen.findByRole('textbox', {name: 'Add an update or reply'}), {target: {value: 'Fictional reply retained'}});
  fireEvent.click(screen.getByRole('button', {name: 'Post update'}));await screen.findByRole('button', {name: 'Retry'});
  expect(screen.getByRole('textbox', {name: 'Add an update or reply'})).toHaveValue('Fictional reply retained');fail = false;
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));await screen.findByText('Fictional reply retained', {selector: 'p'});
  await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(2));
  const writes = request.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => JSON.parse(String(init?.body)));
  expect(writes[0]).toEqual(writes[1]);expect(writes[0].expectedVersion).toBe(4);expect(writes[0].activity.at(-1).text).toBe('Fictional reply retained');
});

test('mounted denial and keyboard preferences fence conversation writes', async () => {
  const api = mockApi(), request = vi.fn(api.request), row = api.rows.get('support-tickets')![0]!, host = hostFor(request as JsonRequest);
  host.preferences = {...DEFAULT_PREFERENCES, keyboardShortcuts: false};
  const view = render(<Record slug="support-tickets" id={row.id} host={host}/>);
  const input = await screen.findByRole('textbox', {name: 'Add an update or reply'});fireEvent.change(input, {target: {value: 'Fictional note'}});fireEvent.keyDown(input, {key: 'Enter', ctrlKey: true});
  expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
  view.rerender(<Record slug="support-tickets" id={row.id} host={{...host, can: () => false}}/>);
  expect(screen.getByRole('button', {name: 'Post update'})).toBeDisabled();expect(screen.getByRole('combobox', {name: 'Stage'})).toBeDisabled();fireEvent.click(screen.getByRole('button', {name: 'Post update'}));expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
});

test('a conversation conflict requires explicit reload and preserves the unaccepted comment', async () => {
  const api = mockApi(), row = api.rows.get('support-tickets')![0]!, request = vi.fn<JsonRequest>(async (path, init) => {if (init?.method === 'PUT') throw Object.assign(new Error('Version conflict'), {status: 409});return api.request(path, init);});
  render(<Record slug="support-tickets" id={row.id} host={hostFor(request as JsonRequest)}/>);
  fireEvent.change(await screen.findByRole('textbox', {name: 'Add an update or reply'}), {target: {value: 'Keep until reload'}});fireEvent.click(screen.getByRole('button', {name: 'Post update'}));
  await screen.findByRole('button', {name: 'Reload'});expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull();expect(screen.getByRole('textbox', {name: 'Add an update or reply'})).toHaveValue('Keep until reload');fireEvent.click(screen.getByRole('button', {name: 'Reload'}));await waitFor(() => expect(screen.getByRole('textbox', {name: 'Add an update or reply'})).toHaveValue(''));
});

test('ERP2 tree shows ancestor navigation, children, leaf guards and confirmed deletion', async () => {
  const api = mockApi(), rows = api.rows.get('chart-of-accounts')!, root = rows.find(row => rows.some(child => child.parentId === row.id))!, kid = rows.find(row => row.parentId === root.id)!, close = vi.fn();
  const request = vi.fn<JsonRequest>(async (path, init) => {if (init?.method === 'DELETE') return {deleted: kid.id} as never;return api.request(path, init);});
  render(<Record slug="chart-of-accounts" id={root.id} host={hostFor(request as JsonRequest)} close={close}/>);
  expect(await screen.findByRole('navigation', {name: 'Position in hierarchy'})).toHaveTextContent(root.name);expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
  // Select a leaf through the actual children table (some first children have their own descendants).
  let leaf = kid;while (rows.some(row => row.parentId === leaf.id)) {const child = rows.find(row => row.parentId === leaf.id)!;fireEvent.click(await screen.findByRole('cell', {name: leaf.name}));leaf = child;}
  fireEvent.click(await screen.findByRole('cell', {name: leaf.name}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled());fireEvent.click(screen.getByRole('button', {name: 'Delete'}));expect(request.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);fireEvent.click(screen.getByRole('button', {name: 'Confirm delete'}));await waitFor(() => expect(close).toHaveBeenCalledOnce());
});

test('hierarchy traversal stops at cycles and missing parents', () => {
  expect(hierarchyPath([{id: 'a', parentId: 'b'}, {id: 'b', parentId: 'a'}], 'a').map(row => row.id)).toEqual(['b', 'a']);expect(hierarchyPath([{id: 'a', parentId: 'missing'}], 'a')).toHaveLength(1);
});

test('booking context refetches the edited date and prevents leaving an unsaved editor through related rows', async () => {
  const api = mockApi(), row = api.rows.get('appointments')![0]!, request = vi.fn(api.request), view = render(<Record slug="appointments" id={row.id} mode="edit" host={hostFor(request as JsonRequest)}/>);
  fireEvent.change(await screen.findByLabelText('Date', {exact: true}), {target: {value: '2026-11-11'}});
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('appointments?') && decodeURIComponent(path).includes('2026-11-11'))).toBe(true));expect(screen.getByRole('button', {name: 'Open schedule'})).toBeDisabled();expect(view.container.querySelector('[data-record-aside]')).toBeTruthy();
});

test('approval decisions include the note and ERP1 related requests stay within the department', async () => {
  const api = mockApi(), row = api.rows.get('approvals')!.find(row => row.status === 'Pending')!, request = vi.fn(api.request);
  render(<Record slug="approvals" id={row.id} host={hostFor(request as JsonRequest, 'erp1')}/>);
  fireEvent.change(await screen.findByRole('textbox', {name: 'Note to the requester (optional)'}), {target: {value: 'Fictional review note'}});fireEvent.click(screen.getByRole('button', {name: 'Approve'}));
  await waitFor(() => expect(request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));const write = request.mock.calls.find(([, init]) => init?.method === 'PUT')!;expect(JSON.parse(String(write[1]?.body))).toMatchObject({status: 'Approved', decisionNote: 'Fictional review note'});
  expect(request.mock.calls.some(([path]) => path.includes('approvals?') && decodeURIComponent(path).includes(String(row.department)))).toBe(true);
});

test('process logs read support events and document summaries preserve deductions and tax', async () => {
  const api = mockApi(), row = api.rows.get('payroll-run')![0]!, request: JsonRequest = async (path, init) => path.includes('/support') ? support as never : api.request(path, init);
  const view = render(<Record slug="payroll-run" id={row.id} host={hostFor(request as JsonRequest)}/>);
  await screen.findByRole('heading', {name: 'Steps'});expect(await screen.findByText('Fictional run completed')).toBeInTheDocument();view.unmount();
  const structure = api.rows.get('salary-structures')![0]!;structure.lines = [{amount: 100, tax: 10}, {amount: 20, tax: 10, kind: 'Deduction'}];
  const rendered = render(<Record slug="salary-structures" id={structure.id} host={hostFor(api.request)}/>);await screen.findByRole('heading', {name: 'Summary'});await waitFor(() => expect(rendered.container.querySelector('[data-record-aside]')).toHaveTextContent('AED 88'));
});

const profiles: [string, Partial<UserPreferences>][] = [['default', {}], ['Arabic RTL', {language: 'ar'}], ['reduced motion', {reducedMotion: true}], ['locked density', {density: 'spacious'}]];
describe.each(profiles)('ERP1 opened record panels: %s', (profile, preferences) => {
  test.each(['customers', 'sales-orders', 'leave-requests', 'approvals', 'appointments', 'support-tickets', 'chart-of-accounts', 'payroll-run', 'quality-inspections'])('%s', async slug => {
    const api = mockApi(), def = PAGES.find(page => page.slug === slug)!, row = api.rows.get(def.entity)![0]!, host = hostFor(api.request, 'erp1');host.preferences = {...host.preferences, ...preferences};
    if (profile === 'locked density') host.preferenceHost = {preferences: host.preferences, preferencePolicy: {revision: 1, rules: {density: {value: 'compact', locked: true}}}, onPreferenceChange: vi.fn()};
    const {container} = render(<Record slug={slug} id={row.id} host={host}/>);
    await waitFor(() => expect(container.querySelector('[data-record-page]')).toBeTruthy());await waitFor(() => expect(container.querySelector('[aria-busy="true"],[data-recovery-kind]')).toBeNull());
    if (profile === 'locked density') expect(container.querySelector('[data-layout]')).toHaveAttribute('data-density', 'compact');
    await act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
  });
});

test('edited forms warn on browser unload, retain failures, and detach after accepted save', async () => {
  const api = mockApi(), row = api.rows.get('customers')![0]!;let fail = true;
  const request: JsonRequest = async (path, init) => {if (init?.method === 'PUT' && fail) throw new Error('Offline');return api.request(path, init);};
  const view = render(<Record slug="customers" id={row.id} mode="edit" host={hostFor(request)}/>);
  const warn = () => {const event = new Event('beforeunload', {cancelable: true});window.dispatchEvent(event);return event.defaultPrevented;};
  const field = await screen.findByRole('textbox', {name: 'Customer'});expect(warn()).toBe(false);
  fireEvent.change(field, {target: {value: 'Unsaved fictional customer'}});expect(warn()).toBe(true);
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));await screen.findByRole('button', {name: 'Retry'});expect(warn()).toBe(true);
  fail = false;fireEvent.click(screen.getByRole('button', {name: 'Retry'}));await screen.findByRole('button', {name: 'Edit'});expect(warn()).toBe(false);
  expect(JSON.stringify(localStorage)).not.toContain('Unsaved fictional customer');view.unmount();expect(warn()).toBe(false);
});

test('case assignee editing waits for explicit save and uses the versioned command', async () => {
  const api = mockApi(), row = api.rows.get('support-tickets')![0]!, request = vi.fn(api.request);
  render(<Record slug="support-tickets" id={row.id} host={hostFor(request as JsonRequest)}/>);
  fireEvent.change(await screen.findByRole('textbox', {name: 'Assignee'}), {target: {value: 'Fictional assignee'}});
  expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', {name: 'Save assignee'}));await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1));
  expect(JSON.parse(String(request.mock.calls.find(([, init]) => init?.method === 'PUT')![1]?.body))).toMatchObject({assignee: 'Fictional assignee'});
});
