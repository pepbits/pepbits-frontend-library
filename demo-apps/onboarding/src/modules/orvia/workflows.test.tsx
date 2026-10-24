import React from 'react';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {memoryStore} from '../../adapters/onboarding';
import {renderWithHost, Routed, testPort} from '../../test/host';
import {CarePathway} from './landing/CarePathway';
import {initialData} from './registration';

const open = (pageId: string, query?: string) => expect.objectContaining({pageId, ...(query ? {query} : {})});
const strong = ['Clinic', 'Strong', 'Pass', '42'].join('-');
const click = (name: string | RegExp, role = 'button') => fireEvent.click(screen.getByRole(role, {name}));
const type = (name: string | RegExp, value: string, role = 'textbox') => fireEvent.change(screen.getByRole(role, {name}), {target: {value}});

describe('landing page', () => {
  it('walks the care pathway with arrow keys in reading direction and formats times', async () => {
    const view = renderWithHost(<CarePathway/>, {preferences: {timeFormat: '12h'}});
    expect(screen.getByRole('radio', {name: /Registration/})).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', {name: /Registration/})).toHaveTextContent(/9:02/);
    expect(screen.getByRole('radio', {name: /Registration/})).not.toHaveTextContent('09:02');
    fireEvent.keyDown(screen.getByRole('radiogroup', {name: 'Choose a step in the visit'}), {key: 'ArrowRight'});
    expect(screen.getByRole('radio', {name: /Triage/})).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', {name: /Triage/})).toHaveFocus();
    view.unmount();
    renderWithHost(<CarePathway/>, {preferences: {language: 'ar', reducedMotion: true}});
    fireEvent.keyDown(screen.getByRole('radiogroup'), {key: 'ArrowLeft'});
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true');
  });
  it('explores organization types and deep-links registration with the chosen type', async () => {
    const {onOpen} = renderWithHost(<Routed/>);
    const tabs = await screen.findByRole('tablist', {name: 'Organization types'});
    fireEvent.click(within(tabs).getByRole('tab', {name: /Pharmacy/}));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Controlled substances');
    click('Register as a pharmacy', 'link');
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-register', 'type=pharmacy'));
    expect(await screen.findByRole('button', {name: /Pharmacy/, pressed: true})).toBeInTheDocument();
  });
  it('opens the network profile with the structure deep link and keyboard tabs', async () => {
    const {onOpen} = renderWithHost(<Routed/>);
    const hospital = await screen.findByRole('tab', {name: /^Hospital/});
    fireEvent.keyDown(hospital, {key: 'ArrowUp'});
    expect(screen.getByRole('tab', {name: /Multi-facility network/})).toHaveAttribute('aria-selected', 'true');
    click('Register as a healthcare group', 'link');
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-register', 'structure=network'));
    expect(await screen.findByRole('button', {name: /Multi-facility network/, pressed: true})).toBeInTheDocument();
  });
  it('header actions reach sign-in and registration', async () => {
    const {onOpen} = renderWithHost(<Routed/>);
    const banner = (await screen.findAllByRole('banner'))[0]!;
    fireEvent.click(within(banner).getByRole('link', {name: 'Sign in'}));
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-workspace'));
    expect(await screen.findByRole('heading', {name: 'Find your workspace'})).toBeInTheDocument();
  });
});

