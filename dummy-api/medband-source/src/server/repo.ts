import "server-only";
import type { MasterData } from "@/lib/master-data";
import type {
  AdmissionRequest, AppState, Case, ComplaintEntry, Coverage, Encounter, EncounterType, Episode, Patient,
} from "@/lib/types";
import type { DB } from "./db";

// SQLite stores booleans as 0/1 and missing values as NULL; the domain uses
// true/false and undefined. These helpers keep that translation in one place.
type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
const bool = (v: unknown) => v === 1 || v === true;
const optBool = (v: unknown) => (v === null || v === undefined ? undefined : bool(v));
const b = (v: boolean | undefined) => (v === undefined ? null : v ? 1 : 0);
const n = <T,>(v: T | undefined) => (v === undefined || v === "" ? null : v);

// ─── Reference data ───

export function loadMaster(db: DB): MasterData {
  const all = (sql: string) => db.prepare(sql).all() as Row[];
  const payerTpas = all("SELECT payer_id, tpa_id FROM payer_tpas");
  const beds = all("SELECT code, ward_id FROM beds ORDER BY sort");
  const counterTypes = all("SELECT counter_id, encounter_type FROM counter_encounter_types");
  return {
    payers: all("SELECT * FROM payers ORDER BY rowid").map((r) => ({
      id: String(r.id), name: String(r.name), short: String(r.short), tpaRequired: bool(r.tpa_required),
      tpaIds: payerTpas.filter((x) => x.payer_id === r.id).map((x) => String(x.tpa_id)),
    })),
    tpas: all("SELECT * FROM tpas ORDER BY rowid").map((r) => ({ id: String(r.id), name: String(r.name) })),
    networks: all("SELECT * FROM plan_networks ORDER BY rowid").map((r) => ({
      id: String(r.id), payerId: String(r.payer_id), name: String(r.name), tier: r.tier as MasterData["networks"][number]["tier"],
    })),
    plans: all("SELECT * FROM plans ORDER BY rowid").map((r) => ({
      id: String(r.id), networkId: String(r.network_id), name: String(r.name), copayPct: Number(r.copay_pct),
      opLimit: Number(r.op_limit), ipCovered: bool(r.ip_covered), teleCovered: bool(r.tele_covered),
    })),
    departments: all("SELECT * FROM departments ORDER BY rowid").map((r) => ({
      id: String(r.id), name: String(r.name), followUpDays: Number(r.follow_up_days),
      freeFollowUps: Number(r.free_follow_ups), consults: bool(r.consults),
    })),
    practitioners: all("SELECT * FROM practitioners ORDER BY rowid").map((r) => ({
      id: String(r.id), name: String(r.name), departmentId: String(r.department_id), title: String(r.title), tele: bool(r.tele),
    })),
    wards: all("SELECT * FROM wards ORDER BY sort").map((r) => ({
      id: String(r.id), name: String(r.name), category: r.category as MasterData["wards"][number]["category"],
      beds: beds.filter((x) => x.ward_id === r.id).map((x) => String(x.code)),
    })),
    services: all("SELECT name FROM services ORDER BY sort").map((r) => String(r.name)),
    packages: all("SELECT * FROM health_packages ORDER BY rowid").map((r) => ({ id: String(r.id), name: String(r.name), items: Number(r.items) })),
    complaints: all("SELECT * FROM complaints ORDER BY sort").map((r) => ({ code: String(r.code), label: String(r.label), category: String(r.category) })),
    counters: all("SELECT * FROM counters ORDER BY sort").map((r) => ({
      id: String(r.id), name: String(r.name), location: String(r.location),
      encounterTypes: counterTypes.filter((x) => x.counter_id === r.id).map((x) => x.encounter_type as EncounterType),
    })),
  };
}

