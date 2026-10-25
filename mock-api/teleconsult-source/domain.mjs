// Teleconsult domain rules shared by every command: validation, scheduling, views, simulation and redaction.
// All records are fictional. Simulated outputs (vitals, transcript, decision support, scribe) are demonstration
// logic copied or adapted from the Teleconsult 01 reference and make no clinical claims.
import {randomBytes} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {DRUGS, ICD, ORDERABLES} from './catalog.ts';
import {computeScore, latestVitals, scriptFor} from './intelligence.ts';

export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (message, extra) => new HttpError(400, message, extra);
export const notFound = message => new HttpError(404, message);
export const conflict = (message, extra) => new HttpError(409, message, extra);

export const newId = prefix => `${prefix}_${randomBytes(6).toString('hex')}`;
export const MINUTE = 60000;
export const DAY = 86400000;

// ---------------------------------------------------------------- primitive validators

const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const validId = v => typeof v === 'string' && RECORD_ID.test(v);

export function recordId(value, field) {
  if (!validId(value)) throw bad(`${field} is not a valid identifier`);
  return value;
}
export function str(value, field, {max = 200, min = 0} = {}) {
  if (typeof value !== 'string') throw bad(`${field} must be text`);
  const text = value.trim();
  if (text.length < min || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw bad(`${field} must be ${min ? `${min}-` : 'up to '}${max} characters`);
  return text;
}
export function num(value, field, min, max, {int = false} = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (int && !Number.isInteger(value))) throw bad(`${field} must be ${int ? 'a whole number' : 'a number'} from ${min} to ${max}`);
  return value;
}
export function bool(value, field) {
  if (typeof value !== 'boolean') throw bad(`${field} must be true or false`);
  return value;
}
export function oneOf(value, field, options) {
  if (!options.includes(value)) throw bad(`${field} must be one of ${options.join(', ')}`);
  return value;
}
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/;
export function instant(value, field) {
  if (typeof value !== 'string' || !ISO.test(value) || Number.isNaN(Date.parse(value))) throw bad(`${field} must be an ISO 8601 date and time with a time zone`);
  return new Date(value).toISOString();
}
export function dateOnly(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw bad(`${field} must be a calendar date (YYYY-MM-DD)`);
  return value;
}
/** Rejects unknown keys so a client cannot smuggle server-owned fields in. */
export function shape(value, field, allowed) {
  if (!isObject(value)) throw bad(`${field} must be an object`);
  const extra = Object.keys(value).filter(k => !allowed.includes(k));
  if (extra.length) throw bad(`${field} has unsupported fields: ${extra.slice(0, 5).join(', ')}`);
  return value;
}
export function list(value, field, max) {
  if (!Array.isArray(value) || value.length > max) throw bad(`${field} must be a list of at most ${max} items`);
  return value;
}
function record(value, field, leaf, max = 30) {
  if (!isObject(value)) throw bad(`${field} must be an object`);
  const entries = Object.entries(value);
  if (entries.length > max) throw bad(`${field} has too many entries`);
  const out = {};
  for (const [k, v] of entries) {
    if (BLOCKED_KEYS.has(k) || !/^[A-Za-z0-9_.-]{1,40}$/.test(k)) throw bad(`${field} has an invalid key`);
    out[k] = leaf(v, `${field}.${k}`);
  }
  return out;
}
const optional = (obj, key, fn) => (obj[key] === undefined ? undefined : fn(obj[key]));
const set = (out, key, value) => { if (value !== undefined) out[key] = value; };

// ---------------------------------------------------------------- time and scheduling

const parseClock = c => Number(c.slice(0, 2)) * 60 + Number(c.slice(3));
/** Minutes after local midnight, and the UTC instant of that local midnight. */
export function localDay(ms, cfg) {
  const off = cfg.scheduling.utcOffsetMinutes * MINUTE;
  const startLocal = Math.floor((ms + off) / DAY) * DAY;
  return {start: startLocal - off, minute: Math.round((ms - (startLocal - off)) / MINUTE)};
}
export const sameDay = (aMs, bMs, cfg) => localDay(aMs, cfg).start === localDay(bMs, cfg).start;

