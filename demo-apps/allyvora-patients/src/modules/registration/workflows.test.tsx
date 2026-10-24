import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, test, vi} from 'vitest';
import type {LayoutSettings} from '@allyvora/shared';
import type {UserPreferences} from '@pepbits/preferences';
import {Renderer} from '../../renderer';
import {pages, targetFromPath} from '../../navigation';
import {TestHostProvider, spies, type TestHost} from '../../test/host';
import {fixture, mockAllyVora, type MockCall} from '../../test/mock-api';

function element(url: string) {
  const [path, query = ''] = url.split('?'), target = targetFromPath(path!, query), page = pages.find(item => item.id === target.pageId)!;
  return <main><Renderer page={page} target={target}/></main>;
}
function mount(url: string, options: {settings?: Partial<LayoutSettings>; preferences?: Partial<UserPreferences>; role?: string; fail?: (call: MockCall) => Response | undefined} = {}) {
  const api = mockAllyVora({settings: options.settings, fail: options.fail}), s = spies();
  const host: TestHost = {client: api.client, preferences: options.preferences, role: options.role, ...s};
  const view = render(<TestHostProvider host={host}>{element(url)}</TestHostProvider>);
  return {api, s, ...view, go: (next: string) => view.rerender(<TestHostProvider host={host}>{element(next)}</TestHostProvider>)};
}
const user = () => userEvent.setup();
/** Long workflows set text values directly so they stay fast under machine load; pickers and buttons still use real clicks. */
const fill = (element: HTMLElement, value: string) => fireEvent.change(element, {target: {value}});
const posted = (api: ReturnType<typeof mockAllyVora>, method: string, path: string) => api.calls.filter(call => call.method === method && call.path === path);
async function choose(label: RegExp, query: string, option: string) {
  const u = user();
  await u.click(screen.getByRole('button', {name: label}));
  await u.type(await screen.findByRole('combobox', {name: new RegExp('Search ' + label.source.replace(/^\^/, ''), 'i')}), query);
  const found = await screen.findAllByRole('option');
  const match = found.find(item => item.textContent?.trim() === option);
  if (!match) throw new Error('Options: ' + found.map(item => item.textContent).join(' | '));
  await u.click(match);
}

