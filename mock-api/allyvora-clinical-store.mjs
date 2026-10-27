/**
 * Synthetic AllyVora clinical workspace for the healthcare demo's Outpatient intake and Emergency
 * triage pages, served under `/allyvora-clinical`. Paths, payloads, status changes and the NEWS2 and
 * ESI rules follow the AllyVora workspace API (`EncounterController`, `ClinicalScores`, commit
 * e025f48). Data is fictional and kept in memory: a restart restores the seeded clinic.
 */

const VITAL_RANGES = {
  sbp: ['Systolic BP', 40, 300], dbp: ['Diastolic BP', 20, 200], hr: ['Heart rate', 20, 250], rr: ['Respiratory rate', 0, 80],
  temp: ['Temperature', 30, 44], spo2: ['SpO₂', 50, 100], glucose: ['Glucose', 0.5, 60], weight: ['Weight', 0.3, 400], height: ['Height', 20, 250], o2Flow: ['Oxygen flow', 0, 60],
};
const REASONS = new Set(['refused', 'unable', 'device-failure', 'not-indicated']);
const REQUIRED = [['hr', 'heart rate'], ['rr', 'respiratory rate'], ['temp', 'temperature'], ['spo2', 'SpO₂'], ['bp', 'blood pressure']];
const OP_WAITING = new Set(['registered', 'intake']);
const LOCKED = new Set(['signed', 'discharged', 'left', 'cancelled']);
const REASSESS_MINUTES = [0, 0, 15, 60, 120, 180];

const COMPLAINTS = [
  ['CC-001', 'Chest pain', ['chest tightness']], ['CC-002', 'Shortness of breath', ['breathless', 'dyspnoea']], ['CC-003', 'Abdominal pain', ['stomach ache']],
  ['CC-004', 'Headache', []], ['CC-005', 'Fever', ['high temperature']], ['CC-006', 'Cough', []], ['CC-007', 'Fall', ['slipped']],
  ['CC-008', 'Back pain', []], ['CC-009', 'Dizziness', ['vertigo', 'light-headed']], ['CC-010', 'Vomiting', ['nausea']],
  ['CC-011', 'Wound or laceration', ['cut']], ['CC-012', 'Palpitations', []], ['CC-013', 'Sore throat', []], ['CC-014', 'Rash', []],
].map(([code, display, synonyms]) => ({code, system: 'urn:demo:allyvora:complaints', display, synonyms}));
const ALLERGENS = [
  ['AL-001', 'Penicillin', 'medication', 'Drug class'], ['AL-002', 'Amoxicillin', 'medication', 'Medicine'], ['AL-003', 'Ibuprofen', 'medication', 'Medicine'],
  ['AL-004', 'Aspirin', 'medication', 'Medicine'], ['AL-005', 'Sulfonamides', 'medication', 'Drug class'], ['AL-006', 'Codeine', 'medication', 'Medicine'],
  ['AL-007', 'Peanut', 'food', 'Food'], ['AL-008', 'Shellfish', 'food', 'Food'], ['AL-009', 'Egg', 'food', 'Food'],
  ['AL-010', 'Latex', 'environment', 'Material'], ['AL-011', 'House dust mite', 'environment', 'Environment'],
].map(([code, display, category, kind]) => ({code, system: 'urn:demo:allyvora:allergens', display, meta: {category, kind}}));
const CATALOGS = {complaints: COMPLAINTS, allergens: ALLERGENS};

const fail = (status, error, problems) => ({status, body: problems ? {error, problems} : {error}});
const ok = body => ({status: 200, body});
const num = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

function points(value, ...bands) {
  if (value === null) return null;
  for (let i = 0; i < bands.length; i += 3) if (value >= bands[i] && value <= bands[i + 1]) return bands[i + 2];
  return null;
}

