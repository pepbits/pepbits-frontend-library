// Teleconsult trust boundary: scope isolation, actor/role grants, command access and bounded configuration.
// Everything here is server-side. Headers and query values only *request* a view; the authenticated user
// decides which provider modes or patient the account may use.
import {createHash} from 'node:crypto';

export const TELECONSULT_MODULES = Object.freeze({'reference-teleconsult-provider': 'provider', 'reference-teleconsult-patient': 'patient'});
export const TELECONSULT_MODES = Object.freeze(['doctor', 'nurse']);
export const VISIT_MODES = Object.freeze(['video', 'audio', 'chat']);
export const ROLE_HEADER = 'x-teleconsult-role';
export const PATIENT_HEADER = 'x-teleconsult-patient';
export const SIMULATION_NOTICE = 'Demonstration data and simulated vitals, transcript, decision support and scribe. Not validated clinical software; no real device, speech or medical advice.';

const ID = /^[A-Za-z0-9._:-]{1,64}$/;
const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const KEY = /^[\w:.-]{8,128}$/;

// ---------------------------------------------------------------- scope

export function moduleSurface(moduleId) {
  return Object.hasOwn(TELECONSULT_MODULES, moduleId) ? TELECONSULT_MODULES[moduleId] : null;
}

/** Both modules resolve to one partition per authenticated tenant/application/branch. */
export function teleconsultScope(user, scope) {
  const tenantId = user?.tenantId, applicationId = scope?.applicationId, branchId = scope?.branchId;
  const surface = moduleSurface(scope?.moduleId);
  if (!user || typeof user.id !== 'string' || !user.id || ![tenantId, applicationId, branchId].every(v => typeof v === 'string' && ID.test(v)) || !surface) {
    throw new Error('Authenticated Teleconsult scope is required');
  }
  const key = createHash('sha256').update(JSON.stringify(['teleconsult', tenantId, applicationId, branchId])).digest('hex');
  return {key, tenantId, applicationId, branchId, surface};
}

// ---------------------------------------------------------------- configuration

export class TeleconsultConfigError extends Error {
  constructor(issues) { super(`Invalid Teleconsult configuration: ${issues.join('; ')}`); this.name = 'TeleconsultConfigError'; this.issues = issues; }
}

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const minutes = clock => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));

// One entry per leaf: [validator, bounds description]. Unknown keys are rejected so typos cannot silently disable a guard.
const intIn = (min, max) => v => Number.isInteger(v) && v >= min && v <= max;
const SCHEMA = {
  scheduling: {
    utcOffsetMinutes: intIn(-720, 840),
    slotIntervalMin: v => Number.isInteger(v) && v >= 5 && v <= 60 && 60 % v === 0,
    opening: v => typeof v === 'string' && CLOCK.test(v),
    closing: v => typeof v === 'string' && CLOCK.test(v),
    breaks: v => Array.isArray(v) && v.length <= 6 && v.every(b => isObject(b) && Object.keys(b).length === 2 && CLOCK.test(b.start ?? '') && CLOCK.test(b.end ?? '')),
    defaultDurationMin: intIn(5, 240),
    minDurationMin: intIn(5, 240),
    maxDurationMin: intIn(5, 240),
    pastGraceMin: intIn(0, 120),
    horizonDays: intIn(1, 365),
  },
  modes: v => Array.isArray(v) && v.length >= 1 && new Set(v).size === v.length && v.every(m => VISIT_MODES.includes(m)),
  // Recording consent is mandatory and cannot be configured away; the key is kept so the policy document states it explicitly.
  recording: {allowed: v => typeof v === 'boolean', consentRequired: v => v === true},
  simulation: {vitals: v => typeof v === 'boolean', transcript: v => typeof v === 'boolean', scribe: v => typeof v === 'boolean', arrive: v => typeof v === 'boolean', transcriptIntervalMs: intIn(250, 60000)},
  limits: {
    maxBodyBytes: intIn(1024, 2 * 1024 * 1024),
    maxPatients: intIn(10, 5000),
    maxAppointments: intIn(15, 20000),
    maxMessagesPerAppointment: intIn(1, 5000),
    maxTranscriptLines: intIn(1, 1000),
    maxAuditEntries: intIn(10, 20000),
    maxIdempotencyKeys: intIn(10, 5000),
  },
  access: {
    enforceClinicianOwnership: v => typeof v === 'boolean',
    allowPatientBooking: v => typeof v === 'boolean',
    allowAdminPatientRegistration: v => typeof v === 'boolean',
    registerRoles: v => Array.isArray(v) && new Set(v).size === v.length && v.every(r => TELECONSULT_MODES.includes(r)),
    doctorStaffId: v => typeof v === 'string' && RECORD_ID.test(v),
    nurseStaffId: v => typeof v === 'string' && RECORD_ID.test(v),
    defaultPatientId: v => typeof v === 'string' && RECORD_ID.test(v),
  },
};