export function insertMaster(db: DB, m: MasterData) {
  const run = (sql: string, ...args: unknown[]) => db.prepare(sql).run(...args);
  m.tpas.forEach((t) => run("INSERT INTO tpas VALUES (?, ?)", t.id, t.name));
  m.payers.forEach((p) => {
    run("INSERT INTO payers VALUES (?, ?, ?, ?)", p.id, p.name, p.short, b(p.tpaRequired));
    p.tpaIds.forEach((t) => run("INSERT INTO payer_tpas VALUES (?, ?)", p.id, t));
  });
  m.networks.forEach((x) => run("INSERT INTO plan_networks VALUES (?, ?, ?, ?)", x.id, x.payerId, x.name, x.tier));
  m.plans.forEach((x) => run("INSERT INTO plans VALUES (?, ?, ?, ?, ?, ?, ?)", x.id, x.networkId, x.name, x.copayPct, x.opLimit, b(x.ipCovered), b(x.teleCovered)));
  m.departments.forEach((x) => run("INSERT INTO departments VALUES (?, ?, ?, ?, ?)", x.id, x.name, x.followUpDays, x.freeFollowUps, b(x.consults)));
  m.practitioners.forEach((x) => run("INSERT INTO practitioners VALUES (?, ?, ?, ?, ?)", x.id, x.name, x.departmentId, x.title, b(x.tele)));
  m.wards.forEach((w, i) => {
    run("INSERT INTO wards VALUES (?, ?, ?, ?)", w.id, w.name, w.category, i);
    w.beds.forEach((bed, j) => run("INSERT INTO beds VALUES (?, ?, ?)", bed, w.id, j));
  });
  m.services.forEach((s, i) => run("INSERT INTO services VALUES (?, ?)", s, i));
  m.packages.forEach((x) => run("INSERT INTO health_packages VALUES (?, ?, ?)", x.id, x.name, x.items));
  m.complaints.forEach((x, i) => run("INSERT INTO complaints VALUES (?, ?, ?, ?)", x.code, x.label, x.category, i));
  m.counters.forEach((c, i) => {
    run("INSERT INTO counters VALUES (?, ?, ?, ?)", c.id, c.name, c.location, i);
    c.encounterTypes.forEach((t) => run("INSERT INTO counter_encounter_types VALUES (?, ?)", c.id, t));
  });
}

// ─── Sequences ───

export function nextNumber(db: DB, name: string): number {
  const row = db.prepare("UPDATE sequences SET value = value + 1 WHERE name = ? RETURNING value").get(name) as Row | undefined;
  if (!row) throw new Error(`Sequence ${name} is missing`);
  return Number(row.value);
}

export function setSequence(db: DB, name: string, value: number) {
  db.prepare("INSERT INTO sequences (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value").run(name, value);
}

// ─── Loaders ───
// Each loader takes an optional list of ids so a write can return just what changed.

const whereIds = (col: string, ids?: string[]) =>
  ids ? { sql: ` WHERE ${col} IN (${ids.map(() => "?").join(",") || "NULL"})`, args: ids } : { sql: "", args: [] as string[] };

function complaintsByOwner(db: DB, table: "case_complaints" | "encounter_complaints", col: string, ids?: string[]) {
  const w = whereIds(col, ids);
  const rows = db.prepare(`SELECT * FROM ${table}${w.sql} ORDER BY seq`).all(...w.args) as Row[];
  const map = new Map<string, ComplaintEntry[]>();
  rows.forEach((r) => {
    const list = map.get(String(r[col])) ?? [];
    list.push({ code: String(r.complaint_code), label: String(r.label), duration: num(r.duration), unit: str(r.unit) as ComplaintEntry["unit"] });
    map.set(String(r[col]), list);
  });
  return map;
}