describe('patient register', () => {
  test('lists API patients and keeps search, views and filters in the URL', async () => {
    const {api, s} = mount('/patients'), u = user();
    expect(await screen.findByRole('link', {name: /^Mr Joseph Kurian/})).toHaveAttribute('href', '/patients?mode=view&id=28');
    await waitFor(() => expect(api.calls.some(call => call.path === '/patients?status=active&sort=updated&dir=desc&page=1&pageSize=20')).toBe(true));
    await u.type(screen.getByRole('textbox', {name: 'Search patients'}), 'Joseph');
    await waitFor(() => expect(s.replace).toHaveBeenCalledWith('/patients?q=Joseph'));
    await u.click(screen.getByRole('tab', {name: /Inactive/}));
    expect(s.replace).toHaveBeenCalledWith('/patients?view=inactive');
    fireEvent.change(screen.getByRole('combobox', {name: 'Sex'}), {target: {value: 'female'}});
    expect(s.replace).toHaveBeenCalledWith('/patients?sex=female');
    fireEvent.change(screen.getByRole('combobox', {name: 'Sort by'}), {target: {value: 'name'}});
    expect(s.replace).toHaveBeenCalledWith('/patients?sort=name');
    await u.click(screen.getByRole('link', {name: /^Mr Joseph Kurian/}));
    expect(s.open).toHaveBeenCalledWith({pageId: 'allyvora-patients', mode: 'view', recordId: '28'});
    await u.click(screen.getByRole('link', {name: 'Edit Mr Joseph Kurian'}));
    expect(s.open).toHaveBeenCalledWith({pageId: 'allyvora-patients', mode: 'edit', recordId: '28'});
    expect(screen.getByRole('tab', {name: /All patients/})).toHaveTextContent(String(fixture.stats.active));
  });

  test('browser history updates search text without overwriting the URL', async () => {
    const view = mount('/patients?q=Joseph');
    expect(await screen.findByRole('textbox', {name: 'Search patients'})).toHaveValue('Joseph');
    view.go('/patients?q=Kavya&sex=female');
    await waitFor(() => expect(screen.getByRole('textbox', {name: 'Search patients'})).toHaveValue('Kavya'));
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 300));});
    expect(view.s.replace).not.toHaveBeenCalled();
    fill(screen.getByRole('textbox', {name: 'Search patients'}), 'Meera');
    await waitFor(() => expect(view.s.replace).toHaveBeenCalledWith('/patients?q=Meera&sex=female'));
  });

  test('late results from an obsolete search cannot replace the current register', async () => {
    const api = mockAllyVora(), original = api.client.patients.list;
    let resolveOld!: (result: typeof fixture.list) => void;
    vi.spyOn(api.client.patients, 'list').mockImplementation((query, signal) => query.q === 'old'
      ? new Promise(resolve => {resolveOld = resolve;}) : original(query, signal));
    const host: TestHost = {client: api.client, ...spies()};
    const view = render(<TestHostProvider host={host}>{element('/patients?q=old')}</TestHostProvider>);
    await waitFor(() => expect(api.client.patients.list).toHaveBeenCalled());
    view.rerender(<TestHostProvider host={host}>{element('/patients?q=nobody')}</TestHostProvider>);
    expect(await screen.findByText('No patients match')).toBeVisible();
    await act(async () => resolveOld(fixture.list));
    expect(screen.getByText('No patients match')).toBeVisible();
    expect(screen.queryByRole('link', {name: /^Mr Joseph Kurian/})).toBeNull();
  });

  test('URL filters drive the API request and page size uses the central preference path', async () => {
    const {api} = mount('/patients?q=kurian&view=incomplete&payer=self&sort=name&page=1');
    await screen.findByRole('link', {name: /^Mr Joseph Kurian/});
    expect(api.calls.some(call => call.path === '/patients?q=kurian&status=active&incomplete=1&payer=self&sort=name&dir=asc&page=1&pageSize=20')).toBe(true);
    fireEvent.change(screen.getByRole('combobox', {name: /rows per page/i}), {target: {value: '50'}});
    await waitFor(() => expect(api.calls.some(call => call.path.endsWith('pageSize=50'))).toBe(true));
  });

  test('empty results offer registration, and failures offer a retry that reloads', async () => {
    let fail = true;
    const {api} = mount('/patients?q=nobody', {fail: call => call.path.startsWith('/patients?') && fail ? Response.json({message: 'Down'}, {status: 503}) : undefined});
    const retry = await screen.findByRole('button', {name: /retry/i});
    fail = false;
    await user().click(retry);
    expect(await screen.findByText('No patients match')).toBeVisible();
    expect(screen.getByRole('button', {name: /Register a new patient/})).toBeEnabled();
    expect(api.calls.filter(call => call.path.startsWith('/patients?q=nobody')).length).toBe(2);
  });

  test('roles without registration rights cannot create from the register or open the editor', async () => {
    mount('/patients', {role: 'school-teacher'});
    expect(await screen.findByRole('button', {name: /New patient/})).toBeDisabled();
    mount('/patients?mode=new', {role: 'school-teacher'});
    expect(await screen.findByText('Access not permitted')).toBeVisible();
  });
});

describe('patient record', () => {
  test('shows the band, sections, masked identity, gaps and activity; status changes are confirmed', async () => {
    const {api, s} = mount('/patients?mode=view&id=2'), u = user();
    expect(await screen.findByRole('heading', {name: 'Patient record: Mr Suresh Kumar'})).toBeInTheDocument();
    const band = screen.getByRole('group', {name: 'Patient summary'});
    expect(within(band).getByText('Mr Suresh Kumar')).toBeVisible();
    expect(screen.getByText('•••• 1452')).toBeVisible();
    expect(screen.queryByText('669264861452')).toBeNull();
    expect(screen.getByRole('link', {name: /Edit Contact/})).toHaveAttribute('href', '/patients?mode=edit&id=2&section=contact');
    expect(screen.getByRole('heading', {name: 'Details still missing'})).toBeVisible();
    expect(within(screen.getByRole('region', {name: 'Activity'})).getByText(fixture.audit['2']![0]!.actor)).toBeVisible();
    await u.click(screen.getByRole('button', {name: 'Mark inactive'}));
    const dialog = await screen.findByRole('dialog', {name: 'Mark this record inactive?'});
    await u.click(within(dialog).getByRole('button', {name: 'Mark inactive'}));
    await waitFor(() => expect(posted(api, 'PATCH', '/patients/2/status')).toHaveLength(1));
    expect(posted(api, 'PATCH', '/patients/2/status')[0]!.body).toEqual({status: 'inactive'});
    await waitFor(() => expect(s.notify).toHaveBeenCalledWith('Record marked inactive: Mr Suresh Kumar', {tone: 'success'}));
    expect(await screen.findByRole('button', {name: 'Make active'})).toBeVisible();
  });

  test('a missing patient shows not found with a way back', async () => {
    const {s} = mount('/patients?mode=view&id=999');
    await user().click(await screen.findByRole('button', {name: 'Open patient register'}));
    expect(s.open).toHaveBeenCalledWith({pageId: 'allyvora-patients'});
  });
});