/** NEWS2 as the workspace scores it: scale 1 or 2 SpO₂, missing inputs make the result incomplete. */
export function news2(v) {
  const rr = num(v.rr), sp = num(v.spo2), bp = num(v.sbp), hr = num(v.hr), temp = num(v.temp);
  const air = typeof v.air === 'string' ? v.air : '', scale = v.scale === '2' ? '2' : '1', o2 = air === 'oxygen', acvpu = typeof v.acvpu === 'string' ? v.acvpu : '';
  let ps = null;
  if (sp !== null && air) ps = scale === '2'
    ? (sp <= 83 ? 3 : sp <= 85 ? 2 : sp <= 87 ? 1 : sp <= 92 || !o2 ? 0 : sp <= 94 ? 1 : sp <= 96 ? 2 : 3)
    : points(sp, -1e9, 91, 3, 92, 93, 2, 94, 95, 1, 96, 1e9, 0);
  const components = [
    {key: 'rr', label: 'Respiration rate', points: points(rr, -1e9, 8, 3, 9, 11, 1, 12, 20, 0, 21, 24, 2, 25, 1e9, 3)},
    {key: 'spo2', label: `SpO₂ (scale ${scale})`, points: ps},
    {key: 'air', label: 'Air or oxygen', points: air ? (o2 ? 2 : 0) : null},
    {key: 'sbp', label: 'Systolic BP', points: points(bp, -1e9, 90, 3, 91, 100, 2, 101, 110, 1, 111, 219, 0, 220, 1e9, 3)},
    {key: 'hr', label: 'Pulse', points: points(hr, -1e9, 40, 3, 41, 50, 1, 51, 90, 0, 91, 110, 1, 111, 130, 2, 131, 1e9, 3)},
    {key: 'acvpu', label: 'Consciousness', points: acvpu ? (acvpu === 'A' ? 0 : 3) : null},
    {key: 'temp', label: 'Temperature', points: points(temp === null ? null : Math.round(temp * 10) / 10, -1e9, 35, 3, 35.1, 36, 1, 36.1, 38, 0, 38.1, 39, 1, 39.1, 1e9, 2)},
  ];
  const missing = components.filter(c => c.points === null).map(c => c.label);
  if (missing.length) return {status: 'incomplete', total: null, components, missing, interpretation: `Cannot calculate yet. Missing: ${missing.join(', ')}.`};
  const total = components.reduce((sum, c) => sum + c.points, 0), red = components.some(c => c.points >= 3);
  return {
    status: 'complete', total, components, missing,
    band: total >= 7 ? 'High' : total >= 5 ? 'Medium' : red ? 'Low–medium (single parameter 3)' : 'Low',
    severity: total >= 7 ? 'critical' : total >= 5 ? 'high' : red ? 'moderate' : 'low',
    interpretation: total >= 7 ? 'Emergency response: urgent assessment by a team with critical-care competencies; continuous monitoring.'
      : total >= 5 ? 'Urgent response: urgent review by a clinician competent in acute illness; monitor at least hourly.'
      : red ? 'Urgent ward-based response: a single parameter scored 3. Inform the responsible clinician.'
      : total === 0 ? 'Continue routine monitoring (at least every 12 hours).' : 'Inform the registered nurse; monitor at least every 4–6 hours.',
  };
}

/** ESI v5 decision points as the workspace calculates them, including its danger-zone defaults. */
export function esi(v) {
  const steps = [], has = key => Object.hasOwn(v, key) && v[key] !== null && v[key] !== undefined, yes = key => v[key] === true || v[key] === 'yes';
  let level = null, dangerZone = false;
  if (!has('lifeSaving')) steps.push('Answer: does the patient need an immediate life-saving intervention?');
  else if (yes('lifeSaving')) { level = 1; steps.push('Decision A: immediate life-saving intervention required'); }
  else {
    steps.push('A: no immediate life-saving intervention');
    if (!['highRisk', 'confusedLethargic', 'severePain'].every(has)) steps.push('Answer decision B: high risk, confusion or severe pain');
    else if (yes('highRisk') || yes('confusedLethargic') || yes('severePain')) { level = 2; steps.push('Decision B: high-risk situation, new confusion or severe pain/distress'); }
    else {
      steps.push('B: not high risk');
      if (!has('resources')) steps.push('Answer decision C: expected number of resources');
      else {
        const r = Number(v.resources);
        if (![0, 1, 2].includes(r)) return {error: 'resources: expected 0, 1 or 2.'};
        if (r < 2) { level = r === 0 ? 5 : 4; steps.push(r === 0 ? 'C: no resources expected' : 'C: one resource expected'); }
        else {
          steps.push('C: two or more resources expected');
          const age = num(v.ageYears) ?? 30;
          const hr = age < 0.25 ? 180 : age < 3 ? 160 : age <= 8 ? 140 : 100, rr = age < 0.25 ? 50 : age < 3 ? 40 : age <= 8 ? 30 : 20;
          dangerZone = (num(v.hr) ?? 0) > hr || (num(v.rr) ?? 0) > rr || (num(v.spo2) ?? 100) < 92;
          level = dangerZone ? 2 : 3;
          steps.push(dangerZone ? `D: danger-zone vital signs (HR > ${hr}, RR > ${rr} or SpO₂ < 92%) — consider up-triage to 2` : 'D: vital signs outside the danger zone');
        }
      }
    }
  }
  return {level, steps, dangerZone};
}