export function loadPatients(db: DB, ids?: string[]): Patient[] {
  const w = whereIds("id", ids);
  const rows = db.prepare(`SELECT * FROM patients${w.sql} ORDER BY created_at DESC`).all(...w.args) as Row[];
  const cw = whereIds("patient_id", ids);
  const covRows = db.prepare(`SELECT * FROM coverages${cw.sql} ORDER BY CASE priority WHEN 'Primary' THEN 1 WHEN 'Secondary' THEN 2 ELSE 3 END`).all(...cw.args) as Row[];
  const covs = new Map<string, Coverage[]>();
  covRows.forEach((r) => {
    const list = covs.get(String(r.patient_id)) ?? [];
    list.push({
      id: String(r.id), priority: r.priority as Coverage["priority"], payerId: String(r.payer_id), tpaId: str(r.tpa_id),
      networkId: String(r.network_id), planId: String(r.plan_id), policyNumber: String(r.policy_number),
      memberId: String(r.member_id), validFrom: String(r.valid_from), validTo: String(r.valid_to),
      relationship: r.relationship as Coverage["relationship"], holderName: str(r.holder_name),
    });
    covs.set(String(r.patient_id), list);
  });
  return rows.map((r) => ({
    id: String(r.id), mrn: String(r.mrn), firstName: String(r.first_name), middleName: str(r.middle_name),
    lastName: String(r.last_name), dob: String(r.dob), gender: r.gender as Patient["gender"], phone: String(r.phone),
    altPhone: str(r.alt_phone), email: str(r.email), nationalId: str(r.national_id), nationality: str(r.nationality),
    bloodGroup: str(r.blood_group), preferredLanguage: str(r.preferred_language), address: str(r.address), city: str(r.city),
    emergencyName: str(r.emergency_name), emergencyPhone: str(r.emergency_phone), allergies: str(r.allergies),
    vip: bool(r.vip), unidentified: bool(r.unidentified), coverages: covs.get(String(r.id)) ?? [], createdAt: String(r.created_at),
  }));
}

export function loadEpisodes(db: DB, ids?: string[]): Episode[] {
  const w = whereIds("id", ids);
  return (db.prepare(`SELECT * FROM episodes${w.sql} ORDER BY start_date DESC`).all(...w.args) as Row[]).map((r) => ({
    id: String(r.id), code: String(r.code), patientId: String(r.patient_id), title: String(r.title),
    kind: r.kind as Episode["kind"], status: r.status as Episode["status"], departmentId: String(r.department_id),
    practitionerId: str(r.practitioner_id), startDate: String(r.start_date), endDate: str(r.end_date), notes: str(r.notes),
  }));
}

export function loadCases(db: DB, ids?: string[]): Case[] {
  const w = whereIds("id", ids);
  const complaints = complaintsByOwner(db, "case_complaints", "case_id", ids);
  return (db.prepare(`SELECT * FROM cases${w.sql} ORDER BY opened_at DESC`).all(...w.args) as Row[]).map((r) => ({
    id: String(r.id), code: String(r.code), patientId: String(r.patient_id), episodeId: String(r.episode_id),
    title: String(r.title), complaints: complaints.get(String(r.id)) ?? [], departmentId: String(r.department_id),
    status: r.status as Case["status"], openedAt: String(r.opened_at), closedAt: str(r.closed_at),
    provisionalDiagnosis: str(r.provisional_diagnosis), medicoLegal: bool(r.medico_legal),
    mlcNumber: str(r.mlc_number), policeStation: str(r.police_station),
  }));
}

