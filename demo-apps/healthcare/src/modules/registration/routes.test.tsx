import React from 'react';
import {act, render, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import axe from 'axe-core';
import type {PreferencePolicy, UserPreferences} from '@pepbits/preferences';
import {HealthcareProviders} from '../../providers';
import {HealthcarePage, Renderer} from '../../renderer';
import {PAGE, hrefFor, pages, targetFromPath} from './routes';
import type {Request} from '../../adapters/http';
import {TestHostProvider, sharedMessages} from '../../test/allyvora/host';
import {mockAllyVora} from '../../test/allyvora/mock-api';
import {fixtureSession} from '../../test/allyvora/session';

const profiles: [string, Partial<UserPreferences>, PreferencePolicy['rules']][] = [
  ['default', {}, {}],
  ['Arabic RTL', {language: 'ar'}, {}],
  ['reduced motion', {reducedMotion: true}, {}],
  ['locked preferences', {}, {density: {value: 'compact', locked: true}, pageSize: {value: 10, locked: true}}],
];
const routes: [string, string][] = [
  ['register', '/allyvora-patients/patients'],
  ['inactive view', '/allyvora-patients/patients?view=inactive'],
  ['filtered search', '/allyvora-patients/patients?q=meera&sort=name'],
  ['new patient', '/allyvora-patients/patients?mode=new'],
  ['edit patient', '/allyvora-patients/patients?mode=edit&id=1'],
  ['edit section', '/allyvora-patients/patients?mode=edit&id=1&section=contact'],
  ['patient record', '/allyvora-patients/patients?mode=view&id=1'],
  ['start a visit', '/allyvora-patients/visits/new'],
  ['start a visit for a patient', '/allyvora-patients/visits/new?patient=1'],
  ['emergency registration', '/allyvora-patients/emergency'],
];
const ready: Record<string, string> = {register: '[data-patient-register]', 'inactive view': '[data-patient-register]', 'filtered search': '[data-patient-register]', 'new patient': '[data-record-form="new"]', 'edit patient': '[data-record-form="edit"]', 'edit section': '[data-record-form="edit"]', 'patient record': '[data-patient-view]', 'start a visit': '[data-front-desk="allyvora-start-visit"]', 'start a visit for a patient': '[data-front-desk="allyvora-start-visit"]', 'emergency registration': '[data-front-desk="allyvora-emergency-registration"]'};

describe.each(profiles)('%s route rendering', (profile, preferences, rules) => {
  it.each(routes)('%s (%s)', async (name, url) => {
    const [path, query = ''] = url.split('?'), target = targetFromPath(path!, query), page = pages.find(item => item.id === target.pageId)!;
    expect(hrefFor(target)).toBe(url);
    const api = mockAllyVora();
    const {container} = render(<TestHostProvider host={{client: api.client, preferences, policy: {revision: 1, rules}}}><main dir={profile === 'Arabic RTL' ? 'rtl' : 'ltr'}><Renderer page={page} target={target}/></main></TestHostProvider>);
    await waitFor(() => expect(container.querySelector(ready[name]!)).toBeTruthy());
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
    if (name === 'register') {
      await waitFor(() => expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
      expect(container.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(profile === 'locked preferences' ? 10 : 20);
      const size = container.querySelector<HTMLSelectElement>('select[aria-label]');
      if (profile === 'locked preferences') expect(size).toBeDisabled();
    }
    if (name === 'edit section') expect(container.querySelector('[data-section="contact"]')).toBeTruthy();
    expect(container.querySelector('h1')).toBeTruthy();
    await act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
  });
});

const hostRequest = (overrides: Partial<UserPreferences>, rules: PreferencePolicy['rules']): Request => async path => Response.json(path.startsWith('/localization') ? {messages: sharedMessages, fallbackMessages: sharedMessages}
  : {overrides, preferences: {}, policy: {revision: 1, rules}, userRevision: 1, canManage: false});
describe.each(profiles)('%s full host', (_profile, preferences, rules) => {
  it.each([['preferences', PAGE.preferences, '[data-page-id="preferences"]'], ['register', PAGE.register, '[data-patient-register]']] as const)('%s renders inside the shared shell', async (_name, pageId, selector) => {
    const target = {pageId}, api = mockAllyVora();
    const navigation = {current: target, hrefFor, open: vi.fn(), openInNewContext: vi.fn()};
    const {container} = render(<HealthcareProviders apiBaseUrl="/api" navigation={navigation} request={hostRequest(preferences, rules)} session={fixtureSession}><HealthcarePage target={target} replace={vi.fn()} client={api.client}/></HealthcareProviders>);
    await waitFor(() => expect(container.querySelector(selector)).toBeTruthy());
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
    await act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
  });
});

it('front desk routes keep the patient parameter and reject unsafe ids', () => {
  expect(targetFromPath('/allyvora-patients/visits/new', 'patient=12')).toEqual({pageId: PAGE.startVisit, recordId: '12'});
  expect(targetFromPath('/allyvora-patients/visits/new', 'patient=../x')).toEqual({pageId: PAGE.startVisit});
  expect(hrefFor({pageId: PAGE.emergency})).toBe('/allyvora-patients/emergency');
});

it('unknown routes render the shared not-found state inside the host', async () => {
  const target = targetFromPath('/allyvora-patients/patients/12'), api = mockAllyVora();
  expect(target.pageId).toBe('not-found');
  const navigation = {current: target, hrefFor, open: vi.fn(), openInNewContext: vi.fn()};
  const {findByText} = render(<HealthcareProviders apiBaseUrl="/api" navigation={navigation} request={hostRequest({}, {})} session={fixtureSession}><HealthcarePage target={target} replace={vi.fn()} client={api.client}/></HealthcareProviders>);
  expect(await findByText('Not found')).toBeTruthy();
  expect(api.calls).toHaveLength(0);
});
