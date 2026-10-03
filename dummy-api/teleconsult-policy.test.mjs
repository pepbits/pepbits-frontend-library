import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  COMMAND_ACCESS, TeleconsultConfigError, commandAllowed, idempotencyKey, moduleSurface, parseTeleconsultRequest,
  patientGrant, providerModes, resolveTeleconsultActor, resolveTeleconsultConfig, teleconsultScope, validateTeleconsultConfig,
} from './teleconsult-policy.mjs';

const shipped = () => JSON.parse(readFileSync(new URL('./config/teleconsult/nexora.json', import.meta.url), 'utf8'));
const withDefaults = patch => { const c = shipped(); patch(c); return c; };
const tenant = 'NEX-AE-001';
const user = (role, extra = {}) => ({id: `u-${role}`, tenantId: tenant, role, ...extra});
const scope = (moduleId = 'reference-teleconsult-provider', branchId = 'dubai') => ({applicationId: 'nexora', branchId, moduleId});
const cfg = () => resolveTeleconsultConfig(validateTeleconsultConfig(shipped()), tenant, 'dubai');
const actorFor = (surface, u, {headers, query = '', pathname = '/api/session'} = {}) => resolveTeleconsultActor({surface, user: u, headers, search: new URLSearchParams(query), pathname, config: cfg()});

test('both modules share one partition per trusted tenant, application and branch', () => {
  const a = teleconsultScope(user('teleconsult-doctor'), scope());
  const b = teleconsultScope(user('teleconsult-patient'), scope('reference-teleconsult-patient'));
  assert.equal(a.key, b.key);
  assert.equal(a.surface, 'provider');
  assert.equal(b.surface, 'patient');
  const keys = new Set([a.key, teleconsultScope({...user('x'), tenantId: 'OTHER'}, scope()).key, teleconsultScope(user('x'), scope(undefined, 'sharjah')).key, teleconsultScope(user('x'), {...scope(), applicationId: 'other'}).key]);
  assert.equal(keys.size, 4);
  assert.match(a.key, /^[0-9a-f]{64}$/);
});

test('scope rejects unauthenticated, malformed and unknown-module requests', () => {
  assert.throws(() => teleconsultScope(null, scope()));
  assert.throws(() => teleconsultScope({id: 'u'}, scope()));
  assert.throws(() => teleconsultScope(user('x'), scope('reference-school')));
  assert.throws(() => teleconsultScope(user('x'), {...scope(), branchId: '../etc'}));
  assert.throws(() => teleconsultScope({...user('x'), tenantId: 'a/b'}, scope()));
  assert.equal(moduleSurface('__proto__'), null);
  assert.equal(moduleSurface('constructor'), null);
});

test('shipped configuration is valid and resolves defaults, tenant and branch overrides', () => {
  const validated = validateTeleconsultConfig(shipped());
  const dubai = resolveTeleconsultConfig(validated, tenant, 'dubai');
  assert.equal(dubai.scheduling.slotIntervalMin, 15);
  assert.deepEqual(dubai.modes, ['video', 'audio', 'chat']);
  const sharjah = resolveTeleconsultConfig(validated, tenant, 'sharjah');
  assert.equal(sharjah.scheduling.slotIntervalMin, 30);
  assert.equal(sharjah.scheduling.opening, '09:00');
  assert.deepEqual(sharjah.modes, ['video', 'audio']);
  assert.equal(sharjah.limits.maxPatients, dubai.limits.maxPatients, 'untouched groups keep tenant defaults');
  assert.equal(resolveTeleconsultConfig(validated, 'UNKNOWN', 'sharjah').scheduling.slotIntervalMin, 15, 'branch overrides apply only to the configured tenant');
  assert.throws(() => { sharjah.scheduling.slotIntervalMin = 5; }, TypeError, 'resolved configuration is frozen');
});

test('tenant defaults can be overridden by a branch without losing sibling settings', () => {
  const raw = withDefaults(c => { c.tenants[tenant] = {scheduling: {slotIntervalMin: 10, closing: '19:00'}, access: {allowPatientBooking: false}, branches: {hq: {recording: {allowed: false}, simulation: {vitals: false}}}}; });
  const validated = validateTeleconsultConfig(raw);
  const hq = resolveTeleconsultConfig(validated, tenant, 'hq');
  assert.equal(hq.scheduling.closing, '19:00');
  assert.deepEqual(hq.recording, {allowed: false, consentRequired: true});
  assert.equal(hq.access.allowPatientBooking, false, 'tenant layer overrides the shipped default');
  assert.equal(hq.access.allowAdminPatientRegistration, true, 'untouched access keys keep defaults');
  assert.equal(hq.simulation.vitals, false);
  assert.equal(hq.simulation.transcript, true);
});