export function loadEncounters(db: DB, ids?: string[]): Encounter[] {
  const w = whereIds("id", ids);
  const rows = db.prepare(`SELECT * FROM encounters${w.sql} ORDER BY start_at DESC`).all(...w.args) as Row[];
  const complaints = complaintsByOwner(db, "encounter_complaints", "encounter_id", ids);
  const ew = whereIds("encounter_id", ids);
  const covs = new Map<string, string[]>();
  (db.prepare(`SELECT * FROM encounter_coverages${ew.sql} ORDER BY seq`).all(...ew.args) as Row[]).forEach((r) =>
    covs.set(String(r.encounter_id), [...(covs.get(String(r.encounter_id)) ?? []), String(r.coverage_id)]),
  );
  const svcs = new Map<string, string[]>();
  (db.prepare(`SELECT * FROM encounter_services${ew.sql} ORDER BY seq`).all(...ew.args) as Row[]).forEach((r) =>
    svcs.set(String(r.encounter_id), [...(svcs.get(String(r.encounter_id)) ?? []), String(r.service)]),
  );
  return rows.map((r) => {
    const id = String(r.id);
    const services = svcs.get(id);
    const comp = complaints.get(id);
    return {
      id, code: String(r.code), patientId: String(r.patient_id), episodeId: String(r.episode_id), caseId: String(r.case_id),
      type: r.type as Encounter["type"], startType: r.start_type as Encounter["startType"], status: r.status as Encounter["status"],
      priority: r.priority as Encounter["priority"], start: String(r.start_at), end: str(r.end_at),
      departmentId: String(r.department_id), practitionerId: str(r.practitioner_id), chiefComplaint: str(r.chief_complaint),
      complaints: comp?.length ? comp : undefined, counterId: str(r.counter_id), admissionRequestId: str(r.admission_request_id),
      broughtBy: str(r.brought_by), broughtByPhone: str(r.brought_by_phone), parentEncounterId: str(r.parent_encounter_id),
      followUpDerived: optBool(r.follow_up_derived), followUpChargeable: optBool(r.follow_up_chargeable),
      billingMode: r.billing_mode as Encounter["billingMode"], coverageIds: covs.get(id) ?? [], authNumber: str(r.auth_number),
      corporateName: str(r.corporate_name), wardId: str(r.ward_id), bed: str(r.bed_code), admissionReason: str(r.admission_reason),
      expectedStayDays: num(r.expected_stay_days), teleChannel: str(r.tele_channel) as Encounter["teleChannel"],
      teleLink: str(r.tele_link), visitAddress: str(r.visit_address), visitTeam: str(r.visit_team),
      referringFacility: str(r.referring_facility), referringDoctor: str(r.referring_doctor), referralNote: str(r.referral_note),
      services: services?.length ? services : undefined, triage: str(r.triage) as Encounter["triage"], packageId: str(r.package_id),
      createdAt: String(r.created_at),
    };
  });
}

export function loadAdmissionRequests(db: DB, ids?: string[]): AdmissionRequest[] {
  const w = whereIds("id", ids);
  const rows = db.prepare(`SELECT * FROM admission_requests${w.sql} ORDER BY planned_date`).all(...w.args) as Row[];
  const nw = whereIds("request_id", ids);
  const needs = new Map<string, string[]>();
  (db.prepare(`SELECT * FROM admission_request_needs${nw.sql} ORDER BY seq`).all(...nw.args) as Row[]).forEach((r) =>
    needs.set(String(r.request_id), [...(needs.get(String(r.request_id)) ?? []), String(r.need)]),
  );
  return rows.map((r) => ({
    id: String(r.id), code: String(r.code), patientId: String(r.patient_id), caseId: String(r.case_id),
    episodeId: String(r.episode_id), sourceEncounterId: str(r.source_encounter_id), requestedById: String(r.requested_by_id),
    admittingDepartmentId: String(r.admitting_department_id), admittingPractitionerId: String(r.admitting_practitioner_id),
    urgency: r.urgency as AdmissionRequest["urgency"], plannedDate: String(r.planned_date),
    expectedStayDays: Number(r.expected_stay_days), bedCategory: r.bed_category as AdmissionRequest["bedCategory"],
    isolation: r.isolation as AdmissionRequest["isolation"], reason: String(r.reason), plannedProcedure: str(r.planned_procedure),
    specialNeeds: needs.get(String(r.id)) ?? [], billingMode: r.billing_mode as AdmissionRequest["billingMode"],
    coverageId: str(r.coverage_id), authStatus: r.auth_status as AdmissionRequest["authStatus"], authNumber: str(r.auth_number),
    estimatedCost: num(r.estimated_cost), depositCollected: bool(r.deposit_collected), notes: str(r.notes),
    status: r.status as AdmissionRequest["status"], admittedEncounterId: str(r.admitted_encounter_id),
    cancelReason: str(r.cancel_reason), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }));
}