function checkLayer(layer, path, issues) {
  if (!isObject(layer)) { issues.push(`${path} must be an object`); return; }
  for (const [group, value] of Object.entries(layer)) {
    const rule = Object.hasOwn(SCHEMA, group) ? SCHEMA[group] : undefined;
    if (!rule) { issues.push(`${path}.${group} is not a supported setting`); continue; }
    if (typeof rule === 'function') { if (!rule(value)) issues.push(`${path}.${group} is invalid`); continue; }
    if (!isObject(value)) { issues.push(`${path}.${group} must be an object`); continue; }
    for (const [name, leaf] of Object.entries(value)) {
      if (!Object.hasOwn(rule, name)) issues.push(`${path}.${group}.${name} is not a supported setting`);
      else if (!rule[name](leaf)) issues.push(`${path}.${group}.${name} is invalid`);
    }
  }
}

const mergeLayer = (base, layer) => {
  const out = structuredClone(base);
  for (const [group, value] of Object.entries(layer ?? {})) out[group] = typeof SCHEMA[group] === 'function' || Array.isArray(value) ? structuredClone(value) : {...out[group], ...structuredClone(value)};
  return out;
};

/** Cross-field rules for a fully merged layer: hours, breaks, durations and staff mapping. */
function checkEffective(cfg, path, issues) {
  const s = cfg.scheduling;
  if (minutes(s.opening) >= minutes(s.closing)) issues.push(`${path}.scheduling opening must be before closing`);
  if (s.minDurationMin > s.defaultDurationMin || s.defaultDurationMin > s.maxDurationMin) issues.push(`${path}.scheduling durations must satisfy min <= default <= max`);
  const sorted = [...s.breaks].sort((a, b) => minutes(a.start) - minutes(b.start));
  sorted.forEach((b, i) => {
    if (minutes(b.start) >= minutes(b.end)) issues.push(`${path}.scheduling break ${b.start}-${b.end} must end after it starts`);
    if (minutes(b.start) < minutes(s.opening) || minutes(b.end) > minutes(s.closing)) issues.push(`${path}.scheduling break ${b.start}-${b.end} must be inside opening hours`);
    if (i && minutes(b.start) < minutes(sorted[i - 1].end)) issues.push(`${path}.scheduling breaks must not overlap`);
  });
  if (cfg.access.doctorStaffId === cfg.access.nurseStaffId) issues.push(`${path}.access doctor and nurse staff identifiers must differ`);
}

/**
 * Validates and freezes the whole document (defaults, every tenant default and every branch override).
 * Throws TeleconsultConfigError listing every problem; nothing partial is ever returned.
 */