/** Date text without a zone is read in the configured clinic time zone, never the host zone. */
export function parseWhen(value, field, cfg) {
  if (typeof value !== 'string' || value.length > 40) throw bad(`${field} is not a valid date`);
  let text = value;
  if (/^\d{4}-\d\d-\d\d$/.test(text)) text += 'T12:00:00';
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(text)) {
    const sign = cfg.scheduling.utcOffsetMinutes < 0 ? '-' : '+';
    const abs = Math.abs(cfg.scheduling.utcOffsetMinutes);
    text += `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  }
  const ms = ISO.test(text) ? Date.parse(text) : NaN;
  if (Number.isNaN(ms)) throw bad(`${field} is not a valid date`);
  return ms;
}

const ACTIVE = a => !['cancelled', 'no-show'].includes(a.status);
export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const apptEnd = a => Date.parse(a.start) + a.durationMin * MINUTE;

/** Why a candidate interval cannot be booked, or null. `ignoreId` lets a reschedule skip itself. */
export function slotProblem(state, cfg, {clinicianId, patientId, startMs, durationMin, nowMs, ignoreId}) {
  const s = cfg.scheduling;
  const {start: dayStart, minute} = localDay(startMs, cfg);
  if ((startMs - dayStart) % MINUTE !== 0) return 'Start time must fall on a whole minute';
  if (minute < parseClock(s.opening) || (minute - parseClock(s.opening)) % s.slotIntervalMin !== 0) return `Start time must be on a ${s.slotIntervalMin}-minute slot from ${s.opening}`;
  if (minute + durationMin > parseClock(s.closing)) return `Visits must finish by ${s.closing}`;
  if (s.breaks.some(b => overlaps(minute, minute + durationMin, parseClock(b.start), parseClock(b.end)))) return 'That time falls in a clinic break';
  if (startMs < nowMs - s.pastGraceMin * MINUTE) return 'That time has passed';
  if (startMs > nowMs + s.horizonDays * DAY) return `Visits can be booked up to ${s.horizonDays} days ahead`;
  const endMs = startMs + durationMin * MINUTE;
  for (const a of state.data.appointments) {
    if (a.id === ignoreId || !ACTIVE(a)) continue;
    if (!overlaps(startMs, endMs, Date.parse(a.start), apptEnd(a))) continue;
    if (a.clinicianId === clinicianId) return 'That slot was just taken. Choose another time.';
    if (a.patientId === patientId) return 'The patient already has a visit at that time.';
  }
  return null;
}

export function slotsForDay(state, cfg, clinicianId, dayMs, durationMin, nowMs) {
  const s = cfg.scheduling;
  const {start: dayStart} = localDay(dayMs, cfg);
  const out = [];
  for (let m = parseClock(s.opening); m < parseClock(s.closing); m += s.slotIntervalMin) {
    const startMs = dayStart + m * MINUTE;
    out.push({start: new Date(startMs).toISOString(), available: !slotProblem(state, cfg, {clinicianId, patientId: null, startMs, durationMin, nowMs})});
  }
  return out;
}

/** First free grid slot at or after the requested day (default 10:00 local), looking up to 14 days ahead. */
export function findFollowUpSlot(state, cfg, {clinicianId, patientId, targetMs, durationMin, nowMs}) {
  const s = cfg.scheduling;
  const open = parseClock(s.opening), close = parseClock(s.closing);
  const {start: firstDay} = localDay(targetMs, cfg);
  for (let d = 0; d < 14; d++) {
    const dayStart = firstDay + d * DAY;
    const from = d === 0 ? Math.max(open, Math.min(close, 600)) : open;
    const first = open + Math.ceil((from - open) / s.slotIntervalMin) * s.slotIntervalMin;
    for (let m = first; m + durationMin <= close; m += s.slotIntervalMin) {
      const startMs = dayStart + m * MINUTE;
      if (!slotProblem(state, cfg, {clinicianId, patientId, startMs, durationMin, nowMs})) return startMs;
    }
  }
  return null;
}

// ---------------------------------------------------------------- views

export const TRANSITIONS = Object.freeze({
  booked: ['waiting', 'cancelled', 'no-show', 'triage', 'in-call'],
  waiting: ['triage', 'in-call', 'cancelled', 'no-show', 'booked'],
  triage: ['ready', 'in-call', 'completed', 'waiting'],
  ready: ['in-call', 'triage', 'waiting'],
  'in-call': ['completed', 'ready', 'waiting'],
  completed: [],
  cancelled: ['booked'],
  'no-show': ['booked'],
});
export const NURSE_TARGETS = ['waiting', 'triage', 'ready'];
const QUEUED = ['waiting', 'triage', 'ready'];

export const findPatient = (state, id) => state.data.patients.find(p => p.id === id);
export const findStaff = (state, id) => state.data.staff.find(s => s.id === id);
export const findAppt = (state, id) => state.data.appointments.find(a => a.id === id);
export const findEncounterFor = (state, appointmentId) => state.data.encounters.find(e => e.appointmentId === appointmentId);

const queueOrder = (x, y) => (x.priority === 'urgent' ? -1 : 0) - (y.priority === 'urgent' ? -1 : 0) || (x.joinedAt ?? '').localeCompare(y.joinedAt ?? '');

export function view(state, a, nowMs) {
  const waitMinutes = a.joinedAt && QUEUED.includes(a.status) ? Math.max(0, Math.round((nowMs - Date.parse(a.joinedAt)) / MINUTE)) : undefined;
  const enc = findEncounterFor(state, a.id);
  let queuePosition;
  if (QUEUED.includes(a.status)) {
    const queue = state.data.appointments.filter(x => x.clinicianId === a.clinicianId && QUEUED.includes(x.status)).sort(queueOrder);
    queuePosition = queue.findIndex(x => x.id === a.id) + 1;
  }
  return {...structuredClone(a), patient: structuredClone(findPatient(state, a.patientId)), clinician: structuredClone(findStaff(state, a.clinicianId)), waitMinutes, recordingActive: !!enc?.recording.active, queuePosition};
}
export const queueFor = (state, cfg, nowMs) => state.data.appointments
  .filter(a => sameDay(Date.parse(a.start), nowMs, cfg) && QUEUED.includes(a.status)).sort(queueOrder).map(a => view(state, a, nowMs));

export function dashboard(state, cfg, dayMs) {
  const list = state.data.appointments.filter(a => sameDay(Date.parse(a.start), dayMs, cfg));
  const waits = list.filter(a => a.joinedAt && a.startedAt).map(a => (Date.parse(a.startedAt) - Date.parse(a.joinedAt)) / MINUTE);
  const count = s => list.filter(a => a.status === s).length;
  return {
    scheduled: list.filter(a => a.status !== 'cancelled').length,
    waiting: count('waiting'), inTriage: count('triage'), ready: count('ready'), inCall: count('in-call'),
    completed: count('completed'), cancelled: count('cancelled'),
    avgWaitMin: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
  };
}

/** Patients see the outcome of a signed visit, never the clinician's working notes or the recording transcript. */
export function patientEncounterView(enc) {
  const out = {
    id: enc.id, appointmentId: enc.appointmentId, patientId: enc.patientId, status: enc.status,
    triage: {chiefComplaint: enc.triage.chiefComplaint, onset: '', painScore: 0, redFlags: [], screening: {}, nurseNote: ''},
    vitals: [], soap: {subjective: '', objective: '', assessment: '', plan: ''},
    diagnoses: structuredClone(enc.diagnoses), prescriptions: structuredClone(enc.prescriptions),
    orders: structuredClone(enc.orders.filter(o => o.status === 'signed')), scores: [],
    allergiesReviewed: enc.allergiesReviewed, recording: {consent: enc.recording.consent, active: false, seconds: 0}, transcript: [],
    followUp: structuredClone(enc.followUp), patientInstructions: enc.patientInstructions, sickNoteDays: enc.sickNoteDays, updatedAt: enc.updatedAt,
  };
  for (const k of ['signedAt', 'signedBy', 'version', 'followUpAppointmentId']) if (enc[k] !== undefined) out[k] = enc[k];
  return out;
}

// ---------------------------------------------------------------- patients and appointments

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const PHONE = /^[+0-9 ()-]{5,24}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}$/;
const DEVICE_KINDS = ['phone', 'bp-cuff', 'oximeter', 'thermometer', 'glucometer', 'watch'];

const FIELD = {
  firstName: v => str(v, 'First name', {min: 1, max: 80}),
  lastName: v => str(v, 'Last name', {min: 1, max: 80}),
  phone: v => { const t = str(v, 'Phone', {min: 5, max: 24}); if (!PHONE.test(t)) throw bad('Phone number is not valid'); return t; },
  email: v => { const t = str(v, 'Email', {max: 180}); if (t && !EMAIL.test(t)) throw bad('Email address is not valid'); return t; },
  language: v => str(v, 'Language', {min: 1, max: 40}),
  address: v => str(v, 'Address', {max: 240}),
  bloodGroup: v => oneOf(v, 'Blood group', BLOOD_GROUPS),
  heightCm: v => num(v, 'Height', 30, 260),
  weightKg: v => num(v, 'Weight', 1, 500),
  guardian: v => str(v, 'Guardian', {max: 120}),
  smoking: v => oneOf(v, 'Smoking status', ['never', 'former', 'current']),
  pregnant: v => bool(v, 'Pregnant'),
  noKnownAllergies: v => bool(v, 'No known allergies'),
  insurance: v => { shape(v, 'Insurance', ['payer', 'memberId']); return {payer: str(v.payer ?? 'Self-pay', 'Payer', {min: 1, max: 80}), memberId: str(v.memberId ?? '', 'Member ID', {max: 40})}; },
  emergencyContact: v => { shape(v, 'Emergency contact', ['name', 'phone', 'relation']); return {name: str(v.name ?? '', 'Emergency contact name', {max: 80}), phone: str(v.phone ?? '', 'Emergency contact phone', {max: 24}), relation: str(v.relation ?? '', 'Emergency contact relation', {max: 40})}; },
  devices: v => list(v, 'Devices', 10).map(d => { shape(d, 'Device', ['name', 'kind', 'connected']); return {name: str(d.name, 'Device name', {min: 1, max: 60}), kind: oneOf(d.kind, 'Device kind', DEVICE_KINDS), connected: bool(d.connected, 'Device connected')}; }),
};
export const PATIENT_PATCH_FIELDS = Object.keys(FIELD).filter(k => k !== 'noKnownAllergies').concat('noKnownAllergies');

const ALLERGY_CATEGORIES = ['drug', 'food', 'environment'];
export function allergyInput(raw, authorId, nowIso) {
  shape(raw, 'Allergy', ['substance', 'category', 'allergyClass', 'reaction', 'severity', 'recordedBy', 'status', 'recordedAt', 'id']);
  const out = {
    id: newId('alg'),
    substance: str(raw.substance, 'Substance', {min: 1, max: 80}),
    category: oneOf(raw.category, 'Allergy category', ALLERGY_CATEGORIES),
  };
  set(out, 'allergyClass', optional(raw, 'allergyClass', v => str(v, 'Allergy class', {max: 40})) || undefined);
  Object.assign(out, {reaction: str(raw.reaction ?? '', 'Reaction', {max: 160}), severity: oneOf(raw.severity ?? 'moderate', 'Severity', ['mild', 'moderate', 'severe']), status: 'active', recordedAt: nowIso, recordedBy: authorId});
  return out;
}

/** `authorId` is the trusted recorder of any allergies in the payload (a staff id or the host user id), never a caller claim. */
export function patientInput(raw, {authorId, nowIso, mrn}) {
  shape(raw, 'Patient', ['firstName', 'lastName', 'dob', 'sex', 'phone', 'email', 'language', 'address', 'bloodGroup', 'heightCm', 'weightKg', 'insurance', 'emergencyContact', 'guardian', 'allergies', 'noKnownAllergies', 'medications', 'problems', 'devices', 'smoking', 'pregnant']);
  for (const k of ['firstName', 'lastName', 'dob', 'phone']) if (raw[k] === undefined || raw[k] === '') throw bad('First name, last name, date of birth and phone are required');
  const dob = dateOnly(raw.dob, 'Date of birth');
  if (dob > nowIso.slice(0, 10) || dob < '1900-01-01') throw bad('Date of birth is out of range');
  const allergies = list(raw.allergies ?? [], 'Allergies', 30).map(a => allergyInput(a, authorId, nowIso));
  const noKnownAllergies = raw.noKnownAllergies === undefined ? false : bool(raw.noKnownAllergies, 'No known allergies');
  if (noKnownAllergies && allergies.length) throw bad('A patient with recorded allergies cannot be marked as having none');
  const p = {
    id: newId('p'), mrn, firstName: FIELD.firstName(raw.firstName), lastName: FIELD.lastName(raw.lastName), dob,
    sex: oneOf(raw.sex ?? 'other', 'Sex', ['female', 'male', 'other']), phone: FIELD.phone(raw.phone), email: raw.email === undefined ? '' : FIELD.email(raw.email),
    language: raw.language === undefined ? 'English' : FIELD.language(raw.language), address: raw.address === undefined ? '' : FIELD.address(raw.address),
    bloodGroup: raw.bloodGroup === undefined ? 'Unknown' : FIELD.bloodGroup(raw.bloodGroup),
  };
  set(p, 'heightCm', optional(raw, 'heightCm', FIELD.heightCm));
  set(p, 'weightKg', optional(raw, 'weightKg', FIELD.weightKg));
  p.insurance = raw.insurance === undefined ? {payer: 'Self-pay', memberId: ''} : FIELD.insurance(raw.insurance);
  p.emergencyContact = raw.emergencyContact === undefined ? {name: '', phone: '', relation: ''} : FIELD.emergencyContact(raw.emergencyContact);
  set(p, 'guardian', optional(raw, 'guardian', FIELD.guardian));
  p.allergies = allergies;
  p.noKnownAllergies = noKnownAllergies;
  p.medications = list(raw.medications ?? [], 'Medications', 30).map(m => {
    shape(m, 'Medication', ['name', 'dose', 'frequency', 'status', 'since', 'id']);
    return {id: newId('med'), name: str(m.name, 'Medication name', {min: 1, max: 100}), dose: str(m.dose ?? '', 'Dose', {max: 60}), frequency: str(m.frequency ?? '', 'Frequency', {max: 60}), status: oneOf(m.status ?? 'active', 'Medication status', ['active', 'stopped']), since: m.since === undefined ? nowIso : instant(m.since, 'Medication start')};
  });
  p.problems = list(raw.problems ?? [], 'Problems', 30).map(x => {
    shape(x, 'Problem', ['code', 'display', 'since', 'status']);
    return {code: str(x.code ?? '', 'Problem code', {max: 12}), display: str(x.display, 'Problem', {min: 1, max: 120}), since: x.since === undefined ? nowIso : instant(x.since, 'Problem start'), status: oneOf(x.status ?? 'active', 'Problem status', ['active', 'resolved'])};
  });
  p.devices = raw.devices === undefined ? [{name: 'Patient phone', kind: 'phone', connected: true}] : FIELD.devices(raw.devices);
  p.smoking = raw.smoking === undefined ? 'never' : FIELD.smoking(raw.smoking);
  set(p, 'pregnant', optional(raw, 'pregnant', FIELD.pregnant));
  p.createdAt = nowIso;
  return p;
}

/** Explicit field allowlist replaces the source's unrestricted Object.assign. */
export function patientPatch(raw, patient) {
  shape(raw, 'Patient update', PATIENT_PATCH_FIELDS);
  const changes = {};
  for (const [key, value] of Object.entries(raw)) changes[key] = FIELD[key](value);
  if (changes.noKnownAllergies === true && patient.allergies.some(a => a.status === 'active')) throw bad('Resolve active allergies before marking none known');
  return changes;
}

export function allergyPatch(raw) {
  shape(raw, 'Allergy update', ['status', 'reaction', 'severity']);
  const out = {};
  if (raw.status !== undefined) out.status = oneOf(raw.status, 'Allergy status', ['active', 'inactive']);
  if (raw.reaction !== undefined) out.reaction = str(raw.reaction, 'Reaction', {max: 160});
  if (raw.severity !== undefined) out.severity = oneOf(raw.severity, 'Severity', ['mild', 'moderate', 'severe']);
  if (!Object.keys(out).length) throw bad('Nothing to update');
  return out;
}

export function preVisitInput(raw) {
  shape(raw, 'Pre-visit', ['completed', 'symptoms', 'duration', 'severity', 'notes', 'shareDeviceData', 'recordingConsent', 'deviceCheck']);
  shape(raw.deviceCheck, 'Device check', ['camera', 'mic', 'network']);
  return {
    completed: bool(raw.completed, 'Completed'),
    symptoms: list(raw.symptoms, 'Symptoms', 20).map(s => str(s, 'Symptom', {min: 1, max: 60})),
    duration: str(raw.duration ?? '', 'Duration', {max: 60}),
    severity: num(raw.severity, 'Severity', 0, 10, {int: true}),
    notes: str(raw.notes ?? '', 'Notes', {max: 500}),
    shareDeviceData: bool(raw.shareDeviceData, 'Share device data'),
    recordingConsent: bool(raw.recordingConsent, 'Recording consent'),
    deviceCheck: {camera: bool(raw.deviceCheck.camera, 'Camera'), mic: bool(raw.deviceCheck.mic, 'Microphone'), network: oneOf(raw.deviceCheck.network, 'Network', ['good', 'fair', 'poor'])},
  };
}

export function appointmentInput(raw, cfg) {
  shape(raw, 'Appointment', ['patientId', 'clinicianId', 'start', 'durationMin', 'mode', 'reason', 'priority', 'createdBy', 'preVisit']);
  if (!raw.patientId || !raw.clinicianId || !raw.start || !raw.reason) throw bad('Patient, clinician, time and reason are required');
  const durationMin = raw.durationMin === undefined ? cfg.scheduling.defaultDurationMin : num(raw.durationMin, 'Duration', cfg.scheduling.minDurationMin, cfg.scheduling.maxDurationMin, {int: true});
  return {
    patientId: recordId(raw.patientId, 'Patient'), clinicianId: recordId(raw.clinicianId, 'Clinician'), startMs: Date.parse(instant(raw.start, 'Start time')), durationMin,
    mode: oneOf(raw.mode ?? 'video', 'Visit mode', cfg.modes), reason: str(raw.reason, 'Reason', {min: 1, max: 300}), priority: oneOf(raw.priority ?? 'routine', 'Priority', ['routine', 'urgent']),
    preVisit: raw.preVisit === undefined ? undefined : preVisitInput(raw.preVisit),
  };
}

// ---------------------------------------------------------------- booking advice

/** Demonstration triage hints ported from the source patient booking page; not medical advice. */
export const RED_FLAG_SYMPTOMS = Object.freeze(['Chest pain', 'Shortness of breath']);
const SPECIALTY_RULES = Object.freeze([
  ['Psychiatry', ['Low mood', 'Anxiety', 'Trouble sleeping']],
  ['Dermatology', ['Rash', 'Itching']],
  ['Cardiology', ['Palpitations', 'High blood pressure reading']],
]);
const URGENT_SEVERITY = 8;

/** Source behaviour: under-16s go to Pediatrics, then the first matching symptom group, else General medicine. */
export function suggestSpecialty(symptoms, age) {
  if (age < 16) return 'Pediatrics';
  for (const [specialty, group] of SPECIALTY_RULES) if (symptoms.some(s => group.includes(s))) return specialty;
  return 'General medicine';
}

/** Whole-year difference between the clinic-local year and the birth year, as the source computed it. */
export function patientAge(dob, nowMs, cfg) {
  return new Date(nowMs + cfg.scheduling.utcOffsetMinutes * MINUTE).getUTCFullYear() - Number(dob.slice(0, 4));
}

export const bookingAdvice = ({symptoms, severity = 4, age}) => ({
  specialty: suggestSpecialty(symptoms, age),
  urgent: symptoms.some(s => RED_FLAG_SYMPTOMS.includes(s)) || severity >= URGENT_SEVERITY,
  demo: true,
});

// ---------------------------------------------------------------- encounters

const VITAL_RANGES = {hr: [20, 300], spo2: [0, 100], sys: [40, 300], dia: [20, 200], rr: [4, 80], temp: [30, 45], glucose: [0, 1000], weight: [1, 500]};
const NURSE_ORDER_KINDS = ['nursing', 'lab', 'procedure'];
export const ENCOUNTER_FIELDS = ['triage', 'vitals', 'soap', 'diagnoses', 'prescriptions', 'orders', 'scores', 'allergiesReviewed', 'recording', 'followUp', 'patientInstructions', 'sickNoteDays'];
const CONTEXT_FIELDS = ['id', 'appointmentId', 'patientId', 'status', 'transcript', 'signedAt', 'signedBy', 'updatedAt', 'version', 'overrideReason', 'followUpAppointmentId'];
const DOCTOR_ONLY = ['prescriptions', 'diagnoses', 'followUp', 'patientInstructions', 'sickNoteDays'];

function itemId(raw, prefix, seen) {
  const id = raw === undefined ? newId(prefix) : recordId(raw, `${prefix} id`);
  if (seen.has(id)) throw bad(`Duplicate ${prefix} identifier`);
  seen.add(id);
  return id;
}

/**
 * Parses client-supplied clinical content into a fresh object. Server-owned context (ids, status, signature,
 * transcript, version) is never taken from the body. Missing sections keep the stored value (`base`).
 */
export function parseEncounterContent(body, base, {actor, nowMs, existingOrders = base.orders, existingScores = base.scores}) {
  shape(body, 'Encounter', [...ENCOUNTER_FIELDS, ...CONTEXT_FIELDS]);
  const out = {};
  if (body.triage !== undefined) {
    const t = shape(body.triage, 'Triage', ['chiefComplaint', 'onset', 'painScore', 'redFlags', 'screening', 'nurseNote', 'completedBy', 'completedAt']);
    out.triage = {
      chiefComplaint: str(t.chiefComplaint ?? '', 'Chief complaint', {max: 500}), onset: str(t.onset ?? '', 'Onset', {max: 200}), painScore: num(t.painScore ?? 0, 'Pain score', 0, 10, {int: true}),
      redFlags: list(t.redFlags ?? [], 'Red flags', 20).map(f => str(f, 'Red flag', {min: 1, max: 100})), screening: record(t.screening ?? {}, 'Screening', (v, f) => bool(v, f)), nurseNote: str(t.nurseNote ?? '', 'Nursing note', {max: 4000}),
    };
    if (t.completedBy !== undefined || t.completedAt !== undefined) {
      const before = base.triage ?? {};
      const by = t.completedBy === undefined ? undefined : recordId(t.completedBy, 'Triage completed by');
      const at = t.completedAt === undefined ? undefined : instant(t.completedAt, 'Triage completed at');
      const changed = by !== before.completedBy || (at !== undefined && at !== before.completedAt);
      if (changed && by !== actor.staffId) throw new HttpError(403, 'Triage can only be completed as the signed-in clinician');
      set(out.triage, 'completedBy', by);
      set(out.triage, 'completedAt', at);
    }
  }
  if (body.vitals !== undefined) {
    const seen = new Set();
    const allowedSources = ['device', 'patient', actor.mode];
    out.vitals = list(body.vitals, 'Vitals', 100).map(v => {
      shape(v, 'Vitals', ['id', 'recordedAt', 'source', 'hr', 'spo2', 'sys', 'dia', 'rr', 'temp', 'glucose', 'weight', 'pain', 'consciousness', 'onOxygen']);
      const at = instant(v.recordedAt, 'Vitals time');
      if (Date.parse(at) > nowMs + 5 * MINUTE) throw bad('Vitals cannot be recorded in the future');
      const id = itemId(v.id, 'vit', seen);
      const prior = base.vitals.find(x => x.id === id);
      // Readings taken by the other role stay as recorded; only new or edited readings must claim an allowed source.
      const row = {id, recordedAt: at, source: oneOf(v.source, 'Vitals source', prior && prior.source === v.source ? [prior.source] : allowedSources)};
      for (const [k, [lo, hi]] of Object.entries(VITAL_RANGES)) if (v[k] !== undefined) row[k] = num(v[k], k, lo, hi);
      if (v.pain !== undefined) row.pain = num(v.pain, 'pain', 0, 10, {int: true});
      if (v.consciousness !== undefined) row.consciousness = oneOf(v.consciousness, 'consciousness', ['alert', 'confused', 'voice', 'pain', 'unresponsive']);
      if (v.onOxygen !== undefined) row.onOxygen = bool(v.onOxygen, 'onOxygen');
      return row;
    });
  }
  if (body.soap !== undefined) {
    const s = shape(body.soap, 'Note', ['subjective', 'objective', 'assessment', 'plan']);
    out.soap = {subjective: str(s.subjective ?? '', 'Subjective', {max: 8000}), objective: str(s.objective ?? '', 'Objective', {max: 8000}), assessment: str(s.assessment ?? '', 'Assessment', {max: 8000}), plan: str(s.plan ?? '', 'Plan', {max: 8000})};
  }
  if (body.diagnoses !== undefined) {
    out.diagnoses = list(body.diagnoses, 'Diagnoses', 30).map(d => {
      shape(d, 'Diagnosis', ['code', 'display', 'type', 'certainty', 'addToProblemList']);
      const code = str(d.code, 'Diagnosis code', {min: 2, max: 12});
      if (!/^[A-Z][0-9A-Z.]{1,10}$/.test(code)) throw bad('Diagnosis code is not valid');
      const known = ICD.find(c => c.code === code);
      return {code, display: known ? known.display : str(d.display, 'Diagnosis', {min: 1, max: 160}), type: oneOf(d.type, 'Diagnosis type', ['primary', 'secondary']), certainty: oneOf(d.certainty, 'Certainty', ['confirmed', 'provisional']), addToProblemList: bool(d.addToProblemList ?? false, 'Add to problem list')};
    });
    if (out.diagnoses.filter(d => d.type === 'primary').length > 1) throw bad('Only one primary diagnosis is allowed');
    if (new Set(out.diagnoses.map(d => d.code)).size !== out.diagnoses.length) throw bad('Duplicate diagnosis');
  }
  if (body.prescriptions !== undefined) {
    const seen = new Set();
    out.prescriptions = list(body.prescriptions, 'Prescriptions', 30).map(r => {
      shape(r, 'Prescription', ['id', 'drugId', 'name', 'strength', 'form', 'dose', 'route', 'frequency', 'durationDays', 'quantity', 'refills', 'instructions', 'prn']);
      const drug = DRUGS.find(d => d.id === r.drugId);
      if (!drug) throw bad('Prescription drug is not in the formulary');
      return {id: itemId(r.id, 'rx', seen), drugId: drug.id, name: drug.name, strength: drug.strength, form: drug.form, dose: str(r.dose ?? drug.defaultDose, 'Dose', {min: 1, max: 80}), route: str(r.route ?? drug.route, 'Route', {min: 1, max: 40}), frequency: str(r.frequency ?? drug.defaultFrequency, 'Frequency', {min: 1, max: 80}), durationDays: num(r.durationDays, 'Duration days', 1, 365, {int: true}), quantity: num(r.quantity, 'Quantity', 0, 1000, {int: true}), refills: num(r.refills ?? 0, 'Refills', 0, 12, {int: true}), instructions: str(r.instructions ?? '', 'Instructions', {max: 500}), prn: bool(r.prn ?? false, 'As needed')};
    });
    if (new Set(out.prescriptions.map(r => r.drugId)).size !== out.prescriptions.length) throw bad('Duplicate prescription');
  }
  if (body.orders !== undefined) {
    const seen = new Set();
    out.orders = list(body.orders, 'Orders', 60).map(o => {
      shape(o, 'Order', ['id', 'kind', 'code', 'name', 'priority', 'notes', 'orderedBy', 'orderedByRole', 'status']);
      const item = ORDERABLES.find(x => x.code === o.code);
      if (!item) throw bad('Order is not in the catalog');
      const id = itemId(o.id, 'ord', seen);
      const prior = existingOrders.find(x => x.id === id);
      // Authorship and status are server-owned; a client cannot re-attribute an order.
      return {id, kind: item.kind, code: item.code, name: item.name, priority: oneOf(o.priority ?? 'routine', 'Order priority', ['routine', 'urgent', 'stat']), notes: str(o.notes ?? '', 'Order notes', {max: 500}), orderedBy: prior?.orderedBy ?? actor.staffId, orderedByRole: prior?.orderedByRole ?? actor.mode, status: prior?.status ?? 'pending'};
    });
    if (new Set(out.orders.map(o => o.code)).size !== out.orders.length) throw bad('Duplicate order');
  }
  if (body.scores !== undefined) {
    const seen = new Set();
    out.scores = list(body.scores, 'Scores', 30).map(s => {
      shape(s, 'Score', ['id', 'key', 'name', 'value', 'max', 'interpretation', 'band', 'answers', 'at']);
      const id = itemId(s.id, 'score', seen);
      const prior = existingScores.find(x => x.id === id);
      if (prior && isDeepStrictEqual(prior, s)) return structuredClone(prior);
      // Results are recomputed on the server so a client cannot forge a clinical score.
      const answers = record(s.answers ?? {}, 'Score answers', (v, f) => num(v, f, 0, 100));
      let result;
      try { result = computeScore(str(s.key, 'Score', {min: 1, max: 20}), answers, latestVitals(out.vitals ?? base.vitals)); } catch (error) { if (error instanceof HttpError) throw error; throw bad(error.message); }
      return {...result, id, at: s.at === undefined ? new Date(nowMs).toISOString() : instant(s.at, 'Score time')};
    });
  }
  if (body.allergiesReviewed !== undefined) out.allergiesReviewed = bool(body.allergiesReviewed, 'Allergies reviewed');
  if (body.recording !== undefined) {
    const r = shape(body.recording, 'Recording', ['consent', 'active', 'seconds']);
    out.recording = {consent: bool(r.consent, 'Recording consent'), active: bool(r.active, 'Recording active'), seconds: num(r.seconds ?? 0, 'Recording seconds', 0, 86400, {int: true})};
  }
  if (body.followUp !== undefined) {
    out.followUp = body.followUp === null ? null : (() => {
      shape(body.followUp, 'Follow-up', ['inDays', 'mode', 'note']);
      return {inDays: num(body.followUp.inDays, 'Follow-up days', 1, 365, {int: true}), mode: oneOf(body.followUp.mode, 'Follow-up mode', ['video', 'audio', 'chat']), note: str(body.followUp.note ?? '', 'Follow-up note', {max: 300})};
    })();
  }
  if (body.patientInstructions !== undefined) out.patientInstructions = str(body.patientInstructions, 'Patient instructions', {max: 4000});
  if (body.sickNoteDays !== undefined) out.sickNoteDays = num(body.sickNoteDays, 'Sick note days', 0, 60, {int: true});
  return out;
}

/** Nurses may not change physician-owned sections, add medicines or alter doctor-authored orders. */
export function assertNurseBoundary(actor, content, stored) {
  if (actor.mode !== 'nurse') return;
  for (const key of DOCTOR_ONLY) {
    if (content[key] !== undefined && !isDeepStrictEqual(content[key], stored[key])) throw new HttpError(403, 'Prescriptions, diagnoses, follow-up, instructions and sick notes are set by a doctor');
  }
  if (content.orders !== undefined) {
    const next = new Map(content.orders.map(o => [o.id, o]));
    for (const prior of stored.orders) {
      if (prior.orderedByRole === 'doctor' && !isDeepStrictEqual(next.get(prior.id), prior)) throw new HttpError(403, 'A nurse cannot change or remove an order placed by a doctor');
    }
    for (const o of content.orders) if (!stored.orders.some(p => p.id === o.id) && !NURSE_ORDER_KINDS.includes(o.kind)) throw new HttpError(403, 'That order needs a doctor');
  }
}

/** Recording gate: allowed by policy, consented, and only during a live call. */
export function assertRecording(recording, stored, appointment, cfg) {
  if (!recording) return;
  // A completed pre-visit form that declined recording cannot be overridden by staff.
  if (recording.consent && !stored.recording.consent && appointment.preVisit?.completed && appointment.preVisit.recordingConsent === false) throw conflict('The patient declined recording');
  if (!recording.active) return;
  if (!cfg.recording.allowed) throw conflict('Recording is not enabled for this branch');
  // Consent is mandatory for every branch; policy validation rejects any attempt to switch this off.
  if (!recording.consent) throw conflict('Recording needs the patient\'s consent');
  if (!['in-call', 'triage'].includes(appointment.status)) throw conflict('Recording can only run during an active call');
}

export function signProblems(actor, merged) {
  const problems = [];
  if (actor.mode === 'doctor' && !merged.diagnoses.some(d => d.type === 'primary')) problems.push('Add a primary diagnosis');
  if (!merged.allergiesReviewed) problems.push('Review allergies');
  if (actor.mode === 'nurse' && !merged.triage.nurseNote.trim()) problems.push('Write a nursing note');
  return problems;
}

// ---------------------------------------------------------------- deterministic simulation

const hash32 = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const unit = (seed, tick, salt) => (hash32(`${seed}:${tick}:${salt}`) % 100000) / 100000;
export const DEFAULT_BASELINE = {hr: 76, spo2: 98, sys: 120, dia: 78, rr: 15, temp: 36.7};

/** Pure function of (appointment, second): any number of pollers observe identical frames. */
export function liveVitalsFrame(appointmentId, baseline, nowMs) {
  const tick = Math.floor(nowMs / 1000);
  const bp = Math.floor(tick / 8);
  const wave = (period, salt) => Math.sin(tick / period + unit(appointmentId, 0, salt) * 6.28);
  return {
    hr: Math.round(baseline.hr + wave(9, 'hr') * 2 + (unit(appointmentId, tick, 'hr') - 0.5) * 3),
    spo2: Math.min(100, Math.round(baseline.spo2 + wave(11, 'o2') * 0.4 + (unit(appointmentId, tick, 'o2') - 0.5) * 0.8)),
    sys: Math.round(baseline.sys + wave(40, 'sys') * 2 + (unit(appointmentId, bp, 'sys') - 0.5) * 6),
    dia: Math.round(baseline.dia + wave(40, 'dia') * 1.5 + (unit(appointmentId, bp, 'dia') - 0.5) * 4),
    rr: Math.round(baseline.rr + wave(13, 'rr') * 0.6 + (unit(appointmentId, tick, 'rr') - 0.5) * 0.8),
    temp: Math.round((baseline.temp + wave(90, 'temp') * 0.04 + (unit(appointmentId, tick, 'temp') - 0.5) * 0.04) * 10) / 10,
    at: new Date(tick * 1000).toISOString(),
    signal: unit(appointmentId, tick, 'sig') > 0.96 ? 'weak' : 'good',
    simulated: true,
  };
}

/**
 * Appends scripted lines that are due on the recording clock. The count is derived from elapsed time and
 * the lines already stored, so concurrent pollers cannot advance the script twice.
 */
export function advanceTranscript(enc, appointment, clock, cfg, nowMs, makeId) {
  const script = scriptFor(appointment.reason);
  const cap = Math.min(script.lines.length, cfg.limits.maxTranscriptLines);
  const due = Math.min(cap, clock.baseLines + Math.floor(Math.max(0, nowMs - clock.startedAtMs) / cfg.simulation.transcriptIntervalMs));
  let appended = 0;
  while (enc.transcript.length < due) {
    const [speaker, text] = script.lines[enc.transcript.length];
    enc.transcript.push({id: makeId('tr'), speaker, text, at: new Date(nowMs).toISOString(), simulated: true});
    appended++;
  }
  return {appended, finished: enc.transcript.length >= cap, total: script.lines.length};
}

export const scriptLength = reason => scriptFor(reason).lines.length;
export {latestVitals};