export function loadAll(db: DB): AppState {
  return {
    patients: loadPatients(db),
    episodes: loadEpisodes(db),
    cases: loadCases(db),
    encounters: loadEncounters(db),
    admissionRequests: loadAdmissionRequests(db),
  };
}

// ─── Writers ───

function writeCoverages(db: DB, patientId: string, coverages: Coverage[]) {
  const ins = db.prepare(
    `INSERT INTO coverages (id, patient_id, priority, payer_id, tpa_id, network_id, plan_id, policy_number, member_id,
       valid_from, valid_to, relationship, holder_name)
     VALUES (@id, @patientId, @priority, @payerId, @tpaId, @networkId, @planId, @policyNumber, @memberId,
       @validFrom, @validTo, @relationship, @holderName)
     ON CONFLICT(id) DO UPDATE SET priority = excluded.priority, payer_id = excluded.payer_id, tpa_id = excluded.tpa_id,
       network_id = excluded.network_id, plan_id = excluded.plan_id, policy_number = excluded.policy_number,
       member_id = excluded.member_id, valid_from = excluded.valid_from, valid_to = excluded.valid_to,
       relationship = excluded.relationship, holder_name = excluded.holder_name`,
  );
  coverages.forEach((c) => ins.run({ ...c, patientId, tpaId: n(c.tpaId), holderName: n(c.holderName) }));
}

export function insertPatient(db: DB, p: Patient) {
  db.prepare(
    `INSERT INTO patients (id, mrn, first_name, middle_name, last_name, dob, gender, phone, alt_phone, email, national_id,
       nationality, blood_group, preferred_language, address, city, emergency_name, emergency_phone, allergies, vip,
       unidentified, created_at)
     VALUES (@id, @mrn, @firstName, @middleName, @lastName, @dob, @gender, @phone, @altPhone, @email, @nationalId,
       @nationality, @bloodGroup, @preferredLanguage, @address, @city, @emergencyName, @emergencyPhone, @allergies, @vip,
       @unidentified, @createdAt)`,
  ).run(patientParams(p));
  writeCoverages(db, p.id, p.coverages);
}

export function updatePatientRow(db: DB, p: Patient, removedCoverageIds: string[]) {
  db.prepare(
    `UPDATE patients SET first_name = @firstName, middle_name = @middleName, last_name = @lastName, dob = @dob,
       gender = @gender, phone = @phone, alt_phone = @altPhone, email = @email, national_id = @nationalId,
       nationality = @nationality, blood_group = @bloodGroup, preferred_language = @preferredLanguage, address = @address,
       city = @city, emergency_name = @emergencyName, emergency_phone = @emergencyPhone, allergies = @allergies,
       vip = @vip, unidentified = @unidentified
     WHERE id = @id`,
  ).run(patientParams(p));
  const del = db.prepare("DELETE FROM coverages WHERE id = ? AND patient_id = ?");
  removedCoverageIds.forEach((id) => del.run(id, p.id));
  writeCoverages(db, p.id, p.coverages);
}

const patientParams = (p: Patient) => ({
  id: p.id, mrn: p.mrn, firstName: p.firstName, middleName: n(p.middleName), lastName: p.lastName, dob: p.dob,
  gender: p.gender, phone: p.phone, altPhone: n(p.altPhone), email: n(p.email), nationalId: n(p.nationalId),
  nationality: n(p.nationality), bloodGroup: n(p.bloodGroup), preferredLanguage: n(p.preferredLanguage),
  address: n(p.address), city: n(p.city), emergencyName: n(p.emergencyName), emergencyPhone: n(p.emergencyPhone),
  allergies: n(p.allergies), vip: b(p.vip) ?? 0, unidentified: b(p.unidentified) ?? 0, createdAt: p.createdAt,
});