/** Range, pairing and absence checks on a vitals payload; returns the problems found. */
export function vitalsProblems(v) {
  const problems = [], absent = v.notMeasured && typeof v.notMeasured === 'object' ? v.notMeasured : {};
  for (const [key, reason] of Object.entries(absent)) if (!REASONS.has(reason)) problems.push(`${key}: unknown reason it wasn't measured.`);
  for (const [key, [label, min, max]] of Object.entries(VITAL_RANGES)) {
    const value = v[key];
    if (value === null || value === undefined) continue;
    if (num(value) === null || value < min || value > max) problems.push(`${label}: enter a number from ${min} to ${max}.`);
    const absentKey = key === 'sbp' || key === 'dbp' ? 'bp' : key;
    if (absent[absentKey]) problems.push(`${label}: recorded as measured and not measured.`);
  }
  if ((v.sbp == null) !== (v.dbp == null)) problems.push('Blood pressure: enter both systolic and diastolic values.');
  else if (num(v.sbp) !== null && num(v.dbp) !== null && v.dbp >= v.sbp) problems.push('Blood pressure: diastolic must be lower than systolic.');
  if (v.pain !== null && v.pain !== undefined && (!Number.isInteger(v.pain) || v.pain < 0 || v.pain > 10)) problems.push('Pain: enter a whole number from 0 to 10.');
  for (const [key, label] of REQUIRED) {
    const measured = key === 'bp' ? v.sbp != null : v[key] != null;
    if (!measured && !absent[key]) problems.push(`Record ${label} or a reason it wasn't measured.`);
  }
  if (!['air', 'oxygen'].includes(v.o2)) problems.push('Say whether the patient is on room air or oxygen.');
  if (!['A', 'C', 'V', 'P', 'U'].includes(v.acvpu)) problems.push('Record level of consciousness (ACVPU).');
  return problems;
}

const actorFor = user => /doctor/.test(String(user?.role)) ? {role: 'doctor', permissions: ['vitals.write', 'note.write', 'triage.write']} : {role: 'nurse', permissions: ['vitals.write', 'triage.write']};