export function validateTeleconsultConfig(raw) {
  const issues = [];
  if (!isObject(raw)) throw new TeleconsultConfigError(['configuration must be an object']);
  for (const key of Object.keys(raw)) if (!['schemaVersion', 'description', 'defaults', 'tenants'].includes(key)) issues.push(`${key} is not a supported section`);
  if (raw.schemaVersion !== 1) issues.push('schemaVersion must be 1');
  if (raw.description !== undefined && typeof raw.description !== 'string') issues.push('description must be text');
  const required = Object.keys(SCHEMA);
  if (!isObject(raw.defaults)) issues.push('defaults must be an object');
  else {
    checkLayer(raw.defaults, 'defaults', issues);
    for (const group of required) {
      const rule = SCHEMA[group];
      if (raw.defaults[group] === undefined) issues.push(`defaults.${group} is required`);
      else if (typeof rule !== 'function') for (const name of Object.keys(rule)) if (raw.defaults[group]?.[name] === undefined) issues.push(`defaults.${group}.${name} is required`);
    }
  }
  const tenants = raw.tenants ?? {};
  if (!isObject(tenants)) issues.push('tenants must be an object');
  if (!issues.length) {
    checkEffective(raw.defaults, 'defaults', issues);
    for (const [tenantId, tenant] of Object.entries(tenants)) {
      const base = `tenants.${tenantId}`;
      if (!ID.test(tenantId)) { issues.push(`${base} has an invalid tenant identifier`); continue; }
      if (!isObject(tenant)) { issues.push(`${base} must be an object`); continue; }
      const {branches, ...tenantLayer} = tenant;
      checkLayer(tenantLayer, base, issues);
      if (branches !== undefined && !isObject(branches)) issues.push(`${base}.branches must be an object`);
      if (issues.length) continue;
      const tenantEffective = mergeLayer(raw.defaults, tenantLayer);
      checkEffective(tenantEffective, base, issues);
      for (const [branchId, layer] of Object.entries(branches ?? {})) {
        const path = `${base}.branches.${branchId}`;
        if (!ID.test(branchId)) { issues.push(`${path} has an invalid branch identifier`); continue; }
        checkLayer(layer, path, issues);
        if (!issues.length) checkEffective(mergeLayer(tenantEffective, layer), path, issues);
      }
    }
  }
  if (issues.length) throw new TeleconsultConfigError(issues);
  return deepFreeze(structuredClone({defaults: raw.defaults, tenants}));
}

function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

/** Tenant defaults, then branch override, over the global defaults. Result is a frozen, fully populated object. */
export function resolveTeleconsultConfig(validated, tenantId, branchId) {
  const tenant = Object.hasOwn(validated.tenants, tenantId) ? validated.tenants[tenantId] : {};
  const {branches = {}, ...tenantLayer} = tenant;
  const branch = Object.hasOwn(branches, branchId) ? branches[branchId] : {};
  return deepFreeze(mergeLayer(mergeLayer(validated.defaults, tenantLayer), branch));
}

// ---------------------------------------------------------------- request hygiene

export function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  const hits = Object.keys(headers).filter(k => k.toLowerCase() === name);
  if (!hits.length) return undefined;
  const values = hits.map(k => headers[k]);
  if (values.length > 1 || Array.isArray(values[0])) return null; // ambiguous duplicate
  return typeof values[0] === 'string' ? values[0].trim() : null;
}