export function insertEpisode(db: DB, e: Episode) {
  db.prepare(
    `INSERT INTO episodes (id, code, patient_id, title, kind, status, department_id, practitioner_id, start_date, end_date, notes)
     VALUES (@id, @code, @patientId, @title, @kind, @status, @departmentId, @practitionerId, @startDate, @endDate, @notes)`,
  ).run({ ...e, practitionerId: n(e.practitionerId), endDate: n(e.endDate), notes: n(e.notes) });
}

function writeComplaints(db: DB, table: "case_complaints" | "encounter_complaints", ownerCol: string, ownerId: string, list: ComplaintEntry[]) {
  db.prepare(`DELETE FROM ${table} WHERE ${ownerCol} = ?`).run(ownerId);
  const ins = db.prepare(`INSERT INTO ${table} (${ownerCol}, seq, complaint_code, label, duration, unit) VALUES (?, ?, ?, ?, ?, ?)`);
  list.forEach((c, i) => ins.run(ownerId, i, c.code, c.label, n(c.duration), n(c.unit)));
}

export function insertCase(db: DB, c: Case) {
  db.prepare(
    `INSERT INTO cases (id, code, patient_id, episode_id, title, department_id, status, opened_at, closed_at,
       provisional_diagnosis, medico_legal, mlc_number, police_station)
     VALUES (@id, @code, @patientId, @episodeId, @title, @departmentId, @status, @openedAt, @closedAt,
       @provisionalDiagnosis, @medicoLegal, @mlcNumber, @policeStation)`,
  ).run({
    ...c, closedAt: n(c.closedAt), provisionalDiagnosis: n(c.provisionalDiagnosis), medicoLegal: b(c.medicoLegal),
    mlcNumber: n(c.mlcNumber), policeStation: n(c.policeStation),
  });
  writeComplaints(db, "case_complaints", "case_id", c.id, c.complaints);
}

export function insertEncounter(db: DB, e: Encounter) {
  db.prepare(
    `INSERT INTO encounters (id, code, patient_id, episode_id, case_id, type, start_type, status, priority, start_at, end_at,
       department_id, practitioner_id, chief_complaint, counter_id, admission_request_id, brought_by, brought_by_phone,
       parent_encounter_id, follow_up_derived, follow_up_chargeable, billing_mode, auth_number, corporate_name, ward_id,
       bed_code, admission_reason, expected_stay_days, tele_channel, tele_link, visit_address, visit_team,
       referring_facility, referring_doctor, referral_note, triage, package_id, created_at)
     VALUES (@id, @code, @patientId, @episodeId, @caseId, @type, @startType, @status, @priority, @start, @end,
       @departmentId, @practitionerId, @chiefComplaint, @counterId, @admissionRequestId, @broughtBy, @broughtByPhone,
       @parentEncounterId, @followUpDerived, @followUpChargeable, @billingMode, @authNumber, @corporateName, @wardId,
       @bed, @admissionReason, @expectedStayDays, @teleChannel, @teleLink, @visitAddress, @visitTeam,
       @referringFacility, @referringDoctor, @referralNote, @triage, @packageId, @createdAt)`,
  ).run({
    id: e.id, code: e.code, patientId: e.patientId, episodeId: e.episodeId, caseId: e.caseId, type: e.type,
    startType: e.startType, status: e.status, priority: e.priority, start: e.start, end: n(e.end),
    departmentId: e.departmentId, practitionerId: n(e.practitionerId), chiefComplaint: n(e.chiefComplaint),
    counterId: n(e.counterId), admissionRequestId: n(e.admissionRequestId), broughtBy: n(e.broughtBy),
    broughtByPhone: n(e.broughtByPhone), parentEncounterId: n(e.parentEncounterId), followUpDerived: b(e.followUpDerived),
    followUpChargeable: b(e.followUpChargeable), billingMode: e.billingMode, authNumber: n(e.authNumber),
    corporateName: n(e.corporateName), wardId: n(e.wardId), bed: n(e.bed), admissionReason: n(e.admissionReason),
    expectedStayDays: n(e.expectedStayDays), teleChannel: n(e.teleChannel), teleLink: n(e.teleLink),
    visitAddress: n(e.visitAddress), visitTeam: n(e.visitTeam), referringFacility: n(e.referringFacility),
    referringDoctor: n(e.referringDoctor), referralNote: n(e.referralNote), triage: n(e.triage), packageId: n(e.packageId),
    createdAt: e.createdAt,
  });
  writeComplaints(db, "encounter_complaints", "encounter_id", e.id, e.complaints ?? []);
  const cov = db.prepare("INSERT INTO encounter_coverages (encounter_id, seq, coverage_id) VALUES (?, ?, ?)");
  e.coverageIds.forEach((c, i) => cov.run(e.id, i, c));
  const svc = db.prepare("INSERT INTO encounter_services (encounter_id, seq, service) VALUES (?, ?, ?)");
  (e.services ?? []).forEach((s, i) => svc.run(e.id, i, s));
}