function seed(now) {
  const at = minutes => new Date(now - minutes * 60_000).toISOString();
  const born = years => new Date(now - years * 365.25 * 86_400_000).toISOString().slice(0, 10);
  const patients = [
    ['P-1001', 'MRN-20001', 'Layla Haddad', 'female', 34], ['P-1002', 'MRN-20002', 'Omar Siddiqui', 'male', 61], ['P-1003', 'MRN-20003', 'Grace Mensah', 'female', 72],
    ['P-1004', 'MRN-20004', 'Arjun Menon', 'male', 45], ['P-1005', 'MRN-20005', 'Sofia Rossi', 'female', 28], ['P-1006', 'MRN-20006', 'Yusuf Rahman', 'male', 8],
    ['P-1007', 'MRN-20007', 'Hannah Becker', 'female', 53], ['P-1008', 'MRN-20008', 'Daniel Okafor', 'male', 39], ['P-1009', 'MRN-20009', 'Mei Tanaka', 'female', 67],
    ['P-1010', 'MRN-20010', 'Unknown male', 'male', 40, 'unknown'], ['P-1011', 'MRN-20011', 'Fatima Al Noor', 'female', 81], ['P-1012', 'MRN-20012', 'Lucas Martin', 'male', 19],
  ].map(([id, mrn, name, sex, age, identityStatus]) => ({id, mrn, name, sex, age, birthDate: born(age), restricted: false, identityStatus: identityStatus ?? 'verified'}));
  const allergies = {
    'P-1002': [{id: 'A-1', substance: 'Penicillin', category: 'medication', clinicalStatus: 'active', verification: 'confirmed', criticality: 'high', reaction: 'Hives and facial swelling'}],
    'P-1007': [{id: 'A-2', substance: 'Peanut', category: 'food', clinicalStatus: 'active', verification: 'unconfirmed', reaction: 'Itchy mouth'}],
    'P-1011': [{id: 'A-3', substance: 'Codeine', category: 'medication', clinicalStatus: 'active', verification: 'confirmed', criticality: 'low', reaction: 'Vomiting'}],
  };
  const assessments = Object.fromEntries(patients.map(p => [p.id, {state: allergies[p.id] ? 'has-entries' : ['P-1001', 'P-1004'].includes(p.id) ? 'nka' : 'not-assessed', ...(allergies[p.id] || ['P-1001', 'P-1004'].includes(p.id) ? {at: at(60 * 24 * 30)} : {})}]));
  const enc = (id, patientId, cls, status, department, minutesAgo, reason, extra = {}) => ({id, patientId, class: cls, status, department, arrivedAt: at(minutesAgo), reason, version: 1, news2: null, ...extra});
  const encounters = [
    enc('OP-301', 'P-1001', 'OP', 'registered', 'General Medicine', 12, 'Cough for a week'),
    enc('OP-302', 'P-1004', 'OP', 'registered', 'Cardiology', 26, 'Follow-up of blood pressure'),
    enc('OP-303', 'P-1007', 'OP', 'intake', 'General Medicine', 41, 'Headaches'),
    enc('OP-304', 'P-1009', 'OP', 'ready', 'Orthopaedics', 55, 'Knee pain', {news2: 1}),
    enc('OP-305', 'P-1005', 'OP', 'in-consult', 'Dermatology', 70, 'Rash on arms', {news2: 0, clinicianName: 'Dr. Ines Duarte'}),
    enc('OP-306', 'P-1012', 'OP', 'signed', 'General Medicine', 130, 'Sports injury', {news2: 0, clinicianName: 'Dr. Ines Duarte'}),
    enc('ER-401', 'P-1002', 'ER', 'waiting-triage', 'Emergency', 6, 'Chest pain'),
    enc('ER-402', 'P-1010', 'ER', 'waiting-triage', 'Emergency', 19, 'Found collapsed, brought by ambulance'),
    enc('ER-403', 'P-1006', 'ER', 'waiting-triage', 'Emergency', 33, 'Fever and vomiting'),
    enc('ER-404', 'P-1003', 'ER', 'triaged', 'Emergency', 48, 'Fall at home', {acuity: 3, news2: 2, reassessDueAt: at(-12)}),
    enc('ER-405', 'P-1011', 'ER', 'triaged', 'Emergency', 75, 'Shortness of breath', {acuity: 2, news2: 6, reassessDueAt: at(5)}),
    enc('ER-406', 'P-1008', 'ER', 'triaged', 'Emergency', 95, 'Cut hand', {acuity: 4, news2: 0, reassessDueAt: at(-25)}),
  ];
  return {patients: new Map(patients.map(p => [p.id, p])), allergies, assessments, encounters: new Map(encounters.map(e => [e.id, e])), observations: {}};
}

