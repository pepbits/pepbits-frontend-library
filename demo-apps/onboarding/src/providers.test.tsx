import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import axe from 'axe-core';
import type {PreferencePolicy, UserPreferences} from '@pepbits/preferences';
import {usePreferences} from '@pepbits/preferences/react';
import type {SessionValue} from '@pepbits/platform/auth';
import {OnboardingProviders} from './providers';
import {OnboardingPage} from './renderer';
import type {Request} from './adapters/http';
import {sharedMessages, testPort} from './test/host';
import {fixtureSession} from './test/session';

const navigation = {current: {pageId: 'orvia-workspace'}, open: vi.fn(), openInNewContext: vi.fn(), hrefFor: () => '/workspace'};
function Probe() {
  const {preferences, update, isLocked} = usePreferences();
  return <div><output data-testid="snapshot">{JSON.stringify(preferences)}</output><input aria-label="Unsaved note"/>
    <button onClick={() => void update({density: 'spacious'})} disabled={isLocked('density')}>Density</button>
    <button onClick={() => void update({reducedMotion: true})}>Motion</button>
    <button onClick={() => void update({language: 'ar'})}>Arabic</button></div>;
}
function service(preferences: Partial<UserPreferences> = {}, policy: PreferencePolicy = {revision: 1, rules: {}}) {
  let snapshot = {overrides: preferences, preferences, policy, userRevision: 1, canManage: false};
  const writes: Record<string, any>[] = [];
  const request = vi.fn<Request>(async (path, init) => {
    if (path.startsWith('/localization')) return Response.json({messages: sharedMessages, fallbackMessages: sharedMessages});
    if (path === '/preferences') {
      if (init?.method === 'PUT') {const body = JSON.parse(String(init.body)); writes.push(body); snapshot = {...snapshot, overrides: body.preferences, preferences: body.preferences, userRevision: snapshot.userRevision + 1};}
      return Response.json(snapshot);
    }
    if (path === '/preference-policy') return Response.json({revision: snapshot.policy.revision, rules: snapshot.policy.rules});
    throw new Error('Unexpected request ' + path);
  });
  return {request, writes, setPolicy: () => {snapshot = {...snapshot, policy: {revision: 2, rules: {density: {value: 'compact', locked: true}}}};}};
}
const mount = (request: Request, children: React.ReactNode = <Probe/>, session: SessionValue = fixtureSession) => render(<OnboardingProviders apiBaseUrl="/api" navigation={navigation} request={request} session={session}>{children}</OnboardingProviders>);

test('one serialized preference path retains adjacent writes and API revisions', async () => {
  const api = service(); mount(api.request);
  fireEvent.click(await screen.findByRole('button', {name: 'Density'}));
  fireEvent.click(screen.getByRole('button', {name: 'Motion'}));
  await waitFor(() => expect(api.writes).toHaveLength(2));
  expect(api.writes[1]).toMatchObject({userRevision: 2, policyRevision: 1, preferences: {density: 'spacious', reducedMotion: true}});
});
test('language catalog refresh preserves the mounted editor', async () => {
  const api = service(); mount(api.request);
  const note = await screen.findByRole('textbox', {name: 'Unsaved note'});
  fireEvent.change(note, {target: {value: 'Fictional unsaved text'}});
  fireEvent.click(screen.getByRole('button', {name: 'Arabic'}));
  await waitFor(() => expect(api.request).toHaveBeenCalledWith('/localization?productId=nexora&language=ar'));
  expect(screen.getByRole('textbox', {name: 'Unsaved note'})).toBe(note);
  expect(note).toHaveValue('Fictional unsaved text');
  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
});
test('runtime tenant locks replace effective values and block writes', async () => {
  const api = service(); mount(api.request);
  await screen.findByRole('button', {name: 'Density'});
  api.setPolicy();
  act(() => window.dispatchEvent(new Event('pepbits-preference-policy-changed')));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Density'})).toBeDisabled());
  fireEvent.click(screen.getByRole('button', {name: 'Density'}));
  expect(api.writes).toHaveLength(0);
  expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).toBe('compact');
});
test('rejected preference writes retain accepted state', async () => {
  const api = service();
  const request = vi.fn<Request>((path, init) => init?.method === 'PUT' ? Promise.resolve(Response.json({error: 'Revision conflict'}, {status: 409})) : api.request(path, init));
  mount(request);
  fireEvent.click(await screen.findByRole('button', {name: 'Density'}));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/preferences', expect.objectContaining({method: 'PUT'})));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Density'})).toBeDisabled());
  expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).not.toBe('spacious');
});
test('the full shell renders an onboarding page with its own navigation', async () => {
  const api = service();
  mount(api.request, <OnboardingPage target={{pageId: 'orvia-workspace'}} port={testPort()}/>);
  // The shell header and the page both title the destination.
  expect((await screen.findAllByRole('heading', {name: 'Find your workspace', level: 1})).length).toBe(2);
  expect(document.querySelector('[data-page-id="orvia-workspace"] .orvia')).toBeTruthy();
  expect(screen.getAllByRole('link', {name: /Register your organization/}).length).toBeGreaterThan(0);
});
test.each([
  ['default', {}, {revision: 1, rules: {}}],
  ['Arabic RTL', {language: 'ar'}, {revision: 1, rules: {}}],
  ['reduced motion', {reducedMotion: true}, {revision: 1, rules: {}}],
  ['locked preference', {density: 'spacious'}, {revision: 1, rules: {density: {value: 'compact', locked: true}}}],
] as const)('the shared preferences route renders with no axe violations: %s', async (profile, preferences, policy) => {
  const api = service(preferences, policy);
  const view = mount(api.request, <OnboardingPage target={{pageId: 'preferences'}} port={testPort()}/>);
  await waitFor(() => expect(view.container.querySelector('[data-page-id="preferences"]')).toBeTruthy());
  expect((await screen.findAllByRole('combobox')).length).toBeGreaterThan(0);
  await waitFor(() => expect(document.documentElement.dir).toBe(profile === 'Arabic RTL' ? 'rtl' : 'ltr'));
  await act(async () => {expect((await axe.run(view.container.querySelector('[data-page-id="preferences"]')!, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
});
test('signed-out visitors get the shared login screen, not onboarding content', async () => {
  const api = service();
  mount(api.request, <OnboardingPage target={{pageId: 'orvia-landing'}} port={testPort()}/>, {status: 'anonymous', user: null, login: async () => null, logout: async () => {}} as unknown as SessionValue);
  expect(await screen.findByRole('button', {name: /sign in/i})).toBeInTheDocument();
  expect(screen.queryByText('One record of care, from front desk to final claim.')).toBeNull();
  expect(api.request).not.toHaveBeenCalledWith('/preferences', expect.anything());
});
