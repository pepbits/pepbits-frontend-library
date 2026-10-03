import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createReferenceTeleconsultStore, TELECONSULT_COMMAND_NAMES} from './reference-teleconsult-store.mjs';
import {COMMAND_ACCESS} from './teleconsult-policy.mjs';

const TENANT = 'NEX-AE-001';
const PROVIDER = 'reference-teleconsult-provider', PATIENT = 'reference-teleconsult-patient';
const users = {
  admin: {id: 'u-admin', role: 'enterprise-admin', name: 'Admin', tenantId: TENANT},
  doctor: {id: 'u-doc', role: 'teleconsult-doctor', name: 'Doctor Account', tenantId: TENANT},
  nurse: {id: 'u-nurse', role: 'teleconsult-nurse', name: 'Nurse Account', tenantId: TENANT},
  patient: {id: 'u-patient', role: 'teleconsult-patient', name: 'Patient Account', tenantId: TENANT, teleconsultPatientId: 'p8'},
  otherTenantDoctor: {id: 'u-doc-b', role: 'teleconsult-doctor', tenantId: 'NEX-OTHER'},
};
const START = Date.UTC(2026, 9, 1, 8, 0, 0); // 08:00 UTC; fixture "today" is 1 October 2026
const at = (hour, minute = 0, day = 1) => new Date(Date.UTC(2026, 9, day, hour, minute)).toISOString();
let counter = 0;

function harness(options = {}) {
  const dir = options.dir ?? mkdtempSync(join(tmpdir(), 'teleconsult-'));
  const clock = {ms: options.start ?? START};
  const open = () => createReferenceTeleconsultStore({dataDir: dir, policy: options.policy, now: () => clock.ms});
  let store = open();
  const call = async (who, method, path, {body, headers = {}, key, branch = 'dubai', module, role, patient, app = 'nexora'} = {}) => {
    const isPatient = who === 'patient' || module === PATIENT;
    const moduleId = module ?? (isPatient ? PATIENT : PROVIDER);
    const h = {...headers};
    if (role) h['X-Teleconsult-Role'] = role;
    if (patient) h['X-Teleconsult-Patient'] = patient;
    if (['POST', 'PUT', 'PATCH'].includes(method) && key !== null) h['Idempotency-Key'] = key ?? `k-${++counter}-${Math.random().toString(36).slice(2)}`;
    const user = typeof who === 'string' ? users[who] : who;
    return store.handle(user, {applicationId: app, branchId: branch, moduleId}, {method, path, query: new URLSearchParams(path.includes('?') ? path.split('?')[1] : ''), body, headers: h});
  };
  return {
    dir, clock, call, get store() { return store; },
    async restart() { await store.close(); store = open(); },
    async done() { await store.close(); rmSync(dir, {recursive: true, force: true}); },
  };
}
const doctor = (t, method, path, extra) => t.call('doctor', method, path, extra);
const nurse = (t, method, path, extra) => t.call('nurse', method, path, extra);
const patient = (t, method, path, extra) => t.call('patient', method, path, extra);
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body; };

async function book(t, over = {}) {
  return doctor(t, 'POST', '/api/appointments', {body: {patientId: 'p8', clinicianId: 'd1', start: at(16), durationMin: 15, mode: 'video', reason: 'Burning when passing urine', priority: 'routine', ...over}});
}
const shipped = () => JSON.parse(readFileSync(new URL('./config/teleconsult/nexora.json', import.meta.url), 'utf8'));
const policyWith = patch => { const c = shipped(); patch(c); return c; };
const draftBody = (enc, patch = {}) => ({...enc, ...patch});

test('command registry and policy access table list exactly the same commands', () => {
  assert.deepEqual([...TELECONSULT_COMMAND_NAMES].sort(), Object.keys(COMMAND_ACCESS).sort());
});

test('source journey across views: book, join, triage, doctor sign and patient summary', async t => {
  const h = harness();
  try {
    const booked = ok(await book(h), 201);
    assert.equal(booked.status, 'booked');
    assert.equal(booked.createdBy, 'staff');
    assert.equal(booked.patient.id, 'p8');

    // Patient module sees the same data without the provider ever sharing it.
    const mine = ok(await patient(h, 'GET', '/api/patients/p8/appointments'));
    assert.ok(mine.some(a => a.id === booked.id));
    assert.equal(ok(await patient(h, 'GET', `/api/appointments/${booked.id}`)).clinician.id, 'd1');

    const preVisit = {completed: true, symptoms: ['Burning urination'], duration: '2 days', severity: 4, notes: 'Drinking fluids', shareDeviceData: true, recordingConsent: true, deviceCheck: {camera: true, mic: true, network: 'good'}};
    const joined = ok(await patient(h, 'POST', `/api/appointments/${booked.id}/join`, {body: {preVisit}}));
    assert.equal(joined.status, 'waiting');
    assert.ok(joined.joinedAt);
    assert.equal(ok(await nurse(h, 'GET', `/api/appointments/${booked.id}/messages`)).length, 1, 'one system message for the join');

    // Nurse triage.
    ok(await nurse(h, 'PATCH', `/api/appointments/${booked.id}`, {body: {status: 'triage', triagedBy: 'n1'}}));
    let enc = ok(await nurse(h, 'GET', `/api/appointments/${booked.id}/encounter`));
    assert.equal(enc.version, 1);
    assert.match(enc.triage.chiefComplaint, /Burning/);
    enc = ok(await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: draftBody(enc, {
      triage: {...enc.triage, nurseNote: 'Afebrile, no flank pain.', completedBy: 'n1', completedAt: at(8)},
      vitals: [{id: 'vit_nurse1', recordedAt: at(8), source: 'nurse', hr: 82, spo2: 99, sys: 118, dia: 76, temp: 37.4}],
      allergiesReviewed: true,
    })}));
    assert.equal(enc.version, 2);
    assert.equal(enc.orders.length, 0);
    const readied = ok(await nurse(h, 'PATCH', `/api/appointments/${booked.id}`, {body: {status: 'ready'}}));
    assert.equal(readied.triagedBy, 'n1');

    // Doctor: call, diagnose, order, prescribe, follow up, sign.
    ok(await doctor(h, 'PATCH', `/api/appointments/${booked.id}`, {body: {status: 'in-call'}}));
    enc = ok(await doctor(h, 'GET', `/api/appointments/${booked.id}/encounter`));
    assert.equal(enc.version, 2, 'GET returns the existing encounter without creating another');
    const cds = ok(await doctor(h, 'POST', `/api/encounters/${enc.id}/cds`, {body: {...enc, prescriptions: [{drugId: 'amoxicillin', dose: '500 mg', frequency: 'Three times daily', durationDays: 5, quantity: 15}]}, key: null}));
    assert.ok(cds.some(a => a.level === 'critical' && a.source === 'allergy'), 'penicillin-class allergy is flagged by the demo decision support');
    enc = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: draftBody(enc, {
      soap: {...enc.soap, assessment: 'Uncomplicated cystitis (demo).', plan: 'Nitrofurantoin 5 days.'},
      diagnoses: [{code: 'N39.0', display: 'ignored client text', type: 'primary', certainty: 'confirmed', addToProblemList: true}],
      prescriptions: [{drugId: 'nitrofurantoin', dose: '100 mg', frequency: 'Twice daily', durationDays: 28, quantity: 56, refills: 1, instructions: 'With food', prn: false}],
      orders: [{kind: 'lab', code: '24356-8', priority: 'routine'}],
      followUp: {inDays: 7, mode: 'video', note: 'Review results'},
      patientInstructions: 'Drink fluids.',
    })}));
    assert.equal(enc.diagnoses[0].display, 'Urinary tract infection, site not specified', 'display comes from the catalog');
    assert.equal(enc.orders[0].orderedBy, 'd1');
    assert.equal(enc.orders[0].orderedByRole, 'doctor');
    assert.equal(enc.orders[0].status, 'pending');
    assert.equal(enc.prescriptions[0].name, 'Nitrofurantoin MR', 'name comes from the catalog');

    const early = await patient(h, 'GET', `/api/appointments/${booked.id}/summary`);
    assert.equal(early.status, 404, 'no summary until the clinician signs');
    assert.match(early.body.error, /still writing/);

    const signed = ok(await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: enc, signerId: 'd1'}}));
    assert.equal(signed.status, 'signed');
    assert.equal(signed.signedBy, 'd1');
    assert.equal(signed.version, enc.version + 1);
    assert.ok(signed.orders.every(o => o.status === 'signed'));
    assert.ok(signed.followUpAppointmentId);

    const appt = ok(await doctor(h, 'GET', `/api/appointments/${booked.id}`));
    assert.equal(appt.status, 'completed');
    const chart = ok(await doctor(h, 'GET', '/api/patients/p8'));
    assert.ok(chart.problems.some(p => p.code === 'N39.0'));
    assert.ok(chart.medications.some(m => m.name.startsWith('Nitrofurantoin')), 'long courses join the medication list');
    const followUps = ok(await doctor(h, 'GET', '/api/patients/p8/appointments')).filter(a => a.reason.startsWith('Follow-up'));
    assert.equal(followUps.length, 1);
    assert.equal(followUps[0].id, signed.followUpAppointmentId);

    // Patient summary: outcome only.
    const summary = ok(await patient(h, 'GET', `/api/appointments/${booked.id}/summary`));
    assert.equal(summary.encounter.status, 'signed');
    assert.equal(summary.encounter.diagnoses[0].code, 'N39.0');
    assert.equal(summary.encounter.prescriptions[0].drugId, 'nitrofurantoin');
    assert.equal(summary.encounter.soap.assessment, '', 'clinical working notes are not exposed to the patient');
    assert.equal(summary.encounter.triage.nurseNote, '');
    assert.deepEqual(summary.encounter.transcript, []);
    assert.deepEqual(summary.encounter.vitals, []);
    const history = ok(await patient(h, 'GET', '/api/patients/p8/history'));
    assert.equal(history.encounters[0].encounter.soap.plan, '');
    const doctorHistory = ok(await doctor(h, 'GET', '/api/patients/p8/history'));
    assert.notEqual(doctorHistory.encounters[0].encounter.soap.plan, '');

    // Messages cross both views with derived authors.
    const m1 = ok(await patient(h, 'POST', `/api/appointments/${booked.id}/messages`, {body: {from: 'patient', author: 'Someone Else', text: 'Thank you'}}), 201);
    assert.equal(m1.author, "Sarah O'Connor");
    assert.equal(m1.from, 'patient');
    const m2 = ok(await doctor(h, 'POST', `/api/appointments/${booked.id}/messages`, {body: {from: 'staff', author: 'Dr. Somebody Else', text: 'You are welcome'}}), 201);
    assert.equal(m2.author, 'Dr. Meera Iyer');
    assert.equal(ok(await patient(h, 'GET', `/api/appointments/${booked.id}/messages`)).length, 3);

    // Actor audit uses the authenticated account, not the d1/n1 source identity.
    const audit = ok(await doctor(h, 'GET', '/api/audit?limit=200')).entries;
    const signEntry = audit.find(e => e.action === 'encounter.signed');
    assert.equal(signEntry.actor.userId, 'u-doc');
    assert.equal(signEntry.actor.staffId, 'd1');
    assert.equal(audit.find(e => e.action === 'appointment.joined').actor.userId, 'u-patient');
    assert.equal(audit.find(e => e.action === 'appointment.joined').actor.role, 'patient');
    assert.ok(audit.some(e => e.actor.userId === 'u-nurse' && e.actor.role === 'nurse'));
  } finally { await h.done(); }
});