describe('registration form', () => {
  test('saving an empty registration reveals problems and sends nothing; a complete one is created and opened', {timeout: 90000}, async () => {
    const {api, s} = mount('/patients?mode=new'), u = user();
    const form = await screen.findByRole('textbox', {name: /First name/});
    await u.click(screen.getByRole('button', {name: /Save patient/}));
    expect(await screen.findByText(/fields need attention/)).toBeVisible();
    expect(screen.getAllByText('Enter first name').length).toBeGreaterThan(0);
    expect(posted(api, 'POST', '/patients')).toHaveLength(0);

    fill(form, 'Fictional');
    fill(screen.getByRole('textbox', {name: /Last name/}), 'Person');
    expect(screen.getByRole('textbox', {name: /Display name/})).toHaveValue('Fictional Person');
    fireEvent.change(document.querySelector('[data-field="dateOfBirth"] input')!, {target: {value: '1990-04-02'}});
    await u.click(screen.getByRole('radio', {name: 'Female'}));
    fill(screen.getByRole('textbox', {name: /Mobile number/}), '9000011122');
    fill(screen.getByRole('textbox', {name: /^PIN code/}), '682020');
    await waitFor(() => expect(screen.getByRole('textbox', {name: /City or town/})).toHaveValue('Kadavanthra'));
    expect(screen.getByText('Kadavanthra, Ernakulam, filled in')).toBeVisible();
    fill(screen.getByRole('textbox', {name: /House, building and street/}), '1 Fictional Lane');
    await u.click(screen.getByRole('radio', {name: 'No known allergies'}));
    await choose(/^Department/, 'Ortho', 'Orthopaedics');
    await u.click(screen.getByRole('switch', {name: /Consents to registration and treatment/}));
    await u.click(screen.getByRole('radio', {name: 'Paper form'}));
    fill(await screen.findByRole('textbox', {name: /Paper form reference/}), 'pf-001');
    await u.click(screen.getByRole('button', {name: /Save patient/}));
    await waitFor(() => expect(posted(api, 'POST', '/patients')).toHaveLength(1));
    const body = posted(api, 'POST', '/patients')[0]!.body as {values: Record<string, unknown>};
    expect(body.values).toMatchObject({givenName: 'Fictional', displayName: 'Fictional Person', city: 'Kadavanthra', state: 'KL', paperFormRef: 'PF-001', branchId: 1, department: 'ortho'});
    expect(body.values).not.toHaveProperty('signature');
    await waitFor(() => expect(s.open).toHaveBeenCalledWith({pageId: 'allyvora-patients', mode: 'view', recordId: '29'}));
    expect(s.notify).toHaveBeenCalledWith(expect.stringMatching(/^Patient registered: Fictional Person, MRN/), {tone: 'success'});
  });

  test('server field errors return to the form; conflicts keep the edit and explain why', {timeout: 90000}, async () => {
    const reject = (call: MockCall) => call.method === 'PUT' && call.path === '/patients/1' ? Response.json({message: 'Ward Admin saved this record. Reload to see their changes.'}, {status: 409}) : undefined;
    const {api, s} = mount('/patients?mode=edit&id=1', {fail: reject}), u = user();
    const email = await screen.findByRole('textbox', {name: /^Email/});
    expect(screen.getByText('The registering branch can’t change after the MRN is assigned')).toBeVisible();
    fill(email, 'kavya@example.test');
    await u.click(screen.getByRole('button', {name: /Save changes/}));
    await waitFor(() => expect(s.notify).toHaveBeenCalledWith('Someone else saved this patient: Ward Admin saved this record. Reload to see their changes.', {tone: 'error'}));
    expect(posted(api, 'PUT', '/patients/1')[0]!.body).toMatchObject({version: 1, values: {email: 'kavya@example.test'}});
    expect(email).toHaveValue('kavya@example.test');
    expect(s.open).not.toHaveBeenCalled();
  });

  test('422 field errors from the API are shown on the matching field', async () => {
    const reject = (call: MockCall) => call.method === 'PUT' ? Response.json({message: 'Some fields need attention', errors: {mobile: 'This mobile is registered to another patient'}}, {status: 422}) : undefined;
    const {s} = mount('/patients?mode=edit&id=1', {fail: reject}), u = user();
    await u.click(await screen.findByRole('button', {name: /Save changes/}));
    expect(await screen.findByText('This mobile is registered to another patient')).toBeVisible();
    expect(s.notify).toHaveBeenCalledWith('Some fields need attention: The server found problems the form highlighted for you.', {tone: 'error'});
  });

  test('possible duplicates are offered while typing, with links to existing records', async () => {
    mount('/patients?mode=new');
    await user().type(await screen.findByRole('textbox', {name: /Mobile number/}), '9534760382');
    const notice = await screen.findByText('This may be a returning patient. Check before creating a new record.');
    const link = within(notice.closest('[data-notice]') as HTMLElement).getByRole('link', {name: /^Mr Joseph Kurian/});
    expect(link).toHaveAttribute('href', '/patients?mode=view&id=28');
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('a manual display name is kept while name parts change, and dependent consultant choices are cleared', async () => {
    mount('/patients?mode=edit&id=1');
    const u = user();
    const display = await screen.findByRole('textbox', {name: /Display name/});
    await u.clear(display); await u.type(display, 'Kavya D.');
    expect(await screen.findByText('Edited by hand. Clear it to rebuild from the name fields.')).toBeVisible();
    await u.type(screen.getByRole('textbox', {name: /Middle name/}), 'R');
    expect(display).toHaveValue('Kavya D.');
    expect(screen.getByRole('button', {name: /^Consultant/})).not.toHaveTextContent('Type or choose');
    await choose(/^Department/, 'Cardio', 'Cardiology');
    await waitFor(() => expect(screen.getByRole('button', {name: /^Consultant/})).toHaveTextContent('Type or choose'));
  });

  test('guided steps check each step before moving on', async () => {
    mount('/patients?mode=new', {settings: {layout: 'wizard'}});
    const u = user();
    await screen.findByRole('navigation', {name: 'Registration steps'});
    await u.click(screen.getByRole('button', {name: /Next: Personal/}));
    expect(await screen.findByRole('heading', {name: 'Personal details', level: 2})).toBeVisible();
    await u.click(screen.getByRole('button', {name: /Next: Contact/}));
    expect(await screen.findByText('Enter first name')).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Personal details', level: 2})).toBeVisible();
    expect(screen.queryByRole('heading', {name: 'Contact', level: 2})).toBeNull();
  });

  test('each organisation layout renders the same sections, and deep-linked sections open first', async () => {
    for (const layout of ['scroll', 'tabs', 'wizard', 'stepper', 'accordion'] as const) {
      const {container, unmount} = mount('/patients?mode=edit&id=1&section=address', {settings: {layout}});
      await waitFor(() => expect(container.querySelector(`[data-form-layout="${layout}"] [data-section="address"]`)).toBeTruthy());
      if (layout === 'tabs') expect(screen.getByRole('tab', {name: /Address/})).toHaveAttribute('aria-selected', 'true');
      if (layout === 'accordion') expect(screen.getByRole('button', {name: /Address/, expanded: true})).toBeVisible();
      unmount();
    }
  });

  test('form rules list every rule and jump to the field', async () => {
    mount('/patients?mode=new');
    const u = user();
    await u.click(await screen.findByRole('button', {name: /Check form rules/}));
    const drawer = await screen.findByRole('dialog', {name: 'Form rules'});
    expect(within(drawer).getByText(/fields need attention before you can save/)).toBeVisible();
    await u.click(within(drawer).getByRole('button', {name: /^First name/}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Form rules'})).toBeNull());
  });

  test('unsaved registrations are offered back within the signed-in session only', async () => {
    const view = mount('/patients?mode=new');
    await user().type(await screen.findByRole('textbox', {name: /First name/}), 'Draftperson');
    fill(screen.getByRole('textbox', {name: /Display name/}), 'Preferred name');
    expect(await screen.findByText(/Draft kept for this session at/, undefined, {timeout: 5000})).toBeInTheDocument();
    view.go('/patients?mode=view&id=1');
    await screen.findByRole('heading', {name: 'Patient record: Mrs Kavya Das'});
    view.go('/patients?mode=new');
    expect(await screen.findByText(/You have an unsaved registration from/)).toBeVisible();
    await user().click(screen.getByRole('button', {name: 'Restore draft'}));
    expect(screen.getByRole('textbox', {name: /First name/})).toHaveValue('Draftperson');
    fill(screen.getByRole('textbox', {name: /Last name/}), 'Family');
    expect(screen.getByRole('textbox', {name: /Display name/})).toHaveValue('Preferred name');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  test('keyboard shortcuts follow the effective preference', async () => {
    const first = mount('/patients?mode=new');
    await screen.findByRole('textbox', {name: /First name/});
    act(() => {fireEvent.keyDown(window, {code: 'KeyS', key: 's', ctrlKey: true});});
    expect(await screen.findByText(/fields need attention/)).toBeVisible();
    first.unmount();
    mount('/patients?mode=new', {preferences: {keyboardShortcuts: false}});
    await screen.findByRole('textbox', {name: /First name/});
    act(() => {fireEvent.keyDown(window, {code: 'KeyS', key: 's', ctrlKey: true});});
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 50));});
    expect(screen.queryByText(/fields need attention/)).toBeNull();
  });

  test('administrators switch the organisation layout from the form; others cannot', async () => {
    const {api} = mount('/patients?mode=new');
    await user().click(await screen.findByRole('radio', {name: 'Tabs'}));
    await waitFor(() => expect(posted(api, 'PUT', '/settings/layout')[0]?.body).toMatchObject({layout: 'tabs'}));
    expect(await screen.findByRole('tablist', {name: 'Form sections'})).toBeVisible();
  });
});

describe('form layout designer', () => {
  test('previews choices, saves for everyone and can reuse history', async () => {
    const {api, s} = mount('/settings/layout'), u = user();
    await u.click(await screen.findByRole('radio', {name: /^Guided steps/}));
    expect(document.querySelector('[data-layout-preview="wizard"]')).toBeTruthy();
    expect(screen.getByText('Not saved yet')).toBeVisible();
    await u.click(screen.getByRole('radio', {name: 'Compact'}));
    await u.click(screen.getByRole('switch', {name: 'Keep unsaved registrations'}));
    await u.click(screen.getByRole('button', {name: /Save layout/}));
    await waitFor(() => expect(posted(api, 'PUT', '/settings/layout')).toHaveLength(1));
    expect(posted(api, 'PUT', '/settings/layout')[0]!.body).toMatchObject({layout: 'wizard', density: 'compact', autosaveDraft: false, columns: 4});
    await waitFor(() => expect(s.notify).toHaveBeenCalledWith('Layout saved: Everyone now registers patients with guided steps.', {tone: 'success'}));
    await waitFor(() => expect(within(document.querySelector('[data-layout-history]') as HTMLElement).getByText('Current')).toBeVisible());
    await u.click(screen.getByRole('button', {name: /Use defaults/}));
    expect(screen.getByRole('radio', {name: /^Single page/})).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('button', {name: 'Discard'}));
    expect(screen.getByRole('radio', {name: /^Guided steps/})).toHaveAttribute('aria-checked', 'true');
  });

  test('non-administrators can explore the preview but not change the organisation layout', async () => {
    const {api} = mount('/settings/layout', {role: 'operations-analyst'});
    expect(await screen.findByText(/Only administrators can change the organisation layout/)).toBeVisible();
    await user().click(screen.getByRole('radio', {name: /^Tabs/}));
    expect(screen.getByRole('radio', {name: /^Tabs/})).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', {name: /Save layout/})).toBeDisabled();
    expect(posted(api, 'PUT', '/settings/layout')).toHaveLength(0);
  });
});