describe('workspace finder', () => {
  it('finds a workspace by address and continues to its sign-in, remembering it', async () => {
    const port = testPort();
    const {onOpen} = renderWithHost(<Routed/>, {target: {pageId: 'orvia-workspace'}, port});
    expect(screen.getByRole('button', {name: 'Continue to sign in'})).toBeDisabled();
    type('Workspace address', 'stmarys.orvia.health');
    await waitFor(() => expect(screen.getByRole('button', {name: 'Continue to sign in'})).toBeEnabled());
    expect(screen.getByText('Hospital network, 6 facilities')).toBeInTheDocument();
    click('Continue to sign in');
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-sign-in', 'ws=stmarys'));
    expect(await screen.findByRole('heading', {name: 'Sign in'})).toBeInTheDocument();
    expect(port.recentWorkspaces().map(record => record.slug)).toEqual(['stmarys']);
  });
  it('explains unknown and invalid addresses and switches to email lookup', async () => {
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-workspace'}});
    type('Workspace address', 'abc-');
    expect(await screen.findByText('Use letters, numbers and hyphens only')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Workspace address'})).toHaveAttribute('aria-invalid', 'true');
    type('Workspace address', 'nobody-here');
    expect(await screen.findByText('No workspace at nobody-here.orvia.health')).toBeInTheDocument();
    click('find it with your email');
    expect(screen.getByRole('radio', {name: 'Work email'})).toHaveAttribute('aria-checked', 'true');
  });
  it('lists workspaces for a work email, offers registration when none match, and validates the address', async () => {
    const {onOpen} = renderWithHost(<Routed/>, {target: {pageId: 'orvia-workspace'}});
    click('Work email', 'radio');
    type('Work email', 'not-an-email', 'textbox');
    click('Find workspaces');
    expect(await screen.findByText('Enter your work email, like name@hospital.org')).toBeInTheDocument();
    type('Work email', 'pharmacist@cityrx.co.uk');
    click('Find workspaces');
    expect(await screen.findByText('1 workspace for cityrx.co.uk')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name: /CityRx Pharmacies/})[0]!);
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-sign-in', 'ws=cityrx'));
    expect(await screen.findByText('CityRx Pharmacies')).toBeInTheDocument();
    expect(await screen.findByRole('heading', {name: 'Sign in'})).toBeInTheDocument();
  });
  it('ignores a late email lookup after the address changes, even if the adapter ignores cancellation', async () => {
    const port = testPort(), matches = await port.lookupByEmail('pharmacist@cityrx.co.uk');
    let resolve!: (records: typeof matches) => void;
    const pending = new Promise<typeof matches>(done => {resolve = done;});
    const lookup = vi.fn<(email: string, signal?: AbortSignal) => Promise<typeof matches>>().mockReturnValueOnce(pending).mockResolvedValue([]);
    port.lookupByEmail = lookup;
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-workspace'}, port});
    click('Work email', 'radio'); type('Work email', 'pharmacist@cityrx.co.uk'); click('Find workspaces');
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
    type('Work email', 'someone@new-clinic.test');
    expect(lookup.mock.calls[0]?.[1]?.aborted).toBe(true);
    await act(async () => {resolve(matches); await pending;});
    expect(screen.queryByText('1 workspace for new-clinic.test')).toBeNull();
    expect(screen.getByRole('button', {name: 'Find workspaces'})).toBeEnabled();
    click('Find workspaces');
    expect(await screen.findByText('No workspaces use new-clinic.test')).toBeInTheDocument();
  });
  it('shows a no-match state with a registration link', async () => {
    const {onOpen} = renderWithHost(<Routed/>, {target: {pageId: 'orvia-workspace'}});
    click('Work email', 'radio');
    type('Work email', 'someone@unknown-clinic.test');
    click('Find workspaces');
    expect(await screen.findByText('No workspaces use unknown-clinic.test')).toBeInTheDocument();
    click('register your organization', 'link');
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-register'));
  });
  it('recovers from a failed lookup without losing the typed address', async () => {
    const port = testPort();
    let fail = true;
    const original = port.lookupWorkspace;
    port.lookupWorkspace = vi.fn(async (slug: string, signal?: AbortSignal) => {if (fail) throw new Error('offline'); return original(slug, signal);});
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-workspace'}, port});
    type('Workspace address', 'alnoor');
    expect(await screen.findByRole('alert')).toHaveTextContent('The workspace lookup did not respond.');
    fail = false;
    click('Try again');
    expect(await screen.findByText('Al Noor Healthcare Group')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Workspace address'})).toHaveValue('alnoor');
    await waitFor(() => expect(port.lookupWorkspace).toHaveBeenCalledTimes(2));
  });
});