test('sessions describe role, modes, staff and patients for each view', async t => {
  const h = harness();
  try {
    const d = ok(await doctor(h, 'GET', '/api/session'));
    assert.equal(d.role, 'doctor');
    assert.deepEqual(d.roles, ['doctor']);
    assert.equal(d.user.id, 'd1');
    assert.equal(d.staff.length, 7);
    assert.equal(d.canRegister, true);
    assert.equal(d.simulation.demo, true);
    assert.match(d.simulation.notice, /Not validated clinical software/);
    const admin = ok(await h.call('admin', 'GET', '/api/session?role=nurse'));
    assert.equal(admin.role, 'nurse');
    assert.deepEqual(admin.roles, ['doctor', 'nurse']);
    assert.equal(admin.user.id, 'n1');
    assert.equal(ok(await h.call('admin', 'GET', '/api/session', {role: 'doctor'})).user.id, 'd1');
    const p = ok(await patient(h, 'GET', '/api/session'));
    assert.equal(p.patient.id, 'p8');
    assert.deepEqual(p.patients.map(x => x.id), ['p8']);
    assert.equal(p.canRegister, false);
    const adminPatients = ok(await h.call('admin', 'GET', '/api/session?patientId=p3', {module: PATIENT}));
    assert.equal(adminPatients.patient.id, 'p3');
    assert.equal(adminPatients.patients.length, 10);
    assert.equal((await h.call('admin', 'GET', '/api/session?patientId=p99', {module: PATIENT})).status, 404);
    assert.equal((await h.call('admin', 'POST', '/api/session', {body: {}})).status, 405);
  } finally { await h.done(); }
});

test('source role spoofing, signer replacement and cross-module access are refused', async t => {
  const h = harness();
  try {
    assert.equal((await nurse(h, 'GET', '/api/queue', {role: 'doctor'})).status, 403);
    assert.equal((await nurse(h, 'GET', '/api/session?role=doctor')).status, 403);
    assert.equal((await doctor(h, 'GET', '/api/queue', {role: 'nurse'})).status, 403);
    assert.equal((await h.call('admin', 'GET', '/api/queue', {role: 'superuser'})).status, 400);
    assert.equal((await h.call('admin', 'GET', '/api/session?role=nurse', {role: 'doctor'})).status, 400);
    assert.equal((await h.call('patient', 'GET', '/api/queue', {module: PROVIDER})).status, 403, 'patient account cannot open the provider module');
    assert.equal((await h.call('doctor', 'GET', '/api/session', {module: PATIENT})).status, 403, 'provider account cannot open the patient module');
    assert.equal((await h.call({id: 'u-x', role: 'finance-manager', tenantId: TENANT}, 'GET', '/api/queue')).status, 403);
    assert.equal((await h.call('doctor', 'GET', '/api/queue', {module: 'reference-school'})).status, 403);
    assert.equal((await h.call(null, 'GET', '/api/queue')).status, 403);
    assert.equal((await h.call({id: 'u', role: 'teleconsult-doctor'}, 'GET', '/api/queue')).status, 403, 'tenant must come from the trusted user');
    // Query/body tenant or user hints are not accepted.
    const spoofedBody = await doctor(h, 'POST', '/api/patients/p8/allergies', {body: {substance: 'Dust', category: 'environment', tenantId: 'OTHER'}});
    assert.equal(spoofedBody.status, 400);

    const a = ok(await book(h), 201);
    const enc = ok(await doctor(h, 'GET', `/api/appointments/${a.id}/encounter`));
    const completeEnc = {...enc, diagnoses: [{code: 'N39.0', display: 'x', type: 'primary', certainty: 'confirmed', addToProblemList: false}], allergiesReviewed: true};
    assert.equal((await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: completeEnc, signerId: 'n1'}})).status, 403, 'signer cannot be replaced');
    assert.equal((await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: completeEnc, signerId: 'd2'}})).status, 403);
    assert.equal((await doctor(h, 'PATCH', `/api/appointments/${a.id}`, {body: {triagedBy: 'n1'}})).status, 403);
    // Client-controlled context fields are rejected rather than merged.
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, tenantId: 'x'}})).status, 400);
    const forged = await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, status: 'signed', signedBy: 'd2', signedAt: at(9), transcript: [{id: 'x', speaker: 'patient', text: 'forged', at: at(9)}], updatedAt: at(1)}});
    const saved = ok(forged);
    assert.equal(saved.status, 'draft');
    assert.equal(saved.signedBy, undefined);
    assert.deepEqual(saved.transcript, []);
    assert.notEqual(saved.updatedAt, at(1));
    // Patient cannot impersonate staff in messages.
    assert.equal((await patient(h, 'POST', `/api/appointments/${a.id}/messages`, {body: {from: 'staff', text: 'hi'}})).status, 403);
    assert.equal((await doctor(h, 'POST', `/api/appointments/${a.id}/messages`, {body: {from: 'patient', text: 'hi'}})).status, 403);
  } finally { await h.done(); }
});

test('patient, tenant, application and branch partitions are isolated', async t => {
  const h = harness();
  try {
    assert.equal((await patient(h, 'GET', '/api/patients/p1')).status, 403);
    assert.equal((await patient(h, 'GET', '/api/patients/p1/appointments')).status, 403);
    assert.equal((await patient(h, 'GET', '/api/patients/p1/history')).status, 403);
    assert.equal((await patient(h, 'GET', '/api/appointments/a2')).status, 404, 'unrelated visit looks absent');
    assert.equal((await patient(h, 'GET', '/api/appointments/a2/messages')).status, 404);
    assert.equal((await patient(h, 'POST', '/api/appointments/a2/messages', {body: {text: 'hello'}})).status, 404);
    assert.equal((await patient(h, 'GET', '/api/appointments/a2/summary')).status, 404);
    assert.equal((await patient(h, 'POST', '/api/appointments/a2/join', {body: {}})).status, 404);
    assert.equal((await patient(h, 'GET', '/api/appointments/a2/vitals/current')).status, 404);
    assert.equal((await patient(h, 'GET', '/api/patients/p8', {patient: 'p1'})).status, 403, 'header cannot select another beneficiary');
    for (const path of ['/api/queue', '/api/appointments', '/api/encounters', '/api/dashboard', '/api/audit', '/api/appointments/a8/transcript/current', '/api/appointments/a8/encounter']) {
      assert.equal((await patient(h, 'GET', path)).status, 403, path);
    }
    assert.equal((await patient(h, 'POST', '/api/patients', {body: {firstName: 'A', lastName: 'B', dob: '1990-01-01', phone: '+1 555 0100'}})).status, 403);
    assert.equal((await patient(h, 'POST', '/api/appointments', {body: {patientId: 'p1', clinicianId: 'd1', start: at(16), reason: 'x'}})).status, 403, 'booking is only for the own beneficiary');
    assert.equal((await patient(h, 'PATCH', '/api/patients/p8', {body: {phone: '+1 555 0101'}})).status, 403);
    // Admin acting as p8 still cannot read p1 without switching beneficiary.
    assert.equal((await h.call('admin', 'GET', '/api/patients/p1', {module: PATIENT, patient: 'p8'})).status, 403);
    assert.equal(ok(await h.call('admin', 'GET', '/api/patients/p1', {module: PATIENT, patient: 'p1'})).id, 'p1');

    const booked = ok(await book(h), 201);
    const seenHere = ok(await doctor(h, 'GET', '/api/appointments')).map(a => a.id);
    assert.ok(seenHere.includes(booked.id));
    const otherBranch = ok(await doctor(h, 'GET', '/api/appointments', {branch: 'hq'})).map(a => a.id);
    assert.ok(!otherBranch.includes(booked.id), 'branch partition');
    const otherTenant = ok(await h.call('otherTenantDoctor', 'GET', '/api/appointments')).map(a => a.id);
    assert.ok(!otherTenant.includes(booked.id), 'tenant partition');
    const otherApp = ok(await doctor(h, 'GET', '/api/appointments', {app: 'other-app'})).map(a => a.id);
    assert.ok(!otherApp.includes(booked.id), 'application partition');
    // Mutations in another partition do not leak either.
    ok(await h.call('otherTenantDoctor', 'PATCH', '/api/appointments/a2', {body: {status: 'in-call'}, role: undefined}));
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a2')).status, 'waiting');
    const files = readdirSync(h.dir).filter(f => f.endsWith('.json'));
    assert.equal(files.length, 4);
    for (const f of files) assert.match(f, /^[0-9a-f]{64}\.json$/, 'file names do not expose tenant or branch ids');
  } finally { await h.done(); }
});

