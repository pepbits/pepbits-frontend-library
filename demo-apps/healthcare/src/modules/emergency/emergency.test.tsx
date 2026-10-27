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
const patientLite = {id: 'p1', mrn: 'MRN-0001', name: 'Omar Haddad', age: 58, sex: 'male', restricted: false};
const row = (id: string, status: string, waitingMinutes: number) => ({id, patientId: 'p1', class: 'ER', status, department: 'Emergency', arrivedAt: '2026-10-27T08:00:00Z', version: 1, waitingMinutes, reason: 'Chest pain',
  clinicalVisible: true, patient: {...patientLite, name: `Patient ${id}`}, allergyState: null, allergyCount: 0, news2: null, openReviews: 0, reassessOverdue: false});
const detail = {
  encounter: {id: 'e1', patientId: 'p1', class: 'ER', status: 'waiting-triage', department: 'Emergency', arrivedAt: '2026-10-27T08:00:00Z', reason: 'Chest pain', version: 2, waitingMinutes: 9},
  patient: {...patientLite, birthDate: '1968-03-02'}, allergies: {assessment: {state: 'nka'}, entries: []}, observations: {latest: {}},
};
const news = {status: 'complete', total: 1, band: 'Low', severity: 'low', interpretation: 'Routine monitoring.', components: [], missing: []};
type Call = {path: string; method: string; body: unknown};
let calls: Call[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
function routes(path: string, method: string, body: Record<string, unknown> | undefined) {
  if (path === '/auth/me') return json({id: 'u1', name: 'Nurse Maria', role: 'nurse', permissions: ['vitals.write']});
  if (path === '/encounters?class=ER') return json([row('e1', 'waiting-triage', 9), row('e2', 'waiting-triage', 31), row('e3', 'triaged', 50)]);
  if (path === '/encounters/e1') return json(detail);
  if (path === '/scores/news2/calculate') return json(news);
  if (path === '/encounters/esi/preview') return json(body?.lifeSaving ? {level: 1, steps: ['Decision A: immediate life-saving intervention required'], dangerZone: false} : {level: null, steps: ['A: no immediate life-saving intervention'], dangerZone: false});
  if (path === '/catalog/complaints?q=chest&limit=10') return json({items: [{code: '29857009', system: 'http://snomed.info/sct', display: 'Chest pain'}]});
  if (path === '/encounters/e1/intake' && method === 'POST') return json({news2: news, esi: {finalLevel: 1}});
  return json({error: 'Not found'}, 404);
}
beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^\/api\/allyvora-clinical/, ''), method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({path, method, body});
    return routes(path, method, body);
  }));
});
afterEach(() => vi.unstubAllGlobals());
const renderPage = (url: string, host = spies()) => {
  const target = targetFromPath(url), page = pages.find(p => p.id === target.pageId)!;
  return {host, ...render(<TestHostProvider host={{client: mockAllyVora().client, ...host}}><RequestContext.Provider value={(path, init) => fetch('/api' + path, init)}><main><Renderer page={page} target={target}/></main></RequestContext.Provider></TestHostProvider>)};
};
const noViolations = (container: HTMLElement) => act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
const choose = (group: string, option: string) => fireEvent.click(within(screen.getByRole('radiogroup', {name: group})).getByRole('radio', {name: option}));

describe('AllyVora Emergency routes', () => {
  it('maps the triage list and form paths both ways and through the app router', () => {
    expect(targetFromPath('/allyvora-emergency/triage')).toEqual({pageId: PAGE.triage});
    expect(targetFromPath('/allyvora-emergency/triage/e1')).toEqual({pageId: PAGE.triageForm, recordId: 'e1'});
    expect(targetFromPath('/allyvora-emergency/triage/bad%20id')).toEqual({pageId: 'not-found'});
    expect(hrefFor({pageId: PAGE.triageForm, recordId: 'e1'})).toBe('/allyvora-emergency/triage/e1');
    expect(appTargetFromPath('/allyvora-emergency/triage/e1')).toEqual({pageId: PAGE.triageForm, recordId: 'e1'});
    expect(appHrefFor({pageId: PAGE.triage})).toBe('/allyvora-emergency/triage');
    expect(appPages.filter(p => p.module === 'reference-allyvora-emergency').map(p => p.id)).toEqual([PAGE.triage, PAGE.triageForm]);
  });
});

describe('Emergency triage on @pepbits/clinical', () => {
  it('lists patients waiting for triage, longest wait first, and opens the form', async () => {
    const {container, host} = renderPage('/allyvora-emergency/triage');
    const list = await screen.findByRole('list');
    await waitFor(() => expect(within(list).getAllByRole('button', {name: 'Triage now'})).toHaveLength(2));
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Patient e2');
    expect(screen.queryByText('Patient e3')).not.toBeInTheDocument();
    await noViolations(container);
    fireEvent.click(within(list).getAllByRole('button', {name: 'Triage now'})[1]!);
    expect(host.open).toHaveBeenCalledWith({pageId: PAGE.triageForm, recordId: 'e1'});
  });

  it('saves ESI 1 triage with the unchanged AllyVora payload and returns to the list', async () => {
    const {container, host} = renderPage('/allyvora-emergency/triage/e1');
    expect(await screen.findByRole('heading', {name: 'Omar Haddad'})).toBeInTheDocument();
    expect(calls.some(c => c.path.endsWith('/status'))).toBe(false);
    await noViolations(container);
    const search = screen.getByRole('combobox', {name: 'Presenting complaint'});
    fireEvent.change(search, {target: {value: 'chest'}});
    await screen.findByRole('option', {name: /Chest pain/});
    fireEvent.keyDown(search, {key: 'ArrowDown'}); fireEvent.keyDown(search, {key: 'Enter'});
    for (const [label, value] of [['Systolic', '90'], ['Diastolic', '50'], ['Heart rate', '130'], ['Respiratory rate', '28'], ['Temperature', '36.4'], ['SpO₂', '88']] as const)
      fireEvent.change(screen.getByLabelText(label), {target: {value}});
    choose('Air or oxygen', 'Room air'); choose('ACVPU', 'Voice'); choose('Allergy review outcome', 'No known allergies');
    choose('Needs an immediate life-saving intervention?', 'Yes');
    expect(await screen.findByRole('img', {name: 'ESI level 1'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Send to area'), {target: {value: 'Resuscitation'}});
    await noViolations(container);
    fireEvent.click(screen.getByRole('button', {name: 'Save triage'}));
    await waitFor(() => expect(host.open).toHaveBeenCalledWith({pageId: PAGE.triage}));
    const saved = calls.find(c => c.path === '/encounters/e1/intake')!;
    expect(saved.method).toBe('POST');
    expect(saved.body).toMatchObject({mode: 'er', complaint: {code: '29857009', display: 'Chest pain'}, allergyReview: 'nka',
      esi: {lifeSaving: true}, disposition: {area: 'Resuscitation'}, vitals: {sbp: 90, dbp: 50, hr: 130, rr: 28, spo2: 88, o2: 'air', acvpu: 'V'}});
    expect(calls).toContainEqual({path: '/encounters/esi/preview', method: 'POST', body: {lifeSaving: true, ageYears: 58, hr: 130, rr: 28, spo2: 88}});
    expect(host.notify).toHaveBeenCalledWith('Triage saved: ESI 1. Doctor review task created.', {tone: 'success'});
  });
});
