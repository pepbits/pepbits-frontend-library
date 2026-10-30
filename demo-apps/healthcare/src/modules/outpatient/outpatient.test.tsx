import React from 'react';
import axe from 'axe-core';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestHostProvider, spies} from '../../test/allyvora/host';
import {mockAllyVora} from '../../test/allyvora/mock-api';
import {Renderer} from '../../renderer';
import {RequestContext} from '../../adapters/http';
import {hrefFor as appHrefFor, pages as appPages, targetFromPath as appTargetFromPath} from '../../navigation';
import {PAGE, hrefFor, pages, targetFromPath} from './routes';

/* Fictional AllyVora clinical workspace API responses; no real patient. */
const patientLite = {id: 'p1', mrn: 'MRN-0001', name: 'Meera Nair', age: 41, sex: 'female', restricted: false};
const row = (id: string, status: string) => ({id, patientId: 'p1', class: 'OP', status, department: 'General Medicine', arrivedAt: '2026-10-27T08:00:00Z', version: 1, waitingMinutes: 12,
  clinicalVisible: true, patient: {...patientLite, name: `Patient ${id}`}, allergyState: null, allergyCount: 0, news2: null, openReviews: 0});
const detail = {
  encounter: {id: 'e1', patientId: 'p1', class: 'OP', status: 'registered', department: 'General Medicine', arrivedAt: '2026-10-27T08:00:00Z', reason: 'Cough', version: 2, waitingMinutes: 12},
  patient: {...patientLite, birthDate: '1985-03-02'}, allergies: {assessment: {state: 'not-assessed'}, entries: []}, observations: {latest: {}},
};
const news = {status: 'complete', total: 0, band: 'Low', severity: 'low', interpretation: 'Routine monitoring.', components: [], missing: []};
type Call = {path: string; method: string; body: unknown};
let calls: Call[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
function routes(path: string, method: string) {
  if (path === '/auth/me') return json({id: 'u1', name: 'Nurse Maria', role: 'nurse', permissions: ['vitals.write']});
  if (path === '/encounters?class=OP') return json([row('e1', 'registered'), row('e2', 'intake'), row('e3', 'ready')]);
  if (path === '/encounters/e1') return json(detail);
  if (path === '/encounters/e1/status' && method === 'PATCH') return json({});
  if (path === '/scores/news2/calculate') return json(news);
  if (path === '/encounters/e1/intake' && method === 'POST') return json({news2: news, esi: null});
  return json({error: 'Not found'}, 404);
}
beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^\/api\/allyvora-clinical/, ''), method = (init.method ?? 'GET').toUpperCase();
    calls.push({path, method, body: init.body ? JSON.parse(String(init.body)) : undefined});
    return routes(path, method);
  }));
});
afterEach(() => vi.unstubAllGlobals());
const renderPage = (url: string, host = spies()) => {
  const target = targetFromPath(url), page = pages.find(p => p.id === target.pageId)!;
  return {host, ...render(<TestHostProvider host={{client: mockAllyVora().client, ...host}}><RequestContext.Provider value={(path, init) => fetch('/api' + path, init)}><main><Renderer page={page} target={target}/></main></RequestContext.Provider></TestHostProvider>)};
};
const noViolations = (container: HTMLElement) => act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});

describe('AllyVora Outpatient routes', () => {
  it('maps the queue and form paths both ways and through the app router', () => {
    expect(targetFromPath('/allyvora-outpatient/intake')).toEqual({pageId: PAGE.intake});
    expect(targetFromPath('/allyvora-outpatient/intake/e1')).toEqual({pageId: PAGE.intakeForm, recordId: 'e1'});
    expect(targetFromPath('/allyvora-outpatient/intake/bad%20id')).toEqual({pageId: 'not-found'});
    expect(hrefFor({pageId: PAGE.intakeForm, recordId: 'e1'})).toBe('/allyvora-outpatient/intake/e1');
    expect(appTargetFromPath('/allyvora-outpatient/intake/e1')).toEqual({pageId: PAGE.intakeForm, recordId: 'e1'});
    expect(appHrefFor({pageId: PAGE.intake})).toBe('/allyvora-outpatient/intake');
    expect(appPages.filter(p => p.module === 'reference-allyvora-outpatient').map(p => p.id)).toEqual([PAGE.intake, PAGE.intakeForm]);
  });
});

describe('Nurse intake on @pepbits/healthcare/clinical', () => {
  it('lists waiting visits and opens the form for one', async () => {
    const {container, host} = renderPage('/allyvora-outpatient/intake');
    expect(await screen.findByText('Patient e1')).toBeInTheDocument();
    expect(screen.getByText('Patient e2')).toBeInTheDocument();
    expect(screen.queryByText('Patient e3')).not.toBeInTheDocument();
    await waitFor(() => expect(calls.some(c => c.path === '/auth/me')).toBe(true));
    await noViolations(container);
    fireEvent.click(screen.getByRole('button', {name: 'Start intake'}));
    expect(host.open).toHaveBeenCalledWith({pageId: PAGE.intakeForm, recordId: 'e1'});
  });

  it('records the intake with the unchanged AllyVora payload and returns to the queue', async () => {
    const {container, host} = renderPage('/allyvora-outpatient/intake/e1');
    expect(await screen.findByRole('heading', {name: 'Meera Nair'})).toBeInTheDocument();
    await waitFor(() => expect(calls).toContainEqual({path: '/encounters/e1/status', method: 'PATCH', body: {status: 'intake'}}));
    await noViolations(container);
    for (const [label, value] of [['Systolic', '120'], ['Diastolic', '80'], ['Heart rate', '72'], ['Respiratory rate', '14'], ['Temperature', '36.6'], ['SpO₂', '99']] as const)
      fireEvent.change(screen.getByLabelText(label), {target: {value}});
    const choose = (group: string, option: string) => fireEvent.click(within(screen.getByRole('radiogroup', {name: group})).getByRole('radio', {name: option}));
    choose('Air or oxygen', 'Room air'); choose('ACVPU', 'Alert'); choose('Allergy review outcome', 'No known allergies');
    fireEvent.click(screen.getByRole('button', {name: 'Save and send to doctor'}));
    await waitFor(() => expect(host.open).toHaveBeenCalledWith({pageId: PAGE.intake}));
    const saved = calls.find(c => c.path === '/encounters/e1/intake')!;
    expect(saved.method).toBe('POST');
    expect(saved.body).toMatchObject({mode: 'op', allergyReview: 'nka', screening: {}, vitals: {sbp: 120, dbp: 80, hr: 72, rr: 14, temp: 36.6, spo2: 99, o2: 'air', acvpu: 'A', notMeasured: {}}});
    expect(host.notify).toHaveBeenCalledWith('Intake saved. Meera Nair is ready for the doctor.', {tone: 'success'});
  });

  it('explains a missing backend instead of showing an empty clinic', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({error: 'The healthcare demo API is not configured.'}, 503)));
    renderPage('/allyvora-outpatient/intake');
    expect(await screen.findByText('The healthcare demo API is not configured.')).toBeInTheDocument();
  });
});
