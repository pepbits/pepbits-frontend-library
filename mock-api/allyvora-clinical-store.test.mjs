import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllyVoraClinicalStore, esi, news2} from './allyvora-clinical-store.mjs';

const nurse = {id: 'u1', role: 'enterprise-admin', name: 'Demo user'}, doctor = {id: 'u2', role: 'teleconsult-doctor', name: 'Demo doctor'};
const store = () => createAllyVoraClinicalStore({now: () => Date.parse('2026-10-27T10:00:00Z')});
const call = (s, user, method, path, body, query = '') => s.handle(user, {method, path, query: new URLSearchParams(query), body});
const vitals = {sbp: 128, dbp: 82, hr: 76, rr: 16, temp: 36.8, spo2: 98, o2: 'air', o2Flow: null, acvpu: 'A', pain: null, glucose: null, weight: null, height: null, notMeasured: {}};

test('NEWS2 follows the workspace bands and reports missing inputs', () => {
  assert.deepEqual([news2({rr: 16, spo2: 98, air: 'air', sbp: 128, hr: 76, acvpu: 'A', temp: 36.8}).total, news2({rr: 16, spo2: 98, air: 'air', sbp: 128, hr: 76, acvpu: 'A', temp: 36.8}).band], [0, 'Low']);
  const high = news2({rr: 26, spo2: 90, air: 'oxygen', sbp: 88, hr: 135, acvpu: 'V', temp: 39.4});
  assert.equal(high.total, 19); assert.equal(high.severity, 'critical');
  assert.equal(news2({rr: 16, spo2: 98, air: 'air', sbp: 128, hr: 76, acvpu: 'P', temp: 36.8}).band, 'Low–medium (single parameter 3)');
  const missing = news2({rr: 16});
  assert.equal(missing.status, 'incomplete'); assert.equal(missing.total, null); assert.ok(missing.missing.includes('Pulse'));
});

test('ESI follows decision points A to D with the age-banded danger zone', () => {
  assert.equal(esi({}).level, null);
  assert.equal(esi({lifeSaving: true}).level, 1);
  assert.equal(esi({lifeSaving: false, highRisk: true}).level, null);
  assert.equal(esi({lifeSaving: false, highRisk: false, confusedLethargic: true, severePain: false}).level, 2);
  const b = {lifeSaving: false, highRisk: false, confusedLethargic: false, severePain: false};
  assert.deepEqual([0, 1].map(resources => esi({...b, resources}).level), [5, 4]);
  assert.equal(esi({...b, resources: 2, ageYears: 40, hr: 90, rr: 16, spo2: 97}).level, 3);
  assert.deepEqual([esi({...b, resources: 2, ageYears: 40, hr: 120}).level, esi({...b, resources: 2, ageYears: 40, hr: 120}).dangerZone], [2, true]);
  assert.equal(esi({...b, resources: 2, ageYears: 1, hr: 150}).level, 3);
  assert.ok(esi({...b, resources: 5}).error);
});

test('lists each class with wait, safety and patient details', () => {
  const s = store();
  const op = call(s, nurse, 'GET', '/encounters', {}, 'class=OP').body, er = call(s, nurse, 'GET', '/encounters', {}, 'class=ER').body;
  assert.ok(op.length >= 5 && op.every(r => r.class === 'OP'));
  assert.equal(er.filter(r => r.status === 'waiting-triage').length, 3);
  assert.ok(er.some(r => r.patient.identityStatus === 'unknown'));
  assert.equal(op.find(r => r.id === 'OP-301').waitingMinutes, 12);
  assert.equal(er.find(r => r.id === 'ER-401').allergyCount, 1);
  assert.equal(call(s, nurse, 'GET', '/auth/me').body.role, 'nurse');
  assert.deepEqual(call(s, doctor, 'GET', '/auth/me').body.permissions, ['vitals.write', 'note.write', 'triage.write']);
});