test('invalid configuration is rejected with every problem and never partially applied', () => {
  const bad = {
    'unknown section': c => { c.extra = 1; },
    'unsupported setting': c => { c.defaults.scheduling.slotInterval = 15; },
    'schema version': c => { c.schemaVersion = 2; },
    'missing group': c => { delete c.defaults.limits; },
    'missing leaf': c => { delete c.defaults.scheduling.opening; },
    'opening after closing': c => { c.defaults.scheduling.opening = '18:00'; c.defaults.scheduling.closing = '08:00'; c.defaults.scheduling.breaks = []; },
    'interval not dividing the hour': c => { c.defaults.scheduling.slotIntervalMin = 25; },
    'interval too small': c => { c.defaults.scheduling.slotIntervalMin = 1; },
    'break outside hours': c => { c.defaults.scheduling.breaks = [{start: '06:00', end: '07:00'}]; },
    'overlapping breaks': c => { c.defaults.scheduling.breaks = [{start: '12:00', end: '13:30'}, {start: '13:00', end: '14:00'}]; },
    'reversed break': c => { c.defaults.scheduling.breaks = [{start: '14:00', end: '13:00'}]; },
    'bad clock text': c => { c.defaults.scheduling.opening = '8am'; },
    'duration order': c => { c.defaults.scheduling.defaultDurationMin = 90; },
    'empty modes': c => { c.defaults.modes = []; },
    'unknown mode': c => { c.defaults.modes = ['video', 'carrier-pigeon']; },
    'duplicate mode': c => { c.defaults.modes = ['video', 'video']; },
    'non boolean flag': c => { c.defaults.recording.allowed = 'yes'; },
    'zero body bound': c => { c.defaults.limits.maxBodyBytes = 0; },
    'unbounded body': c => { c.defaults.limits.maxBodyBytes = 10 ** 9; },
    'fractional limit': c => { c.defaults.limits.maxPatients = 10.5; },
    'bad register role': c => { c.defaults.access.registerRoles = ['patient']; },
    'same staff ids': c => { c.defaults.access.nurseStaffId = 'd1'; },
    'bad staff id': c => { c.defaults.access.doctorStaffId = '../d1'; },
    'tenant bad id': c => { c.tenants['bad/id'] = {}; },
    'branch breaks invalid after merge': c => { c.tenants[tenant].branches.sharjah.scheduling.opening = '14:00'; },
    'branch unknown key': c => { c.tenants[tenant].branches.sharjah.billing = {}; },
    'tenant not an object': c => { c.tenants[tenant] = 5; },
    'offset out of range': c => { c.defaults.scheduling.utcOffsetMinutes = 2000; },
  };
  for (const [name, patch] of Object.entries(bad)) {
    assert.throws(() => validateTeleconsultConfig(withDefaults(patch)), TeleconsultConfigError, name);
  }
  assert.throws(() => validateTeleconsultConfig(null), TeleconsultConfigError);
  assert.throws(() => validateTeleconsultConfig([]), TeleconsultConfigError);
  try { validateTeleconsultConfig(withDefaults(c => { c.defaults.modes = []; c.defaults.limits.maxPatients = 1; })); assert.fail('should throw'); } catch (error) { assert.ok(error.issues.length >= 2); }
});