describe('workspace sign-in', () => {
  it('asks for a workspace first when none or an unknown one is linked', async () => {
    const {onOpen} = renderWithHost(<Routed/>, {target: {pageId: 'orvia-sign-in', query: 'ws=missing-one'}});
    expect(await screen.findByText(/There is no workspace at missing-one.orvia.health/)).toBeInTheDocument();
    click('Find your workspace', 'link');
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-workspace'));
  });
  it('validates credentials, then completes the 6-digit code step and signs out', async () => {
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-sign-in', query: 'ws=stmarys'}});
    fireEvent.click(await screen.findByRole('button', {name: 'Continue with single sign-on'}));
    expect(screen.getByRole('status')).toHaveTextContent("Single sign-on opens your organization's identity provider");
    click('Sign in');
    expect(await screen.findByText('Enter the email you use for this workspace')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', {name: 'Email'})).toHaveFocus());
    type('Email', 'nurse@stmarys.org');
    fireEvent.change(screen.getByLabelText('Password'), {target: {value: strong}});
    click('Sign in');
    expect(await screen.findByRole('heading', {name: 'Enter your sign-in code'})).toBeInTheDocument();
    expect(screen.getByText(/Text me a code in 30s/)).toBeInTheDocument();
    click('Verify and sign in');
    expect(await screen.findByText('Enter all 6 digits')).toBeInTheDocument();
    fireEvent.paste(screen.getByRole('textbox', {name: 'Digit 1 of 6'}), {clipboardData: {getData: () => '123456'}});
    expect(await screen.findByRole('heading', {name: "Signed in to St. Mary's Medical Center"})).toBeInTheDocument();
    click('Sign out');
    expect(await screen.findByRole('heading', {name: 'Sign in'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue('nurse@stmarys.org');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
  it('requests a password reset', async () => {
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-sign-in', query: 'ws=demo'}});
    fireEvent.click(await screen.findByRole('button', {name: 'Forgot password?'}));
    expect(screen.getByRole('heading', {name: 'Reset your password'})).toBeInTheDocument();
    click('Send reset link');
    expect(await screen.findByText('Enter the email you use for this workspace')).toBeInTheDocument();
    type('Email', 'clerk@demo.orvia.health');
    click('Send reset link');
    expect(await screen.findByRole('heading', {name: 'Check your email'})).toBeInTheDocument();
    click('Back to sign in');
    expect(screen.getByRole('heading', {name: 'Sign in'})).toBeInTheDocument();
  });
  it('keeps typed values when the sign-in service fails and shows the pending-review notice', async () => {
    const port = testPort();
    await port.submitRegistration({...initialData, structure: 'single', facilityTypes: ['clinic'], org: {...initialData.org, legalName: 'Fictional Pending Clinic'}, workspace: {...initialData.workspace, slug: 'pending-clinic', region: 'eu', adminEmail: 'admin@pending.test'}});
    port.signIn = vi.fn(async () => {throw new Error('Sign-in did not respond. Try again.');});
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-sign-in', query: 'ws=pending-clinic'}, port});
    expect(await screen.findByText(/pending license review/)).toBeInTheDocument();
    type('Email', 'admin@pending.test');
    fireEvent.change(screen.getByLabelText('Password'), {target: {value: strong}});
    click('Sign in');
    expect(await screen.findByText('Sign-in did not respond. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue('admin@pending.test');
    await waitFor(() => expect(port.signIn).toHaveBeenCalledWith('pending-clinic', 'admin@pending.test', strong));
  });
});

async function completeSingleHospital() {
  click(/^Single facility/);
  click(/^Hospital/);
  click('Continue');
  await screen.findByRole('heading', {name: 'Organization details'});
  type(/Legal name/, 'Fictional Riverside Hospital LLC');
  type(/License number/, 'DEMO-LIC-1');
  type(/Licensed beds/, '120', 'spinbutton');
  fireEvent.change(screen.getByRole('combobox', {name: /Country/}), {target: {value: 'AE'}});
  expect(screen.getByRole('combobox', {name: /Time zone/})).toHaveValue('Asia/Dubai');
  expect(screen.getByRole('combobox', {name: /Billing currency/})).toHaveValue('AED');
  type(/^City/, 'Dubai');
  type(/Street address/, '1 Fictional Street');
  type(/Main phone/, '04 123 4567');
  click('Continue');
  await screen.findByRole('heading', {name: 'Clinical scope'});
  expect(screen.getByText(/We pre-selected 6 care settings/)).toBeInTheDocument();
  click('Continue');
  await screen.findByRole('heading', {name: 'Modules and standards'});
  expect(screen.getByText(/We suggested 26 modules and 4 local integrations/)).toBeInTheDocument();
  click('Continue');
  await screen.findByRole('heading', {name: 'Workspace and administrator'});
  expect(screen.getByRole('textbox', {name: /Workspace address/})).toHaveValue('fictional-riverside-hospital-llc');
  expect(screen.getByRole('combobox', {name: /Data residency/})).toHaveValue('me-uae');
  expect(await screen.findByText(/is available/)).toBeInTheDocument();
  type(/Full name/, 'Amira Haddad');
  fireEvent.change(screen.getByRole('combobox', {name: /^Role/}), {target: {value: 'Medical director'}});
  type(/Work email/, 'amira@riverside.test');
  type(/Mobile number/, '50 123 4567');
  fireEvent.change(screen.getByLabelText(/^Password/), {target: {value: strong}});
  click('Continue');
  await screen.findByRole('heading', {name: 'Review and submit'});
}

describe('organization registration', () => {
  it('Save and exit flushes the current values before the autosave delay', async () => {
    const port = testPort();
    const {onOpen} = renderWithHost(<Routed/>, {target: {pageId: 'orvia-register', query: 'type=clinic'}, port});
    await screen.findByRole('button', {name: /Clinic or polyclinic/, pressed: true});
    click(/^Single facility/); click('Continue');
    await screen.findByRole('heading', {name: 'Organization details'});
    type(/Legal name/, 'Fictional Immediate Draft');
    click('Save and exit', 'link');
    expect(port.loadDraft()).toMatchObject({stepId: 'details', data: {org: {legalName: 'Fictional Immediate Draft'}}});
    expect(onOpen).toHaveBeenLastCalledWith(open('orvia-landing'));
  });
  it('failed draft saving keeps the form open and does not report success', async () => {
    const port = testPort({store: {...memoryStore(), set: () => false}});
    const {onOpen} = renderWithHost(<Routed/>, {target: {pageId: 'orvia-register'}, port});
    await screen.findByRole('heading', {name: 'Organization type'});
    click(/^Single facility/);
    click('Save and exit', 'link');
    expect(await screen.findByRole('alert')).toHaveTextContent('could not save your draft');
    expect(screen.queryByText(/Draft saved at/)).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: /^Single facility/, pressed: true})).toBeInTheDocument();
  });
  it('validates step 1, focuses the first problem and clears errors as they are fixed', async () => {
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-register'}});
    expect(await screen.findByRole('heading', {name: 'Organization type'})).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: 'Registration steps'})).toBeInTheDocument();
    click('Continue');
    expect(await screen.findByRole('alert')).toHaveTextContent('2 items need your attention before you continue.');
    await waitFor(() => expect(document.getElementById('structure')).toHaveFocus());
    click(/^Single facility/);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('1 item needs your attention'));
    click(/^Clinic or polyclinic/);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('progressbar', {name: 'Registration progress'})).toHaveAttribute('aria-valuenow', '0');
  });
  it('completes a single-hospital registration, submits and makes the workspace discoverable', async () => {
    const port = testPort();
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-register'}, port});
    await completeSingleHospital();
    expect(screen.getByText('Fictional Riverside Hospital LLC')).toBeInTheDocument();
    click('Submit registration');
    expect(await screen.findByText('Accept the terms of service to continue')).toBeInTheDocument();
    for (const name of [/terms of service/, /business associate agreement/, /data processing agreement/]) fireEvent.click(screen.getByRole('checkbox', {name}));
    click('Submit registration');
    expect(await screen.findByRole('heading', {name: 'Registration submitted'})).toBeInTheDocument();
    expect(screen.getByText('ORV-26-55000')).toBeInTheDocument();
    expect(port.loadDraft()).toBeNull();
    expect(await port.lookupWorkspace('fictional-riverside-hospital-llc')).toMatchObject({status: 'pending', kind: 'Hospital'});
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getAllByRole('button', {name: /\(completed\)/})).toHaveLength(6);
  });
  it('adds the facilities step for networks with a pre-filled head office and editable rows', async () => {
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-register', query: 'structure=network'}});
    expect(await screen.findByText('Step 1 of 7')).toBeInTheDocument();
    click(/^Pharmacy/); click(/^Diagnostic laboratory/);
    click('Continue');
    await screen.findByRole('heading', {name: 'Organization details'});
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Organization details');
    expect(screen.queryByRole('spinbutton', {name: /Licensed beds/})).toBeNull();
    type(/Legal name/, 'Fictional Care Group'); type(/License number/, 'DEMO-2'); type(/^City/, 'Mumbai'); type(/Street address/, '2 Demo Road'); type(/Main phone/, '22 1234 5678');
    fireEvent.change(screen.getByRole('combobox', {name: /Country/}), {target: {value: 'IN'}});
    click('Continue');
    await screen.findByRole('heading', {name: 'Facilities'});
    expect(screen.getByText(/We started your list with your head office/)).toBeInTheDocument();
    const names = screen.getAllByRole('textbox', {name: 'Facility name'});
    expect(names[0]).toHaveValue('Fictional Care Group');
    click('Continue');
    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    fireEvent.change(names[1]!, {target: {value: 'Fictional North Lab'}});
    click('Add facility');
    await waitFor(() => expect(screen.getAllByRole('textbox', {name: 'Facility name'})[2]).toHaveFocus());
    click(/Remove facility 3/);
    expect(screen.getAllByRole('textbox', {name: 'Facility name'})).toHaveLength(2);
    click('Continue');
    expect(await screen.findByRole('heading', {name: 'Clinical scope'})).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 7')).toBeInTheDocument();
  });
  it('autosaves fields (never the password) and restores the draft on return', async () => {
    const store = memoryStore(), port = testPort({store});
    const first = renderWithHost(<Routed/>, {target: {pageId: 'orvia-register', query: 'type=clinic'}, port});
    expect(await screen.findByRole('button', {name: /Clinic or polyclinic/, pressed: true})).toBeInTheDocument();
    click(/^Single facility/);
    click('Continue');
    await screen.findByRole('heading', {name: 'Organization details'});
    type(/Legal name/, 'Fictional Draft Clinic');
    await waitFor(() => expect(port.loadDraft()).toMatchObject({stepId: 'details', data: {org: {legalName: 'Fictional Draft Clinic'}}}), {timeout: 5000});
    expect(await screen.findByText(/Draft saved at/)).toBeInTheDocument();
    first.unmount();
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-register'}, port: testPort({store})});
    expect(await screen.findByText('We restored your draft from this device.')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Organization details'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /Legal name/})).toHaveValue('Fictional Draft Clinic');
    // Stepper jumps back freely; unreached steps stay disabled.
    expect(screen.getByRole('button', {name: /Review and submit/})).toBeDisabled();
    click(/Organization type \(completed\)/);
    expect(await screen.findByRole('heading', {name: 'Organization type'})).toBeInTheDocument();
  });
  it('asks for the password again after restoring a draft past the workspace step', async () => {
    const store = memoryStore(), port = testPort({store});
    port.saveDraft({data: {structure: 'single', facilityTypes: ['clinic'], workspace: {slug: 'restored-clinic', region: 'eu', adminName: 'Fictional Admin', adminRole: 'Other', adminEmail: 'a@restored.test', adminPhone: '123456', password: strong, mfa: 'sms'}}, stepId: 'workspace', completed: ['organization'], reached: ['organization', 'details', 'scope', 'modules', 'workspace'], savedAt: Date.parse('2026-10-24T08:00:00Z')});
    expect(JSON.stringify(store.get('pepbits-demo.onboarding.fictional-tenant.fixture-admin.registration-draft'))).not.toContain(strong);
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-register'}, port});
    expect(await screen.findByText(/re-enter the administrator password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toHaveValue('');
    expect(screen.getByRole('radio', {name: 'SMS'})).toHaveAttribute('aria-checked', 'true');
  });
  it('keeps every value after a failed submission and succeeds on retry', async () => {
    const port = testPort();
    const submit = port.submitRegistration;
    let fail = true;
    port.submitRegistration = vi.fn(async data => {if (fail) throw new Error('The registration service did not respond. Try again.'); return submit(data);});
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-register'}, port});
    await completeSingleHospital();
    for (const name of [/terms of service/, /business associate agreement/, /data processing agreement/]) fireEvent.click(screen.getByRole('checkbox', {name}));
    click('Submit registration');
    expect(await screen.findByRole('alert')).toHaveTextContent('The registration service did not respond. Try again.');
    expect(screen.getByRole('checkbox', {name: /terms of service/})).toBeChecked();
    fail = false;
    click('Submit registration');
    expect(await screen.findByRole('heading', {name: 'Registration submitted'})).toBeInTheDocument();
    await waitFor(() => expect(port.submitRegistration).toHaveBeenCalledTimes(2));
  });
  it('edits a section from review and uses instant scrolling under reduced motion', async () => {
    renderWithHost(<Routed/>, {target: {pageId: 'orvia-register'}, preferences: {reducedMotion: true}});
    await completeSingleHospital();
    click('Edit Details');
    expect(await screen.findByRole('heading', {name: 'Organization details'})).toBeInTheDocument();
    type(/Legal name/, '');
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    click('Continue');
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({block: 'center', behavior: 'auto'}));
    await act(async () => {type(/Legal name/, 'Fictional Riverside Hospital LLC');});
    click(/Review and submit/);
    expect(await screen.findByRole('heading', {name: 'Review and submit'})).toBeInTheDocument();
  });
});
