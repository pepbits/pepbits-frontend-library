import React from 'react';
import axe from 'axe-core';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestHostProvider, spies} from '../../../test/allyvora/host';
import {mockAllyVora} from '../../../test/allyvora/mock-api';
import {StartVisit} from './StartVisit';
import {EmergencyRegistration} from './EmergencyRegistration';

/* Fictional front desk API responses (the front desk backend is separate from the AllyVora Patients mock). */
const patient = {id: 'p1', mrn: 'MRN-0001', name: 'Meera Nair', age: 41, sex: 'female', restricted: false, identityStatus: 'verified'};
const context = {
  patient, coverage: null, blocked: [], openVisits: [], appointments: [], referrals: [], clinicians: [{id: 'u1', name: 'Dr Rao', role: 'consultant'}],
  departments: [{code: 'GM', name: 'General Medicine', services: ['outpatient'], specialties: ['Internal medicine']}, {code: 'ED', name: 'Emergency', services: ['emergency'], specialties: []}],
  clinics: [], arrivalModes: ['walk-in', 'ambulance'],
  actions: [{key: 'start-visit', label: 'Start a visit now', description: 'Outpatient or emergency visit', allowed: true}, {key: 'appointments', label: 'Book an appointment', description: 'Clinic booking', href: '/front-desk/appointments', allowed: true}],
};
type Call = {path: string; method: string; body: unknown};
let calls: Call[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
function routes(path: string, method: string) {
  if (path.startsWith('/patients?q=')) return json([patient]);
  if (path === '/front-desk/overview') return json({appointments: {upcoming: []}});
  if (path === '/patients/p1/visit-context') return json(context);
  if (path === '/patients/p1/visits' && method === 'POST') return json({encounter: {id: 'e1', class: 'OP'}});
  if (path === '/services') return json({specialties: [], departments: context.departments, clinics: [], wards: []});
  if (path === '/identity-policy/library') return json({types: [], countries: [{code: 'IN', label: 'India'}]});
  if (path === '/patients' && method === 'POST') return json({patient: {id: 'p9', mrn: 'TMP-000042', name: 'Unknown Kilo-0042', restricted: false, identityStatus: 'unknown'}, encounter: {id: 'e9', class: 'ER'}});
  return json({error: 'Not found'}, 404);
}
beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^\/api/, ''), method = (init.method ?? 'GET').toUpperCase();
    calls.push({path, method, body: init.body ? JSON.parse(String(init.body)) : undefined});
    return routes(path, method);
  }));
});
afterEach(() => vi.unstubAllGlobals());
const noViolations = (container: HTMLElement) => act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
const host = (notify = vi.fn()) => ({client: mockAllyVora().client, ...spies(), notify});
/** The test host provider loads the module session before rendering its children. */
const ready = (container: HTMLElement) => waitFor(() => expect(container.querySelector('[data-start-visit], [data-emergency-mode]')).toBeTruthy());

describe('front desk pages on @pepbits components', () => {
  it('Start a visit advances find → visit details → done and posts the unchanged visit payload', async () => {
    const notify = vi.fn();
    const {container} = render(<TestHostProvider host={host(notify)}><StartVisit/></TestHostProvider>);
    await ready(container);
    const stepper = container.querySelector('[data-wizard-stepper]')!;
    expect(stepper).toBeTruthy();
    expect(within(stepper as HTMLElement).getByText('Find patient').closest('button')).toHaveAttribute('aria-current', 'step');
    expect(container.querySelector('[data-start-visit="find"]')).toBeTruthy();
    expect(container.querySelector('.allyvora-front-desk, [class*="lapis"], [class*="rounded-ctl"]')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', {name: 'Search patients'}), {target: {value: 'meera'}});
    const option = await screen.findByRole('option', {}, {timeout: 2000});
    fireEvent.click(within(option).getByRole('button'));

    await waitFor(() => expect(container.querySelector('[data-start-visit="details"]')).toBeTruthy());
    expect(stepper.querySelector('[data-step="find"]')).toHaveAttribute('data-state', 'done');
    expect(screen.getByRole('radiogroup', {name: 'Type of visit'})).toBeInTheDocument();
    expect(container.querySelector('[data-service="start-visit"] button')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', {name: /Start outpatient visit/}));
    await waitFor(() => expect(container.querySelector('[data-start-visit="done"]')).toBeTruthy());
    expect(screen.getByText('Visit started')).toBeInTheDocument();
    expect(calls.find(call => call.method === 'POST')).toEqual({path: '/patients/p1/visits', method: 'POST',
      body: {visit: {type: 'walk-in', department: 'General Medicine', billing: 'self-pay', priority: 'routine'}}});
    expect(notify).toHaveBeenCalledWith('Visit started for Meera Nair.', {tone: 'success'});
    // Screens absent from the demo stay disabled.
    expect(screen.getByText('Start nurse intake').closest('[aria-disabled="true"]')).toHaveAttribute('title', 'Not available in this demo');
  });

  it('Start a visit with ?patient opens visit details and validates referrals before posting', async () => {
    const {container} = render(<TestHostProvider host={host()}><StartVisit patient="p1"/></TestHostProvider>);
    await waitFor(() => expect(container.querySelector('[data-start-visit="details"]')).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', {name: 'Referred'}));
    expect(container.querySelector('[data-referral-source]')).toBeTruthy();
    await noViolations(container);
    fireEvent.click(screen.getByRole('button', {name: /Start outpatient visit/}));
    expect(await screen.findByText('Enter who referred the patient.')).toBeInTheDocument();
    expect(calls.some(call => call.method === 'POST')).toBe(false);
  });

  it('Emergency registration validates, then registers an unknown patient with the unchanged payload', async () => {
    const {container} = render(<TestHostProvider host={host()}><EmergencyRegistration/></TestHostProvider>);
    await ready(container);
    expect(screen.getByRole('radiogroup', {name: 'Who is the patient?'})).toBeInTheDocument();
    expect(container.querySelector('[data-emergency-form="unknown"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /Register unknown patient/}));
    expect(await screen.findByText('Enter the estimated age in whole years (0–120).')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('spinbutton', {name: /Estimated age/}), {target: {value: '40'}});
    fireEvent.click(screen.getByRole('button', {name: /Register unknown patient/}));
    await waitFor(() => expect(container.querySelector('[data-emergency-mode="done"]')).toBeTruthy());
    expect(screen.getByText('TMP-000042')).toBeInTheDocument();
    expect(calls.find(call => call.method === 'POST')?.body).toEqual({identityMode: 'unknown',
      unidentified: {estimatedAge: 40, arrivalMode: 'ambulance', broughtBy: '', foundAt: '', referenceNumber: '', description: '', belongings: ''},
      sex: 'unknown', sensitivity: 'normal', consents: {emergencyException: true}, visit: {type: 'emergency', department: 'Emergency', arrivalMode: 'ambulance'}});
  });

  it('Emergency registration requires consent details for a patient who can say who they are', async () => {
    const {container} = render(<TestHostProvider host={host()}><EmergencyRegistration/></TestHostProvider>);
    await ready(container);
    fireEvent.click(screen.getByRole('radio', {name: /Can say who they are/}));
    expect(container.querySelector('[data-emergency-form="known"] [data-consent]')).toBeTruthy();
    await noViolations(container);
    fireEvent.click(screen.getByRole('button', {name: /Register and send to triage/}));
    expect(await screen.findByText('Enter the name the patient gives.')).toBeInTheDocument();
    expect(screen.getByText('Choose administrative sex.')).toBeInTheDocument();
    expect(calls.some(call => call.method === 'POST')).toBe(false);
  });
});