test('malformed identifiers, paths and bodies are refused without touching data', async t => {
  const h = harness();
  try {
    for (const path of ['/api/patients/..%2f..%2fetc', '/api/patients/bad%20id', '/api/patients/p8%00', `/api/patients/${'x'.repeat(80)}`, '/api/appointments/%E0%A4%A', '/api/../etc/passwd', '/other/health']) {
      assert.ok([400, 404].includes((await doctor(h, 'GET', path)).status), path);
      assert.notEqual((await doctor(h, 'GET', path)).status, 200, path);
    }
    assert.equal((await doctor(h, 'GET', '/api/patients/..%2fp1')).status, 400);
    assert.equal((await doctor(h, 'GET', '/api/patients/nope')).status, 404);
    assert.equal((await doctor(h, 'GET', '/api/nope')).status, 404);
    assert.equal((await doctor(h, 'DELETE', '/api/patients/p1')).status, 405);
    assert.equal((await doctor(h, 'GET', '/api/appointments/a1/encounter/extra')).status, 404);
    assert.equal((await doctor(h, 'PUT', '/api/appointments/a1', {body: {}})).status, 405);
    assert.equal((await doctor(h, 'POST', '/api/appointments', {body: 'text'})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/appointments', {body: []})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {firstName: 'x'.repeat(300_000)}})).status, 413);
    assert.equal((await doctor(h, 'GET', '/api/appointments?status=bogus')).status, 400);
    assert.equal((await doctor(h, 'GET', '/api/appointments?date=tomorrow')).status, 400);
    assert.equal((await doctor(h, 'GET', '/api/staff?role=admin')).status, 400);
    assert.equal((await doctor(h, 'GET', '/api/slots?clinicianId=n1')).status, 404, 'nurses are not bookable');
    assert.equal((await doctor(h, 'GET', '/api/slots')).status, 400);
  } finally { await h.done(); }
});

test('booking guards cover mismatches, grid, hours, breaks, past times and interval overlap', async t => {
  const h = harness();
  try {
    const base = {patientId: 'p8', clinicianId: 'd1', reason: 'Check', durationMin: 15};
    const post = body => doctor(h, 'POST', '/api/appointments', {body: {...base, ...body}});
    assert.equal((await post({patientId: 'p99', start: at(16)})).status, 404);
    assert.equal((await post({clinicianId: 'n1', start: at(16)})).status, 404);
    assert.equal((await post({clinicianId: 'd99', start: at(16)})).status, 404);
    assert.equal((await post({patientId: '../x', start: at(16)})).status, 400);
    assert.equal((await post({start: 'tomorrow'})).status, 400);
    assert.equal((await post({start: '2026-10-01T16:00:00'})).status, 400, 'a time zone is required');
    assert.equal((await post({start: at(16, 7)})).status, 409, 'off the 15-minute grid');
    assert.equal((await post({start: at(7, 45)})).status, 409, 'before opening');
    assert.equal((await post({start: at(17, 45), durationMin: 30})).status, 409, 'must finish before closing');
    assert.equal((await post({start: at(13)})).status, 409, 'break');
    assert.equal((await post({start: at(12, 45), durationMin: 30})).status, 409, 'running into the break');
    assert.equal((await post({start: at(1, 0, 1)})).status, 409);
    h.clock.ms = Date.UTC(2026, 9, 1, 12, 0);
    assert.equal((await post({start: at(9)})).status, 409, 'past');
    h.clock.ms = START;
    assert.equal((await post({start: at(8, 0, 1) .replace('2026-10-01', '2027-03-01')})).status, 409, 'beyond the booking horizon');
    assert.equal((await post({start: at(16), durationMin: 500})).status, 400);
    assert.equal((await post({start: at(16), durationMin: 2})).status, 400);
    assert.equal((await post({start: at(16), durationMin: 15.5})).status, 400);
    assert.equal((await post({start: at(16), mode: 'telepathy'})).status, 400);
    assert.equal((await post({start: at(16), priority: 'whenever'})).status, 400);
    assert.equal((await post({start: at(16), reason: ''})).status, 400);
    assert.equal((await post({start: at(16), status: 'completed'})).status, 400, 'server-owned fields are rejected');
    // Existing d1 visits: a5 10:30-10:50 (20 min), a3 09:45-10:05, a4 10:00-10:15.
    assert.equal((await post({start: at(10, 45)})).status, 409, 'interval overlap with a 20-minute visit');
    assert.equal((await post({start: at(10, 15), durationMin: 30})).status, 409, 'a long visit that runs into the next one');
    assert.equal((await post({start: at(10, 30)})).status, 409, 'exact clash');
    assert.equal((await post({start: at(9, 15), durationMin: 30})).status, 409, 'spans a2 09:30');
    // Different doctor, same patient overlapping.
    assert.equal((await post({start: at(12), clinicianId: 'd2'})).status, 409, 'p8 already has a8 at 12:00 with d1');
    // Free neighbours succeed, including back-to-back adjacency.
    ok(await post({start: at(10, 50 + 10), durationMin: 15}), 201);
    ok(await post({start: at(11, 15), clinicianId: 'd1', patientId: 'p7', durationMin: 15}), 201);
    ok(await post({start: at(11, 30), clinicianId: 'd1', patientId: 'p9', durationMin: 15}), 201);
    // Slot listing agrees with booking rules.
    const slots = ok(await doctor(h, 'GET', `/api/slots?clinicianId=d1&date=2026-10-01T12:00:00`));
    const byStart = Object.fromEntries(slots.map(s => [s.start, s.available]));
    assert.equal(byStart[at(10, 30)], false);
    assert.equal(byStart[at(10, 45)], false);
    assert.equal(byStart[at(13)], false);
    assert.equal(byStart[at(16)], true);
    assert.equal(slots.length, 40);
  } finally { await h.done(); }
});

test('appointment transitions, role limits and rescheduling follow the source rules', async t => {
  const h = harness();
  try {
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/h1', {body: {status: 'waiting'}})).status, 409, 'completed visits cannot reopen');
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a5', {body: {status: 'ready'}})).status, 409, 'booked cannot jump to ready');
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a5', {body: {status: 'nonsense'}})).status, 400);
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a5', {body: {id: 'a99'}})).status, 400);
    assert.equal((await nurse(h, 'PATCH', '/api/appointments/a2', {body: {status: 'in-call'}})).status, 403);
    assert.equal((await nurse(h, 'PATCH', '/api/appointments/a2', {body: {status: 'completed'}})).status, 403);
    assert.equal((await nurse(h, 'PATCH', '/api/appointments/a2', {body: {status: 'cancelled'}})).status, 403);
    assert.equal(ok(await nurse(h, 'PATCH', '/api/appointments/a2', {body: {status: 'triage'}})).triagedBy, 'n1');
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/h1', {body: {start: at(16)}})).status, 409);
    // Reschedule with the same rules as booking.
    assert.equal(ok(await doctor(h, 'PATCH', '/api/appointments/a9', {body: {start: at(10, 45)}})).start, at(10, 45), 'a free slot for the other doctor');
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a5', {body: {start: at(10, 45)}})).status, 200, 'its own interval does not block it');
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a5', {body: {start: at(9, 45)}})).status, 409);
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a5', {body: {clinicianId: 'n1'}})).status, 404);
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a3', {body: {start: at(17)}})).status, 409, 'a visit already in the queue cannot move');
    // Cancel then reopen needs a still-valid slot.
    ok(await doctor(h, 'PATCH', '/api/appointments/a10', {body: {status: 'cancelled'}}));
    ok(await book(h, {start: at(15), reason: 'Took the slot', patientId: 'p7'}), 201);
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a10', {body: {status: 'booked'}})).status, 409, 'reopening re-checks overlap');
    ok(await doctor(h, 'PATCH', '/api/appointments/a10', {body: {status: 'booked', start: at(16, 30)}}));
    // Recording stops when a visit leaves the call.
    ok(await doctor(h, 'PATCH', '/api/appointments/a3', {body: {status: 'in-call'}}));
    const enc = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    const rec = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: true, active: true, seconds: 0}}}));
    assert.equal(rec.recording.active, true);
    ok(await doctor(h, 'PATCH', '/api/appointments/a3', {body: {status: 'waiting'}}));
    const after = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    assert.equal(after.recording.active, false);
    assert.equal(after.version, rec.version + 1);
  } finally { await h.done(); }
});

test('nurse cannot supply prescriptions, diagnoses or doctor-only content, and cannot sign as a doctor', async t => {
  const h = harness();
  try {
    const enc = ok(await nurse(h, 'GET', '/api/appointments/a3/encounter'));
    const rx = {drugId: 'paracetamol', dose: '500 mg', frequency: 'Four times daily', durationDays: 3, quantity: 12};
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, prescriptions: [rx]}})).status, 403);
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, diagnoses: [{code: 'R42', display: 'x', type: 'primary', certainty: 'provisional', addToProblemList: false}]}})).status, 403);
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, followUp: {inDays: 3, mode: 'video', note: ''}}})).status, 403);
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, patientInstructions: 'Take anything'}})).status, 403);
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, sickNoteDays: 5}})).status, 403);
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, orders: [{kind: 'imaging', code: 'IMG-CXR', priority: 'routine'}]}})).status, 403, 'imaging needs a doctor');
    const nurseOrder = ok(await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, orders: [{kind: 'lab', code: '51990-0', priority: 'routine'}]}}));
    assert.equal(nurseOrder.orders[0].orderedByRole, 'nurse');
    assert.equal(nurseOrder.orders[0].orderedBy, 'n1');
    // A doctor adds an order; the nurse may not drop or alter it.
    const docEnc = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...nurseOrder, orders: [...nurseOrder.orders, {kind: 'imaging', code: 'IMG-CXR', priority: 'urgent'}]}}));
    const docOrder = docEnc.orders.find(o => o.code === 'IMG-CXR');
    assert.equal(docOrder.orderedByRole, 'doctor');
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...docEnc, orders: docEnc.orders.filter(o => o.code !== 'IMG-CXR')}})).status, 403);
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...docEnc, orders: docEnc.orders.map(o => (o.code === 'IMG-CXR' ? {...o, priority: 'routine'} : o))}})).status, 403);
    // Order authorship cannot be claimed through the body.
    const claimed = ok(await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...docEnc, orders: [...docEnc.orders, {kind: 'nursing', code: 'NUR-INHALER', priority: 'routine', orderedBy: 'd1', orderedByRole: 'doctor', status: 'signed'}]}}));
    const claimedOrder = claimed.orders.find(o => o.code === 'NUR-INHALER');
    assert.deepEqual([claimedOrder.orderedBy, claimedOrder.orderedByRole, claimedOrder.status], ['n1', 'nurse', 'pending'], 'authorship and status are server-owned');
    // Sign: the nurse can never sign a doctor visit, even with a complete note and the right version.
    const current = ok(await nurse(h, 'GET', '/api/appointments/a3/encounter'));
    const complete = {...current, allergiesReviewed: true, triage: {...current.triage, nurseNote: 'Completed.'}};
    const refused = await nurse(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: complete, signerId: 'n1'}});
    assert.equal(refused.status, 403);
    assert.equal((await nurse(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: complete, signerId: 'd1'}})).status, 403);
    assert.equal((await nurse(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: {...complete, prescriptions: [rx]}}})).status, 403);
    assert.equal(ok(await nurse(h, 'GET', '/api/appointments/a3/encounter')).status, 'draft');
    assert.equal((await nurse(h, 'GET', '/api/audit')).status, 403);
    // Nurse recording consent flows are the same as doctor's.
    assert.equal((await nurse(h, 'GET', '/api/appointments/a3/transcript/current')).status, 200);
  } finally { await h.done(); }
});

test('sign retries do not duplicate follow-ups, messages or bookings', async t => {
  const h = harness();
  try {
    const key = 'book-once-0001';
    const first = await book(h, {start: at(16)});
    ok(first, 201);
    const bookKey = {key};
    const a = ok(await doctor(h, 'POST', '/api/appointments', {body: {patientId: 'p7', clinicianId: 'd1', start: at(16, 30), reason: 'Idempotent', durationMin: 15}, ...bookKey}), 201);
    const replay = await doctor(h, 'POST', '/api/appointments', {body: {patientId: 'p7', clinicianId: 'd1', start: at(16, 30), reason: 'Idempotent', durationMin: 15}, ...bookKey});
    assert.equal(replay.status, 201);
    assert.equal(replay.body.id, a.id);
    assert.equal(replay.headers['Idempotent-Replay'], 'true');
    assert.equal(ok(await doctor(h, 'GET', '/api/patients/p7/appointments')).filter(x => x.reason === 'Idempotent').length, 1);
    const reuse = await doctor(h, 'POST', '/api/appointments', {body: {patientId: 'p7', clinicianId: 'd1', start: at(17), reason: 'Different', durationMin: 15}, ...bookKey});
    assert.equal(reuse.status, 409, 'same key with a different request is refused');
    assert.equal((await doctor(h, 'POST', '/api/appointments', {body: {patientId: 'p7', clinicianId: 'd1', start: at(17), reason: 'x'}, key: null})).status, 428);
    assert.equal((await doctor(h, 'POST', '/api/appointments', {body: {}, key: 'short'})).status, 400);
    assert.equal((await doctor(h, 'PUT', '/api/encounters/x', {body: {}, key: null})).status, 428);
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a5', {body: {}, key: null})).status, 428);
    // Another user cannot replay the key.
    const other = await nurse(h, 'POST', '/api/appointments', {body: {patientId: 'p7', clinicianId: 'd1', start: at(16, 30), reason: 'Idempotent', durationMin: 15}, ...bookKey});
    assert.equal(other.status, 409, 'a different actor runs its own request and meets the real slot conflict');

    // Messages.
    const msgKey = 'message-once-1';
    const msgBody = {text: 'Please share readings'};
    const m1 = await doctor(h, 'POST', '/api/appointments/a2/messages', {body: msgBody, key: msgKey});
    const m2 = await doctor(h, 'POST', '/api/appointments/a2/messages', {body: msgBody, key: msgKey});
    assert.equal(m1.body.id, m2.body.id);
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a2/messages')).filter(m => m.text === msgBody.text).length, 1);

    // Sign twice.
    const appt = ok(await book(h, {start: at(15, 30), reason: 'Sign retry'}), 201);
    const enc = ok(await doctor(h, 'GET', `/api/appointments/${appt.id}/encounter`));
    const draft = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, allergiesReviewed: true, diagnoses: [{code: 'R42', display: 'x', type: 'primary', certainty: 'confirmed', addToProblemList: false}], followUp: {inDays: 3, mode: 'audio', note: 'Check'}}}));
    const signBody = {encounter: draft, signerId: 'd1'};
    const s1 = await doctor(h, 'POST', `/api/encounters/${draft.id}/sign`, {body: signBody, key: 'sign-once-0001'});
    const s2 = await doctor(h, 'POST', `/api/encounters/${draft.id}/sign`, {body: signBody, key: 'sign-once-0001'});
    ok(s1); ok(s2);
    assert.deepEqual(s2.body, s1.body);
    assert.equal(s2.headers['Idempotent-Replay'], 'true');
    // A fresh key is a new request against a signed note: refused, nothing created.
    const s3 = await doctor(h, 'POST', `/api/encounters/${draft.id}/sign`, {body: signBody, key: 'sign-again-02'});
    assert.equal(s3.status, 409);
    assert.equal(s3.body.code, 'signed');
    const followUps = ok(await doctor(h, 'GET', '/api/appointments')).filter(x => x.reason === 'Follow-up: Check');
    assert.equal(followUps.length, 1);
    assert.equal(followUps[0].id, s1.body.followUpAppointmentId);
    assert.equal(ok(await doctor(h, 'GET', `/api/appointments/${appt.id}/encounter`)).version, s1.body.version);
    const signedAudits = ok(await doctor(h, 'GET', '/api/audit?limit=200')).entries.filter(e => e.action === 'encounter.signed' && e.target.id === draft.id);
    assert.equal(signedAudits.length, 1);
  } finally { await h.done(); }
});