test('outpatient intake moves the visit to intake, validates and hands it to the doctor', () => {
  const s = store();
  assert.equal(call(s, nurse, 'PATCH', '/encounters/OP-301/status', {status: 'intake'}).status, 200);
  assert.equal(call(s, nurse, 'PATCH', '/encounters/OP-301/status', {status: 'in-consult'}).status, 403);
  const bad = call(s, nurse, 'POST', '/encounters/OP-301/intake', {mode: 'op', vitals: {...vitals, temp: 98, hr: null}});
  assert.equal(bad.status, 422);
  assert.deepEqual(bad.body.problems, ['Temperature: enter a number from 30 to 44.', "Record heart rate or a reason it wasn't measured.", 'Review the allergy list with the patient.']);
  const saved = call(s, nurse, 'POST', '/encounters/OP-301/intake', {mode: 'op', vitals, screening: {}, allergyReview: 'nka'});
  assert.equal(saved.status, 200);
  assert.equal(saved.body.encounter.status, 'ready'); assert.equal(saved.body.news2.total, 0); assert.equal(saved.body.esi, null);
  assert.equal(call(s, nurse, 'GET', '/encounters/OP-301').body.observations.latest['8867-4'].value, 76);
  assert.equal(call(s, nurse, 'POST', '/encounters/OP-301/intake', {mode: 'op', vitals, allergyReview: 'nka'}).status, 409);
  assert.equal(call(s, nurse, 'POST', '/encounters/ER-401/intake', {mode: 'op', vitals, allergyReview: 'nka'}).status, 409);
});

test('emergency triage stays waiting until saved, then records the final level and reassessment', () => {
  const s = store();
  assert.equal(call(s, nurse, 'PATCH', '/encounters/ER-401/status', {status: 'intake'}).status, 409);
  const preview = call(s, nurse, 'POST', '/encounters/esi/preview', {lifeSaving: false, highRisk: false, confusedLethargic: false, severePain: false, resources: 2, ageYears: 61, hr: 128});
  assert.deepEqual([preview.body.level, preview.body.dangerZone], [2, true]);
  assert.equal(call(s, nurse, 'POST', '/encounters/esi/preview', {hr: 400}).status, 422);
  const complaint = {code: 'CC-001', display: 'Chest pain, central'};
  const noReason = call(s, nurse, 'POST', '/encounters/ER-401/intake', {mode: 'er', complaint, vitals, allergyReview: 'reviewed-no-change', esi: {lifeSaving: false, highRisk: true, confusedLethargic: false, severePain: false, overrideLevel: 1}});
  assert.deepEqual(noReason.body.problems, ['Give a reason for changing the calculated triage level.']);
  const saved = call(s, nurse, 'POST', '/encounters/ER-401/intake', {mode: 'er', complaint, vitals, allergyReview: 'reviewed-no-change',
    esi: {lifeSaving: false, highRisk: true, confusedLethargic: false, severePain: false, overrideLevel: 1, overrideReason: 'Ongoing pain'}, disposition: {area: 'Resuscitation'}});
  assert.equal(saved.status, 200);
  assert.deepEqual([saved.body.esi.level, saved.body.esi.finalLevel], [2, 1]);
  const row = call(s, nurse, 'GET', '/encounters', {}, 'class=ER').body.find(r => r.id === 'ER-401');
  assert.deepEqual([row.status, row.acuity, row.reason, row.reassessDueAt], ['triaged', 1, 'Chest pain, central', '2026-10-27T10:00:00.000Z']);
  assert.equal(call(s, nurse, 'POST', '/encounters/ER-402/intake', {mode: 'er', vitals, allergyReview: 'nka', esi: {}}).body.problems.at(-1), 'Complete the triage decision points before saving.');
});

test('catalogue search, unconfirmed allergies and unknown routes', () => {
  const s = store();
  assert.deepEqual(call(s, nurse, 'GET', '/catalog/complaints', {}, 'q=breath&limit=10').body.items.map(i => i.display), ['Shortness of breath']);
  assert.equal(call(s, nurse, 'GET', '/catalog/drugs', {}, 'q=a').status, 404);
  const block = call(s, nurse, 'POST', '/patients/P-1001/allergies', {substance: 'Latex', allergenCode: 'AL-010', category: 'environment'}).body;
  assert.deepEqual([block.assessment.state, block.entries[0].verification], ['has-entries', 'unconfirmed']);
  assert.equal(call(s, nurse, 'POST', '/patients/P-1001/allergies', {substance: '', category: 'food'}).status, 422);
  assert.equal(call(s, nurse, 'GET', '/encounters/NOPE').status, 404);
  assert.equal(call(s, nurse, 'DELETE', '/encounters').status, 404);
});