test('provider mode comes from the authenticated grant; the header only selects among granted modes', () => {
  assert.deepEqual(providerModes(user('teleconsult-doctor')), ['doctor']);
  assert.deepEqual(providerModes(user('enterprise-admin')), ['doctor', 'nurse']);
  assert.deepEqual(providerModes(user('finance-manager')), []);
  assert.deepEqual(providerModes(user('enterprise-admin', {teleconsultRoles: ['nurse', 'surgeon']})), ['nurse'], 'explicit grants narrow, never widen');
  assert.deepEqual(providerModes(user('teleconsult-nurse', {teleconsultRoles: ['doctor']})), [], 'explicit grants cannot add a mode');
  const doctor = actorFor('provider', user('teleconsult-doctor'));
  assert.equal(doctor.actor.mode, 'doctor');
  assert.equal(doctor.actor.staffId, 'd1');
  assert.equal(doctor.actor.userId, 'u-teleconsult-doctor', 'actor keeps the real account id');
  assert.equal(actorFor('provider', user('teleconsult-nurse')).actor.staffId, 'n1');
  assert.equal(actorFor('provider', user('teleconsult-nurse'), {headers: {'X-Teleconsult-Role': 'doctor'}}).status, 403);
  assert.equal(actorFor('provider', user('teleconsult-nurse'), {query: 'role=doctor'}).status, 403);
  assert.equal(actorFor('provider', user('teleconsult-doctor'), {headers: {'x-teleconsult-role': 'nurse'}}).status, 403);
  assert.equal(actorFor('provider', user('teleconsult-patient')).status, 403);
  assert.equal(actorFor('provider', user('school-admin')).status, 403);
  assert.equal(actorFor('provider', null).status, 401);
  assert.equal(actorFor('provider', user('enterprise-admin'), {headers: {'x-teleconsult-role': 'nurse'}}).actor.mode, 'nurse');
  assert.equal(actorFor('provider', user('enterprise-admin'), {query: 'role=nurse'}).actor.mode, 'nurse');
  assert.equal(actorFor('provider', user('enterprise-admin'), {headers: {'x-teleconsult-role': 'doctor'}, query: 'role=nurse'}).status, 400, 'conflicting selections are refused');
  assert.equal(actorFor('provider', user('enterprise-admin'), {headers: {'x-teleconsult-role': 'root'}}).status, 400);
  assert.equal(actorFor('provider', user('enterprise-admin'), {query: 'role=nurse', pathname: '/api/staff'}).actor.mode, 'doctor', 'query role is honored on /api/session only');
  assert.equal(actorFor('provider', user('enterprise-admin'), {headers: {'x-teleconsult-role': ['doctor', 'nurse']}}).status, 400, 'duplicate headers are ambiguous');
});

test('patient beneficiary is fixed for dedicated accounts and selectable only by admin', () => {
  const dedicated = user('teleconsult-patient', {teleconsultPatientId: 'p8'});
  assert.equal(actorFor('patient', dedicated).actor.patientId, 'p8');
  assert.equal(actorFor('patient', dedicated, {headers: {'x-teleconsult-patient': 'p8'}}).actor.patientId, 'p8');
  assert.equal(actorFor('patient', dedicated, {headers: {'x-teleconsult-patient': 'p1'}}).status, 403);
  assert.equal(actorFor('patient', dedicated, {query: 'patientId=p1'}).status, 403);
  assert.equal(actorFor('patient', dedicated, {headers: {'x-teleconsult-patient': '../p1'}}).status, 400);
  assert.equal(actorFor('patient', user('teleconsult-patient', {teleconsultPatientId: 'p3'})).actor.patientId, 'p3');
  // A fixed patient account needs the host's trusted mapping; the config default never stands in for it.
  assert.equal(cfg().access.defaultPatientId, 'p8');
  for (const missing of [user('teleconsult-patient'), user('teleconsult-patient', {teleconsultPatientId: ''}), user('teleconsult-patient', {teleconsultPatientId: 42}), user('teleconsult-patient', {teleconsultPatientId: '../p1'}), user('teleconsult-patient', {teleconsultPatientId: null})]) {
    assert.equal(actorFor('patient', missing).status, 403, JSON.stringify(missing));
    assert.equal(actorFor('patient', missing, {headers: {'x-teleconsult-patient': 'p8'}}).status, 403, 'a header cannot supply the missing mapping');
    assert.equal(actorFor('patient', missing, {query: 'patientId=p8'}).status, 403);
  }
  assert.equal(patientGrant(user('teleconsult-patient')), null);
  assert.deepEqual(patientGrant(dedicated), {all: false, patientId: 'p8'});
  assert.deepEqual(patientGrant(user('enterprise-admin')), {all: true});
  assert.equal(actorFor('patient', user('teleconsult-patient', {teleconsultPatientId: 'p3'}), {headers: {'x-teleconsult-patient': 'p8'}}).status, 403, 'a header cannot widen to the config default either');
  // The config default only seeds an admin's initial selection.
  const admin = user('enterprise-admin');
  assert.equal(actorFor('patient', admin).actor.patientId, 'p8');
  assert.equal(actorFor('patient', admin).actor.all, true);
  assert.equal(actorFor('patient', admin, {headers: {'x-teleconsult-patient': 'p1'}}).actor.patientId, 'p1');
  assert.equal(actorFor('patient', admin, {query: 'patientId=p2'}).actor.patientId, 'p2');
  assert.equal(actorFor('patient', user('teleconsult-doctor')).status, 403);
  assert.equal(actorFor('patient', user('teleconsult-nurse')).status, 403);
});