export function writeAdmissionRequest(db: DB, r: AdmissionRequest) {
  db.prepare(
    `INSERT INTO admission_requests (id, code, patient_id, case_id, episode_id, source_encounter_id, requested_by_id,
       admitting_department_id, admitting_practitioner_id, urgency, planned_date, expected_stay_days, bed_category,
       isolation, reason, planned_procedure, billing_mode, coverage_id, auth_status, auth_number, estimated_cost,
       deposit_collected, notes, status, admitted_encounter_id, cancel_reason, created_at, updated_at)
     VALUES (@id, @code, @patientId, @caseId, @episodeId, @sourceEncounterId, @requestedById, @admittingDepartmentId,
       @admittingPractitionerId, @urgency, @plannedDate, @expectedStayDays, @bedCategory, @isolation, @reason,
       @plannedProcedure, @billingMode, @coverageId, @authStatus, @authNumber, @estimatedCost, @depositCollected, @notes,
       @status, @admittedEncounterId, @cancelReason, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET admitting_department_id = excluded.admitting_department_id,
       admitting_practitioner_id = excluded.admitting_practitioner_id, urgency = excluded.urgency,
       planned_date = excluded.planned_date, expected_stay_days = excluded.expected_stay_days,
       bed_category = excluded.bed_category, isolation = excluded.isolation, reason = excluded.reason,
       planned_procedure = excluded.planned_procedure, billing_mode = excluded.billing_mode,
       coverage_id = excluded.coverage_id, auth_status = excluded.auth_status, auth_number = excluded.auth_number,
       estimated_cost = excluded.estimated_cost, deposit_collected = excluded.deposit_collected, notes = excluded.notes,
       status = excluded.status, admitted_encounter_id = excluded.admitted_encounter_id,
       cancel_reason = excluded.cancel_reason, updated_at = excluded.updated_at`,
  ).run({
    ...r, sourceEncounterId: n(r.sourceEncounterId), plannedProcedure: n(r.plannedProcedure), coverageId: n(r.coverageId),
    authNumber: n(r.authNumber), estimatedCost: n(r.estimatedCost), depositCollected: b(r.depositCollected) ?? 0,
    notes: n(r.notes), admittedEncounterId: n(r.admittedEncounterId), cancelReason: n(r.cancelReason),
  });
  db.prepare("DELETE FROM admission_request_needs WHERE request_id = ?").run(r.id);
  const ins = db.prepare("INSERT INTO admission_request_needs (request_id, seq, need) VALUES (?, ?, ?)");
  r.specialNeeds.forEach((x, i) => ins.run(r.id, i, x));
}

export function audit(db: DB, entity: string, entityId: string, action: string, detail?: unknown, counterId?: string) {
  db.prepare("INSERT INTO audit_log (at, entity, entity_id, action, counter_id, detail, actor_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    new Date().toISOString(), entity, entityId, action, n(counterId), detail === undefined ? null : JSON.stringify(detail), globalThis.__accessHostActor?.hostId ?? null,
  );
}