test('stale versions conflict, signed notes are locked and context mismatches are refused', async t => {
  const h = harness();
  try {
    const enc = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    const second = ok(await doctor(h, 'GET', '/api/appointments/a2/encounter'));
    assert.equal(enc.version, 1);
    const v2 = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, soap: {...enc.soap, subjective: 'First edit'}}}));
    assert.equal(v2.version, 2);
    const stale = await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, soap: {...enc.soap, subjective: 'Overwrites?'}}});
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'version-conflict');
    assert.equal(stale.body.currentVersion, 2);
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).soap.subjective, 'First edit');
    const {version, ...unversioned} = v2;
    const missing = await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: unversioned});
    assert.equal(missing.status, 428);
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...v2, version: 'two'}})).status, 428);
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...v2, version: 99}})).status, 409);
    // Source context: another visit's encounter cannot be written through this path.
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...v2, id: second.id}})).status, 409);
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...v2, appointmentId: 'a2'}})).status, 409);
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...v2, patientId: 'p1'}})).status, 409);
    assert.equal((await doctor(h, 'PUT', '/api/encounters/enc_missing', {body: v2})).status, 404);
    assert.equal((await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: {...v2, patientId: 'p1'}, signerId: 'd1'}})).status, 409);
    assert.equal((await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: {...v2, version: 1}, signerId: 'd1'}})).status, 409, 'sign validates the expected version');
    assert.equal((await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: unversioned, signerId: 'd1'}})).status, 428);
    // Validation problems return the source 422 shape and do not change anything.
    const incomplete = await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: {...v2, allergiesReviewed: false}, signerId: 'd1'}});
    assert.equal(incomplete.status, 422);
    assert.deepEqual(incomplete.body.problems, ['Add a primary diagnosis', 'Review allergies']);
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).version, 2);

    // Critical safety alerts require an explicit override reason that is retained as evidence.
    const withRx = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...v2, allergiesReviewed: true, diagnoses: [{code: 'R42', display: 'x', type: 'primary', certainty: 'confirmed', addToProblemList: false}], prescriptions: [{drugId: 'ibuprofen', dose: '400 mg', frequency: 'Three times daily', durationDays: 3, quantity: 9}]}}));
    const blocked = await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: withRx, signerId: 'd1'}});
    assert.equal(blocked.status, 422);
    assert.match(blocked.body.problems[0], /critical safety alert/);
    const signed = ok(await doctor(h, 'POST', `/api/encounters/${enc.id}/sign`, {body: {encounter: withRx, signerId: 'd1', overrideReason: 'Reviewed with cardiology (demo)'}}));
    assert.equal(signed.overrideReason, 'Reviewed with cardiology (demo)');

    // Signed evidence is locked against every mutation path.
    const evidence = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    for (const [method, path, body] of [
      ['PUT', `/api/encounters/${enc.id}`, {...evidence, soap: {...evidence.soap, subjective: 'rewritten'}}],
      ['POST', `/api/encounters/${enc.id}/sign`, {encounter: {...evidence, prescriptions: []}, signerId: 'd1'}],
      ['POST', `/api/encounters/${enc.id}/scribe`, undefined],
    ]) {
      const r = await doctor(h, method, path, {body});
      assert.equal(r.status, 409, path);
      assert.equal(r.body.code, 'signed');
    }
    assert.equal((await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: evidence})).status, 409);
    assert.deepEqual(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')), evidence, 'signed encounter is byte-for-byte unchanged');
    assert.equal((await doctor(h, 'PATCH', '/api/appointments/a3', {body: {status: 'waiting'}})).status, 409);
    // Seeded signed encounters are locked too.
    const seeded = ok(await doctor(h, 'GET', '/api/appointments/a1/encounter'));
    assert.equal(seeded.status, 'signed');
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${seeded.id}`, {body: seeded})).status, 409);
  } finally { await h.done(); }
});

test('encounter content is validated against catalogs and bounds; scores are recomputed server-side', async t => {
  const h = harness();
  try {
    const enc = ok(await doctor(h, 'GET', '/api/appointments/a2/encounter'));
    const put = patch => doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, ...patch}});
    assert.equal((await put({prescriptions: [{drugId: 'made-up', durationDays: 1, quantity: 1}]})).status, 400);
    assert.equal((await put({prescriptions: [{drugId: 'paracetamol', durationDays: 0, quantity: 1}]})).status, 400);
    assert.equal((await put({orders: [{kind: 'lab', code: 'NOPE', priority: 'routine'}]})).status, 400);
    assert.equal((await put({diagnoses: [{code: 'lowercase', type: 'primary', certainty: 'confirmed', addToProblemList: false}]})).status, 400);
    assert.equal((await put({diagnoses: [{code: 'J20.9', type: 'primary', certainty: 'confirmed', addToProblemList: false}, {code: 'R05.9', type: 'primary', certainty: 'confirmed', addToProblemList: false}]})).status, 400);
    assert.equal((await put({vitals: [{recordedAt: at(8), source: 'doctor', hr: 9999}]})).status, 400);
    assert.equal((await put({vitals: [{recordedAt: at(8), source: 'nurse', hr: 70}]})).status, 400, 'a doctor cannot label a reading as nurse-taken');
    assert.equal((await put({vitals: [{recordedAt: at(23, 0, 5), source: 'doctor', hr: 70}]})).status, 400, 'future readings');
    assert.equal((await put({triage: {...enc.triage, painScore: 11}})).status, 400);
    assert.equal((await put({triage: {...enc.triage, screening: {__proto__: true, x: 'y'}}})).status, 400);
    assert.equal((await put({triage: {...enc.triage, screening: JSON.parse('{"__proto__": true}')}})).status, 400);
    assert.equal((await put({triage: {...enc.triage, completedBy: 'n1', completedAt: at(8)}})).status, 403, 'a doctor cannot attribute triage to the nurse');
    assert.equal((await put({soap: {...enc.soap, plan: 'x'.repeat(9000)}})).status, 400);
    assert.equal((await put({followUp: {inDays: 0, mode: 'video', note: ''}})).status, 400);
    assert.equal((await put({sickNoteDays: -1})).status, 400);
    assert.equal((await put({unknownSection: true})).status, 400);
    const scored = ok(await put({scores: [{id: 'score_forge', key: 'gad7', name: 'Forged', value: 0, max: 21, interpretation: 'None', band: 'low', answers: {q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3}, at: at(8)}]}));
    assert.equal(scored.scores[0].value, 18, 'value is derived from the answers, not trusted');
    assert.equal(scored.scores[0].name, 'GAD-7');
    assert.notEqual(scored.scores[0].band, 'low');
    assert.notEqual(scored.scores[0].interpretation, 'None');
    assert.equal((await put({version: scored.version, scores: [{key: 'unknown-score', answers: {}}]})).status, 400);
    // Score and decision-support endpoints are demo computations and reject nonsense.
    const computed = ok(await doctor(h, 'POST', '/api/scores/compute', {body: {key: 'news2', encounter: {vitals: [{recordedAt: at(8), source: 'device', hr: 95, spo2: 93, sys: 105, dia: 70, rr: 21, temp: 38.5}]}}, key: null}));
    assert.equal(computed.key, 'news2');
    assert.ok(computed.value > 0);
    assert.equal((await doctor(h, 'POST', '/api/scores/compute', {body: {key: 'nope'}, key: null})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/scores/compute', {body: {key: 'phq9', answers: JSON.parse('{"__proto__": 3}')}, key: null})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/scores/compute', {body: {key: 'phq9', answers: {q1: 'many'}}, key: null})).status, 400);
    const sug = ok(await doctor(h, 'POST', `/api/encounters/${enc.id}/suggest`, {body: enc, key: null}));
    assert.ok(sug.some(s => s.type === 'diagnosis'));
    const scribed = await doctor(h, 'POST', `/api/encounters/${enc.id}/scribe`, {key: null});
    assert.match(ok(scribed).subjective, /Draft generated from triage and pre-visit answers/);
    assert.equal(scribed.headers['X-Teleconsult-Simulation'], 'demo');
    // Seeded encounters round-trip through the same validator.
    const grace = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    ok(await doctor(h, 'PUT', `/api/encounters/${grace.id}`, {body: grace}));
  } finally { await h.done(); }
});

test('patient and allergy writes use field allowlists and keep identifiers server-owned', async t => {
  const h = harness();
  try {
    const registration = {firstName: ' Nadia ', lastName: 'Khan', dob: '1990-02-03', sex: 'female', phone: '+971 50 555 0100', allergies: [{substance: 'Latex', category: 'environment', reaction: 'Rash', severity: 'mild', recordedBy: 'impostor'}], noKnownAllergies: false};
    const p = ok(await doctor(h, 'POST', '/api/patients', {body: registration}), 201);
    assert.equal(p.firstName, 'Nadia');
    assert.match(p.mrn, /^TC-100241$/);
    assert.equal(p.allergies[0].recordedBy, 'd1', 'recorded-by is the signed-in clinician');
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: registration})).status, 409, 'duplicate phone and date of birth');
    assert.equal(ok(await nurse(h, 'POST', '/api/patients', {body: {...registration, phone: '+971 50 555 0101'}}), 201).mrn, 'TC-100242');
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {...registration, phone: '+971 50 555 0102', id: 'p1'}})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {...registration, phone: '+971 50 555 0103', mrn: 'TC-1'}})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {firstName: 'A'}})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {...registration, phone: 'abc', dob: '1990-02-03'}})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {...registration, phone: '+971 50 555 0104', dob: '2999-01-01'}})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {...registration, phone: '+971 50 555 0105', dob: '1990-02-31'}})).status, 400);
    assert.equal((await doctor(h, 'POST', '/api/patients', {body: {...registration, phone: '+971 50 555 0106', noKnownAllergies: true}})).status, 400);
    const patched = ok(await nurse(h, 'PATCH', `/api/patients/${p.id}`, {body: {weightKg: 61.5, smoking: 'former', insurance: {payer: 'Demo Payer', memberId: 'D-1'}}}));
    assert.equal(patched.weightKg, 61.5);
    for (const body of [{id: 'p9'}, {mrn: 'x'}, {allergies: []}, {createdAt: at(1)}, {dob: '1970-01-01'}, {__proto__: {isAdmin: true}, constructor: {}}, {weightKg: -5}, {smoking: 'sometimes'}]) {
      const r = await doctor(h, 'PATCH', `/api/patients/${p.id}`, {body});
      assert.equal(r.status, 400, JSON.stringify(body));
    }
    assert.equal(ok(await doctor(h, 'GET', `/api/patients/${p.id}`)).id, p.id);
    // Allergies.
    const withAllergy = ok(await nurse(h, 'POST', `/api/patients/${p.id}/allergies`, {body: {substance: 'Penicillin', category: 'drug', allergyClass: 'penicillin', reaction: 'Hives', severity: 'moderate', recordedBy: 'd1', status: 'inactive'}}), 201);
    const added = withAllergy.allergies.find(a => a.substance === 'Penicillin');
    assert.equal(added.recordedBy, 'n1');
    assert.equal(added.status, 'active');
    assert.equal((await nurse(h, 'POST', `/api/patients/${p.id}/allergies`, {body: {substance: 'penicillin', category: 'drug'}})).status, 409);
    const inactive = ok(await doctor(h, 'PATCH', `/api/patients/${p.id}/allergies/${added.id}`, {body: {status: 'inactive'}}));
    assert.equal(inactive.allergies.find(a => a.id === added.id).status, 'inactive');
    assert.equal((await doctor(h, 'PATCH', `/api/patients/${p.id}/allergies/${added.id}`, {body: {substance: 'Other'}})).status, 400);
    assert.equal((await doctor(h, 'PATCH', `/api/patients/${p.id}/allergies/nope`, {body: {status: 'inactive'}})).status, 404);
    // Search endpoints.
    assert.ok(ok(await doctor(h, 'GET', '/api/patients?q=nadia')).length >= 1);
    assert.ok(ok(await doctor(h, 'GET', '/api/catalog/search?q=amox')).some(x => x.type === 'drug'));
    assert.deepEqual(ok(await doctor(h, 'GET', '/api/catalog/search?q=a')), []);
    assert.ok(ok(await patient(h, 'GET', '/api/catalog')).symptoms.length > 0);
    assert.equal((await patient(h, 'GET', '/api/catalog/search?q=amox')).status, 403);
    assert.equal(ok(await patient(h, 'GET', '/api/staff?role=doctor')).length, 5);
  } finally { await h.done(); }
});

test('patients check in only for their own visits and the shipped demo allows self booking', async t => {
  const h = harness();
  try {
    assert.equal((await patient(h, 'POST', '/api/appointments/a8/join', {body: {preVisit: {completed: true}}})).status, 400, 'pre-visit shape is validated');
    assert.equal((await patient(h, 'POST', '/api/appointments/a8/join', {body: {status: 'in-call'}})).status, 400);
    const preVisit = {completed: true, symptoms: ['Fever'], duration: '1 day', severity: 3, notes: '', shareDeviceData: false, recordingConsent: false, deviceCheck: {camera: true, mic: false, network: 'fair'}};
    const joined = ok(await patient(h, 'POST', '/api/appointments/a8/join', {body: {preVisit}}));
    assert.equal(joined.status, 'waiting');
    assert.equal(joined.preVisit.recordingConsent, false);
    const again = ok(await patient(h, 'POST', '/api/appointments/a8/join', {body: {preVisit: {...preVisit, recordingConsent: true}}}));
    assert.equal(again.preVisit.recordingConsent, true, 'answers can still change while waiting');
    assert.equal(ok(await patient(h, 'GET', '/api/appointments/a8/messages')).filter(m => m.author === 'System').length, 1, 'rejoining does not add another system message');
    // Device sharing off is honored by the live frame endpoint.
    assert.equal((await patient(h, 'GET', '/api/appointments/a8/vitals/current')).status, 409, 'device sharing is off for this visit');
    // After triage starts, a reconnecting patient cannot rewrite the pre-visit record.
    ok(await nurse(h, 'PATCH', '/api/appointments/a8', {body: {status: 'triage'}}));
    const locked = ok(await patient(h, 'POST', '/api/appointments/a8/join', {body: {preVisit: {...preVisit, notes: 'changed late'}}}));
    assert.equal(locked.preVisit.notes, '');
    assert.equal(locked.status, 'triage');
    // Closed visits cannot be joined.
    assert.equal((await patient(h, 'POST', '/api/appointments/a8/join', {body: {}, key: 'join-closed-1', patient: 'p8'})).status, 200);
    ok(await doctor(h, 'PATCH', '/api/appointments/a8', {body: {status: 'completed'}}));
    assert.equal((await patient(h, 'POST', '/api/appointments/a8/join', {body: {}})).status, 409);
    // Booking for self, with server-set createdBy; booking for someone else is refused.
    const mine = ok(await patient(h, 'POST', '/api/appointments', {body: {patientId: 'p8', clinicianId: 'd1', start: at(16), reason: 'Self booked', createdBy: 'staff'}}), 201);
    assert.equal(mine.createdBy, 'patient');
    assert.equal((await patient(h, 'POST', '/api/appointments', {body: {patientId: 'p1', clinicianId: 'd1', start: at(16, 30), reason: 'For someone else'}})).status, 403);
    assert.equal(ok(await patient(h, 'GET', '/api/slots?clinicianId=d1&date=2026-10-01')).length, 40);
  } finally { await h.done(); }
});

test('configuration overrides change scheduling, modes, recording, simulation and limits per branch', async t => {
  const h = harness();
  try {
    // Shipped Sharjah override: 30-minute grid from 09:00 to 17:00, lunch 12:00-13:00, video/audio only.
    const post = body => doctor(h, 'POST', '/api/appointments', {body: {patientId: 'p8', clinicianId: 'd1', reason: 'Branch rule', durationMin: 30, mode: 'video', ...body}, branch: 'sharjah'});
    assert.equal((await post({start: at(16, 15)})).status, 409, '15-minute grid is not offered in Sharjah');
    assert.equal((await post({start: at(8, 30)})).status, 409, 'before the Sharjah opening');
    assert.equal((await post({start: at(12, 30)})).status, 409, 'Sharjah lunch');
    assert.equal((await post({start: at(16, 30), durationMin: 45})).status, 409, 'must finish by 17:00');
    assert.equal((await post({start: at(16), mode: 'chat'})).status, 400, 'chat is not allowed in Sharjah');
    ok(await post({start: at(16)}), 201);
    // Same values are valid in the default branch.
    assert.equal(ok(await book(h, {start: at(16, 15), mode: 'chat'}), 201).mode, 'chat');
    assert.equal(ok(await doctor(h, 'GET', '/api/session', {branch: 'sharjah'})).settings.scheduling.slotIntervalMin, 30);
    assert.equal(ok(await doctor(h, 'GET', '/api/slots?clinicianId=d1&date=2026-10-02', {branch: 'sharjah'})).length, 16);
  } finally { await h.done(); }

  const custom = JSON.parse(readFileSync(new URL('./config/teleconsult/nexora.json', import.meta.url), 'utf8'));
  custom.defaults.recording = {allowed: false, consentRequired: true};
  custom.defaults.simulation = {vitals: false, transcript: false, scribe: false, arrive: false, transcriptIntervalMs: 2600};
  custom.defaults.limits.maxPatients = 10;
  custom.defaults.limits.maxAppointments = 15;
  custom.defaults.limits.maxBodyBytes = 2048;
  custom.defaults.limits.maxMessagesPerAppointment = 2;
  custom.defaults.access.enforceClinicianOwnership = true;
  custom.defaults.scheduling.utcOffsetMinutes = 240;
  const g = harness({policy: custom});
  try {
    const a3 = ok(await doctor(g, 'GET', '/api/appointments/a3'));
    assert.equal(a3.start, '2026-10-01T05:45:00.000Z', 'seed clock follows the configured UTC offset (09:45 local)');
    const enc = ok(await doctor(g, 'GET', '/api/appointments/a3/encounter'));
    ok(await doctor(g, 'PATCH', '/api/appointments/a3', {body: {status: 'in-call'}}));
    const refused = await doctor(g, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: true, active: true, seconds: 0}}});
    assert.equal(refused.status, 409, 'recording disabled for the branch');
    assert.equal((await doctor(g, 'GET', '/api/appointments/a3/vitals/current')).status, 404);
    assert.equal((await doctor(g, 'GET', '/api/appointments/a3/transcript/current')).status, 404);
    assert.equal((await doctor(g, 'POST', `/api/encounters/${enc.id}/scribe`, {key: null})).status, 404);
    assert.equal((await doctor(g, 'POST', '/api/sim/arrive', {body: {}})).status, 404);
    assert.equal((await doctor(g, 'POST', '/api/patients', {body: {firstName: 'N', lastName: 'M', dob: '1990-01-01', phone: '+971 55 000 0000'}})).status, 409, 'patient capacity');
    assert.equal((await doctor(g, 'POST', '/api/appointments', {body: {patientId: 'p8', clinicianId: 'd1', start: new Date(Date.UTC(2026, 9, 2, 12, 0)).toISOString(), reason: 'cap'}})).status, 409, 'appointment capacity');
    assert.equal((await doctor(g, 'POST', '/api/appointments/a2/messages', {body: {text: 'x'.repeat(3000)}})).status, 413);
    ok(await doctor(g, 'POST', '/api/appointments/a2/messages', {body: {text: 'one'}}), 201);
    assert.equal((await doctor(g, 'POST', '/api/appointments/a2/messages', {body: {text: 'two'}})).status, 409, 'message limit (one system message already exists)');
    // Clinician ownership: the demo doctor maps to d1 and may not touch d2's visit.
    assert.equal((await doctor(g, 'PATCH', '/api/appointments/a11', {body: {status: 'in-call'}})).status, 403);
    assert.equal((await doctor(g, 'GET', '/api/appointments/a11/encounter')).status, 200, 'reading remains clinic-wide');
    assert.equal((await nurse(g, 'PATCH', '/api/appointments/a11', {body: {status: 'triage'}})).status, 200);
  } finally { await g.done(); }

  assert.throws(() => createReferenceTeleconsultStore({dataDir: mkdtempSync(join(tmpdir(), 'tc-bad-')), policy: {...custom, defaults: {...custom.defaults, modes: []}}}), /Invalid Teleconsult configuration/);
  assert.throws(() => createReferenceTeleconsultStore({policy: custom}), /data directory/);
});

test('current vitals and transcript frames replace SSE: authenticated, deterministic and consent-gated', async t => {
  const h = harness();
  try {
    ok(await doctor(h, 'PATCH', '/api/appointments/a3', {body: {status: 'in-call'}}));
    // No tokens in URLs and no streaming endpoint: the stream paths answer 410 with the polling alternative.
    const gone = await doctor(h, 'GET', '/api/appointments/a3/vitals/stream');
    assert.equal(gone.status, 410);
    assert.equal(gone.body.alternate, '/api/appointments/a3/vitals/current');
    assert.equal((await doctor(h, 'GET', '/api/appointments/a3/transcript/stream')).status, 410);
    assert.equal((await h.call(null, 'GET', '/api/appointments/a3/vitals/current')).status, 403, 'unauthenticated polling is refused');

    const f1 = await doctor(h, 'GET', '/api/appointments/a3/vitals/current');
    ok(f1);
    for (const key of ['hr', 'spo2', 'sys', 'dia', 'rr', 'temp', 'at', 'signal']) assert.ok(f1.body[key] !== undefined, key);
    assert.equal(f1.body.simulated, true);
    assert.equal(f1.headers['X-Teleconsult-Simulation'], 'demo');
    assert.ok(f1.body.spo2 <= 100 && f1.body.hr > 40 && f1.body.hr < 160);
    assert.deepEqual((await nurse(h, 'GET', '/api/appointments/a3/vitals/current')).body, f1.body, 'every poller sees the same frame for the same second');
    h.clock.ms += 3000;
    assert.notEqual((await doctor(h, 'GET', '/api/appointments/a3/vitals/current')).body.at, f1.body.at);
    // The patient sees their own visit's frame.
    const own = ok(await patient(h, 'GET', '/api/appointments/a8/vitals/current'));
    assert.equal(own.simulated, true);
    // Closed visits and visits that disabled device sharing do not produce frames.
    assert.equal((await doctor(h, 'GET', '/api/appointments/a1/vitals/current')).status, 409);

    // Transcript: appended only while recording is active with consent, on the recording clock.
    const enc = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    const idle = ok(await doctor(h, 'GET', '/api/appointments/a3/transcript/current'));
    assert.equal(idle.pending, true);
    assert.equal(idle.reason, 'not-recording');
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: false, active: true, seconds: 0}}})).status, 409, 'consent is required');
    ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: true, active: true, seconds: 0}}}));
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/transcript/current')).pending, true, 'first line is not due yet');
    h.clock.ms += 2600;
    const poll = () => doctor(h, 'GET', '/api/appointments/a3/transcript/current');
    const [p1, p2, p3] = await Promise.all([poll(), poll(), poll()]);
    assert.equal(p1.body.simulated, true);
    assert.equal(p1.body.speaker, 'clinician');
    assert.equal(p1.body.id, p2.body.id);
    assert.equal(p2.body.id, p3.body.id, 'concurrent subscribers receive one line');
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).transcript.length, 1, 'several subscribers did not increment twice');
    h.clock.ms += 5200;
    const next = ok(await doctor(h, 'GET', `/api/appointments/a3/transcript/current?after=${p1.body.id}`));
    assert.notEqual(next.id, p1.body.id);
    assert.equal(next.remaining, 1, 'a catch-up cursor walks one line at a time');
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).transcript.length, 3);
    assert.equal((await doctor(h, 'GET', '/api/appointments/a3/transcript/current?after=tr_unknown')).status, 400);
    // Pausing recording stops the clock; nothing is appended while paused.
    const live = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    ok(await doctor(h, 'PUT', `/api/encounters/${live.id}`, {body: {...live, recording: {consent: true, active: false, seconds: 10}}}));
    h.clock.ms += 60000;
    const lastId = live.transcript.at(-1).id;
    const paused = ok(await doctor(h, 'GET', `/api/appointments/a3/transcript/current?after=${lastId}`));
    assert.equal(paused.pending, true);
    assert.equal(paused.reason, 'not-recording');
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).transcript.length, 3);
    // Patients never read transcripts.
    assert.equal((await patient(h, 'GET', '/api/appointments/a8/transcript/current')).status, 403);
    // Lines carry the demo marker so the UI can label them.
    assert.ok(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).transcript.every(l => l.simulated === true));
    // Resuming continues the script instead of repeating it.
    const stopped = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    ok(await doctor(h, 'PUT', `/api/encounters/${stopped.id}`, {body: {...stopped, recording: {consent: true, active: true, seconds: 10}}}));
    h.clock.ms += 2600;
    const resumed = ok(await doctor(h, 'GET', `/api/appointments/a3/transcript/current?after=${lastId}`));
    assert.notEqual(resumed.id, lastId);
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).transcript.length, 4);
  } finally { await h.done(); }
});

test('simulated arrival is explicit demo behaviour and asserts no consent', async t => {
  const h = harness();
  try {
    const r = await doctor(h, 'POST', '/api/sim/arrive', {body: {}});
    const arrived = ok(r);
    assert.equal(arrived.status, 'waiting');
    assert.equal(r.headers['X-Teleconsult-Simulation'], 'demo');
    assert.equal(arrived.id, 'a5', 'next booked visit today');
    assert.equal(arrived.preVisit.recordingConsent, false);
    assert.equal(arrived.preVisit.completed, false);
    assert.match(arrived.preVisit.notes, /Simulated/);
    assert.equal((await doctor(h, 'POST', '/api/sim/arrive', {body: {x: 1}})).status, 400);
    // A completed pre-visit that declined recording cannot be overridden by staff.
    const preVisit = {completed: true, symptoms: ['Cough'], duration: '1 day', severity: 2, notes: '', shareDeviceData: true, recordingConsent: false, deviceCheck: {camera: true, mic: true, network: 'good'}};
    ok(await patient(h, 'POST', '/api/appointments/a8/join', {body: {preVisit}}));
    ok(await doctor(h, 'PATCH', '/api/appointments/a8', {body: {status: 'in-call'}}));
    const enc = ok(await doctor(h, 'GET', '/api/appointments/a8/encounter'));
    const consent = await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: true, active: true, seconds: 0}}});
    assert.equal(consent.status, 409);
    assert.match(consent.body.error, /declined/);
    // Staff can attest consent when the patient never answered.
    const e5 = ok(await doctor(h, 'GET', '/api/appointments/a5/encounter'));
    ok(await doctor(h, 'PATCH', '/api/appointments/a5', {body: {status: 'in-call'}}));
    ok(await doctor(h, 'PUT', `/api/encounters/${e5.id}`, {body: {...e5, recording: {consent: true, active: true, seconds: 0}}}));
  } finally { await h.done(); }
});

test('state is durable across close and recreate, with exclusive writer ownership', async t => {
  const h = harness();
  try {
    const a = ok(await book(h, {start: at(15, 30), reason: 'Survives restart'}), 201);
    const enc = ok(await doctor(h, 'GET', `/api/appointments/${a.id}/encounter`));
    const draft = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, allergiesReviewed: true, diagnoses: [{code: 'R42', display: 'x', type: 'primary', certainty: 'confirmed', addToProblemList: false}], followUp: {inDays: 5, mode: 'video', note: 'After restart'}}}));
    const signed = await doctor(h, 'POST', `/api/encounters/${draft.id}/sign`, {body: {encounter: draft, signerId: 'd1'}, key: 'sign-restart-01'});
    ok(signed);
    ok(await patient(h, 'POST', `/api/appointments/${a.id}/messages`, {body: {text: 'Persist me'}}), 201);
    ok(await h.call('admin', 'POST', '/api/patients', {body: {firstName: 'Durable', lastName: 'Patient', dob: '1985-05-05', phone: '+971 50 999 0000'}, role: 'doctor'}), 201);

    // A second store on the same directory is refused while the first owns the lease.
    assert.throws(() => createReferenceTeleconsultStore({dataDir: h.dir, now: () => h.clock.ms}), /another writer/);
    const before = ok(await doctor(h, 'GET', '/api/appointments'));
    const files = readdirSync(h.dir);
    assert.ok(files.some(f => f.endsWith('.json')));
    assert.ok(!files.some(f => f.includes('.tmp-')), 'no temporary files remain after atomic writes');
    const stored = JSON.parse(readFileSync(join(h.dir, files.find(f => /^[0-9a-f]{64}\.json$/.test(f))), 'utf8'));
    assert.equal(stored.scope.tenantId, TENANT);
    assert.ok(stored.audit.length > 3);

    await h.restart();
    h.clock.ms += 3600_000; // time moved on; persisted data must not be reseeded
    const after = ok(await doctor(h, 'GET', '/api/appointments'));
    assert.deepEqual(after.map(x => x.id).sort(), before.map(x => x.id).sort());
    assert.equal(ok(await doctor(h, 'GET', `/api/appointments/${a.id}`)).status, 'completed');
    assert.equal(ok(await doctor(h, 'GET', `/api/appointments/${a.id}/encounter`)).status, 'signed');
    assert.equal(ok(await patient(h, 'GET', `/api/appointments/${a.id}/messages`)).filter(m => m.text === 'Persist me').length, 1);
    assert.equal(ok(await doctor(h, 'GET', '/api/patients?q=durable')).length, 1);
    // Idempotency survives the restart: the retry replays instead of conflicting or duplicating.
    const retry = await doctor(h, 'POST', `/api/encounters/${draft.id}/sign`, {body: {encounter: draft, signerId: 'd1'}, key: 'sign-restart-01'});
    assert.equal(retry.status, 200);
    assert.equal(retry.headers['Idempotent-Replay'], 'true');
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments')).filter(x => x.reason === 'Follow-up: After restart').length, 1);
    const audit = ok(await doctor(h, 'GET', '/api/audit?limit=200')).entries;
    assert.ok(audit.some(e => e.action === 'encounter.signed'));
    assert.ok(audit.length > 3, 'audit history is durable');

    // Closing refuses further work and releases the lease.
    const closing = h.store;
    await closing.close();
    assert.equal((await closing.handle(users.doctor, {applicationId: 'nexora', branchId: 'dubai', moduleId: PROVIDER}, {method: 'GET', path: '/api/health', headers: {}})).status, 503);
    const reopened = createReferenceTeleconsultStore({dataDir: h.dir, now: () => h.clock.ms});
    await reopened.close();
  } finally { await h.done(); }
});

test('a lease left by a dead process is taken over and an unreadable state file is not silently reseeded', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'teleconsult-stale-'));
  try {
    const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))']);
    const deadPid = Number(child.stdout.toString());
    mkdirSync(join(dir, '.teleconsult.lease'), {recursive: true});
    writeFileSync(join(dir, '.teleconsult.lease', 'owner.json'), JSON.stringify({pid: deadPid, token: 'stale'}));
    const clock = {ms: START};
    const store = createReferenceTeleconsultStore({dataDir: dir, now: () => clock.ms});
    const call = (path = '/api/session') => store.handle(users.doctor, {applicationId: 'nexora', branchId: 'dubai', moduleId: PROVIDER}, {method: 'GET', path, headers: {}});
    assert.equal((await call()).status, 200);
    await store.close();
    const file = readdirSync(dir).find(f => /^[0-9a-f]{64}\.json$/.test(f));
    writeFileSync(join(dir, file), '{not json');
    const damaged = createReferenceTeleconsultStore({dataDir: dir, now: () => clock.ms});
    const response = await damaged.handle(users.doctor, {applicationId: 'nexora', branchId: 'dubai', moduleId: PROVIDER}, {method: 'GET', path: '/api/session', headers: {}});
    assert.equal(response.status, 503);
    assert.equal(readFileSync(join(dir, file), 'utf8'), '{not json', 'damaged data is preserved for recovery, not overwritten');
    await damaged.close();
    // A state file moved to another scope is rejected, never trusted.
    const other = createReferenceTeleconsultStore({dataDir: dir, now: () => clock.ms});
    const wrong = await other.handle({...users.doctor, tenantId: 'NEX-OTHER'}, {applicationId: 'nexora', branchId: 'dubai', moduleId: PROVIDER}, {method: 'GET', path: '/api/session', headers: {}});
    assert.equal(wrong.status, 200);
    await other.close();
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('audit history is bounded, ordered and restricted to the doctor mode', async t => {
  const policy = JSON.parse(readFileSync(new URL('./config/teleconsult/nexora.json', import.meta.url), 'utf8'));
  policy.defaults.limits.maxAuditEntries = 10;
  policy.defaults.limits.maxIdempotencyKeys = 10;
  const h = harness({policy});
  try {
    for (let i = 0; i < 14; i++) ok(await doctor(h, 'POST', '/api/appointments/a2/messages', {body: {text: `note ${i}`}}), 201);
    const audit = ok(await doctor(h, 'GET', '/api/audit?limit=200'));
    assert.equal(audit.entries.length, 10);
    assert.equal(audit.dropped, 4);
    assert.ok(audit.entries[0].at >= audit.entries[9].at, 'newest first');
    assert.equal(audit.entries[0].summary.startsWith('msg_'), true);
    assert.equal(ok(await doctor(h, 'GET', '/api/audit?limit=3')).entries.length, 3);
    assert.equal((await doctor(h, 'GET', '/api/audit?limit=0')).status, 400);
    assert.equal((await nurse(h, 'GET', '/api/audit')).status, 403);
    assert.equal(ok(await h.call('admin', 'GET', '/api/audit', {role: 'doctor'})).entries.length, 10);
    assert.equal((await h.call('admin', 'GET', '/api/audit', {role: 'nurse'})).status, 403);
    // Replay window is bounded too: the oldest key falls out and is treated as a new request.
    const stored = JSON.parse(readFileSync(join(h.dir, readdirSync(h.dir).find(f => /^[0-9a-f]{64}\.json$/.test(f))), 'utf8'));
    assert.equal(stored.idempotency.length, 10);
  } finally { await h.done(); }
});

test('concurrent first requests share one scope and every committed change is retained', async t => {
  const h = harness();
  try {
    const slots = [15, 30, 45].map(m => at(16, m));
    const results = await Promise.all([
      ...slots.map((start, i) => doctor(h, 'POST', '/api/appointments', {body: {patientId: 'p7', clinicianId: 'd1', start, reason: `Parallel ${i}`, durationMin: 15}})),
      doctor(h, 'POST', '/api/appointments/a2/messages', {body: {text: 'parallel message'}}),
      patient(h, 'GET', '/api/patients/p8/appointments'),
      doctor(h, 'GET', '/api/queue'),
    ]);
    results.forEach(r => assert.ok(r.status < 300, JSON.stringify(r.body)));
    const booked = ok(await doctor(h, 'GET', '/api/appointments')).filter(a => a.reason.startsWith('Parallel'));
    assert.equal(booked.length, 3, 'no concurrent write overwrote another');
    assert.equal(readdirSync(h.dir).filter(f => /^[0-9a-f]{64}\.json$/.test(f)).length, 1);
    // Racing identical bookings for one slot yield one winner.
    const race = await Promise.all([0, 1, 2, 3].map(() => doctor(h, 'POST', '/api/appointments', {body: {patientId: 'p6', clinicianId: 'd1', start: at(17), reason: 'Race', durationMin: 15}})));
    assert.deepEqual(race.map(r => r.status).sort(), [201, 409, 409, 409]);
    // Racing replays of one key create exactly one record.
    const replays = await Promise.all([0, 1, 2].map(() => doctor(h, 'POST', '/api/appointments/a2/messages', {body: {text: 'same'}, key: 'parallel-key-1'})));
    assert.equal(new Set(replays.map(r => r.body.id)).size, 1);
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a2/messages')).filter(m => m.text === 'same').length, 1);
  } finally { await h.done(); }
});

test('the default clock and shipped policy work without options', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'teleconsult-default-'));
  const store = createReferenceTeleconsultStore({dataDir: dir});
  try {
    const r = await store.handle(users.doctor, {applicationId: 'nexora', branchId: 'dubai', moduleId: PROVIDER}, {method: 'GET', path: '/api/health', headers: {}});
    assert.equal(r.status, 200);
    assert.equal(r.body.demo, true);
    assert.equal(r.headers['Cache-Control'], 'no-store');
  } finally { await store.close(); rmSync(dir, {recursive: true, force: true}); }
});

// ---------------------------------------------------------------- trust-boundary corrections

test('a dedicated patient account needs the trusted host mapping; the config default never fills in', async t => {
  const h = harness();
  try {
    const unmapped = {id: 'u-unmapped', role: 'teleconsult-patient', name: 'Unmapped', tenantId: TENANT};
    for (const path of ['/api/session', '/api/patients/p8', '/api/patients/p8/appointments', '/api/appointments/a8']) {
      assert.equal((await h.call(unmapped, 'GET', path, {module: PATIENT})).status, 403, path);
      assert.equal((await h.call(unmapped, 'GET', path, {module: PATIENT, patient: 'p8'})).status, 403, `${path} with the default patient requested`);
    }
    assert.equal((await h.call(unmapped, 'POST', '/api/appointments/a8/join', {module: PATIENT, body: {}})).status, 403);
    assert.equal((await h.call({...unmapped, teleconsultPatientId: ''}, 'GET', '/api/session', {module: PATIENT})).status, 403);
    // Mapped to another beneficiary: only that one, regardless of headers or the config default.
    const p3 = {...unmapped, id: 'u-p3', teleconsultPatientId: 'p3'};
    assert.equal(ok(await h.call(p3, 'GET', '/api/session', {module: PATIENT})).patient.id, 'p3');
    assert.equal((await h.call(p3, 'GET', '/api/patients/p8', {module: PATIENT, patient: 'p8'})).status, 403);
    assert.equal((await h.call(p3, 'GET', '/api/session?patientId=p8', {module: PATIENT})).status, 403);
    assert.deepEqual(ok(await h.call(p3, 'GET', '/api/patients', {module: PATIENT})).map(x => x.id), ['p3']);
    // The configured default still seeds an admin's first selection.
    assert.equal(ok(await h.call('admin', 'GET', '/api/session', {module: PATIENT})).patient.id, 'p8');
    // The mapping never grants provider access.
    assert.equal((await h.call(p3, 'GET', '/api/queue', {module: PROVIDER})).status, 403);
  } finally { await h.done(); }
});

test('self booking is on in the shipped demo and off by explicit override, independent of provider booking', async t => {
  const h = harness();
  try {
    const mine = ok(await patient(h, 'POST', '/api/appointments', {body: {patientId: 'p8', clinicianId: 'd1', start: at(16), reason: 'Imported patient flow', preVisit: {completed: false, symptoms: ['Fever'], duration: '', severity: 4, notes: '', shareDeviceData: true, recordingConsent: false, deviceCheck: {camera: false, mic: false, network: 'good'}}, createdBy: 'patient'}}), 201);
    assert.equal(mine.createdBy, 'patient');
    assert.equal(ok(await patient(h, 'GET', '/api/session')).settings.allowPatientBooking, true);
  } finally { await h.done(); }
  const off = harness({policy: policyWith(c => { c.defaults.access.allowPatientBooking = false; })});
  try {
    assert.equal((await patient(off, 'POST', '/api/appointments', {body: {patientId: 'p8', clinicianId: 'd1', start: at(16), reason: 'x'}})).status, 403);
    assert.equal((await patient(off, 'GET', '/api/slots?clinicianId=d1&date=2026-10-01')).status, 403);
    assert.equal(ok(await patient(off, 'GET', '/api/session')).settings.allowPatientBooking, false);
    ok(await patient(off, 'GET', '/api/booking-advice?symptoms=Rash'));
    ok(await doctor(off, 'POST', '/api/appointments', {body: {patientId: 'p8', clinicianId: 'd1', start: at(16), reason: 'Provider booking is unaffected'}}), 201);
    ok(await nurse(off, 'POST', '/api/appointments', {body: {patientId: 'p7', clinicianId: 'd1', start: at(16, 30), reason: 'Nurse booking is unaffected'}}), 201);
    assert.equal(ok(await nurse(off, 'GET', '/api/slots?clinicianId=d1&date=2026-10-01')).length, 40);
    assert.equal(ok(await doctor(off, 'GET', '/api/slots?clinicianId=d1&date=2026-10-01')).length, 40);
  } finally { await off.done(); }
});

// The source patient registration form payload (teleconsult-01 patient/app/register), field for field.
const registrationPayload = (over = {}) => ({
  firstName: 'Amira', lastName: 'Haddad', dob: '1992-04-12', sex: 'female', language: 'English',
  phone: '+971 50 555 0199', email: 'amira@example.test', address: '',
  insurance: {payer: 'Self-pay', memberId: ''}, emergencyContact: {name: '', phone: '', relation: ''},
  heightCm: undefined, weightKg: 62, smoking: 'never',
  allergies: [{substance: 'Penicillin', category: 'drug', allergyClass: 'penicillin', reaction: 'Reported by patient', severity: 'moderate', recordedBy: 'patient'}],
  noKnownAllergies: false,
  problems: [{code: '', display: 'Asthma', since: '2026-10-01T08:00:00.000Z', status: 'active'}],
  medications: [{name: 'Salbutamol', dose: '', frequency: 'As reported', status: 'active', since: '2026-10-01T08:00:00.000Z'}],
  ...over,
});
const json = value => JSON.parse(JSON.stringify(value));

test('admin demo patient session may register a patient; fixed patients and a disabled setting cannot', async t => {
  const h = harness();
  try {
    const session = ok(await h.call('admin', 'GET', '/api/session', {module: PATIENT}));
    assert.equal(session.canRegister, true);
    assert.equal(session.settings.allowAdminPatientRegistration, true);
    assert.equal(ok(await patient(h, 'GET', '/api/session')).canRegister, false, 'fixed patient session');

    const created = ok(await h.call('admin', 'POST', '/api/patients', {module: PATIENT, body: json(registrationPayload())}), 201);
    assert.match(created.mrn, /^TC-/);
    assert.equal(created.allergies[0].substance, 'Penicillin');
    assert.equal(created.allergies[0].recordedBy, 'u-admin', 'the trusted host account, not the claimed "patient" and not an invented prescriber');
    assert.notEqual(created.allergies[0].recordedBy, 'patient');
    assert.ok(!['d1', 'n1'].includes(created.allergies[0].recordedBy), 'no clinician identity is invented');
    assert.equal(created.problems[0].code, '', 'patient-reported conditions need no code');
    assert.equal(created.medications[0].name, 'Salbutamol');
    assert.equal(created.noKnownAllergies, false);

    const audit = ok(await doctor(h, 'GET', '/api/audit?limit=50')).entries.find(e => e.action === 'patient.registered');
    assert.equal(audit.actor.userId, 'u-admin');
    assert.equal(audit.actor.role, 'patient');
    assert.equal(audit.target.id, created.id);

    // Caller-supplied attribution or server-owned fields are not accepted; duplicates still conflict.
    for (const extra of [{createdBy: 'd1'}, {registeredBy: 'u-other'}, {id: 'p1'}, {mrn: 'TC-1'}, {staffId: 'd1'}]) {
      assert.equal((await h.call('admin', 'POST', '/api/patients', {module: PATIENT, body: json(registrationPayload({phone: '+971 50 555 0200', ...extra}))})).status, 400, JSON.stringify(extra));
    }
    assert.equal((await h.call('admin', 'POST', '/api/patients', {module: PATIENT, body: json(registrationPayload())})).status, 409, 'same phone and date of birth');

    // The admin can switch to the new beneficiary; a fixed patient cannot.
    const asNew = ok(await h.call('admin', 'GET', '/api/session', {module: PATIENT, patient: created.id}));
    assert.equal(asNew.patient.id, created.id);
    assert.equal(ok(await h.call('admin', 'GET', `/api/patients/${created.id}`, {module: PATIENT, patient: created.id})).firstName, 'Amira');
    assert.equal((await patient(h, 'GET', `/api/patients/${created.id}`)).status, 403);
    assert.equal((await patient(h, 'GET', '/api/session', {patient: created.id})).status, 403);
    assert.equal((await patient(h, 'GET', `/api/patients/${created.id}`, {patient: created.id})).status, 403);
    assert.equal(ok(await doctor(h, 'GET', `/api/patients/${created.id}`)).allergies.length, 1, 'providers see the new chart');

    // Fixed patient accounts never register, with or without a header.
    assert.equal((await patient(h, 'POST', '/api/patients', {body: json(registrationPayload({phone: '+971 50 555 0300'}))})).status, 403);
    assert.equal((await patient(h, 'POST', '/api/patients', {body: json(registrationPayload({phone: '+971 50 555 0300'})), patient: 'p8'})).status, 403);
    assert.equal((await h.call({id: 'u-unmapped', role: 'teleconsult-patient', tenantId: TENANT}, 'POST', '/api/patients', {module: PATIENT, body: json(registrationPayload())})).status, 403);
    // Providers keep their own staff-mapped authorship.
    const byDoctor = ok(await doctor(h, 'POST', '/api/patients', {body: json(registrationPayload({phone: '+971 50 555 0400'}))}), 201);
    assert.equal(byDoctor.allergies[0].recordedBy, 'd1');
  } finally { await h.done(); }

  const off = harness({policy: policyWith(c => { c.defaults.access.allowAdminPatientRegistration = false; })});
  try {
    assert.equal(ok(await off.call('admin', 'GET', '/api/session', {module: PATIENT})).canRegister, false);
    assert.equal((await off.call('admin', 'POST', '/api/patients', {module: PATIENT, body: json(registrationPayload())})).status, 403);
    assert.equal(ok(await off.call('admin', 'GET', '/api/patients', {module: PATIENT})).length, 10, 'nothing was created');
    ok(await doctor(off, 'POST', '/api/patients', {body: json(registrationPayload())}), 201);
  } finally { await off.done(); }
});

test('admin registration is durable across restart and replays exactly', async t => {
  const h = harness();
  try {
    const key = 'register-once-0001';
    const first = await h.call('admin', 'POST', '/api/patients', {module: PATIENT, body: json(registrationPayload()), key});
    const created = ok(first, 201);
    await h.restart();
    const replay = await h.call('admin', 'POST', '/api/patients', {module: PATIENT, body: json(registrationPayload()), key});
    assert.equal(replay.status, 201);
    assert.equal(replay.body.id, created.id);
    assert.equal(replay.headers['Idempotent-Replay'], 'true');
    assert.equal(ok(await h.call('admin', 'GET', '/api/patients?q=amira', {module: PATIENT})).length, 1);
    assert.equal(ok(await h.call('admin', 'GET', `/api/patients/${created.id}`, {module: PATIENT, patient: created.id})).allergies[0].recordedBy, 'u-admin');
  } finally { await h.done(); }
});

test('changed payload under a used idempotency key is a 409 conflict; exact replays and restarts keep working', async t => {
  const h = harness();
  try {
    const key = 'conflict-key-0001';
    const body = {patientId: 'p7', clinicianId: 'd1', start: at(16), reason: 'Original', durationMin: 15};
    const first = ok(await doctor(h, 'POST', '/api/appointments', {body, key}), 201);
    const changed = await doctor(h, 'POST', '/api/appointments', {body: {...body, reason: 'Changed'}, key});
    assert.equal(changed.status, 409);
    assert.match(changed.body.error, /Idempotency-Key/);
    assert.equal(changed.headers['Idempotent-Replay'], undefined, 'a conflict is not a replay');
    assert.equal(ok(await doctor(h, 'GET', '/api/patients/p7/appointments')).filter(a => a.reason === 'Changed').length, 0, 'the conflicting request changed nothing');
    const replay = await doctor(h, 'POST', '/api/appointments', {body, key});
    assert.equal(replay.status, 201);
    assert.equal(replay.body.id, first.id);
    assert.equal(replay.headers['Idempotent-Replay'], 'true');
    await h.restart();
    const afterRestart = await doctor(h, 'POST', '/api/appointments', {body, key});
    assert.equal(afterRestart.body.id, first.id, 'replay survives a restart');
    assert.equal(afterRestart.headers['Idempotent-Replay'], 'true');
    assert.equal((await doctor(h, 'POST', '/api/appointments', {body: {...body, reason: 'Changed again'}, key})).status, 409, 'conflict survives a restart');
    assert.equal(ok(await doctor(h, 'GET', '/api/patients/p7/appointments')).filter(a => a.reason === 'Original').length, 1);
  } finally { await h.done(); }
});

test('recording always requires consent and no policy can switch that off', async t => {
  assert.throws(() => createReferenceTeleconsultStore({dataDir: mkdtempSync(join(tmpdir(), 'teleconsult-bad-')), policy: policyWith(c => { c.defaults.recording.consentRequired = false; })}), /consentRequired is invalid/);
  assert.throws(() => createReferenceTeleconsultStore({dataDir: mkdtempSync(join(tmpdir(), 'teleconsult-bad-')), policy: policyWith(c => { c.tenants['NEX-AE-001'].branches.sharjah.recording = {consentRequired: false}; })}), /consentRequired is invalid/);
  const h = harness();
  try {
    assert.equal(ok(await doctor(h, 'GET', '/api/session')).settings.recording.consentRequired, true);
    const enc = ok(await doctor(h, 'GET', '/api/appointments/a3/encounter'));
    ok(await doctor(h, 'PATCH', '/api/appointments/a3', {body: {status: 'in-call'}}));
    const noConsent = await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: false, active: true, seconds: 0}}});
    assert.equal(noConsent.status, 409);
    assert.match(noConsent.body.error, /consent/);
    const nurseNoConsent = await nurse(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: false, active: true, seconds: 0}}});
    assert.equal(nurseNoConsent.status, 409);
    assert.equal(ok(await doctor(h, 'GET', '/api/appointments/a3/encounter')).recording.active, false, 'nothing started');
    const consented = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...enc, recording: {consent: true, active: true, seconds: 0}}}));
    assert.equal(consented.recording.active, true);
    // Withdrawing consent while recording runs is refused; stopping is always allowed.
    assert.equal((await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...consented, recording: {consent: false, active: true, seconds: 3}}})).status, 409);
    const stopped = ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...consented, recording: {consent: false, active: false, seconds: 3}}}));
    assert.deepEqual([stopped.recording.consent, stopped.recording.active], [false, false]);
    // Still a simulation: the transcript is scripted and labelled.
    ok(await doctor(h, 'PUT', `/api/encounters/${enc.id}`, {body: {...stopped, recording: {consent: true, active: true, seconds: 0}}}));
    const frame = await doctor(h, 'GET', '/api/appointments/a3/transcript/current');
    assert.equal(frame.status, 200);
    assert.equal(frame.body.simulated, true);
    assert.equal(frame.headers['X-Teleconsult-Simulation'], 'demo');
  } finally { await h.done(); }
});

test('booking advice keeps the source specialty and red-flag rules on the API', async t => {
  const h = harness();
  const advice = (who, query, extra) => h.call(who, 'GET', `/api/booking-advice${query}`, extra);
  try {
    // p8 is an adult, p1..p10 are the seed fixtures; find a child for the Pediatrics rule.
    const patients = ok(await doctor(h, 'GET', '/api/patients'));
    const year = 2026;
    const child = patients.find(p => year - Number(p.dob.slice(0, 4)) < 16);
    const adult = patients.find(p => year - Number(p.dob.slice(0, 4)) >= 16);
    assert.ok(child && adult, 'seed has a child and an adult');
    const q = (id, symptoms, more = '') => `?patientId=${id}&symptoms=${encodeURIComponent(symptoms)}${more}`;

    const cases = [
      ['', 'General medicine', false], ['Fever,Cough', 'General medicine', false], ['Medication refill', 'General medicine', false],
      ['Low mood', 'Psychiatry', false], ['Anxiety', 'Psychiatry', false], ['Trouble sleeping', 'Psychiatry', false],
      ['Rash', 'Dermatology', false], ['Itching,Fever', 'Dermatology', false],
      ['Palpitations', 'Cardiology', false], ['High blood pressure reading', 'Cardiology', false],
      ['Chest pain', 'General medicine', true], ['Shortness of breath', 'General medicine', true],
      ['Palpitations,Chest pain', 'Cardiology', true],
      ['Rash,Anxiety', 'Psychiatry', false], ['Rash,Palpitations', 'Dermatology', false], // source ordering: psychiatry, dermatology, cardiology
      [' Rash , Fever ', 'Dermatology', false], ['rash', 'General medicine', false], ['chest pain', 'General medicine', false], // exact-name matching, as in the source
    ];
    for (const [symptoms, specialty, urgent] of cases) {
      const r = ok(await advice('doctor', q(adult.id, symptoms)));
      assert.deepEqual(r, {specialty, urgent, demo: true}, `symptoms: "${symptoms}"`);
    }
    // Under-16 always routes to Pediatrics first; red flags still mark the visit urgent.
    assert.deepEqual(ok(await advice('doctor', q(child.id, 'Anxiety,Rash'))), {specialty: 'Pediatrics', urgent: false, demo: true});
    assert.deepEqual(ok(await advice('doctor', q(child.id, 'Chest pain'))), {specialty: 'Pediatrics', urgent: true, demo: true});
    // Optional severity follows the source (>= 8 is urgent; the page default is 4).
    assert.equal(ok(await advice('doctor', q(adult.id, 'Fever', '&severity=7'))).urgent, false);
    assert.equal(ok(await advice('doctor', q(adult.id, 'Fever', '&severity=8'))).urgent, true);
    assert.equal(ok(await advice('doctor', q(adult.id, 'Fever', '&severity=10'))).urgent, true);
    assert.equal(ok(await advice('doctor', q(adult.id, 'Fever', '&severity=0'))).urgent, false);
    // Age follows the clinic clock year.
    h.clock.ms = Date.UTC(2040, 0, 1);
    assert.equal(ok(await advice('doctor', q(child.id, ''))).specialty, 'General medicine', 'the child has grown up by 2040');
    h.clock.ms = START;

    // Labelled demonstration data, never cached.
    const sample = await advice('nurse', q(adult.id, 'Rash'));
    assert.equal(sample.headers['X-Teleconsult-Simulation'], 'demo');
    assert.equal(sample.headers['Cache-Control'], 'no-store');
    assert.deepEqual(Object.keys(sample.body).sort(), ['demo', 'specialty', 'urgent']);

    // Authorization: provider names the patient; patients stay on their beneficiary; admin may choose.
    assert.equal((await advice('doctor', '?symptoms=Rash')).status, 400, 'providers must name the patient');
    assert.equal((await advice('doctor', q('nope', 'Rash'))).status, 404);
    assert.equal(ok(await advice('patient', '?symptoms=Rash')).specialty, 'Dermatology', 'own beneficiary by default');
    assert.equal(ok(await advice('patient', q('p8', 'Rash'))).specialty, 'Dermatology');
    assert.equal((await advice('patient', q('p1', 'Rash'))).status, 403);
    assert.equal((await advice('patient', q('p8', 'Rash'), {patient: 'p1'})).status, 403, 'header cannot widen');
    assert.equal((await advice({id: 'u-unmapped', role: 'teleconsult-patient', tenantId: TENANT}, q('p8', 'Rash'), {module: PATIENT})).status, 403);
    assert.equal(ok(await advice('admin', q(child.id, 'Rash'), {module: PATIENT})).specialty, 'Pediatrics', 'admin chooses explicitly');
    assert.equal((await advice('admin', q('nope', 'Rash'), {module: PATIENT})).status, 404);
    assert.equal(ok(await advice('admin', '?symptoms=Rash', {module: PATIENT})).specialty, 'Dermatology', 'admin default selection');
    assert.equal((await advice({id: 'u-finance', role: 'finance-manager', tenantId: TENANT}, q('p8', 'Rash'))).status, 403);
    assert.equal((await h.call('doctor', 'POST', '/api/booking-advice', {body: {}})).status, 405);

    // Bounded, validated input.
    const bad = [
      q(adult.id, Array.from({length: 21}, (_, i) => `S${i}`).join(',')), q(adult.id, 'x'.repeat(61)), q(adult.id, 'a'.repeat(1001)),
      q(adult.id, 'Rash', '&severity=11'), q(adult.id, 'Rash', '&severity=-1'), q(adult.id, 'Rash', '&severity=4.5'), q(adult.id, 'Rash', '&severity=abc'), q(adult.id, 'Rash', '&severity='),
      q(adult.id, 'Rash', '&extra=1'), `?patientId=${adult.id}&patientId=p1&symptoms=Rash`, `?patientId=${adult.id}&symptoms=Rash&symptoms=Anxiety`,
      '?patientId=../p1&symptoms=Rash', `?patientId=${'p'.repeat(65)}&symptoms=Rash`, q(adult.id, 'Ra\u0001sh'),
    ];
    for (const query of bad) {
      const r = await advice('doctor', query);
      assert.ok(r.status === 400, `${query.slice(0, 60)} → ${r.status}`);
    }
    assert.equal((await advice('doctor', `?patientId=${adult.id}&symptoms=${'y'.repeat(1100)}`)).status, 400, 'over-long request targets are refused before routing');
    // A read: nothing is persisted, no idempotency key is needed and no audit entry appears.
    const before = ok(await doctor(h, 'GET', '/api/audit?limit=200')).entries.length;
    await advice('doctor', q(adult.id, 'Rash'));
    assert.equal(ok(await doctor(h, 'GET', '/api/audit?limit=200')).entries.length, before);
  } finally { await h.done(); }
});