test('shipped demo policy enables patient booking and admin registration; recording consent can never be disabled', () => {
  const c = cfg();
  assert.equal(c.access.allowPatientBooking, true);
  assert.equal(c.access.allowAdminPatientRegistration, true);
  assert.equal(c.recording.consentRequired, true);
  for (const value of [false, 'true', 0, null]) {
    assert.throws(() => validateTeleconsultConfig(withDefaults(x => { x.defaults.recording.consentRequired = value; })), TeleconsultConfigError, `defaults ${value}`);
  }
  assert.throws(() => validateTeleconsultConfig(withDefaults(x => { x.tenants[tenant].recording = {consentRequired: false}; })), /tenants\.NEX-AE-001\.recording\.consentRequired is invalid/, 'tenant layer');
  assert.throws(() => validateTeleconsultConfig(withDefaults(x => { x.tenants[tenant].branches.sharjah.recording = {consentRequired: false}; })), /sharjah\.recording\.consentRequired is invalid/, 'branch layer');
  validateTeleconsultConfig(withDefaults(x => { x.defaults.recording.consentRequired = true; x.defaults.recording.allowed = false; }));
  // The new access flag is bounded to a boolean and required in the defaults.
  for (const value of ['yes', 1, null, {}]) assert.throws(() => validateTeleconsultConfig(withDefaults(x => { x.defaults.access.allowAdminPatientRegistration = value; })), /allowAdminPatientRegistration is invalid/);
  assert.throws(() => validateTeleconsultConfig(withDefaults(x => { delete x.defaults.access.allowAdminPatientRegistration; })), /allowAdminPatientRegistration is required/);
  const branchOff = resolveTeleconsultConfig(validateTeleconsultConfig(withDefaults(x => { x.tenants[tenant].branches.sharjah.access = {allowAdminPatientRegistration: false}; })), tenant, 'sharjah');
  assert.equal(branchOff.access.allowAdminPatientRegistration, false);
  assert.equal(branchOff.access.allowPatientBooking, true, 'siblings keep their values');
});

test('request parsing refuses escaping paths, oversized and non-object bodies', () => {
  const c = cfg();
  const parse = (path, extra = {}) => parseTeleconsultRequest({method: 'GET', path, ...extra}, c);
  assert.equal(parse('/api/health').pathname, '/api/health');
  assert.equal(parse('/api/slots?clinicianId=d1').search.get('clinicianId'), 'd1');
  for (const path of ['/api/%2e%2e/x', '/api/%ZZ', '/api/../x', '/api/a\\b', '/apix', '/other', '/api//health', '/api/%00', `/api/${'a'.repeat(700)}`, 'https://evil/api/health']) {
    assert.equal(parse(path).error?.status, 400, path);
  }
  assert.equal(parseTeleconsultRequest({method: 'TRACE', path: '/api/health'}, c).error.status, 405);
  assert.equal(parseTeleconsultRequest({method: 'POST', path: '/api/x', body: []}, c).error.status, 400);
  assert.equal(parseTeleconsultRequest({method: 'POST', path: '/api/x', body: 'text'}, c).error.status, 400);
  assert.equal(parseTeleconsultRequest({method: 'POST', path: '/api/x', body: {t: 'x'.repeat(c.limits.maxBodyBytes)}}, c).error.status, 413);
  const circular = {}; circular.self = circular;
  assert.equal(parseTeleconsultRequest({method: 'POST', path: '/api/x', body: circular}, c).error.status, 400);
  assert.equal(parseTeleconsultRequest({method: 'GET', path: '/api/x', query: new URLSearchParams({q: 'y'.repeat(2000)})}, c).error.status, 414);
});

test('idempotency keys are validated and header lookup is case-insensitive', () => {
  assert.equal(idempotencyKey({'Idempotency-Key': 'abcdef12'}).key, 'abcdef12');
  assert.equal(idempotencyKey({'idempotency-key': 'abc:def.12_3'}).key, 'abc:def.12_3');
  assert.ok(idempotencyKey({}).missing);
  assert.ok(idempotencyKey({'idempotency-key': 'short'}).invalid);
  assert.ok(idempotencyKey({'idempotency-key': 'has space in it'}).invalid);
  assert.ok(idempotencyKey({'idempotency-key': ['aaaaaaaa', 'bbbbbbbb']}).invalid);
  assert.ok(idempotencyKey({'idempotency-key': 'a'.repeat(129)}).invalid);
});

