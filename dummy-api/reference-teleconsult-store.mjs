// Teleconsult reference API for the provider (doctor/nurse) and patient modules.
// Both modules call the same store through the authenticated host: handle(user, scope, request).
// One durable partition exists per trusted tenant/application/branch, seeded from fictional source data.
// Clinical simulation (vitals, transcript, decision support, scribe) is demonstration logic only.
// No server port is opened here; the host owns transport, authentication and tenant resolution.
import {createHash, randomBytes} from 'node:crypto';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {mkdir, open, readFile, rename, rm, unlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {
  COMMAND_ACCESS, SIMULATION_NOTICE, commandAllowed, idempotencyKey, isMutation, parseTeleconsultRequest,
  resolveTeleconsultActor, resolveTeleconsultConfig, teleconsultScope, validateTeleconsultConfig,
} from './teleconsult-policy.mjs';
import {getCatalog, DRUGS, ICD, ORDERABLES, ORDER_SETS} from './teleconsult-source/catalog.ts';
import {blankEncounter, buildSeed} from './teleconsult-source/seed.ts';
import {computeScore, runCds, scribe, suggest} from './teleconsult-source/intelligence.ts';
import * as D from './teleconsult-source/domain.mjs';

const {HttpError, bad, conflict, notFound} = D;
const DEFAULT_CONFIG = fileURLToPath(new URL('./config/teleconsult/nexora.json', import.meta.url));
const SCHEMA = 1;
const MAX_LOADED_SCOPES = 64;
const held = new Set(); // data directories owned by a store in this process

// ---------------------------------------------------------------- lease and durable files

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

/** One writer per data directory: an owner file inside an exclusive lease directory. */
function acquireLease(dataDir) {
  mkdirSync(dataDir, {recursive: true, mode: 0o700});
  const lease = join(dataDir, '.teleconsult.lease');
  const token = randomBytes(16).toString('hex');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      mkdirSync(lease, {mode: 0o700});
      writeFileSync(join(lease, 'owner.json'), JSON.stringify({pid: process.pid, token, acquiredAt: new Date().toISOString()}), {mode: 0o600});
      held.add(dataDir);
      return {lease, token};
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner = null;
      try { owner = JSON.parse(readFileSync(join(lease, 'owner.json'), 'utf8')); } catch { /* unreadable owner is treated as stale */ }
      const live = owner && Number.isInteger(owner.pid) && pidAlive(owner.pid) && (owner.pid !== process.pid || held.has(dataDir));
      if (live) throw new Error('Teleconsult data directory is owned by another writer');
      rmSync(lease, {recursive: true, force: true});
    }
  }
  throw new Error('Teleconsult data directory lease could not be acquired');
}