/** Normalizes the request target; returns null when the path could escape or confuse routing. */
export function parseTeleconsultRequest(request, config) {
  const method = String(request?.method ?? '').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) return {error: {status: 405, error: 'Method is not supported'}};
  const raw = request?.path;
  if (typeof raw !== 'string' || raw.length > 600 || !raw.startsWith('/api')) return {error: {status: 400, error: 'Invalid Teleconsult path'}};
  let pathname;
  try { pathname = decodeURIComponent(raw.split('?')[0]); } catch { return {error: {status: 400, error: 'Invalid Teleconsult path'}}; }
  if (!(pathname === '/api' || pathname.startsWith('/api/')) || /[\\\x00-\x1f]/.test(pathname) || pathname.split('/').some(p => p === '.' || p === '..') || pathname.includes('//')) return {error: {status: 400, error: 'Invalid Teleconsult path'}};
  const search = request.query instanceof URLSearchParams ? request.query : new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '');
  if (search.toString().length > 1024) return {error: {status: 414, error: 'Query is too long'}};
  let body = request.body;
  if (body !== undefined && body !== null) {
    if (!isObject(body)) return {error: {status: 400, error: 'Request body must be a JSON object'}};
    let size;
    try { size = Buffer.byteLength(JSON.stringify(body)); } catch { return {error: {status: 400, error: 'Request body is not valid JSON'}}; }
    if (size > config.limits.maxBodyBytes) return {error: {status: 413, error: 'Request body is too large'}};
  } else body = undefined;
  return {method, pathname, search, body};
}

export function idempotencyKey(headers) {
  const value = headerValue(headers, 'idempotency-key');
  if (value === undefined) return {missing: true};
  return typeof value === 'string' && KEY.test(value) ? {key: value} : {invalid: true};
}

export const isMutation = method => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

// ---------------------------------------------------------------- actors

// Accounts are authenticated by the host. The `teleconsult-*` roles are dedicated demo accounts with fixed grants.
const GRANTS = Object.freeze({
  'enterprise-admin': {modes: ['doctor', 'nurse'], patients: 'all'},
  admin: {modes: ['doctor', 'nurse'], patients: 'all'},
  'teleconsult-doctor': {modes: ['doctor'], patients: null},
  'teleconsult-nurse': {modes: ['nurse'], patients: null},
  'teleconsult-patient': {modes: [], patients: 'fixed'},
});

/** Provider modes this account may use. An explicit `teleconsultRoles` narrows (never widens) the account's grants. */
export function providerModes(user) {
  const grant = Object.hasOwn(GRANTS, user?.role) ? GRANTS[user.role] : null;
  if (!grant) return [];
  let modes = grant.modes;
  if (user.teleconsultRoles !== undefined) modes = Array.isArray(user.teleconsultRoles) ? modes.filter(m => user.teleconsultRoles.includes(m)) : [];
  return modes;
}

/**
 * `all` for admin demo accounts. A dedicated patient account is fixed to the host's trusted `user.teleconsultPatientId`;
 * a missing or malformed mapping denies access. The configured default patient only seeds an admin's initial selection.
 */
export function patientGrant(user) {
  const grant = Object.hasOwn(GRANTS, user?.role) ? GRANTS[user.role] : null;
  if (!grant || !grant.patients) return null;
  if (grant.patients === 'all') return {all: true};
  const id = user.teleconsultPatientId;
  return typeof id === 'string' && RECORD_ID.test(id) ? {all: false, patientId: id} : null;
}

const deny = (status, error) => ({ok: false, status, error});

/**
 * Resolves the acting identity for one request.
 * Provider: requested mode comes from X-Teleconsult-Role (or ?role on /api/session) and must be granted.
 * Patient: requested beneficiary comes from X-Teleconsult-Patient (or ?patientId on /api/session) and must be granted.
 */
