import "server-only";
import { randomUUID } from "node:crypto";
import { computeRequestStatus, pendingReason } from "@/lib/admission";
import { COMPLAINT_REQUIRED, encounterType, START_TYPES } from "@/lib/encounter-config";
import { deriveFollowUp } from "@/lib/followup";
import {
  complaint, counter, department, healthPackage, masterLoaded, network, payer, plan, practitioner, setMasterData, SERVICES, ward,
  type MasterData,
} from "@/lib/master-data";
import type { PatientFilters } from "@/lib/search";
import type {
  AdmissionRequest, AuthStatus, Case, Changes, ComplaintEntry, Coverage, Encounter, EncounterStatus, Episode, Patient,
} from "@/lib/types";
import { coverageActive } from "@/lib/utils";
import { getDb, recreateSchema, type DB } from "./db";
import { conflict, invalid, notFound } from "./errors";
import {
  audit, insertCase, insertEncounter, insertEpisode, insertPatient, loadAdmissionRequests, loadAll, loadCases,
  loadEncounters, loadEpisodes, loadMaster, loadPatients, nextNumber, updatePatientRow, writeAdmissionRequest,
} from "./repo";
import {
  admissionActionSchema, admissionRequestSchema, caseStatusSchema, encounterSchema, encounterStatusSchema, episodeSchema,
  episodeStatusSchema, patientPatchSchema, patientSchema, type AdmissionRequestInput, type CaseChoice, type PatientInput,
} from "@/lib/contract";
import { isSeeded, seedDatabase } from "./seed";

// ─── Setup ───

