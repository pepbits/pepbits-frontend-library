import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {usePreferences} from '@pepbits/preferences/react';
import {AllyVoraProviders} from './providers';
import type {Request} from './adapters/http';
import {sharedMessages} from './test/host';
import {fixtureSession} from './test/session';
const navigation = {current: {pageId: 'allyvora-patients'}, open: vi.fn(), openInNewContext: vi.fn(), hrefFor: () => '/patients'};
function Probe() {const {preferences, update, isLocked} = usePreferences(); return <div><output data-testid="snapshot">{JSON.stringify(preferences)}</output><input aria-label="Unsaved note"/><button onClick={() => void update({density: 'spacious'})} disabled={isLocked('density')}>Density</button><button onClick={() => void update({reducedMotion: true})}>Motion</button><button onClick={() => void update({language: 'ar'})}>Arabic</button></div>;}
function service() {
  let snapshot = {overrides: {}, preferences: {}, policy: {revision: 1, rules: {}}, userRevision: 1, canManage: false};
  const writes: Record<string, any>[] = [];
  const request = vi.fn<Request>(async (path, init) => {
    if (path.startsWith('/localization')) return Response.json({messages: sharedMessages, fallbackMessages: sharedMessages});
    if (path === '/preferences') {
      if (init?.method === 'PUT') {const body = JSON.parse(String(init.body)); writes.push(body); snapshot = {...snapshot, overrides: body.preferences, preferences: body.preferences, userRevision: snapshot.userRevision + 1};}
      return Response.json(snapshot);
    }
    throw new Error('Unexpected request ' + path);
  });
  return {request, writes, setPolicy: () => {snapshot = {...snapshot, policy: {revision: 2, rules: {density: {value: 'compact', locked: true}}}} as typeof snapshot;}};
}
const mount = (request: Request) => render(<AllyVoraProviders apiBaseUrl="/api" navigation={navigation} request={request} session={fixtureSession}><Probe/></AllyVoraProviders>);
test('one serialized preference path retains adjacent writes and API revisions', async () => {
  const api = service(); mount(api.request);
  fireEvent.click(await screen.findByRole('button', {name: 'Density'}));
  fireEvent.click(screen.getByRole('button', {name: 'Motion'}));
  await waitFor(() => expect(api.writes).toHaveLength(2));
  expect(api.writes[1]).toMatchObject({userRevision: 2, policyRevision: 1, preferences: {density: 'spacious', reducedMotion: true}});
});
test('language catalog refresh preserves the mounted editor and switches direction', async () => {
  const api = service(); mount(api.request);
  const note = await screen.findByRole('textbox', {name: 'Unsaved note'});
  fireEvent.change(note, {target: {value: 'Fictional unsaved text'}});
  fireEvent.click(screen.getByRole('button', {name: 'Arabic'}));
  await waitFor(() => expect(api.request).toHaveBeenCalledWith('/localization?productId=nexora&language=ar'));
  expect(screen.getByRole('textbox', {name: 'Unsaved note'})).toBe(note);
  expect(note).toHaveValue('Fictional unsaved text');
  await waitFor(() => expect(note.closest('[dir]')?.getAttribute('dir')).toBe('rtl'));
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
  const request: Request = (path, init) => init?.method === 'PUT' ? Promise.resolve(Response.json({error: 'Revision conflict'}, {status: 409})) : api.request(path, init);
  mount(request);
  fireEvent.click(await screen.findByRole('button', {name: 'Density'}));
  await act(async () => {await new Promise(resolve => setTimeout(resolve, 30));});
  expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).not.toBe('spacious');
});