test('command access separates doctor, nurse and patient capabilities', () => {
  const c = cfg();
  const doctor = {kind: 'provider', mode: 'doctor'}, nurse = {kind: 'provider', mode: 'nurse'}, patient = {kind: 'patient'};
  assert.ok(commandAllowed(doctor, 'audit.list', c));
  assert.ok(!commandAllowed(nurse, 'audit.list', c));
  assert.ok(!commandAllowed(patient, 'audit.list', c));
  for (const name of ['encounter.put', 'encounter.sign', 'patients.update', 'appointments.update', 'transcript.current', 'sim.arrive', 'queue.get', 'appointments.list']) {
    assert.ok(commandAllowed(doctor, name, c) && commandAllowed(nurse, name, c), name);
    assert.ok(!commandAllowed(patient, name, c), `${name} is not available to patients`);
  }
  for (const name of ['appointments.join', 'appointments.get', 'summary.get', 'messages.post', 'vitals.current', 'patients.history']) assert.ok(commandAllowed(patient, name, c), name);
  assert.ok(!commandAllowed(doctor, 'appointments.join', c), 'only patients join the waiting room');
  assert.ok(commandAllowed(patient, 'appointments.create', c) && commandAllowed(patient, 'slots.list', c), 'the shipped demo enables patient booking');
  const noBooking = resolveTeleconsultConfig(validateTeleconsultConfig(withDefaults(x => { x.defaults.access.allowPatientBooking = false; })), tenant, 'dubai');
  assert.ok(!commandAllowed(patient, 'appointments.create', noBooking) && !commandAllowed(patient, 'slots.list', noBooking), 'an explicit override turns patient booking off');
  assert.ok(commandAllowed(doctor, 'appointments.create', noBooking) && commandAllowed(nurse, 'appointments.create', noBooking) && commandAllowed(nurse, 'slots.list', noBooking), 'provider booking does not depend on the patient setting');
  // Registration from the patient module: only the all-patient admin grant, and only while the setting is on.
  const adminPatient = {kind: 'patient', all: true}, fixedPatient = {kind: 'patient', all: false, patientId: 'p8'};
  assert.equal(c.access.allowAdminPatientRegistration, true, 'shipped default');
  assert.ok(commandAllowed(adminPatient, 'patients.create', c));
  assert.ok(!commandAllowed(fixedPatient, 'patients.create', c), 'a fixed patient can never create patients');
  assert.ok(!commandAllowed({kind: 'patient'}, 'patients.create', c), 'an actor without an all-grant flag is denied');
  const noAdminRegistration = resolveTeleconsultConfig(validateTeleconsultConfig(withDefaults(x => { x.defaults.access.allowAdminPatientRegistration = false; })), tenant, 'dubai');
  assert.ok(!commandAllowed(adminPatient, 'patients.create', noAdminRegistration) && !commandAllowed(fixedPatient, 'patients.create', noAdminRegistration));
  assert.ok(commandAllowed(doctor, 'patients.create', noAdminRegistration), 'provider registration is governed by registerRoles only');
  // Booking advice is available to every surface; it carries no patient write.
  assert.ok(commandAllowed(doctor, 'booking.advice', c) && commandAllowed(nurse, 'booking.advice', c) && commandAllowed(fixedPatient, 'booking.advice', c) && commandAllowed(adminPatient, 'booking.advice', c));
  assert.ok(commandAllowed(fixedPatient, 'booking.advice', noBooking), 'advice does not depend on the booking switch');
  assert.ok(commandAllowed(nurse, 'patients.create', c));
  const noNurseRegistration = resolveTeleconsultConfig(validateTeleconsultConfig(withDefaults(x => { x.defaults.access.registerRoles = ['doctor']; })), tenant, 'dubai');
  assert.ok(!commandAllowed(nurse, 'patients.create', noNurseRegistration) && commandAllowed(doctor, 'patients.create', noNurseRegistration));
  assert.ok(!commandAllowed(doctor, 'not.a.command', c));
  assert.ok(!commandAllowed(doctor, '__proto__', c));
  assert.ok(Object.isFrozen(COMMAND_ACCESS));
});