async function writeAtomic(file, text) {
  const temporary = `${file}.tmp-${randomBytes(6).toString('hex')}`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(text);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
    const directory = await open(dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

// ---------------------------------------------------------------- helpers

const sha = text => createHash('sha256').update(text).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
const ok = (body, status = 200, headers) => ({status, body, ...(headers ? {headers} : {})});
const SIM = {'X-Teleconsult-Simulation': 'demo'};
const clone = value => structuredClone(value);

function newState(scope, seed, nowIso) {
  return {
    schema: SCHEMA, scope, revision: 0, createdAt: nowIso,
    data: {staff: seed.staff, patients: seed.patients, appointments: seed.appointments, encounters: seed.encounters, messages: seed.messages, vitalBaselines: seed.vitalBaselines},
    counters: {mrn: 100241}, runtime: {recordings: {}}, idempotency: [], audit: [], auditDropped: 0,
  };
}

function normalizeState(state, scope) {
  if (!state || state.schema !== SCHEMA || !state.data || !isDeepStrictEqual(state.scope, scope)) throw new Error('Teleconsult state does not match its scope');
  for (const key of ['staff', 'patients', 'appointments', 'encounters', 'messages']) if (!Array.isArray(state.data[key])) throw new Error('Teleconsult state is incomplete');
  for (const e of state.data.encounters) e.version = Number.isInteger(e.version) ? e.version : 1;
  state.idempotency ??= []; state.audit ??= []; state.auditDropped ??= 0; state.runtime ??= {recordings: {}}; state.runtime.recordings ??= {};
  return state;
}

// ---------------------------------------------------------------- command registry

const COMMANDS = [];
/** kind: read (live state), write (draft + persist), auto (draft, persisted only when the handler changed it). */
function command(name, method, path, kind, run, {key = kind === 'write'} = {}) {
  if (!Object.hasOwn(COMMAND_ACCESS, name)) throw new Error(`Command ${name} has no access rule`);
  COMMANDS.push({name, method, segments: path.split('/').slice(1), kind, key, run});
}

function matchCommand(method, pathname) {
  const parts = pathname.split('/').slice(1);
  let pathHit = false;
  for (const c of COMMANDS) {
    if (c.segments.length !== parts.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < parts.length && match; i++) {
      if (c.segments[i].startsWith(':')) params[c.segments[i].slice(1)] = parts[i];
      else match = c.segments[i] === parts[i];
    }
    if (!match) continue;
    pathHit = true;
    if (c.method === method) return {command: c, params};
  }
  return pathHit ? {methodNotAllowed: true} : null;
}

const staffName = (state, id) => state.data.staff.find(s => s.id === id)?.name ?? 'Clinician';
const fullName = p => `${p.firstName} ${p.lastName}`;

function needPatient(ctx, id) {
  const p = D.findPatient(ctx.state, D.recordId(id, 'Patient'));
  if (!p) throw notFound('Patient not found');
  return p;
}
function needAppt(ctx, id) {
  const a = D.findAppt(ctx.state, D.recordId(id, 'Appointment'));
  if (!a) throw notFound('Appointment not found');
  return a;
}
/** Patients only reach their own beneficiary; unrelated visits look absent rather than forbidden. */
function ownAppt(ctx, id) {
  const a = needAppt(ctx, id);
  if (ctx.actor.kind === 'patient' && a.patientId !== ctx.actor.patientId) throw notFound('Appointment not found');
  return a;
}
function ownPatientParam(ctx, id) {
  if (ctx.actor.kind === 'patient' && id !== ctx.actor.patientId) throw new HttpError(403, 'This account is not authorized for that patient');
  return needPatient(ctx, id);
}
function clinicianGuard(ctx, appt) {
  if (ctx.actor.kind === 'provider' && ctx.actor.mode === 'doctor' && ctx.cfg.access.enforceClinicianOwnership && appt.clinicianId !== ctx.actor.staffId) {
    throw new HttpError(403, 'This visit belongs to another clinician');
  }
}
const noBody = ctx => { if (ctx.body && Object.keys(ctx.body).length) throw bad('This request does not take a body'); };
const boolQuery = (search, name) => search.get(name) === null ? false : ['1', 'true'].includes(search.get(name));
const queryText = (search, name, max = 80) => {
  const v = search.get(name);
  if (v === null) return '';
  if (v.length > max) throw bad(`${name} is too long`);
  return v.toLowerCase().trim();
};

// ----- reference

command('health.get', 'GET', '/api/health', 'read', ctx => ok({ok: true, time: new Date(ctx.nowMs).toISOString(), demo: true}));

command('session.get', 'GET', '/api/session', 'read', ctx => {
  const {state, actor, cfg} = ctx;
  const settings = {
    modes: cfg.modes, scheduling: cfg.scheduling, recording: cfg.recording,
    simulation: cfg.simulation, allowPatientBooking: cfg.access.allowPatientBooking, allowAdminPatientRegistration: cfg.access.allowAdminPatientRegistration,
  };
  const simulation = {demo: true, notice: SIMULATION_NOTICE};
  if (actor.kind === 'provider') {
    const user = state.data.staff.find(s => s.id === actor.staffId);
    return ok({role: actor.mode, roles: actor.modes, user: clone(user), staff: clone(state.data.staff), canRegister: cfg.access.registerRoles.includes(actor.mode), settings, simulation}, 200, SIM);
  }
  const patients = actor.all ? state.data.patients : state.data.patients.filter(p => p.id === actor.patientId);
  const patient = state.data.patients.find(p => p.id === actor.patientId);
  return ok({...(patient ? {patient: clone(patient)} : {}), patients: clone(patients), canRegister: actor.all && cfg.access.allowAdminPatientRegistration, settings, simulation}, 200, SIM);
});

command('staff.list', 'GET', '/api/staff', 'read', ctx => {
  const role = ctx.search.get('role');
  if (role !== null && !['doctor', 'nurse'].includes(role)) throw bad('role must be doctor or nurse');
  return ok(clone(ctx.state.data.staff.filter(s => !role || s.role === role)));
});

command('booking.advice', 'GET', '/api/booking-advice', 'read', ctx => {
  const {actor, search} = ctx;
  for (const name of search.keys()) if (!['patientId', 'symptoms', 'severity'].includes(name)) throw bad(`${name} is not a supported parameter`);
  for (const name of ['patientId', 'symptoms', 'severity']) if (search.getAll(name).length > 1) throw bad(`${name} may be given once`);
  // A patient session defaults to its own beneficiary; a provider must name the patient explicitly.
  const patientId = search.get('patientId') ?? (actor.kind === 'patient' ? actor.patientId : null);
  if (patientId === null) throw bad('patientId is required');
  D.recordId(patientId, 'Patient');
  if (actor.kind === 'patient' && !actor.all && patientId !== actor.patientId) throw new HttpError(403, 'This account is not authorized for that patient');
  const patient = needPatient(ctx, patientId);
  const text = search.get('symptoms') ?? '';
  if (text.length > 1000) throw bad('symptoms is too long');
  const symptoms = text.split(',').map(s => s.trim()).filter(Boolean);
  if (symptoms.length > 20) throw bad('symptoms must list at most 20 items');
  symptoms.forEach(s => D.str(s, 'Symptom', {min: 1, max: 60}));
  const rawSeverity = search.get('severity');
  if (rawSeverity !== null && !/^(10|\d)$/.test(rawSeverity)) throw bad('severity must be a whole number from 0 to 10');
  return ok(D.bookingAdvice({symptoms, severity: rawSeverity === null ? undefined : Number(rawSeverity), age: D.patientAge(patient.dob, ctx.nowMs, ctx.cfg)}), 200, SIM);
});

command('catalog.get', 'GET', '/api/catalog', 'read', () => ok(clone(getCatalog()), 200, SIM));

command('catalog.search', 'GET', '/api/catalog/search', 'read', ctx => {
  const q = queryText(ctx.search, 'q');
  if (q.length < 2) return ok([]);
  const tokens = q.split(/\s+/).filter(Boolean);
  const match = (...fields) => { const hay = fields.join(' ').toLowerCase(); return tokens.every(t => hay.includes(t)); };
  const hits = [];
  ICD.filter(c => match(c.code, c.display, ...c.keywords)).slice(0, 6).forEach(c => hits.push({type: 'icd', id: c.code, label: c.display, sub: `Diagnosis · ICD-10 ${c.code}`}));
  DRUGS.filter(d => match(d.name, d.strength, d.drugClass, d.form)).slice(0, 6).forEach(d => hits.push({type: 'drug', id: d.id, label: `${d.name} ${d.strength}`, sub: `Prescription · ${d.drugClass}`}));
  ORDERABLES.filter(o => match(o.name, o.code, o.group, o.kind)).slice(0, 8).forEach(o => hits.push({type: 'order', id: o.code, label: o.name, sub: `${o.kind[0].toUpperCase()}${o.kind.slice(1)} · ${o.group}`, kind: o.kind}));
  ORDER_SETS.filter(s => match(s.name, s.description, 'order set')).forEach(s => hits.push({type: 'orderset', id: s.id, label: s.name, sub: `Order set · ${s.description}`}));
  hits.sort((a, b) => Number(b.label.toLowerCase().startsWith(tokens[0])) - Number(a.label.toLowerCase().startsWith(tokens[0])));
  return ok(hits.slice(0, 20), 200, SIM);
});
command('catalog.icd', 'GET', '/api/catalog/icd', 'read', ctx => {
  const q = queryText(ctx.search, 'q');
  return ok(clone(ICD.filter(c => !q || c.code.toLowerCase().includes(q) || c.display.toLowerCase().includes(q) || c.keywords.some(k => k.includes(q))).slice(0, 25)));
});
command('catalog.drugs', 'GET', '/api/catalog/drugs', 'read', ctx => {
  const tokens = queryText(ctx.search, 'q').split(/\s+/).filter(Boolean);
  return ok(clone(DRUGS.filter(d => tokens.every(t => `${d.name} ${d.strength} ${d.drugClass}`.toLowerCase().includes(t))).slice(0, 25)));
});

// ----- patients

command('patients.list', 'GET', '/api/patients', 'read', ctx => {
  const q = queryText(ctx.search, 'q');
  let list = ctx.state.data.patients;
  if (ctx.actor.kind === 'patient' && !ctx.actor.all) list = list.filter(p => p.id === ctx.actor.patientId);
  return ok(clone(list.filter(p => !q || `${p.firstName} ${p.lastName} ${p.mrn} ${p.phone} ${p.email}`.toLowerCase().includes(q))));
});

command('patients.create', 'POST', '/api/patients', 'write', ctx => {
  const {state, cfg, actor} = ctx;
  if (state.data.patients.length >= cfg.limits.maxPatients) throw conflict('Patient capacity for this branch has been reached');
  // Authorship comes from the authenticated account only: the staff mapping for providers, the host user id for an admin patient session.
  const patient = D.patientInput(ctx.body ?? {}, {authorId: actor.kind === 'provider' ? actor.staffId : actor.userId, nowIso: new Date(ctx.nowMs).toISOString(), mrn: `TC-${state.counters.mrn}`});
  if (state.data.patients.some(p => p.phone === patient.phone && p.dob === patient.dob)) throw conflict('A patient with this phone and date of birth already exists');
  state.counters.mrn += 1;
  state.data.patients.unshift(patient);
  state.data.vitalBaselines[patient.id] = clone(D.DEFAULT_BASELINE);
  ctx.audit('patient.registered', 'patient', patient.id);
  return ok(clone(patient), 201);
});

command('patients.get', 'GET', '/api/patients/:id', 'read', ctx => ok(clone(ownPatientParam(ctx, ctx.params.id))));

command('patients.update', 'PATCH', '/api/patients/:id', 'write', ctx => {
  const patient = needPatient(ctx, ctx.params.id);
  const changes = D.patientPatch(ctx.body ?? {}, patient);
  for (const [key, value] of Object.entries(changes)) patient[key] = value;
  ctx.audit('patient.updated', 'patient', patient.id, Object.keys(changes).join(','));
  return ok(clone(patient));
});

command('allergies.add', 'POST', '/api/patients/:id/allergies', 'write', ctx => {
  const patient = needPatient(ctx, ctx.params.id);
  const allergy = D.allergyInput(ctx.body ?? {}, ctx.actor.staffId, new Date(ctx.nowMs).toISOString());
  if (patient.allergies.length >= 60) throw conflict('Allergy list is full');
  if (patient.allergies.some(a => a.status === 'active' && a.substance.toLowerCase() === allergy.substance.toLowerCase())) throw conflict('That allergy is already recorded');
  patient.allergies.push(allergy);
  patient.noKnownAllergies = false;
  ctx.audit('allergy.added', 'patient', patient.id, allergy.id);
  return ok(clone(patient), 201);
});

command('allergies.update', 'PATCH', '/api/patients/:id/allergies/:aid', 'write', ctx => {
  const patient = needPatient(ctx, ctx.params.id);
  const allergy = patient.allergies.find(a => a.id === ctx.params.aid);
  if (!allergy) throw notFound('Allergy not found');
  const changes = D.allergyPatch(ctx.body ?? {});
  for (const [key, value] of Object.entries(changes)) allergy[key] = value;
  ctx.audit('allergy.updated', 'patient', patient.id, allergy.id);
  return ok(clone(patient));
});

command('patients.history', 'GET', '/api/patients/:id/history', 'read', ctx => {
  const patient = ownPatientParam(ctx, ctx.params.id);
  const encounters = ctx.state.data.encounters.filter(e => e.patientId === patient.id && e.status === 'signed').map(e => {
    const appointment = D.findAppt(ctx.state, e.appointmentId);
    return {appointment: clone(appointment), encounter: ctx.actor.kind === 'patient' ? D.patientEncounterView(e) : clone(e), clinician: clone(D.findStaff(ctx.state, e.signedBy ?? appointment.clinicianId))};
  }).sort((a, b) => b.appointment.start.localeCompare(a.appointment.start));
  return ok({encounters});
});

command('patients.appointments', 'GET', '/api/patients/:id/appointments', 'read', ctx => {
  const patient = ownPatientParam(ctx, ctx.params.id);
  return ok(ctx.state.data.appointments.filter(a => a.patientId === patient.id).map(a => D.view(ctx.state, a, ctx.nowMs)).sort((a, b) => a.start.localeCompare(b.start)));
});

// ----- scheduling

command('slots.list', 'GET', '/api/slots', 'read', ctx => {
  const clinician = D.findStaff(ctx.state, D.recordId(ctx.search.get('clinicianId') ?? '', 'Clinician'));
  if (!clinician || clinician.role !== 'doctor') throw notFound('Clinician not found');
  const dayMs = ctx.search.get('date') === null ? ctx.nowMs : D.parseWhen(ctx.search.get('date'), 'date', ctx.cfg);
  const durationMin = ctx.search.get('durationMin') === null ? ctx.cfg.scheduling.defaultDurationMin : D.num(Number(ctx.search.get('durationMin')), 'durationMin', ctx.cfg.scheduling.minDurationMin, ctx.cfg.scheduling.maxDurationMin, {int: true});
  return ok(D.slotsForDay(ctx.state, ctx.cfg, clinician.id, dayMs, durationMin, ctx.nowMs));
});

command('appointments.list', 'GET', '/api/appointments', 'read', ctx => {
  const date = ctx.search.get('date'), clinicianId = ctx.search.get('clinicianId'), status = ctx.search.get('status');
  const dayMs = date === null ? null : D.parseWhen(date, 'date', ctx.cfg);
  if (clinicianId !== null) D.recordId(clinicianId, 'Clinician');
  const statuses = status === null ? null : status.split(',');
  if (statuses && !statuses.every(s => Object.hasOwn(D.TRANSITIONS, s))) throw bad('status is not valid');
  return ok(ctx.state.data.appointments
    .filter(a => dayMs === null || D.sameDay(Date.parse(a.start), dayMs, ctx.cfg))
    .filter(a => !clinicianId || a.clinicianId === clinicianId)
    .filter(a => !statuses || statuses.includes(a.status))
    .map(a => D.view(ctx.state, a, ctx.nowMs)).sort((a, b) => a.start.localeCompare(b.start)));
});

command('appointments.get', 'GET', '/api/appointments/:id', 'read', ctx => ok(D.view(ctx.state, ownAppt(ctx, ctx.params.id), ctx.nowMs)));

command('appointments.create', 'POST', '/api/appointments', 'write', ctx => {
  const {state, cfg, actor} = ctx;
  const input = D.appointmentInput(ctx.body ?? {}, cfg);
  if (actor.kind === 'patient' && input.patientId !== actor.patientId) throw new HttpError(403, 'This account is not authorized for that patient');
  if (!D.findPatient(state, input.patientId)) throw notFound('Patient not found');
  const clinician = D.findStaff(state, input.clinicianId);
  if (!clinician || clinician.role !== 'doctor') throw notFound('Clinician not found');
  if (state.data.appointments.length >= cfg.limits.maxAppointments) throw conflict('Appointment capacity for this branch has been reached');
  const problem = D.slotProblem(state, cfg, {clinicianId: input.clinicianId, patientId: input.patientId, startMs: input.startMs, durationMin: input.durationMin, nowMs: ctx.nowMs});
  if (problem) throw conflict(problem);
  const appointment = {
    id: D.newId('a'), patientId: input.patientId, clinicianId: input.clinicianId, start: new Date(input.startMs).toISOString(), durationMin: input.durationMin, mode: input.mode,
    reason: input.reason, priority: input.priority, status: 'booked', createdBy: actor.kind === 'patient' ? 'patient' : 'staff',
  };
  if (input.preVisit) appointment.preVisit = input.preVisit;
  state.data.appointments.push(appointment);
  ctx.audit('appointment.booked', 'appointment', appointment.id);
  return ok(D.view(state, appointment, ctx.nowMs), 201);
});

function stopRecording(state, appointment) {
  const enc = D.findEncounterFor(state, appointment.id);
  if (enc && enc.status === 'draft' && enc.recording.active) { enc.recording.active = false; enc.version += 1; delete state.runtime.recordings[enc.id]; }
}

command('appointments.update', 'PATCH', '/api/appointments/:id', 'write', ctx => {
  const {state, cfg, actor} = ctx;
  const a = needAppt(ctx, ctx.params.id);
  clinicianGuard(ctx, a);
  const body = D.shape(ctx.body ?? {}, 'Appointment update', ['status', 'start', 'clinicianId', 'preVisit', 'triagedBy']);
  const next = {};
  if (body.status !== undefined && body.status !== a.status) {
    D.oneOf(body.status, 'Status', Object.keys(D.TRANSITIONS));
    if (actor.mode === 'nurse' && !D.NURSE_TARGETS.includes(body.status)) throw new HttpError(403, `A nurse cannot move a visit to ${body.status}`);
    if (!D.TRANSITIONS[a.status].includes(body.status)) throw conflict(`Cannot move a ${a.status} visit to ${body.status}`);
    next.status = body.status;
  }
  if (body.triagedBy !== undefined && body.triagedBy !== actor.staffId) throw new HttpError(403, 'Triage can only be attributed to the signed-in clinician');
  if (a.status === 'completed' && (body.start !== undefined || body.clinicianId !== undefined || body.preVisit !== undefined || next.status)) throw conflict('This visit is complete');
  if (['cancelled', 'no-show'].includes(a.status) && (body.clinicianId !== undefined || body.preVisit !== undefined)) throw conflict('Reopen the visit before changing it');
  const status = next.status ?? a.status;
  let startMs = Date.parse(a.start), clinicianId = a.clinicianId, rescheduled = false;
  if (body.start !== undefined) { startMs = Date.parse(D.instant(body.start, 'Start time')); rescheduled = startMs !== Date.parse(a.start); }
  if (body.clinicianId !== undefined) {
    D.recordId(body.clinicianId, 'Clinician');
    const clinician = D.findStaff(state, body.clinicianId);
    if (!clinician || clinician.role !== 'doctor') throw notFound('Clinician not found');
    rescheduled ||= body.clinicianId !== a.clinicianId; clinicianId = body.clinicianId;
  }
  const reopening = ['cancelled', 'no-show'].includes(a.status) && status === 'booked';
  if (rescheduled && !['booked', 'waiting'].includes(a.status) && !reopening) throw conflict('A visit that has started cannot be rescheduled');
  if (rescheduled || reopening) {
    const problem = D.slotProblem(state, cfg, {clinicianId, patientId: a.patientId, startMs, durationMin: a.durationMin, nowMs: ctx.nowMs, ignoreId: a.id});
    if (problem) throw conflict(problem);
  }
  let preVisit;
  if (body.preVisit !== undefined) {
    if (!['booked', 'waiting', 'triage', 'ready'].includes(status)) throw conflict('Pre-visit answers are closed for this visit');
    preVisit = D.preVisitInput(body.preVisit);
  }
  const nowIso = new Date(ctx.nowMs).toISOString();
  if (next.status) {
    a.status = next.status;
    if (next.status === 'waiting' && !a.joinedAt) a.joinedAt = nowIso;
    if (next.status === 'in-call' && !a.startedAt) a.startedAt = nowIso;
    if (next.status === 'completed') a.endedAt = nowIso;
    if (actor.mode === 'nurse' && ['triage', 'ready'].includes(next.status)) a.triagedBy = actor.staffId;
    if (['completed', 'cancelled', 'no-show', 'booked', 'waiting'].includes(next.status)) stopRecording(state, a);
  }
  if (body.triagedBy !== undefined) a.triagedBy = body.triagedBy;
  if (rescheduled || reopening) { a.start = new Date(startMs).toISOString(); a.clinicianId = clinicianId; }
  if (preVisit) a.preVisit = preVisit;
  ctx.audit('appointment.updated', 'appointment', a.id, [next.status && `status:${next.status}`, rescheduled && 'rescheduled', preVisit && 'preVisit'].filter(Boolean).join(','));
  return ok(D.view(state, a, ctx.nowMs));
});

command('appointments.join', 'POST', '/api/appointments/:id/join', 'write', ctx => {
  const {state} = ctx;
  const a = ownAppt(ctx, ctx.params.id);
  D.shape(ctx.body ?? {}, 'Join', ['preVisit']);
  if (['completed', 'cancelled', 'no-show'].includes(a.status)) throw conflict('This visit is closed');
  const preVisit = ctx.body?.preVisit === undefined ? undefined : D.preVisitInput(ctx.body.preVisit);
  const nowIso = new Date(ctx.nowMs).toISOString();
  if (a.status === 'booked') {
    a.status = 'waiting';
    a.joinedAt = nowIso;
    const patient = D.findPatient(state, a.patientId);
    if (state.data.messages.filter(m => m.appointmentId === a.id).length < ctx.cfg.limits.maxMessagesPerAppointment) {
      state.data.messages.push({id: D.newId('msg'), appointmentId: a.id, from: 'patient', author: 'System', text: `${patient.firstName} joined the waiting room`, at: nowIso});
    }
  }
  // Answers can change only until triage begins; a reconnect after that simply returns the visit.
  if (preVisit && ['booked', 'waiting'].includes(a.status)) a.preVisit = preVisit;
  ctx.audit('appointment.joined', 'appointment', a.id);
  return ok(D.view(state, a, ctx.nowMs));
});

command('queue.get', 'GET', '/api/queue', 'read', ctx => ok(D.queueFor(ctx.state, ctx.cfg, ctx.nowMs)));

command('dashboard.get', 'GET', '/api/dashboard', 'read', ctx => ok(D.dashboard(ctx.state, ctx.cfg, ctx.search.get('date') === null ? ctx.nowMs : D.parseWhen(ctx.search.get('date'), 'date', ctx.cfg))));

command('sim.arrive', 'POST', '/api/sim/arrive', 'write', ctx => {
  if (!ctx.cfg.simulation.arrive) throw new HttpError(404, 'The demo arrival helper is disabled for this branch');
  noBody(ctx);
  const next = ctx.state.data.appointments.filter(a => D.sameDay(Date.parse(a.start), ctx.nowMs, ctx.cfg) && a.status === 'booked').sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!next) throw notFound('No more booked visits today');
  const nowIso = new Date(ctx.nowMs).toISOString();
  next.status = 'waiting';
  next.joinedAt = nowIso;
  // Simulated arrival: the patient has not answered anything, so no consent is asserted on their behalf.
  next.preVisit ??= {completed: false, symptoms: [next.reason], duration: 'a few days', severity: 4, notes: 'Simulated arrival (demo)', shareDeviceData: true, recordingConsent: false, deviceCheck: {camera: true, mic: true, network: 'good'}};
  ctx.audit('simulation.arrival', 'appointment', next.id);
  return ok(D.view(ctx.state, next, ctx.nowMs), 200, SIM);
});

// ----- encounters

function needEncounter(ctx, id) {
  const e = ctx.state.data.encounters.find(x => x.id === D.recordId(id, 'Encounter'));
  if (!e) throw notFound('Encounter not found');
  return e;
}

command('encounter.get', 'GET', '/api/appointments/:id/encounter', 'auto', ctx => {
  const a = needAppt(ctx, ctx.params.id);
  let e = D.findEncounterFor(ctx.state, a.id);
  if (!e) {
    e = blankEncounter(a, D.newId('enc'), new Date(ctx.nowMs).toISOString());
    ctx.state.data.encounters.push(e);
    ctx.audit('encounter.created', 'encounter', e.id);
  }
  return ok(clone(e));
});

function assertContext(body, enc) {
  for (const key of ['id', 'appointmentId', 'patientId']) {
    if (body[key] !== undefined && body[key] !== enc[key]) throw conflict('This encounter does not match the requested record');
  }
}
function assertVersion(body, enc) {
  if (!Number.isInteger(body.version)) throw new HttpError(428, 'Send the encounter version you are editing', {code: 'version-required', currentVersion: enc.version});
  if (body.version !== enc.version) throw conflict('This note changed since you opened it. Reload and review before saving.', {code: 'version-conflict', currentVersion: enc.version});
}
function editable(ctx, enc) {
  const a = D.findAppt(ctx.state, enc.appointmentId);
  clinicianGuard(ctx, a);
  if (enc.status === 'signed') throw conflict('This note is signed and locked', {code: 'signed'});
  if (['cancelled', 'no-show'].includes(a.status)) throw conflict('This visit is closed');
  return a;
}

command('encounter.put', 'PUT', '/api/encounters/:id', 'write', ctx => {
  const {state, actor, cfg} = ctx;
  const enc = needEncounter(ctx, ctx.params.id);
  const a = editable(ctx, enc);
  const body = ctx.body ?? {};
  assertContext(body, enc);
  assertVersion(body, enc);
  const content = D.parseEncounterContent(body, enc, {actor, nowMs: ctx.nowMs});
  D.assertNurseBoundary(actor, content, enc);
  D.assertRecording(content.recording, enc, a, cfg);
  const wasActive = enc.recording.active;
  for (const [key, value] of Object.entries(content)) enc[key] = value;
  if (enc.recording.active && !wasActive) state.runtime.recordings[enc.id] = {startedAtMs: ctx.nowMs, baseLines: enc.transcript.length};
  if (!enc.recording.active) delete state.runtime.recordings[enc.id];
  enc.version += 1;
  enc.updatedAt = new Date(ctx.nowMs).toISOString();
  ctx.audit('encounter.saved', 'encounter', enc.id, Object.keys(content).join(','));
  return ok(clone(enc));
});

function workingCopy(ctx, enc) {
  const body = ctx.body ?? {};
  assertContext(body, enc);
  const content = D.parseEncounterContent(body, enc, {actor: ctx.actor, nowMs: ctx.nowMs});
  return {...clone(enc), ...content};
}

command('encounter.cds', 'POST', '/api/encounters/:id/cds', 'read', ctx => {
  const enc = needEncounter(ctx, ctx.params.id);
  return ok(runCds(D.findPatient(ctx.state, enc.patientId), workingCopy(ctx, enc)), 200, SIM);
}, {key: false});

command('encounter.suggest', 'POST', '/api/encounters/:id/suggest', 'read', ctx => {
  const enc = needEncounter(ctx, ctx.params.id);
  return ok(suggest(D.findPatient(ctx.state, enc.patientId), {...workingCopy(ctx, enc), transcript: clone(enc.transcript)}), 200, SIM);
}, {key: false});

command('encounter.scribe', 'POST', '/api/encounters/:id/scribe', 'read', ctx => {
  if (!ctx.cfg.simulation.scribe) throw new HttpError(404, 'The demo scribe is disabled for this branch');
  noBody(ctx);
  const enc = needEncounter(ctx, ctx.params.id);
  if (enc.status === 'signed') throw conflict('This note is signed and locked', {code: 'signed'});
  const a = D.findAppt(ctx.state, enc.appointmentId);
  return ok(scribe(a.reason, D.findPatient(ctx.state, enc.patientId), clone(enc)), 200, SIM);
}, {key: false});

command('scores.compute', 'POST', '/api/scores/compute', 'read', ctx => {
  const body = D.shape(ctx.body ?? {}, 'Score request', ['key', 'answers', 'encounter']);
  const key = D.str(body.key ?? '', 'Score', {min: 1, max: 20});
  const answers = body.answers === undefined ? {} : (() => {
    if (!D.isObject(body.answers) || Object.keys(body.answers).length > 30) throw bad('answers must be an object');
    const out = {};
    for (const [k, v] of Object.entries(body.answers)) {
      if (!/^[A-Za-z0-9_.-]{1,40}$/.test(k) || ['__proto__', 'constructor', 'prototype'].includes(k)) throw bad('answers has an invalid key');
      out[k] = D.num(v, `answers.${k}`, 0, 100);
    }
    return out;
  })();
  let vitals;
  if (body.encounter !== undefined) {
    D.shape(body.encounter, 'Encounter', ['vitals']);
    const parsed = D.parseEncounterContent({vitals: body.encounter.vitals}, {orders: [], scores: [], vitals: []}, {actor: ctx.actor, nowMs: ctx.nowMs});
    vitals = D.latestVitals(parsed.vitals ?? []);
  }
  try { return ok(computeScore(key, answers, vitals), 200, SIM); } catch (error) { throw bad(error.message); }
}, {key: false});

command('encounter.sign', 'POST', '/api/encounters/:id/sign', 'write', ctx => {
  const {state, actor, cfg} = ctx;
  const enc = needEncounter(ctx, ctx.params.id);
  const a = editable(ctx, enc);
  const body = D.shape(ctx.body ?? {}, 'Sign request', ['encounter', 'signerId', 'overrideReason']);
  if (!D.isObject(body.encounter)) throw bad('The encounter to sign is required');
  if (body.signerId !== undefined && body.signerId !== actor.staffId) throw new HttpError(403, 'You can only sign as the signed-in clinician');
  if (actor.mode === 'nurse' && D.findStaff(state, a.clinicianId)?.role !== 'nurse') throw new HttpError(403, 'Only a doctor can sign this visit');
  assertContext(body.encounter, enc);
  assertVersion(body.encounter, enc);
  const content = D.parseEncounterContent(body.encounter, enc, {actor, nowMs: ctx.nowMs});
  D.assertNurseBoundary(actor, content, enc);
  const merged = {...clone(enc), ...content};
  const patient = D.findPatient(state, enc.patientId);
  const problems = D.signProblems(actor, merged);
  const critical = runCds(patient, merged).filter(x => x.level === 'critical' && x.source !== 'vitals');
  const overrideReason = body.overrideReason === undefined ? undefined : D.str(body.overrideReason, 'Override reason', {min: 1, max: 500});
  if (critical.length && !overrideReason) problems.push(`Resolve or override ${critical.length} critical safety alert(s)`);
  if (problems.length) return {status: 422, body: {error: 'Cannot sign yet', problems}};

  let followUpStart = null;
  if (merged.followUp) {
    if (state.data.appointments.length >= cfg.limits.maxAppointments) throw conflict('Appointment capacity for this branch has been reached');
    followUpStart = D.findFollowUpSlot(state, cfg, {clinicianId: a.clinicianId, patientId: a.patientId, targetMs: ctx.nowMs + merged.followUp.inDays * D.DAY, durationMin: cfg.scheduling.defaultDurationMin, nowMs: ctx.nowMs});
    if (followUpStart === null) throw conflict('No follow-up slot is available near the requested day');
  }
  const nowIso = new Date(ctx.nowMs).toISOString();
  for (const [key, value] of Object.entries(content)) enc[key] = value;
  Object.assign(enc, {status: 'signed', signedAt: nowIso, signedBy: actor.staffId, updatedAt: nowIso, version: enc.version + 1});
  enc.recording = {...enc.recording, active: false};
  enc.orders = enc.orders.map(o => ({...o, status: 'signed'}));
  if (critical.length) enc.overrideReason = overrideReason;
  delete state.runtime.recordings[enc.id];

  enc.diagnoses.filter(d => d.addToProblemList && !patient.problems.some(x => x.code === d.code)).forEach(d => patient.problems.push({code: d.code, display: d.display, since: nowIso, status: 'active'}));
  enc.prescriptions.forEach(rx => {
    if (rx.durationDays >= 28 && !patient.medications.some(m => m.name.startsWith(rx.name))) patient.medications.push({id: D.newId('med'), name: `${rx.name} ${rx.strength}`, dose: rx.dose, frequency: rx.frequency, status: 'active', since: nowIso});
  });
  if (a.status !== 'completed') { a.status = 'completed'; a.endedAt = nowIso; }
  if (followUpStart !== null) {
    const followUp = {id: D.newId('a'), patientId: a.patientId, clinicianId: a.clinicianId, start: new Date(followUpStart).toISOString(), durationMin: cfg.scheduling.defaultDurationMin, mode: enc.followUp.mode, reason: `Follow-up: ${enc.followUp.note || a.reason}`, priority: 'routine', status: 'booked', createdBy: 'staff'};
    state.data.appointments.push(followUp);
    enc.followUpAppointmentId = followUp.id;
  }
  ctx.audit('encounter.signed', 'encounter', enc.id, [critical.length && 'safety-override', enc.followUpAppointmentId && `followUp:${enc.followUpAppointmentId}`].filter(Boolean).join(','));
  return ok(clone(enc));
});

command('encounters.list', 'GET', '/api/encounters', 'read', ctx => {
  const status = ctx.search.get('status');
  if (status !== null && !['draft', 'signed'].includes(status)) throw bad('status must be draft or signed');
  return ok(ctx.state.data.encounters.filter(e => !status || e.status === status)
    .map(e => ({encounter: clone(e), appointment: D.view(ctx.state, D.findAppt(ctx.state, e.appointmentId), ctx.nowMs)}))
    .sort((a, b) => (b.encounter.signedAt ?? b.encounter.updatedAt).localeCompare(a.encounter.signedAt ?? a.encounter.updatedAt)));
});

command('summary.get', 'GET', '/api/appointments/:id/summary', 'read', ctx => {
  const a = ownAppt(ctx, ctx.params.id);
  const e = D.findEncounterFor(ctx.state, a.id);
  if (!e || e.status !== 'signed') throw notFound('Your clinician is still writing up this visit');
  return ok({appointment: clone(a), clinician: clone(D.findStaff(ctx.state, e.signedBy ?? a.clinicianId)), encounter: ctx.actor.kind === 'patient' ? D.patientEncounterView(e) : clone(e)});
});

// ----- messaging

command('messages.list', 'GET', '/api/appointments/:id/messages', 'read', ctx => {
  const a = ownAppt(ctx, ctx.params.id);
  const after = ctx.search.get('after') === null ? '' : D.instant(ctx.search.get('after'), 'after');
  return ok(clone(ctx.state.data.messages.filter(m => m.appointmentId === a.id && (!after || m.at > after))));
});

command('messages.post', 'POST', '/api/appointments/:id/messages', 'write', ctx => {
  const {state, actor} = ctx;
  const a = ownAppt(ctx, ctx.params.id);
  const body = D.shape(ctx.body ?? {}, 'Message', ['from', 'author', 'text']);
  if (body.from !== undefined && body.from !== (actor.kind === 'patient' ? 'patient' : 'staff')) throw new HttpError(403, 'You cannot send a message on behalf of the other party');
  const text = D.str(body.text ?? '', 'Message', {max: 2000});
  if (!text) throw bad('Message is empty');
  if (['cancelled', 'no-show'].includes(a.status)) throw conflict('This visit is closed');
  if (state.data.messages.filter(m => m.appointmentId === a.id).length >= ctx.cfg.limits.maxMessagesPerAppointment) throw conflict('This conversation has reached its message limit');
  // Author is derived from the authenticated identity; only the generic "System" label is accepted from staff.
  const author = actor.kind === 'patient' ? fullName(D.findPatient(state, a.patientId)) : (body.author === 'System' ? 'System' : staffName(state, actor.staffId));
  const message = {id: D.newId('msg'), appointmentId: a.id, from: actor.kind === 'patient' ? 'patient' : 'staff', author, text, at: new Date(ctx.nowMs).toISOString()};
  state.data.messages.push(message);
  ctx.audit('message.sent', 'appointment', a.id, message.id);
  return ok(clone(message), 201);
});

// ----- live demo frames (replace the source's SSE streams with authenticated polling)

const streamGone = (name, alternate) => ctx => {
  needAppt(ctx, ctx.params.id);
  return {status: 410, body: {error: 'Server-sent events are not offered. Poll the authenticated current-frame endpoint instead.', alternate: `/api/appointments/${ctx.params.id}/${alternate}`}};
};
command('vitals.stream', 'GET', '/api/appointments/:id/vitals/stream', 'read', streamGone('vitals', 'vitals/current'));
command('transcript.stream', 'GET', '/api/appointments/:id/transcript/stream', 'read', streamGone('transcript', 'transcript/current'));

command('vitals.current', 'GET', '/api/appointments/:id/vitals/current', 'read', ctx => {
  if (!ctx.cfg.simulation.vitals) throw new HttpError(404, 'The demo vitals simulator is disabled for this branch');
  const a = ownAppt(ctx, ctx.params.id);
  if (['completed', 'cancelled', 'no-show'].includes(a.status)) throw conflict('This visit is closed');
  if (a.preVisit?.shareDeviceData === false) throw conflict('Device data sharing is off for this visit');
  const baseline = ctx.state.data.vitalBaselines[a.patientId] ?? D.DEFAULT_BASELINE;
  return ok(D.liveVitalsFrame(a.id, baseline, ctx.nowMs), 200, {...SIM, 'Cache-Control': 'no-store'});
});

command('transcript.current', 'GET', '/api/appointments/:id/transcript/current', 'auto', ctx => {
  if (!ctx.cfg.simulation.transcript) throw new HttpError(404, 'The demo transcript simulator is disabled for this branch');
  const a = needAppt(ctx, ctx.params.id);
  const headers = {...SIM, 'Cache-Control': 'no-store'};
  const pending = reason => ok({pending: true, reason, simulated: true}, 200, headers);
  const enc = D.findEncounterFor(ctx.state, a.id);
  if (!enc || enc.status === 'signed') return pending('not-recording');
  const clock = ctx.state.runtime.recordings[enc.id];
  const listening = enc.recording.active && enc.recording.consent && ctx.cfg.recording.allowed && ['in-call', 'triage'].includes(a.status) && clock;
  const after = ctx.search.get('after');
  if (after !== null) D.recordId(after, 'after');
  if (listening) {
    const progress = D.advanceTranscript(enc, a, clock, ctx.cfg, ctx.nowMs, D.newId);
    if (progress.appended) ctx.audit('transcript.advanced', 'encounter', enc.id, String(progress.appended));
  }
  let index = 0;
  if (after) {
    index = enc.transcript.findIndex(l => l.id === after) + 1;
    if (!index) throw bad('Unknown transcript cursor');
  }
  if (index < enc.transcript.length) return ok({...clone(enc.transcript[index]), simulated: true, remaining: enc.transcript.length - index - 1}, 200, headers);
  const cap = Math.min(D.scriptLength(a.reason), ctx.cfg.limits.maxTranscriptLines);
  if (enc.transcript.length >= cap) return ok({done: true, simulated: true}, 200, headers);
  return pending(listening ? 'waiting-for-next-line' : 'not-recording');
});

// ----- audit

command('audit.list', 'GET', '/api/audit', 'read', ctx => {
  const limit = ctx.search.get('limit') === null ? 50 : D.num(Number(ctx.search.get('limit')), 'limit', 1, 200, {int: true});
  const target = ctx.search.get('target');
  if (target !== null) D.recordId(target, 'target');
  const entries = ctx.state.audit.filter(e => !target || e.target.id === target).slice(-limit).reverse();
  return ok({entries: clone(entries), dropped: ctx.state.auditDropped});
});

// ---------------------------------------------------------------- store

export function createReferenceTeleconsultStore({dataDir, policy, now = Date.now} = {}) {
  if (typeof dataDir !== 'string' || !dataDir) throw new Error('A Teleconsult data directory is required');
  const config = validateTeleconsultConfig(policy ?? JSON.parse(readFileSync(DEFAULT_CONFIG, 'utf8')));
  const lease = acquireLease(dataDir);
  const scopes = new Map();
  let closed = false;

  const leaseHeld = async () => {
    try { return JSON.parse(await readFile(join(lease.lease, 'owner.json'), 'utf8')).token === lease.token; } catch { return false; }
  };

  function remember(key, entry) {
    scopes.delete(key); scopes.set(key, entry);
    if (scopes.size <= MAX_LOADED_SCOPES) return;
    for (const [oldKey, old] of scopes) {
      if (scopes.size <= MAX_LOADED_SCOPES) break;
      if (oldKey !== key && old.pending === 0 && old.pins === 0 && old.state) scopes.delete(oldKey);
    }
  }

  async function initialise(entry, sc, cfg) {
    const scope = {tenantId: sc.tenantId, applicationId: sc.applicationId, branchId: sc.branchId};
    let text = null;
    try { text = await readFile(entry.file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (text !== null) { entry.state = normalizeState(JSON.parse(text), scope); return; }
    const seed = buildSeed(now(), cfg.scheduling.utcOffsetMinutes);
    for (const id of [cfg.access.doctorStaffId, cfg.access.nurseStaffId]) if (!seed.staff.some(s => s.id === id)) throw new Error('Configured Teleconsult staff mapping is not in the seed');
    const state = newState(scope, clone(seed), new Date(now()).toISOString());
    await persist(entry, state, false);
    entry.state = state;
  }

  /** One in-memory entry per scope, shared by concurrent first requests. The caller must release() the pin. */
  async function loadScope(sc, cfg) {
    let entry = scopes.get(sc.key);
    if (!entry) {
      entry = {tail: Promise.resolve(), pending: 0, pins: 0, state: null, ready: null, file: join(dataDir, `${sc.key}.json`)};
      const created = entry;
      created.ready = initialise(created, sc, cfg).catch(error => { if (scopes.get(sc.key) === created) scopes.delete(sc.key); throw error; });
    }
    entry.pins += 1;
    remember(sc.key, entry);
    try { await entry.ready; } catch (error) { entry.pins -= 1; throw error; }
    return entry;
  }

  async function persist(entry, draft, bump = true) {
    if (!(await leaseHeld())) throw new Error('Teleconsult writer lease was lost');
    if (bump) draft.revision += 1;
    await mkdir(dataDir, {recursive: true, mode: 0o700});
    await writeAtomic(entry.file, JSON.stringify(draft));
  }

  const serialize = (entry, task) => {
    entry.pending += 1;
    const result = entry.tail.then(task, task);
    entry.tail = result.then(() => {}, () => {}).finally(() => { entry.pending -= 1; });
    return result;
  };

  function auditWriter(draft, ctx, route) {
    return (action, targetType, targetId, summary = '') => {
      ctx.dirty = true;
      const a = ctx.actor;
      draft.audit.push({
        id: D.newId('aud'), at: new Date(ctx.nowMs).toISOString(), action, command: route.command.name, method: ctx.method, path: ctx.pathname,
        // Real authenticated account; the d1/n1 staff id is only the source-model relationship.
        actor: a.kind === 'provider' ? {userId: a.userId, role: a.mode, staffId: a.staffId} : {userId: a.userId, role: 'patient', patientId: a.patientId},
        target: {type: targetType, id: targetId}, summary, ...(ctx.keyHash ? {idempotency: ctx.keyHash} : {}),
      });
      const overflow = draft.audit.length - ctx.cfg.limits.maxAuditEntries;
      if (overflow > 0) { draft.audit.splice(0, overflow); draft.auditDropped += overflow; }
    };
  }

  async function execute(entry, route, ctx, keyInfo) {
    const {command: c} = route;
    let replayId = null, fingerprint = null;
    if (c.key) {
      replayId = sha(`${ctx.actor.userId}|${ctx.actor.kind === 'provider' ? ctx.actor.mode : ctx.actor.patientId}|${ctx.method}|${ctx.pathname}|${keyInfo.key}`);
      fingerprint = sha(stable({query: [...ctx.search.entries()].sort(), body: ctx.body ?? null}));
      ctx.keyHash = replayId.slice(0, 16);
      const prior = entry.state.idempotency.find(r => r.id === replayId);
      if (prior) {
        if (prior.fingerprint !== fingerprint) return {status: 409, body: {error: 'This Idempotency-Key was already used for a different request'}};
        return {status: prior.status, body: clone(prior.body), headers: {...(prior.headers ?? {}), 'Idempotent-Replay': 'true'}};
      }
    }
    const live = entry.state;
    ctx.state = c.kind === 'read' ? live : clone(live);
    ctx.audit = auditWriter(ctx.state, ctx, route);
    ctx.dirty = false;
    let result;
    try {
      result = c.run(ctx);
    } catch (error) {
      if (error instanceof HttpError) return {status: error.status, body: {error: error.message, ...error.extra}};
      throw error;
    }
    if (c.kind === 'read' || result.status >= 400 || !(c.kind === 'write' || ctx.dirty)) return result;
    if (c.key) {
      ctx.state.idempotency.push({id: replayId, fingerprint, status: result.status, body: clone(result.body), ...(result.headers ? {headers: result.headers} : {}), at: new Date(ctx.nowMs).toISOString()});
      const extra = ctx.state.idempotency.length - ctx.cfg.limits.maxIdempotencyKeys;
      if (extra > 0) ctx.state.idempotency.splice(0, extra);
    }
    await persist(entry, ctx.state);
    entry.state = ctx.state;
    return result;
  }

  async function handle(user, scope, request) {
    const respond = (status, body, headers) => ({status, body, headers: {'Cache-Control': 'no-store', ...(headers ?? {})}});
    if (closed) return respond(503, {error: 'Teleconsult service is unavailable'});
    let sc;
    try { sc = teleconsultScope(user, scope); } catch { return respond(403, {error: 'Teleconsult scope is not authorized'}); }
    const cfg = resolveTeleconsultConfig(config, sc.tenantId, sc.branchId);
    const parsed = parseTeleconsultRequest(request, cfg);
    if (parsed.error) return respond(parsed.error.status, {error: parsed.error.error});
    const {method, pathname, search, body} = parsed;
    const resolved = resolveTeleconsultActor({surface: sc.surface, user, headers: request.headers, search, pathname, config: cfg});
    if (!resolved.ok) return respond(resolved.status, {error: resolved.error});
    const route = matchCommand(method, pathname);
    if (!route) return respond(404, {error: 'Teleconsult endpoint not found'});
    if (route.methodNotAllowed) return respond(405, {error: 'Method is not allowed'});
    if (!commandAllowed(resolved.actor, route.command.name, cfg)) return respond(403, {error: 'This Teleconsult action is not allowed'});
    let keyInfo = {};
    if (route.command.key) {
      keyInfo = idempotencyKey(request.headers);
      if (keyInfo.missing) return respond(428, {error: 'An Idempotency-Key header is required for changes'});
      if (keyInfo.invalid) return respond(400, {error: 'Idempotency-Key must be 8-128 letters, digits or : . _ -'});
    } else if (isMutation(method) && !['encounter.cds', 'encounter.suggest', 'encounter.scribe', 'scores.compute'].includes(route.command.name)) {
      return respond(500, {error: 'Teleconsult command registry is inconsistent'});
    }
    let entry = null;
    try {
      entry = await loadScope(sc, cfg);
      const result = await serialize(entry, async () => {
        const ctx = {cfg, actor: resolved.actor, params: route.params, search, body, method, pathname, nowMs: now()};
        if (ctx.actor.kind === 'patient' && !D.findPatient(entry.state, ctx.actor.patientId)) {
          // An admin who did not pick a beneficiary falls back to the first fixture; an explicit unknown id is a 404.
          const first = entry.state.data.patients[0];
          if (!ctx.actor.all || ctx.actor.requested || !first) return {status: 404, body: {error: 'Patient not found'}};
          ctx.actor = {...ctx.actor, patientId: first.id};
        }
        return execute(entry, route, ctx, keyInfo);
      });
      return respond(result.status, result.body, result.headers);
    } catch {
      return respond(503, {error: 'Teleconsult data is temporarily unavailable'});
    } finally {
      if (entry) entry.pins -= 1;
    }
  }

  async function close() {
    if (closed) return;
    closed = true;
    await Promise.all([...scopes.values()].map(e => e.tail));
    scopes.clear();
    held.delete(dataDir);
    if (await leaseHeld()) await rm(lease.lease, {recursive: true, force: true});
  }

  return {handle, close};
}

export const TELECONSULT_COMMAND_NAMES = Object.freeze(COMMANDS.map(c => c.name));