function ready(): DB {
  const db = getDb();
  if (!isSeeded(db)) {
    if (!globalThis.__accessAllowSeed) throw new Error("Existing MedBand database cannot be reseeded.");
    seedDatabase(db);
  }
  if (!masterLoaded()) setMasterData(loadMaster(db));
  return db;
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${randomUUID().slice(0, 12)}`;

export function getMaster(): MasterData {
  return loadMaster(ready());
}

export function bootstrap() {
  const db = ready();
  return { master: loadMaster(db), data: loadAll(db) };
}

export function resetDemo() {
  const db = getDb();
  recreateSchema(db);
  seedDatabase(db);
  setMasterData(loadMaster(db));
  return bootstrap();
}

const one = <T,>(list: T[], what: string) => {
  if (!list[0]) throw notFound(what);
  return list[0];
};

// ─── Patients ───

function validateCoverages(coverages: Coverage[]) {
  const seen = new Set<string>();
  coverages.forEach((c, i) => {
    const f = (name: string) => `coverages.${i}.${name}`;
    if (seen.has(c.priority)) throw invalid(`Only one ${c.priority.toLowerCase()} coverage is allowed.`, f("priority"));
    seen.add(c.priority);
    const py = payer(c.payerId);
    if (!py) throw invalid("Unknown insurer.", f("payerId"));
    const net = plan(c.planId);
    if (!net || net.networkId !== c.networkId) throw invalid("The plan does not belong to the chosen network.", f("planId"));
    const nw = network(c.networkId);
    if (!nw || nw.payerId !== c.payerId) throw invalid("The network does not belong to the chosen insurer.", f("networkId"));
    if (py.tpaRequired && !c.tpaId) throw invalid(`${py.short} claims go through a TPA. Choose one.`, f("tpaId"));
    if (c.tpaId && !py.tpaIds.includes(c.tpaId)) throw invalid(`${py.short} does not work with that TPA.`, f("tpaId"));
    if (c.validTo < c.validFrom) throw invalid("Coverage ends before it starts.", f("validTo"));
  });
}

function checkDuplicateId(db: DB, nationalId: string | undefined, exceptId?: string) {
  if (!nationalId) return;
  const row = db.prepare("SELECT mrn FROM patients WHERE national_id = ? AND id != ?").get(nationalId, exceptId ?? "") as { mrn: string } | undefined;
  if (row) throw conflict(`National ID ${nationalId} is already registered to ${row.mrn}.`, "nationalId");
}

export function registerPatient(body: unknown): Changes & { patientId: string } {
  const db = ready();
  const input: PatientInput = patientSchema.parse(body);
  validateCoverages(input.coverages as Coverage[]);
  if (!input.unidentified && !input.phone) throw invalid("A phone number is required.", "phone");
  checkDuplicateId(db, input.nationalId);
  const patient = db.transaction(() => {
    const p: Patient = { ...input, coverages: input.coverages as Coverage[], id: id("pat"), mrn: `MRN-${nextNumber(db, "mrn")}`, createdAt: now() };
    insertPatient(db, p);
    audit(db, "patient", p.id, "registered", { mrn: p.mrn, unidentified: !!p.unidentified });
    return p;
  })();
  return { patientId: patient.id, patients: loadPatients(db, [patient.id]) };
}

export function updatePatient(patientId: string, body: unknown): Changes {
  const db = ready();
  const current = one(loadPatients(db, [patientId]), "Patient");
  const patch = patientPatchSchema.parse(body);
  const next: Patient = { ...current, ...patch, coverages: (patch.coverages as Coverage[] | undefined) ?? current.coverages };
  validateCoverages(next.coverages);
  checkDuplicateId(db, next.nationalId, patientId);

  const keep = new Set(next.coverages.map((c) => c.id));
  const removed = current.coverages.filter((c) => !keep.has(c.id)).map((c) => c.id);
  const billed = removed.filter((cid) => db.prepare("SELECT 1 FROM encounter_coverages WHERE coverage_id = ? UNION SELECT 1 FROM admission_requests WHERE coverage_id = ?").get(cid, cid));
  if (billed.length) {
    throw conflict("A coverage you removed has already been billed. Keep it and set its end date instead.", "coverages");
  }
  db.transaction(() => {
    updatePatientRow(db, next, removed);
    audit(db, "patient", patientId, "updated", { fields: Object.keys(patch) });
  })();
  return { patients: loadPatients(db, [patientId]) };
}

/** Server-side patient search. Insurance criteria must match on the same coverage row. */
export function searchPatients(f: PatientFilters): Patient[] {
  const db = ready();
  const where: string[] = [];
  const args: unknown[] = [];
  const inList = (col: string, values: string[]) => `${col} IN (${values.map(() => "?").join(",")})`;
  const like = (v: string) => `%${v.toLowerCase().replace(/[\s\-()+]/g, "")}%`;
  const norm = (col: string) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(COALESCE(${col}, '')), ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')`;

  if (f.text.trim()) {
    const q = like(f.text);
    where.push(`(${norm("p.first_name || p.last_name")} LIKE ? OR ${norm("p.first_name || COALESCE(p.middle_name, '') || p.last_name")} LIKE ?
      OR ${norm("p.mrn")} LIKE ? OR ${norm("p.phone")} LIKE ? OR ${norm("p.national_id")} LIKE ? OR ${norm("p.email")} LIKE ?
      OR EXISTS (SELECT 1 FROM coverages c WHERE c.patient_id = p.id AND (${norm("c.member_id")} LIKE ? OR ${norm("c.policy_number")} LIKE ?)))`);
    args.push(q, q, q, q, q, q, q, q);
  }
  if (f.dob) (where.push("p.dob = ?"), args.push(f.dob));
  if (f.gender) (where.push("p.gender = ?"), args.push(f.gender));
  if (f.city) (where.push(`${norm("p.city")} LIKE ?`), args.push(like(f.city)));
  if (f.coverageKind === "insured") where.push("EXISTS (SELECT 1 FROM coverages c WHERE c.patient_id = p.id)");
  if (f.coverageKind === "self-pay") where.push("NOT EXISTS (SELECT 1 FROM coverages c WHERE c.patient_id = p.id)");

  const cov: string[] = [];
  if (f.payerIds.length) (cov.push(inList("c.payer_id", f.payerIds)), args.push(...f.payerIds));
  if (f.tpaIds.length) (cov.push(inList("c.tpa_id", f.tpaIds)), args.push(...f.tpaIds));
  if (f.networkIds.length) (cov.push(inList("c.network_id", f.networkIds)), args.push(...f.networkIds));
  if (f.planIds.length) (cov.push(inList("c.plan_id", f.planIds)), args.push(...f.planIds));
  if (f.memberOrPolicy.trim()) {
    cov.push(`(${norm("c.member_id")} LIKE ? OR ${norm("c.policy_number")} LIKE ?)`);
    args.push(like(f.memberOrPolicy), like(f.memberOrPolicy));
  }
  const today = new Date().toISOString().slice(0, 10);
  if (f.coverageStatus === "active") (cov.push("c.valid_from <= ? AND c.valid_to >= ?"), args.push(today, today));
  if (f.coverageStatus === "expired") (cov.push("(c.valid_from > ? OR c.valid_to < ?)"), args.push(today, today));
  if (cov.length) where.push(`EXISTS (SELECT 1 FROM coverages c WHERE c.patient_id = p.id AND ${cov.join(" AND ")})`);

  const enc: string[] = [];
  if (f.encounterTypes.length) (enc.push(inList("e.type", f.encounterTypes)), args.push(...f.encounterTypes));
  if (f.departmentId) (enc.push("e.department_id = ?"), args.push(f.departmentId));
  if (enc.length) where.push(`EXISTS (SELECT 1 FROM encounters e WHERE e.patient_id = p.id AND ${enc.join(" AND ")})`);
  if (f.openEpisode) where.push("EXISTS (SELECT 1 FROM episodes ep WHERE ep.patient_id = p.id AND ep.status = 'Active')");

  const sql = `SELECT p.id FROM patients p${where.length ? ` WHERE ${where.join(" AND ")}` : ""} LIMIT 500`;
  const ids = (db.prepare(sql).all(...args) as Array<{ id: string }>).map((r) => r.id);
  return loadPatients(db, ids);
}

