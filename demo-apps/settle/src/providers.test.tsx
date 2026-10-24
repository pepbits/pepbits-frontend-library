import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {usePreferences} from '@pepbits/preferences/react';
import {SettleProviders} from './providers';
import type {Request} from './adapters/http';
import {fixtureSession, hostRequest} from './test/host';
import {mockSettle} from './test/mock-settle';

const navigation = {current: {pageId: 'settle-desk'}, open: vi.fn(), openInNewContext: vi.fn(), hrefFor: () => '/'};
function Probe() {
  const {preferences, update, isLocked} = usePreferences();
  return <div><output data-testid="snapshot">{JSON.stringify(preferences)}</output><input aria-label="Unsaved note"/>
    <button onClick={() => void update({density: 'spacious'})} disabled={isLocked('density')}>Density</button>
    <button onClick={() => void update({reducedMotion: true})}>Motion</button>
    <button onClick={() => void update({language: 'ar'})}>Arabic</button></div>;
}
function mount(request: Request) {
  return render(<SettleProviders apiBaseUrl="/api" settleApiBaseUrl="/settle-api" settleFetch={mockSettle().fetcher} navigation={navigation} request={request} session={fixtureSession}><Probe/></SettleProviders>);
}
test('one serialized preference path retains adjacent writes and API revisions', async () => {
  const api = hostRequest(); mount(api.request);
  fireEvent.click(await screen.findByRole('button', {name: 'Density'}));
  fireEvent.click(screen.getByRole('button', {name: 'Motion'}));
  await waitFor(() => expect(api.writes).toHaveLength(2));
  expect(api.writes[1]).toMatchObject({userRevision: 2, policyRevision: 1, preferences: {density: 'spacious', reducedMotion: true}});
});
test('language catalog refresh preserves the mounted editor and switches direction', async () => {
  const api = hostRequest(); mount(api.request);
  const note = await screen.findByRole('textbox', {name: 'Unsaved note'});
  fireEvent.change(note, {target: {value: 'Fictional unsaved text'}});
  fireEvent.click(screen.getByRole('button', {name: 'Arabic'}));
  await waitFor(() => expect(api.request).toHaveBeenCalledWith('/localization?productId=nexora&language=ar'));
  expect(screen.getByRole('textbox', {name: 'Unsaved note'})).toBe(note);
  expect(note).toHaveValue('Fictional unsaved text');
  await waitFor(() => expect(document.querySelector('[dir="rtl"]')).toBeTruthy());
});
test('runtime tenant locks replace effective values and block writes', async () => {
  let rules = {};
  const base = hostRequest();
  const request: Request = async (path, init) => path === '/preferences' && !init?.method ? Response.json({overrides: {}, preferences: {}, policy: {revision: 2, rules}, userRevision: 1, canManage: false}) : base.request(path, init);
  mount(request);
  await screen.findByRole('button', {name: 'Density'});
  rules = {density: {value: 'compact', locked: true}};
  act(() => window.dispatchEvent(new Event('pepbits-preference-policy-changed')));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Density'})).toBeDisabled());
  fireEvent.click(screen.getByRole('button', {name: 'Density'}));
  expect(base.writes).toHaveLength(0);
  expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).toBe('compact');
});
test('rejected preference writes retain the accepted state', async () => {
  const base = hostRequest();
  const request: Request = (path, init) => init?.method === 'PUT' ? Promise.resolve(Response.json({error: 'Revision conflict'}, {status: 409})) : base.request(path, init);
  mount(request);
  fireEvent.click(await screen.findByRole('button', {name: 'Density'}));
  await act(async () => {await new Promise(resolve => setTimeout(resolve, 30));});
  expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).not.toBe('spacious');
});
