import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES, type UserPreferences} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {TestHostProvider, type TestHostValue} from './test/host';
import {mockApi} from './test/mock-api';
import {PAGES} from './modules/keystone/catalog';
import {ReadyPage} from './modules/keystone/ReadyPage';
import {ErpWorklist} from './modules/keystone/worklist';
import {ErpPersonalViews, restoreView, sourceFilters} from './modules/keystone/personal-views';
import {pageId, pages, type Variant} from './navigation';

const def = PAGES.find(page => page.slug === 'customers')!;
function hostFor(request: JsonRequest, variant: Variant = 'erp2'): TestHostValue {
  const preferences = {...DEFAULT_PREFERENCES, rememberFilters: true, columnLayoutScope: 'account' as const};
  return {scope: {tenantId: 'fictional', applicationId: 'nexora', branchId: 'head-office', userId: 'fixture', roles: ['admin'], moduleId: variant}, preferences, preferenceHost: {preferences, preferencePolicy: {revision: 1, rules: {}}, onPreferenceChange: vi.fn()}, request, navigate: vi.fn()};
}
const layout = {filters: {query: 'Fictional', status: 'Active'}, columns: ['name', 'status'], sort: {key: 'name', direction: 'desc' as const}, pageSize: 20};
function List({host, slug = 'customers'}: {host: TestHostValue; slug?: string}) {
  const definition = PAGES.find(page => page.slug === slug)!, page = pages.find(page => page.id === pageId(host.scope.moduleId as Variant, definition))!;
  return <TestHostProvider host={host}><main dir={host.preferences.language === 'ar' ? 'rtl' : 'ltr'}><ReadyPage def={definition}>{ready => <ErpWorklist def={ready} page={page} onOpen={vi.fn()}/>}</ReadyPage></main></TestHostProvider>;
}
const writes = (request: ReturnType<typeof vi.fn>) => request.mock.calls.filter(([path, init]) => path === '/api/view-state' && init?.method === 'PUT').map(([, init]) => JSON.parse(String(init.body)));
async function saveView(name: string, button = 'Save current view') {
  fireEvent.click(await screen.findByRole('button', {name: 'Saved views'}));
  fireEvent.change(await screen.findByRole('textbox', {name: 'View name'}), {target: {value: name}});
  await waitFor(() => expect(screen.getByRole('button', {name: button})).toBeEnabled());fireEvent.click(screen.getByRole('button', {name: button}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Apply ' + name})).toBeEnabled());
}

test.each(['erp1', 'erp2'] as const)('%s saves and restores account search, typed filters, sort and columns after remount', async variant => {
  const api = mockApi(), request = vi.fn(api.request), host = hostFor(request as JsonRequest, variant);
  const view = render(<List host={host}/>);await screen.findByRole('button', {name: 'Advanced filters (0)'});
  fireEvent.click(await screen.findByRole('button', {name: 'Customer'}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Search'}), {target: {value: 'Fictional'}});
  fireEvent.change(screen.getByRole('combobox', {name: 'Status'}), {target: {value: 'Active'}});
  await saveView('My customers');await waitFor(() => expect(writes(request).some(write => write.key === 'keystone.views.customers')).toBe(true));
  const saved = writes(request).find(write => write.key === 'keystone.views.customers').value[0];
  expect(saved).toMatchObject({q: 'Fictional', filters: {status: ['Active']}, snapshot: {sort: {key: 'name', direction: 'asc'}}});
  view.unmount();render(<List host={host}/>);
  fireEvent.click(await screen.findByRole('button', {name: 'Saved views'}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Apply My customers'})).toBeEnabled());fireEvent.click(screen.getByRole('button', {name: 'Apply My customers'}));
  await waitFor(() => expect(screen.getByRole('textbox', {name: 'Search'})).toHaveValue('Fictional'));
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('q=Fictional') && path.includes('sort=name') && decodeURIComponent(path).includes('"status":["Active"]'))).toBe(true));
  expect(JSON.stringify(localStorage)).not.toContain('Fictional');
});

test('source hidden-column contract is used for account load and writes', async () => {
  const api = mockApi();await api.request('/api/view-state', {method: 'PUT', body: JSON.stringify({key: 'keystone.cols.customers', value: ['name']})});
  const request = vi.fn(api.request);render(<List host={hostFor(request as JsonRequest)}/>);
  await waitFor(() => expect(screen.queryByRole('columnheader', {name: /Customer/})).toBeNull());
  fireEvent.click(await screen.findByRole('button', {name: 'Choose columns'}));
  const dialog = await screen.findByRole('dialog', {name: 'Columns & layout'});
  await waitFor(() => expect(within(dialog).getByRole('button', {name: 'Customer'})).toHaveAttribute('aria-pressed', 'false'));
  fireEvent.click(within(dialog).getByRole('button', {name: 'Customer'}));
  await waitFor(() => expect(writes(request).some(write => write.key === 'keystone.cols.customers' && !write.value.includes('name'))).toBe(true));
});

test('failed saved-view write keeps the snapshot and retries; deletion persists', async () => {
  const api = mockApi();let fail = true;
  const request = vi.fn<JsonRequest>(async (path, init) => {if (init?.method === 'PUT' && fail) throw new Error('Offline views');return api.request(path, init);});
  render(<TestHostProvider host={hostFor(request as JsonRequest)}><ErpPersonalViews def={def} layout={layout} onApply={vi.fn()}/></TestHostProvider>);
  fireEvent.click(screen.getByRole('button', {name: 'Saved views'}));fireEvent.change(screen.getByRole('textbox', {name: 'View name'}), {target: {value: 'Retained'}});
  await waitFor(() => expect(screen.getByRole('button', {name: 'Save current view'})).toBeEnabled());fireEvent.click(screen.getByRole('button', {name: 'Save current view'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline views');expect(screen.getByRole('button', {name: 'Apply Retained'})).toBeDisabled();fail = false;
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));await waitFor(() => expect(screen.getByRole('button', {name: 'Apply Retained'})).toBeEnabled());
  expect(writes(request)[0]).toEqual(writes(request)[1]);fireEvent.click(screen.getByRole('button', {name: 'Delete Retained'}));
  await waitFor(() => expect(writes(request).at(-1).value).toEqual([]));
});

test('rememberFilters lock stops account persistence while session views remain usable and scoped', async () => {
  const api = mockApi(), request = vi.fn(api.request), host = hostFor(request as JsonRequest);
  host.preferenceHost!.preferencePolicy = {revision: 2, rules: {rememberFilters: {value: false, locked: true}}};
  const tree = (value: TestHostValue) => <TestHostProvider host={value}><ErpPersonalViews def={def} layout={layout} onApply={vi.fn()}/></TestHostProvider>;
  const view = render(tree(host));await saveView('Session columns', 'Save column set');expect(writes(request)).toHaveLength(0);
  view.rerender(tree({...host, scope: {...host.scope, userId: 'another-user'}}));
  fireEvent.click(screen.getByRole('button', {name: 'Saved views'}));expect(await screen.findByText('No saved views yet.')).toBeVisible();expect(screen.queryByRole('button', {name: 'Apply Session columns'})).toBeNull();
});

test('legacy source views and column-only snapshots restore without replacing unrelated filters', () => {
  expect(restoreView(def, {name: 'Legacy', q: 'Name', quick: 'Active', filters: {}}, layout).filters).toMatchObject({query: 'Name', status: 'json:["Active"]'});
  expect(restoreView(def, {name: 'Columns', q: '', quick: null, filters: {}, snapshot: {criteria: {}, columns: ['code', 'gone'], sort: null, kind: 'columns'}}, layout)).toMatchObject({filters: layout.filters, columns: ['code'], sort: null});
  expect(sourceFilters(def, {creditLimit: 'json:{"min":10,"max":100}', status: 'json:["Active","Inactive"]', rogue: 'x'})).toEqual({creditLimit: {min: 10, max: 100}, status: ['Active', 'Inactive']});
});

test('ERP1 parent panel filters the dependent list through HTTP and retries failed parent data', async () => {
  const api = mockApi();let fail = true;const request = vi.fn<JsonRequest>(async (path, init) => {if (path.startsWith('/api/entities/countries?') && fail) throw new Error('Parent service offline');return api.request(path, init);});
  render(<List slug="states" host={hostFor(request as JsonRequest, 'erp1')}/>);fireEvent.click(await screen.findByRole('button', {name: 'Retry'}));fail = false;
  fireEvent.click(await screen.findByRole('button', {name: 'Retry'}));const region = await screen.findByRole('region', {name: 'Parent records'}), name = api.rows.get('countries')![0]!.name;
  fireEvent.click(within(region).getByRole('button', {name: new RegExp('^' + name + ' \\(')}));
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('/entities/states?') && decodeURIComponent(path).includes(name))).toBe(true));
});

const profiles: [string, Partial<UserPreferences>][] = [['default', {}], ['Arabic RTL', {language: 'ar'}], ['reduced motion', {reducedMotion: true}], ['locked density', {density: 'spacious'}]];
for (const variant of ['erp1', 'erp2'] as const) test.each(profiles)(variant + ' personal-view/filter dialogs: %s', async (profile, preferences) => {
  const api = mockApi(), host = hostFor(api.request, variant);host.preferences = {...host.preferences, ...preferences};
  if (profile === 'locked density') host.preferenceHost!.preferencePolicy = {revision: 1, rules: {density: {value: 'compact', locked: true}, pageSize: {value: 10, locked: true}}};
  const {container} = render(<List host={host}/>);await waitFor(() => expect(container.querySelector('[data-erp-advanced-filters]')).toBeTruthy());fireEvent.click(container.querySelector('[data-erp-advanced-filters]')!);
  await act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
  fireEvent.click(container.querySelector('[data-erp-saved-views]')!);await screen.findByRole('dialog');
  await act(async () => {expect((await axe.run(document.body, {rules: {'color-contrast': {enabled: false}, region: {enabled: false}}})).violations).toEqual([]);});
});

test('column account failure stays visible and explicit retry sends the same layout', async () => {
  const api = mockApi();let fail = false;
  const request = vi.fn<JsonRequest>(async (path, init) => {if (init?.method === 'PUT' && JSON.parse(String(init.body)).key === 'keystone.cols.customers' && fail) throw new Error('Columns offline');return api.request(path, init);});
  render(<List host={hostFor(request as JsonRequest)}/>);await screen.findByRole('button', {name: 'Customer'});
  fireEvent.click(screen.getByRole('button', {name: 'Choose columns'}));const dialog = await screen.findByRole('dialog');fail = true;fireEvent.click(within(dialog).getByRole('button', {name: 'Customer'}));
  fireEvent.click(within(dialog).getByRole('button', {name: 'Done'}));await screen.findByRole('button', {name: 'Retry'});fail = false;fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
  await waitFor(() => expect(writes(request).filter(write => write.key === 'keystone.cols.customers')).toHaveLength(2));
  const changes = writes(request).filter(write => write.key === 'keystone.cols.customers');expect(changes[0]).toEqual(changes[1]);await waitFor(() => expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull());
});

test('mounted persistence policy switches restore account views without promoting session snapshots', async () => {
  const api = mockApi();await api.request('/api/view-state', {method: 'PUT', body: JSON.stringify({key: 'keystone.views.customers', value: [{name: 'Account only', q: '', quick: null, filters: {}}]})});
  const request = vi.fn(api.request), host = hostFor(request as JsonRequest);
  const tree = (remember: boolean) => <TestHostProvider host={{...host, preferenceHost: {...host.preferenceHost!, preferencePolicy: {revision: remember ? 2 : 1, rules: {rememberFilters: {value: remember, locked: true}}}}}}><ErpPersonalViews def={def} layout={layout} onApply={vi.fn()}/></TestHostProvider>;
  const view = render(tree(false));await saveView('Session only');expect(writes(request)).toHaveLength(0);
  view.rerender(tree(true));expect(await screen.findByRole('button', {name: 'Apply Account only'})).toBeEnabled();expect(screen.queryByRole('button', {name: 'Apply Session only'})).toBeNull();
  view.rerender(tree(false));expect(await screen.findByRole('button', {name: 'Apply Session only'})).toBeEnabled();expect(writes(request)).toHaveLength(0);
});