// ─── Episodes and cases ───

export function createEpisode(body: unknown): Changes {
  const db = ready();
  const input = episodeSchema.parse(body);
  one(loadPatients(db, [input.patientId]), "Patient");
  if (!department(input.departmentId)) throw invalid("Unknown department.", "departmentId");
  const ep = db.transaction(() => {
    const e: Episode = { ...input, id: id("ep"), code: `EP-${nextNumber(db, "episode")}`, status: "Active", startDate: now() };
    insertEpisode(db, e);
    audit(db, "episode", e.id, "opened");
    return e;
  })();
  return { episodes: [ep] };
}

export function setEpisodeStatus(episodeId: string, body: unknown): Changes {
  const db = ready();
  const { status } = episodeStatusSchema.parse(body);
  const ep = one(loadEpisodes(db, [episodeId]), "Episode");
  const changedCases: string[] = [];
  db.transaction(() => {
    db.prepare("UPDATE episodes SET status = ?, end_date = ? WHERE id = ?").run(status, status === "Closed" ? now() : null, episodeId);
    if (status === "Closed") {
      // Closing an episode closes its open cases.
      const open = db.prepare("SELECT id FROM cases WHERE episode_id = ? AND status = 'Open'").all(episodeId) as Array<{ id: string }>;
      open.forEach((c) => changedCases.push(c.id));
      db.prepare("UPDATE cases SET status = 'Closed', closed_at = ? WHERE episode_id = ? AND status = 'Open'").run(now(), episodeId);
    }
    audit(db, "episode", ep.id, `status:${status}`);
  })();
  return { episodes: loadEpisodes(db, [episodeId]), cases: loadCases(db, changedCases) };
}

export function setCaseStatus(caseId: string, body: unknown): Changes {
  const db = ready();
  const { status, provisionalDiagnosis } = caseStatusSchema.parse(body);
  const c = one(loadCases(db, [caseId]), "Case");
  if (status === "Closed") {
    const open = db.prepare("SELECT code FROM encounters WHERE case_id = ? AND status IN ('Planned','Arrived','In progress')").get(caseId) as { code: string } | undefined;
    if (open) throw conflict(`${open.code} is still open. Complete or cancel it before closing the case.`);
  }
  const episodeChanged: string[] = [];
  db.transaction(() => {
    db.prepare("UPDATE cases SET status = ?, closed_at = ?, provisional_diagnosis = COALESCE(?, provisional_diagnosis) WHERE id = ?").run(
      status, status === "Closed" ? now() : null, provisionalDiagnosis ?? null, caseId,
    );
    if (status === "Open") {
      const ep = loadEpisodes(db, [c.episodeId])[0];
      if (ep && ep.status !== "Active") {
        db.prepare("UPDATE episodes SET status = 'Active', end_date = NULL WHERE id = ?").run(ep.id);
        episodeChanged.push(ep.id);
      }
    }
    audit(db, "case", caseId, `status:${status}`);
  })();
  return { cases: loadCases(db, [caseId]), episodes: loadEpisodes(db, episodeChanged) };
}

function validateComplaints(list: ComplaintEntry[], field = "complaints") {
  list.forEach((c, i) => {
    const m = complaint(c.code);
    if (!m) throw invalid(`Unknown complaint code ${c.code}.`, `${field}.${i}`);
    if (c.code !== "CC-OTH" && c.label !== m.label) c.label = m.label;
    if (c.duration && !c.unit) throw invalid("Give a unit for the complaint duration.", `${field}.${i}.unit`);
  });
  const codes = list.filter((c) => c.code !== "CC-OTH").map((c) => c.code);
  if (new Set(codes).size !== codes.length) throw invalid("The same complaint is listed twice.", field);
}

/**
 * Resolves the case an encounter or admission request belongs to, creating the
 * case (and its episode) when asked. Returns ids of anything it created or reopened.
 */