export function resolveTeleconsultActor({surface, user, headers, search, pathname, config}) {
  if (!user || typeof user.id !== 'string') return deny(401, 'Authentication is required');
  const onSession = pathname === '/api/session';
  const fromHeader = headerValue(headers, surface === 'provider' ? ROLE_HEADER : PATIENT_HEADER);
  if (fromHeader === null) return deny(400, 'Ambiguous Teleconsult view header');
  const fromQuery = onSession ? search.get(surface === 'provider' ? 'role' : 'patientId') : null;
  if (fromHeader && fromQuery && fromHeader !== fromQuery) return deny(400, 'Conflicting Teleconsult view selection');
  const requested = fromHeader || fromQuery || undefined;
  const userName = typeof user.name === 'string' ? user.name : user.email;
  if (surface === 'provider') {
    const modes = providerModes(user);
    if (!modes.length) return deny(403, 'This account cannot use the Teleconsult provider workspace');
    if (requested !== undefined && !TELECONSULT_MODES.includes(requested)) return deny(400, 'Unknown Teleconsult provider role');
    const mode = requested ?? modes[0];
    if (!modes.includes(mode)) return deny(403, `This account is not authorized for the ${mode} role`);
    const staffId = mode === 'doctor' ? config.access.doctorStaffId : config.access.nurseStaffId;
    return {ok: true, actor: {kind: 'provider', mode, modes, userId: user.id, userName, staffId}};
  }
  const grant = patientGrant(user);
  if (!grant) return deny(403, 'This account cannot use the Teleconsult patient workspace');
  if (requested !== undefined && !RECORD_ID.test(requested)) return deny(400, 'Invalid patient identifier');
  if (!grant.all && requested !== undefined && requested !== grant.patientId) return deny(403, 'This account is not authorized for that patient');
  const patientId = grant.all ? (requested ?? config.access.defaultPatientId) : grant.patientId;
  return {ok: true, actor: {kind: 'patient', all: grant.all, requested: requested !== undefined, patientId, userId: user.id, userName}};
}

// ---------------------------------------------------------------- command access

const P = ['doctor', 'nurse'];
const ALL = {provider: P, patient: true};
const PROVIDER = {provider: P, patient: false};
/** Command → who may call it. Patient `true` means "own beneficiary only"; the store enforces ownership. */
export const COMMAND_ACCESS = Object.freeze({
  'health.get': ALL,
  'session.get': ALL,
  'staff.list': ALL,
  'catalog.get': ALL,
  'catalog.search': PROVIDER,
  'catalog.icd': PROVIDER,
  'catalog.drugs': PROVIDER,
  'patients.list': ALL,
  'patients.create': {provider: 'register', patient: 'register'},
  'patients.get': ALL,
  'patients.update': PROVIDER,
  'allergies.add': PROVIDER,
  'allergies.update': PROVIDER,
  'patients.history': ALL,
  'patients.appointments': ALL,
  'booking.advice': ALL,
  'slots.list': {provider: P, patient: 'booking'},
  'appointments.list': PROVIDER,
  'appointments.get': ALL,
  'appointments.create': {provider: P, patient: 'booking'},
  'appointments.update': PROVIDER,
  'appointments.join': {provider: [], patient: true},
  'queue.get': PROVIDER,
  'dashboard.get': PROVIDER,
  'sim.arrive': PROVIDER,
  'encounter.get': PROVIDER,
  'encounter.put': PROVIDER,
  'encounter.cds': PROVIDER,
  'encounter.suggest': PROVIDER,
  'encounter.scribe': PROVIDER,
  'scores.compute': PROVIDER,
  'encounter.sign': PROVIDER,
  'encounters.list': PROVIDER,
  'summary.get': ALL,
  'messages.list': ALL,
  'messages.post': ALL,
  'vitals.current': ALL,
  'vitals.stream': ALL,
  'transcript.current': PROVIDER,
  'transcript.stream': PROVIDER,
  'audit.list': {provider: ['doctor'], patient: false},
});

export function commandAllowed(actor, command, config) {
  const rule = Object.hasOwn(COMMAND_ACCESS, command) ? COMMAND_ACCESS[command] : null;
  if (!rule) return false;
  if (actor.kind === 'provider') {
    if (rule.provider === 'register') return config.access.registerRoles.includes(actor.mode);
    return Array.isArray(rule.provider) && rule.provider.includes(actor.mode);
  }
  if (rule.patient === 'booking') return config.access.allowPatientBooking;
  // Registration is an admin-demo branch only: a dedicated (fixed) patient account can never create patients.
  if (rule.patient === 'register') return actor.all === true && config.access.allowAdminPatientRegistration;
  return rule.patient === true;
}