export function createAllyVoraClinicalStore({now = () => Date.now()} = {}) {
  const db = seed(now());
  let allergySeq = 100;
  const lite = p => ({id: p.id, mrn: p.mrn, name: p.name, age: p.age, sex: p.sex, restricted: p.restricted, identityStatus: p.identityStatus});
  const allergyBlock = pid => ({assessment: db.assessments[pid] ?? {state: 'not-assessed'}, entries: db.allergies[pid] ?? []});
  const waiting = e => Math.max(0, Math.round((now() - Date.parse(e.arrivedAt)) / 60_000));
  const encounterView = ({news2: _score, ...e}) => ({...e, waitingMinutes: waiting(e)});
  const row = e => {
    const p = db.patients.get(e.patientId), block = allergyBlock(e.patientId);
    const active = block.entries.filter(a => a.clinicalStatus === 'active' && a.verification !== 'refuted');
    return {...encounterView(e), clinicalVisible: true, patient: lite(p), allergyState: block.assessment.state, allergyCount: active.length, news2: e.news2,
      openReviews: 0, reassessOverdue: !!e.reassessDueAt && Date.parse(e.reassessDueAt) < now()};
  };

  function saveIntake(e, body, actor) {
    if (e.class === 'IP') return fail(422, 'Use inpatient observations; outpatient intake or emergency triage cannot change an inpatient admission.');
    if (LOCKED.has(e.status)) return fail(409, 'This visit is closed.');
    const mode = body.mode;
    if (mode !== 'op' && mode !== 'er') return fail(400, 'mode: expected op or er.');
    if ((mode === 'er') !== (e.class === 'ER')) return fail(409, mode === 'er' ? 'Only emergency visits are triaged.' : 'Emergency visits are triaged, not taken through outpatient intake.');
    if (mode === 'er' && !['doctor', 'nurse'].includes(actor.role)) return fail(403, 'Triage must be performed by a registered nurse or doctor.');
    if (mode === 'op' ? !OP_WAITING.has(e.status) : e.status !== 'waiting-triage') return fail(409, mode === 'op' ? 'This visit is no longer waiting for intake.' : 'This visit is no longer waiting for triage.');
    const v = body.vitals && typeof body.vitals === 'object' ? body.vitals : {};
    const problems = vitalsProblems(v);
    const review = body.allergyReview;
    if (!review) problems.push('Review the allergy list with the patient.');
    else if (!['nka', 'unknown', 'reviewed-no-change', 'updated'].includes(review)) problems.push('Invalid allergy review.');
    const complaint = body.complaint && typeof body.complaint === 'object' ? body.complaint : null;
    if (complaint && (typeof complaint.display !== 'string' || !complaint.display.trim() || complaint.display.length > 200)) problems.push('complaint.display: 1 to 200 characters.');
    if (mode === 'er' && !complaint) problems.push('Choose the presenting complaint.');
    let triage = null;
    if (mode === 'er') {
      const decision = body.esi && typeof body.esi === 'object' ? body.esi : {};
      const p = db.patients.get(e.patientId);
      const result = esi({...decision, ageYears: p.age, hr: v.hr, rr: v.rr, spo2: v.spo2});
      if (result.error) problems.push(result.error);
      if (decision.overrideLevel != null && !String(decision.overrideReason ?? '').trim()) problems.push('Give a reason for changing the calculated triage level.');
      const finalLevel = decision.overrideLevel ?? result.level ?? 0;
      if (!(finalLevel >= 1 && finalLevel <= 5)) problems.push('Complete the triage decision points before saving.');
      triage = {...result, finalLevel};
    }
    if (problems.length) return fail(422, problems[0], problems);
    const news = news2({rr: v.rr, spo2: v.spo2, air: v.o2, sbp: v.sbp, hr: v.hr, acvpu: v.acvpu, temp: v.temp, scale: '1'});
    Object.assign(e, {version: e.version + 1, news2: news.total ?? e.news2, ...(complaint ? {reason: complaint.display.trim()} : {})},
      mode === 'er' ? {status: 'triaged', acuity: triage.finalLevel, reassessDueAt: new Date(now() + REASSESS_MINUTES[triage.finalLevel] * 60_000).toISOString()} : {status: 'ready'},
      body.disposition?.area ? {area: String(body.disposition.area).slice(0, 60)} : {});
    if (review && review !== 'updated') {
      const state = review === 'nka' ? 'nka' : review === 'unknown' ? 'unknown' : db.assessments[e.patientId]?.state ?? 'has-entries';
      db.assessments[e.patientId] = {state, at: new Date(now()).toISOString(), by: actor.role};
    }
    db.observations[e.patientId] = {at: new Date(now()).toISOString(), vitals: v};
    return ok({encounter: encounterView(e), news2: news, esi: triage});
  }

  function setStatus(e, status, actor) {
    if (LOCKED.has(e.status)) return fail(409, 'This visit is closed.');
    if (e.class !== 'OP') return fail(409, 'Emergency visits change status through triage.');
    const from = {intake: ['registered'], 'in-consult': ['registered', 'intake', 'ready']}[status];
    if (!from) return fail(400, 'status: not a change this workspace allows here.');
    if (status === 'in-consult' && !actor.permissions.includes('note.write')) return fail(403, 'Only clinicians who write notes can start a consultation.');
    if (!from.includes(e.status)) return fail(409, `This visit is ${e.status}; it cannot move to ${status}.`);
    Object.assign(e, {status, version: e.version + 1});
    return ok({encounter: encounterView(e)});
  }

  function addAllergy(pid, body) {
    const substance = String(body.substance ?? '').trim();
    if (!substance || substance.length > 120) return fail(422, 'Substance: 1 to 120 characters.', ['Substance: 1 to 120 characters.']);
    if (!['medication', 'food', 'environment'].includes(body.category)) return fail(422, 'Category: choose medicine, food or environment.', ['Category: choose medicine, food or environment.']);
    if (body.criticality && !['low', 'high', 'unable-to-assess'].includes(body.criticality)) return fail(422, 'Invalid severity concern.', ['Invalid severity concern.']);
    (db.allergies[pid] ??= []).push({id: `A-${++allergySeq}`, substance, category: body.category, clinicalStatus: 'active', verification: 'unconfirmed',
      ...(body.criticality ? {criticality: body.criticality} : {}), ...(body.reaction ? {reaction: String(body.reaction).slice(0, 200)} : {})});
    db.assessments[pid] = {state: 'has-entries', at: new Date(now()).toISOString()};
    return ok(allergyBlock(pid));
  }

  /** One request below `/allyvora-clinical` for a signed-in demo user. */
  function handle(user, {method, path, query, body = {}}) {
    const actor = actorFor(user);
    if (path === '/auth/me' && method === 'GET') return ok({id: user.id, name: user.name ?? user.username ?? 'Demo clinician', ...actor});
    if (path === '/encounters' && method === 'GET') {
      const cls = query.get('class');
      return ok([...db.encounters.values()].filter(e => !cls || e.class === cls).map(row));
    }
    if (path === '/encounters/esi/preview' && method === 'POST') {
      if (!actor.permissions.includes('vitals.write')) return fail(403, 'Not allowed.');
      const problems = ['hr', 'rr', 'spo2'].filter(key => body[key] != null).flatMap(key => {
        const [label, min, max] = VITAL_RANGES[key];
        return num(body[key]) === null || body[key] < min || body[key] > max ? [`${label}: enter a number from ${min} to ${max}.`] : [];
      });
      if (problems.length) return fail(422, problems[0], problems);
      const result = esi(body);
      return result.error ? fail(400, result.error) : ok(result);
    }
    if (path === '/scores/news2/calculate' && method === 'POST') return ok(news2(body.inputs && typeof body.inputs === 'object' ? body.inputs : {}));
    const catalog = /^\/catalog\/([a-z]+)$/.exec(path);
    if (catalog && method === 'GET') {
      const items = CATALOGS[catalog[1]];
      if (!items) return fail(404, 'Unknown catalogue.');
      const q = (query.get('q') ?? '').trim().toLowerCase(), limit = Math.min(Number(query.get('limit')) || 10, 50);
      return ok({items: items.filter(i => !q || i.display.toLowerCase().includes(q) || i.synonyms?.some(s => s.includes(q))).slice(0, limit)});
    }
    const allergy = /^\/patients\/([^/]+)\/allergies$/.exec(path);
    if (allergy && method === 'POST') return db.patients.has(allergy[1]) ? addAllergy(allergy[1], body) : fail(404, 'Patient not found.');
    const match = /^\/encounters\/([^/]+)(\/status|\/intake)?$/.exec(path);
    if (match) {
      const e = db.encounters.get(match[1]);
      if (!e) return fail(404, 'Visit not found.');
      if (!match[2] && method === 'GET') {
        const p = db.patients.get(e.patientId), last = db.observations[e.patientId];
        const latest = last ? Object.fromEntries([['8867-4', 'hr', 'Heart rate', '/min'], ['9279-1', 'rr', 'Respiratory rate', '/min'], ['8310-5', 'temp', 'Temperature', '°C'], ['59408-5', 'spo2', 'SpO₂', '%']]
          .filter(([, key]) => num(last.vitals[key]) !== null).map(([code, key, display, unit]) => [code, {id: `${code}-${e.patientId}`, code, display, value: last.vitals[key], unit, effectiveAt: last.at}])) : {};
        return ok({encounter: encounterView(e), patient: {...lite(p), birthDate: p.birthDate}, allergies: allergyBlock(e.patientId), observations: {latest}});
      }
      if (match[2] === '/status' && method === 'PATCH') return setStatus(e, body.status, actor);
      if (match[2] === '/intake' && method === 'POST') return saveIntake(e, body, actor);
    }
    return fail(404, `No route for ${method} /allyvora-clinical${path}.`);
  }

  return {handle};
}