function resolveCase(
  db: DB,
  patientId: string,
  choice: CaseChoice | undefined,
  ctx: { departmentId: string; practitionerId?: string; complaints: ComplaintEntry[]; startedAt: string; medicoLegalRequired?: boolean },
): { kase: Case; created: { episodes: string[]; cases: string[] } } {
  const created = { episodes: [] as string[], cases: [] as string[] };
  if (!choice) throw invalid("Choose the case this belongs to, or open a new one.", "case");

  if (choice.mode === "existing") {
    const kase = loadCases(db, [choice.caseId])[0];
    if (!kase || kase.patientId !== patientId) throw invalid("That case does not belong to this patient.", "case");
    if (kase.status === "Closed") throw invalid(`${kase.code} is closed. Reopen it from the patient record or open a new case.`, "case");
    if (ctx.medicoLegalRequired && !kase.medicoLegal) throw invalid("A police case must be recorded on a medico-legal case.", "case");
    return { kase, created };
  }

  if (!ctx.complaints.length) throw invalid("Select the chief complaint to open a new case.", "complaints");
  if (ctx.medicoLegalRequired && !choice.medicoLegal) throw invalid("Mark the case as medico-legal for a police case.", "case.medicoLegal");
  if (choice.medicoLegal && !choice.mlcNumber) throw invalid("Enter the medico-legal case number.", "case.mlcNumber");

  let episodeId: string;
  if (choice.episode.mode === "existing") {
    const ep = loadEpisodes(db, [choice.episode.episodeId])[0];
    if (!ep || ep.patientId !== patientId) throw invalid("That episode does not belong to this patient.", "case.episode");
    if (ep.status === "Closed") throw invalid(`${ep.code} is closed. Choose another episode or start a new one.`, "case.episode");
    if (ep.status === "On hold") {
      db.prepare("UPDATE episodes SET status = 'Active' WHERE id = ?").run(ep.id);
      created.episodes.push(ep.id);
    }
    episodeId = ep.id;
  } else {
    const ep: Episode = {
      id: id("ep"), code: `EP-${nextNumber(db, "episode")}`, patientId, title: choice.episode.title, kind: choice.episode.kind,
      status: "Active", departmentId: ctx.departmentId, practitionerId: ctx.practitionerId, startDate: ctx.startedAt,
    };
    insertEpisode(db, ep);
    audit(db, "episode", ep.id, "opened");
    created.episodes.push(ep.id);
    episodeId = ep.id;
  }

  const kase: Case = {
    id: id("cs"), code: `CS-${nextNumber(db, "case")}`, patientId, episodeId,
    title: choice.title || ctx.complaints.map((c) => c.label).slice(0, 2).join(" and "),
    complaints: ctx.complaints, departmentId: ctx.departmentId, status: "Open", openedAt: ctx.startedAt,
    provisionalDiagnosis: choice.provisionalDiagnosis, medicoLegal: choice.medicoLegal,
    mlcNumber: choice.medicoLegal ? choice.mlcNumber : undefined, policeStation: choice.medicoLegal ? choice.policeStation : undefined,
  };
  insertCase(db, kase);
  audit(db, "case", kase.id, "opened", { medicoLegal: kase.medicoLegal });
  created.cases.push(kase.id);
  return { kase, created };
}

// ─── Encounters ───


const OPEN: EncounterStatus[] = ["Planned", "Arrived", "In progress"];

function openAdmission(db: DB, patientId: string) {
  return db.prepare("SELECT code, bed_code FROM encounters WHERE patient_id = ? AND type = 'IP' AND status IN ('Planned','Arrived','In progress')").get(patientId) as
    | { code: string; bed_code: string | null }
    | undefined;
}

function bedTaken(db: DB, bed: string) {
  return db.prepare("SELECT code FROM encounters WHERE bed_code = ? AND status IN ('Planned','Arrived','In progress')").get(bed) as { code: string } | undefined;
}

function checkCoverage(p: Patient, coverageIds: string[], type: string, at: Date) {
  if (!coverageIds.length) throw invalid("Select a coverage, or bill as self pay.", "coverageIds");
  coverageIds.forEach((cid) => {
    const c = p.coverages.find((x) => x.id === cid);
    if (!c) throw invalid("That coverage does not belong to this patient.", "coverageIds");
    const pl = plan(c.planId);
    if (!coverageActive(c, at)) throw invalid(`${payer(c.payerId)?.short} coverage is not active on that date.`, "coverageIds");
    if ((type === "IP" || type === "DAY_CARE") && !pl?.ipCovered) throw invalid(`${pl?.name} does not cover admissions.`, "coverageIds");
    if (type === "TELE" && !pl?.teleCovered) throw invalid(`${pl?.name} does not cover teleconsultation.`, "coverageIds");
  });
}

export function createEncounter(body: unknown): Changes & { encounterId: string } {
  const db = ready();
  const input = encounterSchema.parse(body);
  const t = encounterType(input.type);
  const desk = counter(input.counterId);
  if (!desk) throw invalid("Unknown counter.", "counterId");
  if (!desk.encounterTypes.includes(input.type)) {
    throw invalid(`${t.label} encounters are not opened at ${desk.name}.`, "type");
  }
  const patient = one(loadPatients(db, [input.patientId]), "Patient");
  if (!t.startTypes.includes(input.startType)) throw invalid(`${START_TYPES[input.startType].label} is not a valid start for ${t.label}.`, "startType");

  const dept = department(input.departmentId);
  if (!dept) throw invalid("Unknown department.", "departmentId");
  if (input.type !== "NO_CONSULT" && input.type !== "OUTSIDE" && !dept.consults) throw invalid(`${dept.name} does not take consultations.`, "departmentId");
  const prac = practitioner(input.practitionerId);
  if (t.needsPractitioner && !prac) throw invalid("Choose the clinician.", "practitionerId");
  if (prac && prac.departmentId !== dept.id) throw invalid(`${prac.name} is not in ${dept.name}.`, "practitionerId");
  if (t.needsTele && prac && !prac.tele) throw invalid(`${prac.name} does not take teleconsultations.`, "practitionerId");

  validateComplaints(input.complaints);
  if (COMPLAINT_REQUIRED.includes(input.type) && !input.complaints.length) throw invalid("Select the chief complaint.", "complaints");

  const start = new Date(input.start);
  const encounters = loadEncounters(db).filter((e) => e.patientId === patient.id);

  // Type rules
  let parent: Encounter | undefined;
  let chargeable: boolean | undefined;
  let derived: boolean | undefined;
  if (input.type === "FOLLOW_UP") {
    parent = encounters.find((e) => e.id === input.parentEncounterId);
    if (!parent) throw invalid("Link the earlier visit this follows.", "parentEncounterId");
    if (!encounterType(parent.type).isConsultation || parent.status === "Cancelled") throw invalid("A follow-up must follow a consultation.", "parentEncounterId");
    if (new Date(parent.start) > start) throw invalid("A follow-up cannot be before the visit it follows.", "parentEncounterId");
    const fu = deriveFollowUp(encounters, { patientId: patient.id, departmentId: dept.id, practitionerId: prac?.id, at: start });
    derived = fu.parent?.id === parent.id;
    chargeable = !(derived && fu.state === "free");
  }

  let request: AdmissionRequest | undefined;
  if (input.type === "IP") {
    if (!input.admissionRequestId) throw invalid("Select the admission request this admission is for.", "admissionRequestId");
    request = loadAdmissionRequests(db, [input.admissionRequestId])[0];
    if (!request || request.patientId !== patient.id) throw invalid("That admission request is not for this patient.", "admissionRequestId");
    if (request.status === "Admitted") throw conflict(`${request.code} has already been admitted.`, "admissionRequestId");
    if (request.status === "Cancelled") throw invalid(`${request.code} was cancelled.`, "admissionRequestId");
    if (request.status === "Pending" && request.urgency !== "Emergency") {
      throw invalid(`${request.code} is not cleared yet: ${pendingReason(request)}.`, "admissionRequestId");
    }
    const already = openAdmission(db, patient.id);
    if (already) throw conflict(`Already admitted under ${already.code}${already.bed_code ? `, bed ${already.bed_code}` : ""}.`, "type");
    if (!input.admissionReason) input.admissionReason = request.reason;
  }

  if (t.needsBed) {
    const w = ward(input.wardId);
    if (!w) throw invalid("Choose a ward.", "wardId");
    if (input.type === "DAY_CARE" && w.category !== "Day care") throw invalid("Day care uses the Day Care Unit.", "wardId");
    if (input.type === "IP" && w.category === "Day care") throw invalid("Admit to an inpatient ward, not the day care unit.", "wardId");
    if (!input.bed || !w.beds.includes(input.bed)) throw invalid("Assign a bed in that ward.", "bed");
    const taken = bedTaken(db, input.bed);
    if (taken) throw conflict(`Bed ${input.bed} is occupied (${taken.code}).`, "bed");
  }
  if (t.needsTriage && !input.triage) throw invalid("Set the triage level.", "triage");
  if (t.needsTele && !input.teleLink) throw invalid("Create the call link.", "teleLink");
  if (t.needsAddress && !input.visitAddress) throw invalid("Enter the visit address.", "visitAddress");
  if (t.needsReferral && !input.referringFacility) throw invalid("Enter the referring facility.", "referringFacility");
  if (t.needsServices) {
    if (!input.services.length) throw invalid("Pick at least one service.", "services");
    input.services.forEach((s) => {
      if (!SERVICES.includes(s)) throw invalid(`Unknown service ${s}.`, "services");
    });
  }
  if (t.needsPackage && !healthPackage(input.packageId)) throw invalid("Choose a health check package.", "packageId");

  // Billing
  if (input.billingMode === "Insurance") {
    checkCoverage(patient, input.coverageIds, input.type, start);
    const authAllowedLater = request?.urgency === "Emergency";
    const auth = input.authNumber ?? request?.authNumber;
    if ((input.type === "IP" || input.type === "DAY_CARE") && !auth && !authAllowedLater) {
      throw invalid("Enter the pre-authorization number.", "authNumber");
    }
    input.authNumber = auth;
  }
  if (input.billingMode === "Corporate" && !input.corporateName) throw invalid("Enter the company name.", "corporateName");

  const future = start.getTime() - Date.now() > 15 * 60_000;
  const status: EncounterStatus = input.type === "IP" || input.type === "EMERGENCY" ? "In progress" : future ? "Planned" : "Arrived";

  const result = db.transaction(() => {
    // Case: a follow-up continues its parent's case, an admission continues its request's case.
    let kase: Case;
    let created = { episodes: [] as string[], cases: [] as string[] };
    if (parent) {
      kase = one(loadCases(db, [parent.caseId]), "Case");
      if (kase.status === "Closed") {
        db.prepare("UPDATE cases SET status = 'Open', closed_at = NULL WHERE id = ?").run(kase.id);
        created.cases.push(kase.id);
      }
    } else if (request) {
      kase = one(loadCases(db, [request.caseId]), "Case");
    } else {
      ({ kase, created } = resolveCase(db, patient.id, input.case, {
        departmentId: dept.id, practitionerId: prac?.id, complaints: input.complaints, startedAt: start.toISOString(),
        medicoLegalRequired: input.startType === "POLICE_CASE",
      }));
    }
    const ep = one(loadEpisodes(db, [kase.episodeId]), "Episode");
    if (ep.status === "On hold") {
      db.prepare("UPDATE episodes SET status = 'Active' WHERE id = ?").run(ep.id);
      created.episodes.push(ep.id);
    }

    const complaints = input.complaints.length ? input.complaints : undefined;
    const enc: Encounter = {
      id: id("enc"), code: `ENC-${nextNumber(db, "encounter")}`, patientId: patient.id, episodeId: kase.episodeId, caseId: kase.id,
      type: input.type, startType: input.startType, status, priority: input.priority, start: start.toISOString(),
      departmentId: dept.id, practitionerId: prac?.id,
      complaints, chiefComplaint: complaints?.map((c) => c.label).join(", ") ?? (input.type === "IP" ? input.admissionReason : undefined),
      counterId: desk.id, admissionRequestId: request?.id, broughtBy: input.broughtBy, broughtByPhone: input.broughtByPhone,
      parentEncounterId: parent?.id, followUpDerived: parent ? derived : undefined, followUpChargeable: parent ? chargeable : undefined,
      billingMode: input.billingMode, coverageIds: input.billingMode === "Insurance" ? input.coverageIds : [],
      authNumber: input.authNumber, corporateName: input.billingMode === "Corporate" ? input.corporateName : undefined,
      wardId: t.needsBed ? input.wardId : undefined, bed: t.needsBed ? input.bed : undefined,
      admissionReason: input.type === "IP" ? input.admissionReason : undefined,
      expectedStayDays: input.type === "IP" ? input.expectedStayDays ?? request?.expectedStayDays : undefined,
      teleChannel: t.needsTele ? input.teleChannel ?? "Video" : undefined, teleLink: t.needsTele ? input.teleLink : undefined,
      visitAddress: t.needsAddress ? input.visitAddress : undefined, visitTeam: t.needsAddress ? input.visitTeam : undefined,
      referringFacility: t.needsReferral ? input.referringFacility : undefined, referringDoctor: t.needsReferral ? input.referringDoctor : undefined,
      referralNote: t.needsReferral ? input.referralNote : undefined, services: t.needsServices ? input.services : undefined,
      triage: t.needsTriage ? input.triage : undefined, packageId: t.needsPackage ? input.packageId : undefined,
      createdAt: now(),
    };
    insertEncounter(db, enc);

    if (request) {
      writeAdmissionRequest(db, { ...request, status: "Admitted", admittedEncounterId: enc.id, updatedAt: now() });
      audit(db, "admission_request", request.id, "admitted", { encounter: enc.code, clearedBeforeAdmission: request.status === "Ready" }, desk.id);
    }
    audit(db, "encounter", enc.id, "created", { type: enc.type, startType: enc.startType, case: kase.code }, desk.id);
    return { enc, kase, created };
  })();

  return {
    encounterId: result.enc.id,
    encounters: loadEncounters(db, [result.enc.id]),
    cases: loadCases(db, [result.kase.id, ...result.created.cases]),
    episodes: loadEpisodes(db, [result.kase.episodeId, ...result.created.episodes]),
    admissionRequests: request ? loadAdmissionRequests(db, [request.id]) : [],
  };
}

const TRANSITIONS: Record<EncounterStatus, EncounterStatus[]> = {
  Planned: ["Arrived", "Cancelled"],
  Arrived: ["In progress", "Cancelled"],
  "In progress": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export function setEncounterStatus(encounterId: string, body: unknown): Changes {
  const db = ready();
  const { status, counterId } = encounterStatusSchema.parse(body);
  const enc = one(loadEncounters(db, [encounterId]), "Encounter");
  if (!TRANSITIONS[enc.status].includes(status)) throw invalid(`An encounter that is ${enc.status.toLowerCase()} cannot become ${status.toLowerCase()}.`, "status");
  const changedRequests: string[] = [];
  db.transaction(() => {
    db.prepare("UPDATE encounters SET status = ?, end_at = ? WHERE id = ?").run(status, status === "Completed" || status === "Cancelled" ? now() : enc.end ?? null, encounterId);
    // Cancelling an admission puts its request back in the admissions queue.
    if (enc.type === "IP" && status === "Cancelled" && enc.admissionRequestId) {
      const r = loadAdmissionRequests(db, [enc.admissionRequestId])[0];
      if (r) {
        writeAdmissionRequest(db, { ...r, admittedEncounterId: undefined, status: computeRequestStatus(r), updatedAt: now() });
        changedRequests.push(r.id);
      }
    }
    audit(db, "encounter", encounterId, `status:${status}`, undefined, counterId);
  })();
  return { encounters: loadEncounters(db, [encounterId]), admissionRequests: loadAdmissionRequests(db, changedRequests) };
}

// ─── Admission requests ───

export function createAdmissionRequest(body: unknown): Changes & { requestId: string } {
  const db = ready();
  const input: AdmissionRequestInput = admissionRequestSchema.parse(body);
  const patient = one(loadPatients(db, [input.patientId]), "Patient");
  const dept = department(input.admittingDepartmentId);
  if (!dept?.consults) throw invalid("Choose an admitting department that takes patients.", "admittingDepartmentId");
  const consultant = practitioner(input.admittingPractitionerId);
  if (!consultant || consultant.departmentId !== dept.id) throw invalid("The admitting consultant must belong to the admitting department.", "admittingPractitionerId");
  if (!practitioner(input.requestedById)) throw invalid("Unknown requesting clinician.", "requestedById");
  validateComplaints(input.complaints);

  const already = openAdmission(db, patient.id);
  if (already) throw conflict(`${fullNameOf(patient)} is already admitted under ${already.code}.`, "patientId");

  const planned = new Date(input.plannedDate);
  let coverageId: string | undefined;
  let authStatus: AuthStatus = "Not required";
  if (input.billingMode === "Insurance") {
    if (!input.coverageId) throw invalid("Choose the coverage for this admission.", "coverageId");
    checkCoverage(patient, [input.coverageId], "IP", planned);
    coverageId = input.coverageId;
    authStatus = input.authNumber ? "Approved" : "Pending";
  }

  let source: Encounter | undefined;
  if (input.sourceEncounterId) {
    source = loadEncounters(db, [input.sourceEncounterId])[0];
    if (!source || source.patientId !== patient.id) throw invalid("The requesting visit is not for this patient.", "sourceEncounterId");
  }

  const result = db.transaction(() => {
    let kase: Case;
    let created = { episodes: [] as string[], cases: [] as string[] };
    if (source) {
      kase = one(loadCases(db, [source.caseId]), "Case");
    } else {
      ({ kase, created } = resolveCase(db, patient.id, input.case, {
        departmentId: dept.id, practitionerId: consultant.id, complaints: input.complaints, startedAt: now(),
      }));
    }
    const dup = db.prepare("SELECT code FROM admission_requests WHERE case_id = ? AND status IN ('Pending','Ready')").get(kase.id) as { code: string } | undefined;
    if (dup) throw conflict(`${kase.code} already has an open admission request, ${dup.code}.`, "case");

    const base = {
      billingMode: input.billingMode, authStatus, depositCollected: input.billingMode === "Self pay" ? input.depositCollected : false,
    };
    const r: AdmissionRequest = {
      id: id("ar"), code: `AR-${nextNumber(db, "admission_request")}`, patientId: patient.id, caseId: kase.id, episodeId: kase.episodeId,
      sourceEncounterId: source?.id, requestedById: input.requestedById, admittingDepartmentId: dept.id,
      admittingPractitionerId: consultant.id, urgency: input.urgency, plannedDate: planned.toISOString(),
      expectedStayDays: input.expectedStayDays, bedCategory: input.bedCategory, isolation: input.isolation, reason: input.reason,
      plannedProcedure: input.plannedProcedure, specialNeeds: input.specialNeeds, coverageId, authNumber: input.authNumber,
      estimatedCost: input.estimatedCost, notes: input.notes, ...base, status: computeRequestStatus(base),
      createdAt: now(), updatedAt: now(),
    };
    writeAdmissionRequest(db, r);
    audit(db, "admission_request", r.id, "requested", { urgency: r.urgency, case: kase.code });
    return { r, kase, created };
  })();

  return {
    requestId: result.r.id,
    admissionRequests: loadAdmissionRequests(db, [result.r.id]),
    cases: loadCases(db, [result.kase.id, ...result.created.cases]),
    episodes: loadEpisodes(db, [result.kase.episodeId, ...result.created.episodes]),
  };
}

export function updateAdmissionRequest(requestId: string, body: unknown): Changes {
  const db = ready();
  const action = admissionActionSchema.parse(body);
  const r = one(loadAdmissionRequests(db, [requestId]), "Admission request");
  if (r.status === "Admitted" || r.status === "Cancelled") throw conflict(`${r.code} is ${r.status.toLowerCase()} and can no longer change.`);

  let next: AdmissionRequest = { ...r, updatedAt: now() };
  switch (action.action) {
    case "authorize":
      if (r.billingMode !== "Insurance") throw invalid("Only insurance admissions need pre-authorization.");
      if (action.decision === "Approved" && !action.authNumber) throw invalid("Enter the authorization number from the insurer.", "authNumber");
      next = { ...next, authStatus: action.decision, authNumber: action.decision === "Approved" ? action.authNumber : undefined };
      break;
    case "deposit":
      if (r.billingMode !== "Self pay") throw invalid("Deposits apply to self-pay admissions.");
      next = { ...next, depositCollected: true };
      break;
    case "reschedule":
      next = { ...next, plannedDate: new Date(action.plannedDate).toISOString() };
      break;
    case "cancel":
      next = { ...next, status: "Cancelled", cancelReason: action.reason };
      break;
  }
  if (next.status !== "Cancelled") next.status = computeRequestStatus(next);
  db.transaction(() => {
    writeAdmissionRequest(db, next);
    audit(db, "admission_request", r.id, action.action, action);
  })();
  return { admissionRequests: loadAdmissionRequests(db, [requestId]) };
}

const fullNameOf = (p: Patient) => [p.firstName, p.lastName].join(" ");

// ─── Reads for API consumers ───

export function getPatientRecord(patientId: string) {
  const db = ready();
  const patient = one(loadPatients(db, [patientId]), "Patient");
  const all = loadAll(db);
  return {
    patient,
    episodes: all.episodes.filter((e) => e.patientId === patientId),
    cases: all.cases.filter((c) => c.patientId === patientId),
    encounters: all.encounters.filter((e) => e.patientId === patientId),
    admissionRequests: all.admissionRequests.filter((r) => r.patientId === patientId),
  };
}

export function listEncounters(q: { patientId?: string; date?: string; status?: string; counterId?: string }) {
  const db = ready();
  return loadEncounters(db).filter(
    (e) =>
      (!q.patientId || e.patientId === q.patientId) &&
      (!q.date || e.start.slice(0, 10) === q.date) &&
      (!q.status || e.status === q.status) &&
      (!q.counterId || e.counterId === q.counterId),
  );
}

export function listAdmissionRequests(q: { status?: string }) {
  return loadAdmissionRequests(ready()).filter((r) => !q.status || r.status === q.status);
}

export function auditTrail(entity: string, entityId: string) {
  const db = ready();
  return db.prepare("SELECT at, action, counter_id AS counterId, detail, actor_id AS actorId FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY id DESC").all(entity, entityId);
}

export { OPEN as OPEN_STATUSES };
