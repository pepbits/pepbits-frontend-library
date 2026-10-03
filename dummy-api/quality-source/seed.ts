import fs from "node:fs";
import crypto from "node:crypto";
import { DB_PATH } from "./paths.js";

// Embedded first-run bootstrap: the worker has verified no initialized database exists.
// An existing source database is never reset by this initializer.
const { db, migrate, appendAudit } = await import("./db.js");
type AuditEntry = import("./db.js").AuditEntry;
const { hashPassword } = await import("./auth.js");
const { EVENT_DOMAINS, addMonths, lastCompleteMonth, monthsBetween, computeValue, monthKey } = await import("./domain.js");
const { recalculateFromEvents } = await import("./services/calc.js");
const { runValidation } = await import("./services/validation.js");
const { renderReport } = await import("./services/reports.js");
const { computeNextRun } = await import("./services/scheduler.js");

migrate();

// ---------- deterministic randomness ----------
let seedState = 20261001;
const rand = () => {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const normal = () => {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const lognormal = (median: number, spread = 0.45) => median * Math.exp(normal() * spread);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const chance = (p: number) => rand() < p;
const uuid = () => crypto.randomUUID();

const now = new Date();
const nowIso = now.toISOString();
const TZ = 4; // UAE, UTC+4
const lastMonth = lastCompleteMonth(now);
const periods = monthsBetween(addMonths(lastMonth, -11), lastMonth);
const eventMonths = periods.slice(-3);

console.log(`Seeding ${DB_PATH}\n  periods ${periods[0]} → ${lastMonth}; Event Pulse months ${eventMonths.join(", ")}`);

// ---------- facilities ----------
const facilities = [
  { code: "AVH-AUH", name: "AllyVora General Hospital", type: "hospital", city: "Abu Dhabi", jurisdiction: "Abu Dhabi", beds: 320, size: 1.0, perf: 0 },
  { code: "AVH-AAN", name: "AllyVora Hospital Al Ain", type: "hospital", city: "Al Ain", jurisdiction: "Abu Dhabi", beds: 180, size: 0.6, perf: -0.8 },
  { code: "AVC-KCA", name: "AllyVora Medical Center Khalifa City", type: "clinic", city: "Abu Dhabi", jurisdiction: "Abu Dhabi", beds: null, size: 0.5, perf: 0.3 },
  { code: "AVD-MUS", name: "AllyVora Dialysis Center Mussafah", type: "dialysis", city: "Abu Dhabi", jurisdiction: "Abu Dhabi", beds: null, size: 0.4, perf: 0.2 },
  { code: "AVH-DXB", name: "AllyVora Specialty Hospital Dubai", type: "hospital", city: "Dubai", jurisdiction: "Dubai", beds: 150, size: 0.55, perf: 0.6 },
];
const insFacility = db.prepare("INSERT INTO facilities (code, name, type, city, jurisdiction, beds) VALUES (?,?,?,?,?,?)");
const facilityIds = facilities.map((f) => Number(insFacility.run(f.code, f.name, f.type, f.city, f.jurisdiction, f.beds).lastInsertRowid));
const facilityById = new Map(facilities.map((f, i) => [facilityIds[i], f]));

// ---------- users ----------
const DEMO_PASSWORD = "Quality@2026";
const pw = hashPassword(DEMO_PASSWORD);
const users = [
  { name: "Sara Al Mansoori", email: "admin@allyvora.health", title: "Director of Quality Systems", role: "admin", facility: null },
  { name: "Omar Haddad", email: "quality@allyvora.health", title: "Group Quality Manager", role: "quality_manager", facility: null },
  { name: "Dr. Priya Nair", email: "verifier@allyvora.health", title: "Clinical Quality Reviewer", role: "verifier", facility: facilityIds[0] },
  { name: "Dr. Khalid Rahman", email: "approver@allyvora.health", title: "Chief Medical Officer", role: "approver", facility: null },
  { name: "Lina Farouk", email: "steward@allyvora.health", title: "Quality Data Steward", role: "data_steward", facility: facilityIds[0] },
  { name: "James Carter", email: "viewer@allyvora.health", title: "Board Member", role: "viewer", facility: null },
  { name: "Aisha Al Dhaheri", email: "aisha.dhaheri@allyvora.health", title: "Lab Quality Coordinator", role: "data_steward", facility: facilityIds[1] },
  { name: "Rahul Menon", email: "rahul.menon@allyvora.health", title: "Infection Prevention Lead", role: "verifier", facility: facilityIds[0] },
];
const insUser = db.prepare("INSERT INTO users (name, email, title, role, facility_id, status, password_hash, last_login_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)");
const userIds: Record<string, number> = {};
users.forEach((u, i) => {
  const status = i === 7 ? "inactive" : "active";
  const created = new Date(now.getTime() - (400 - i * 20) * 86400000).toISOString();
  userIds[u.role + (i > 5 ? i : "")] = Number(insUser.run(u.name, u.email, u.title, u.role, u.facility, status, pw, i < 6 ? new Date(now.getTime() - randInt(1, 72) * 3600000).toISOString() : null, created).lastInsertRowid);
});
const U = { admin: userIds.admin, qm: userIds.quality_manager, verifier: userIds.verifier, approver: userIds.approver, steward: userIds.data_steward, viewer: userIds.viewer };
const userName = new Map(users.map((u, i) => [i + 1, u.name]));

// ---------- authorities ----------
const authorities = [
  { code: "DOH", name: "Department of Health – Abu Dhabi", jurisdiction: "Abu Dhabi", channel: "portal_upload", endpoint: "JAWDA submission portal", contact: "quality.reporting@doh.example", programs: ["JAWDA"] },
  { code: "DHA", name: "Dubai Health Authority", jurisdiction: "Dubai", channel: "api", endpoint: "DHA quality reporting interface", contact: "indicators@dha.example", programs: ["DHA"] },
  { code: "MOHAP", name: "Ministry of Health and Prevention", jurisdiction: "UAE (federal)", channel: "email", endpoint: "Secure email", contact: "statistics@mohap.example", programs: ["Federal"] },
  { code: "JCI", name: "Joint Commission International", jurisdiction: "International", channel: "portal_upload", endpoint: "Accreditation evidence portal", contact: "accreditation@jci.example", programs: ["JCI"] },
  { code: "BOARD", name: "Board Quality & Safety Committee", jurisdiction: "Internal", channel: "email", endpoint: "board-quality@allyvora.health", contact: "board-quality@allyvora.health", programs: ["Internal"] },
];
const insAuth = db.prepare("INSERT INTO authorities (code, name, jurisdiction, channel, endpoint, contact_email, programs) VALUES (?,?,?,?,?,?,?)");
const authorityIds: Record<string, number> = {};
for (const a of authorities) authorityIds[a.code] = Number(insAuth.run(a.code, a.name, a.jurisdiction, a.channel, a.endpoint, a.contact, JSON.stringify(a.programs)).lastInsertRowid);

// ---------- TAT definitions ----------
const tatDefs = [
  { code: "LAB-TAT-STAT", name: "STAT lab order to result release", domain: "lab", start: "order_placed", end: "result_released", target: 60, filter: { priority: "STAT" }, d: "End-to-end turnaround for STAT laboratory orders." },
  { code: "LAB-TAT-RTN", name: "Routine lab order to result release", domain: "lab", start: "order_placed", end: "result_released", target: 240, filter: { priority: "routine" }, d: "End-to-end turnaround for routine laboratory orders." },
  { code: "LAB-COLL-RCV", name: "Sample collection to laboratory receipt", domain: "lab", start: "sample_collected", end: "sample_received", target: 30, filter: {}, d: "Transport time from collection point to the laboratory." },
  { code: "LAB-INLAB", name: "Laboratory receipt to verification", domain: "lab", start: "sample_received", end: "result_verified", target: 90, filter: {}, d: "In-laboratory processing time." },
  { code: "LAB-CRIT", name: "Critical result release to acknowledgement", domain: "lab", start: "result_released", end: "critical_acknowledged", target: 30, filter: { critical: true }, d: "Time for a responsible clinician to acknowledge a critical result." },
  { code: "RAD-CT-RPT", name: "CT order to signed report", domain: "radiology", start: "order_placed", end: "report_signed", target: 1440, filter: { modality: "CT" }, d: "CT examinations reported and signed within 24 hours." },
  { code: "RAD-EXAM-RPT", name: "Exam completion to signed report", domain: "radiology", start: "exam_completed", end: "report_signed", target: 720, filter: {}, d: "Reporting turnaround after the examination is complete." },
  { code: "ED-D2T", name: "ED arrival to triage", domain: "ed", start: "arrival", end: "triage", target: 10, filter: {}, d: "Door-to-triage time." },
  { code: "ED-D2P", name: "ED arrival to physician", domain: "ed", start: "arrival", end: "physician_seen", target: 30, filter: {}, d: "Door-to-physician time." },
  { code: "ED-LOS", name: "ED length of stay", domain: "ed", start: "arrival", end: "departed", target: 240, filter: {}, d: "Arrival to departure from the emergency department." },
  { code: "OPD-WAIT", name: "Outpatient check-in to consultation", domain: "outpatient", start: "check_in", end: "consultation_started", target: 30, filter: {}, d: "Waiting time to see the clinician." },
  { code: "PHR-STAT", name: "STAT medication order to dispensing", domain: "pharmacy", start: "order_received", end: "dispensed", target: 30, filter: { priority: "STAT" }, d: "STAT pharmacy turnaround." },
  { code: "PHR-RTN", name: "Routine medication order to dispensing", domain: "pharmacy", start: "order_received", end: "dispensed", target: 120, filter: { priority: "routine" }, d: "Routine pharmacy turnaround." },
];
const insTat = db.prepare("INSERT INTO tat_definitions (code, name, domain, start_event, end_event, target_minutes, filter, description) VALUES (?,?,?,?,?,?,?,?)");
const tatIds: Record<string, number> = {};
for (const t of tatDefs) tatIds[t.code] = Number(insTat.run(t.code, t.name, t.domain, t.start, t.end, t.target, JSON.stringify(t.filter), t.d).lastInsertRowid);

// ---------- indicators ----------
type Ind = {
  code: string; name: string; domain: string; program: string; category: string; unit: string; direction: "higher" | "lower";
  target: number; warning: number; num: string; den: string; excl?: string; types: string[]; tat?: string; base: number; sd: number; denRange: [number, number]; minSample?: number;
};
const HOSP = ["hospital"], HC = ["hospital", "clinic"], ALL = ["hospital", "clinic", "dialysis"];
const indicators: Ind[] = [
  { code: "OP-01", name: "Outpatient visits seen within 30 minutes", domain: "Access", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 85, warning: 75, num: "Visits where the consultation started within 30 minutes of check-in", den: "Completed outpatient visits with check-in and consultation start times", excl: "Phlebotomy-only and vaccination-only visits", types: HC, tat: "OPD-WAIT", base: 82, sd: 4, denRange: [600, 2400] },
  { code: "OP-02", name: "Mean outpatient waiting time", domain: "Access", program: "JAWDA", category: "operational", unit: "minutes", direction: "lower", target: 20, warning: 30, num: "Sum of minutes from check-in to consultation start", den: "Completed outpatient visits", types: HC, tat: "OPD-WAIT", base: 21, sd: 3, denRange: [600, 2400] },
  { code: "OP-03", name: "New-patient appointments available within 7 days", domain: "Access", program: "Internal", category: "operational", unit: "percent", direction: "higher", target: 80, warning: 70, num: "New-patient requests offered an appointment within 7 days", den: "New-patient appointment requests", types: HC, base: 77, sd: 5, denRange: [200, 700] },
  { code: "OP-04", name: "Outpatient no-show rate", domain: "Access", program: "Internal", category: "operational", unit: "percent", direction: "lower", target: 8, warning: 12, num: "Booked appointments not attended without cancellation", den: "Booked appointments", types: HC, base: 9, sd: 1.5, denRange: [800, 3000] },
  { code: "ED-01", name: "ED patients seen by a physician within 30 minutes", domain: "Emergency", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 80, warning: 70, num: "ED visits with physician assessment within 30 minutes of arrival", den: "ED visits with arrival and physician-seen times", excl: "Patients who left before triage", types: HOSP, tat: "ED-D2P", base: 78, sd: 4, denRange: [1500, 4000] },
  { code: "ED-02", name: "ED length of stay within 4 hours", domain: "Emergency", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 90, warning: 85, num: "ED visits departed within 4 hours of arrival", den: "ED visits with arrival and departure times", types: HOSP, tat: "ED-LOS", base: 88, sd: 3, denRange: [1500, 4000] },
  { code: "ED-03", name: "ED patients who left without being seen", domain: "Emergency", program: "JAWDA", category: "outcome", unit: "percent", direction: "lower", target: 2, warning: 3, num: "ED visits that left before physician assessment", den: "ED arrivals", types: HOSP, base: 2.1, sd: 0.5, denRange: [1500, 4000] },
  { code: "LAB-01", name: "STAT laboratory results released within 60 minutes", domain: "Laboratory", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 90, warning: 85, num: "STAT orders with result released within 60 minutes of order", den: "Completed STAT laboratory orders", excl: "Send-out tests and cancelled orders", types: HC, tat: "LAB-TAT-STAT", base: 88, sd: 3, denRange: [300, 900] },
  { code: "LAB-02", name: "Critical results acknowledged within 30 minutes", domain: "Laboratory", program: "JCI", category: "process", unit: "percent", direction: "higher", target: 95, warning: 90, num: "Critical results acknowledged by a responsible clinician within 30 minutes of release", den: "Critical results released", types: HOSP, tat: "LAB-CRIT", base: 93, sd: 3, denRange: [30, 90], minSample: 10 },
  { code: "LAB-03", name: "Laboratory specimen rejection rate", domain: "Laboratory", program: "Internal", category: "process", unit: "percent", direction: "lower", target: 2, warning: 3, num: "Specimens rejected (haemolysed, clotted, mislabelled, insufficient)", den: "Specimens received", types: ALL, base: 1.8, sd: 0.4, denRange: [3000, 9000] },
  { code: "RAD-01", name: "CT reports signed within 24 hours", domain: "Radiology", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 90, warning: 85, num: "CT examinations with a signed report within 24 hours of order", den: "Completed CT examinations", types: HOSP, tat: "RAD-CT-RPT", base: 91, sd: 3, denRange: [200, 700] },
  { code: "PS-01", name: "Inpatient falls with injury", domain: "Patient safety", program: "JAWDA", category: "outcome", unit: "per_1000", direction: "lower", target: 0.5, warning: 0.8, num: "Inpatient falls resulting in injury", den: "Inpatient days", types: HOSP, base: 0.45, sd: 0.15, denRange: [6000, 8000] },
  { code: "PS-02", name: "Hospital-acquired pressure injuries (stage 2+)", domain: "Patient safety", program: "JAWDA", category: "outcome", unit: "per_1000", direction: "lower", target: 1.0, warning: 1.5, num: "New stage 2 or higher pressure injuries after admission", den: "Inpatient days", types: HOSP, base: 0.95, sd: 0.25, denRange: [6000, 8000] },
  { code: "PS-03", name: "Medication errors reaching the patient", domain: "Patient safety", program: "Internal", category: "outcome", unit: "per_1000", direction: "lower", target: 0.3, warning: 0.5, num: "Medication errors that reached the patient", den: "Medication doses administered", types: HOSP, base: 0.26, sd: 0.08, denRange: [25000, 60000] },
  { code: "PS-04", name: "Correct patient identification compliance", domain: "Patient safety", program: "JCI", category: "process", unit: "percent", direction: "higher", target: 98, warning: 95, num: "Observed encounters using two patient identifiers", den: "Observed encounters audited", types: ALL, base: 97.5, sd: 1.2, denRange: [100, 300] },
  { code: "PS-05", name: "Hand hygiene compliance", domain: "Infection prevention", program: "JCI", category: "process", unit: "percent", direction: "higher", target: 90, warning: 85, num: "Observed hand hygiene opportunities performed correctly", den: "Observed hand hygiene opportunities", types: ALL, base: 88, sd: 3, denRange: [300, 900] },
  { code: "IC-01", name: "Central line-associated bloodstream infections", domain: "Infection prevention", program: "JAWDA", category: "outcome", unit: "per_1000", direction: "lower", target: 1.0, warning: 1.5, num: "CLABSI events meeting the surveillance definition", den: "Central-line days", types: HOSP, base: 0.9, sd: 0.4, denRange: [400, 1500] },
  { code: "IC-02", name: "Catheter-associated urinary tract infections", domain: "Infection prevention", program: "JAWDA", category: "outcome", unit: "per_1000", direction: "lower", target: 1.5, warning: 2.0, num: "CAUTI events meeting the surveillance definition", den: "Urinary catheter days", types: HOSP, base: 1.3, sd: 0.45, denRange: [500, 1800] },
  { code: "IC-03", name: "Surgical site infection rate", domain: "Infection prevention", program: "JAWDA", category: "outcome", unit: "percent", direction: "lower", target: 2, warning: 3, num: "Surgical site infections within the surveillance window", den: "Procedures under surveillance", types: HOSP, base: 1.6, sd: 0.5, denRange: [150, 500] },
  { code: "SUR-01", name: "Surgical safety checklist compliance", domain: "Surgery", program: "JCI", category: "process", unit: "percent", direction: "higher", target: 98, warning: 95, num: "Procedures with all checklist phases completed", den: "Surgical procedures performed", types: HOSP, base: 97.8, sd: 1, denRange: [200, 600] },
  { code: "SUR-02", name: "Prophylactic antibiotic within 60 minutes before incision", domain: "Surgery", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 95, warning: 90, num: "Eligible procedures with prophylaxis started 0–60 minutes before incision", den: "Eligible surgical procedures", types: HOSP, base: 94, sd: 2, denRange: [150, 500] },
  { code: "SUR-03", name: "Unplanned return to theatre within 48 hours", domain: "Surgery", program: "JAWDA", category: "outcome", unit: "percent", direction: "lower", target: 1, warning: 1.5, num: "Unplanned returns to theatre within 48 hours", den: "Surgical procedures performed", types: HOSP, base: 0.9, sd: 0.3, denRange: [200, 600] },
  { code: "MAT-01", name: "Primary caesarean section rate (NTSV)", domain: "Maternity", program: "JAWDA", category: "outcome", unit: "percent", direction: "lower", target: 25, warning: 30, num: "Nulliparous, term, singleton, vertex births by caesarean section", den: "Nulliparous, term, singleton, vertex births", types: HOSP, base: 27, sd: 2.5, denRange: [80, 250] },
  { code: "MAT-02", name: "Exclusive breastfeeding at discharge", domain: "Maternity", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 70, warning: 60, num: "Newborns exclusively breastfed at discharge", den: "Eligible newborns discharged", types: HOSP, base: 68, sd: 4, denRange: [80, 250] },
  { code: "DIA-01", name: "Haemodialysis adequacy (Kt/V ≥ 1.2)", domain: "Dialysis", program: "JAWDA", category: "outcome", unit: "percent", direction: "higher", target: 85, warning: 80, num: "Haemodialysis patients with Kt/V of at least 1.2", den: "Prevalent haemodialysis patients tested", types: ["dialysis"], base: 86, sd: 2.5, denRange: [180, 260] },
  { code: "DIA-02", name: "Arteriovenous fistula use", domain: "Dialysis", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 65, warning: 55, num: "Patients dialysed via arteriovenous fistula", den: "Prevalent haemodialysis patients", types: ["dialysis"], base: 62, sd: 3, denRange: [180, 260] },
  { code: "OUT-01", name: "30-day unplanned readmission rate", domain: "Outcomes", program: "JAWDA", category: "outcome", unit: "percent", direction: "lower", target: 8, warning: 10, num: "Discharges followed by an unplanned readmission within 30 days", den: "Eligible inpatient discharges", excl: "Planned readmissions, transfers and deaths", types: HOSP, base: 8.4, sd: 0.9, denRange: [800, 2200] },
  { code: "OUT-02", name: "Inpatient mortality (crude)", domain: "Outcomes", program: "Internal", category: "outcome", unit: "percent", direction: "lower", target: 2, warning: 2.5, num: "Inpatient deaths", den: "Inpatient discharges including deaths", excl: "Palliative care admissions", types: HOSP, base: 1.7, sd: 0.3, denRange: [900, 2500] },
  { code: "PX-01", name: "Patient experience top-box score", domain: "Patient experience", program: "JAWDA", category: "experience", unit: "percent", direction: "higher", target: 85, warning: 80, num: "Respondents rating overall care 9 or 10", den: "Survey respondents", types: ALL, base: 84, sd: 2.5, denRange: [300, 900] },
  { code: "PX-02", name: "Complaints resolved within 30 days", domain: "Patient experience", program: "Internal", category: "process", unit: "percent", direction: "higher", target: 90, warning: 80, num: "Complaints closed with a response within 30 days", den: "Complaints received", types: ALL, base: 88, sd: 5, denRange: [30, 90] },
  { code: "TH-01", name: "Telehealth consultations completed as scheduled", domain: "Telehealth", program: "JAWDA", category: "process", unit: "percent", direction: "higher", target: 95, warning: 90, num: "Telehealth consultations completed at the booked time", den: "Booked telehealth consultations", types: HC, base: 93, sd: 2, denRange: [150, 600] },
  { code: "PH-01", name: "STAT medications dispensed within 30 minutes", domain: "Pharmacy", program: "Internal", category: "process", unit: "percent", direction: "higher", target: 90, warning: 85, num: "STAT medication orders dispensed within 30 minutes", den: "STAT medication orders dispensed", types: HOSP, tat: "PHR-STAT", base: 89, sd: 3, denRange: [200, 600] },
];
const insInd = db.prepare(
  `INSERT INTO indicators (code, name, domain, program, category, unit, direction, target, warning, numerator_def, denominator_def, exclusions, frequency, facility_types, source, tat_definition_id, min_sample, owner_id, version, status, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'monthly',?,?,?,?,?,1,'active',?,?)`,
);
const created = new Date(now.getTime() - 420 * 86400000).toISOString();
const indIds: Record<string, number> = {};
for (const i of indicators) {
  const owner = i.domain === "Laboratory" ? U.steward : i.domain === "Infection prevention" ? userIds.verifier7 : U.qm;
  indIds[i.code] = Number(
    insInd.run(i.code, i.name, i.domain, i.program, i.category, i.unit, i.direction, i.target, i.warning, i.num, i.den, i.excl ?? null, JSON.stringify(i.types), i.tat ? "events" : "manual", i.tat ? tatIds[i.tat] : null, i.minSample ?? 30, owner ?? U.qm, created, created).lastInsertRowid,
  );
}

// ---------- Event Pulse: clinical transactions ----------
const eventStart = new Date(`${eventMonths[0]}-01T00:00:00Z`).getTime() - TZ * 3600000;
const dayCount = Math.ceil((now.getTime() - eventStart) / 86400000);
const insTx = db.prepare("INSERT INTO transactions (id, domain, facility_id, priority, attributes, patient_ref, started_at, current_state, current_state_at, last_sequence, is_complete) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
const insEv = db.prepare(
  `INSERT INTO clinical_events (event_id, transaction_id, domain, event_type, facility_id, occurred_at, ingested_at, source_system, source_event_key, source_sequence, actor, event_kind, supersedes_event_id, payload)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
const insLog = db.prepare("INSERT INTO ingestion_log (received_at, source_system, source_event_key, outcome, reason) VALUES (?,?,?,?,?)");

const volume: Record<string, number[]> = {
  // per facility index (AUH, AAN, KCA, MUS, DXB), mean transactions per day
  lab: [12, 8, 5, 2, 7],
  radiology: [4, 3, 0, 0, 3],
  ed: [8, 6, 0, 0, 6],
  outpatient: [10, 7, 9, 0, 6],
  pharmacy: [5, 3, 0, 0, 3],
};
const facilitySpeed = [1.0, 1.22, 1.3, 1.1, 0.88];
const staff = ["RN A. Saleh", "RN M. Cruz", "Dr. L. Moreau", "Dr. A. Khan"];
const STAFF: Record<string, string[]> = {
  lab: ["Phleb. S. Iqbal", "MLT R. Das", "MLT H. Yousef", "Dr. F. Al Hammadi", "RN A. Saleh"],
  radiology: ["Rad. Tech J. Park", "Rad. Tech M. Boateng", "Dr. E. Rossi (Radiology)", "Dr. S. Haddad (Radiology)"],
  ed: ["RN M. Cruz", "RN A. Saleh", "Dr. A. Khan", "Dr. L. Moreau"],
  outpatient: ["Reception K. Ali", "RN T. Varghese", "Dr. N. Farah", "Dr. P. Menon"],
  pharmacy: ["PharmD N. Osei", "Pharm. Tech D. Silva", "PharmD R. Kapoor"],
};
const labTestsStat = ["Troponin I", "Lactate", "Basic metabolic panel", "Complete blood count", "PT/INR", "Blood gas"];
const labTestsRoutine = ["Complete blood count", "Comprehensive metabolic panel", "HbA1c", "Lipid panel", "TSH", "Vitamin D", "CRP", "Urinalysis", "Ferritin"];
const opdDepartments = ["Family medicine", "Internal medicine", "Paediatrics", "Cardiology", "Orthopaedics", "Dermatology", "Obstetrics"];

let txCounter = 0;
let eventCount = 0;
let duplicateCount = 0;

function arrivalTime(dayIdx: number, domain: string): number {
  const dayStartUtc = eventStart + dayIdx * 86400000;
  let hour: number;
  if (domain === "outpatient") hour = 8 + rand() * 12;
  else if (domain === "radiology" || domain === "pharmacy") hour = 7 + rand() * 15;
  else hour = chance(0.75) ? 8 + rand() * 14 : rand() * 24;
  return dayStartUtc + hour * 3600000;
}

function stagesFor(domain: string, priority: string, fIdx: number, attrs: Record<string, unknown>, progress: number) {
  // progress 0..1 across the window gives a gentle improvement trend
  const k = facilitySpeed[fIdx] * (1.08 - 0.12 * progress);
  const stat = priority === "STAT";
  const steps: [string, number][] = [];
  switch (domain) {
    case "lab":
      steps.push(["order_placed", 0]);
      steps.push(["sample_collected", lognormal(stat ? 7 : 35, 0.5) * k]);
      steps.push(["sample_received", lognormal(fIdx === 2 ? (stat ? 16 : 30) : stat ? 9 : 22, 0.45) * k]);
      steps.push(["processing_started", lognormal(stat ? 4 : 28, 0.45) * k]);
      steps.push(["result_verified", lognormal(stat ? 16 : 55, 0.45) * k]);
      steps.push(["result_released", lognormal(stat ? 1.5 : 6, 0.5)]);
      if (attrs.critical) steps.push(["critical_acknowledged", lognormal(13, 0.55) * k]);
      break;
    case "radiology":
      steps.push(["order_placed", 0]);
      steps.push(["patient_arrived", lognormal(stat ? 25 : 170, 0.6) * k]);
      steps.push(["exam_started", lognormal(14, 0.4)]);
      steps.push(["exam_completed", lognormal(attrs.modality === "MRI" ? 40 : 18, 0.3)]);
      steps.push(["report_drafted", lognormal(stat ? 45 : 380, 0.6) * k]);
      steps.push(["report_signed", lognormal(stat ? 25 : 85, 0.7) * k]);
      break;
    case "ed":
      steps.push(["arrival", 0]);
      steps.push(["triage", lognormal(5.5, 0.5) * k]);
      steps.push(["physician_seen", lognormal(stat ? 7 : 15, 0.55) * k]);
      steps.push(["disposition_decided", lognormal(stat ? 110 : 75, 0.42) * k]);
      steps.push(["departed", lognormal(attrs.disposition === "admitted" ? 70 : 18, 0.55) * k]);
      break;
    case "outpatient":
      steps.push(["check_in", 0]);
      steps.push(["vitals_recorded", lognormal(7, 0.4)]);
      steps.push(["consultation_started", lognormal(11, 0.55) * k]);
      steps.push(["consultation_ended", lognormal(14, 0.35)]);
      break;
    case "pharmacy":
      steps.push(["order_received", 0]);
      steps.push(["pharmacist_verified", lognormal(stat ? 5 : 22, 0.5) * k]);
      steps.push(["prepared", lognormal(stat ? 7 : 30, 0.45) * k]);
      steps.push(["dispensed", lognormal(stat ? 4 : 14, 0.5)]);
      break;
  }
  return steps;
}

const seedEvents = db.transaction(() => {
  for (let day = 0; day < dayCount; day++) {
    const progress = day / Math.max(1, dayCount - 1);
    for (const domain of Object.keys(volume)) {
      const cfg = EVENT_DOMAINS[domain as keyof typeof EVENT_DOMAINS];
      volume[domain].forEach((mean, fIdx) => {
        if (!mean) return;
        const weekend = new Date(eventStart + day * 86400000 + 12 * 3600000).getUTCDay() % 6 === 5 ? 0.6 : 1; // lighter Saturdays
        const n = Math.max(0, Math.round(mean * weekend + normal() * Math.sqrt(mean) * 0.6));
        for (let j = 0; j < n; j++) {
          const facilityId = facilityIds[fIdx];
          const t0 = arrivalTime(day, domain);
          if (t0 > now.getTime()) continue;
          let priority = "routine";
          const attrs: Record<string, unknown> = {};
          if (domain === "lab") {
            priority = chance(0.28) ? "STAT" : "routine";
            attrs.test = pick(priority === "STAT" ? labTestsStat : labTestsRoutine);
            attrs.critical = chance(priority === "STAT" ? 0.09 : 0.02);
            attrs.location = pick(["ED", "Ward 3B", "ICU", "OPD", "Day surgery"]);
          } else if (domain === "radiology") {
            priority = chance(0.22) ? "STAT" : "routine";
            attrs.modality = pick(["CT", "CT", "CT", "MRI", "MRI", "X-ray", "X-ray", "Ultrasound"]);
          } else if (domain === "ed") {
            const esi = pick([1, 2, 2, 3, 3, 3, 3, 4, 4, 5]);
            priority = esi <= 2 ? "STAT" : "routine";
            attrs.acuity = `ESI ${esi}`;
            attrs.disposition = chance(esi <= 2 ? 0.6 : 0.18) ? "admitted" : "discharged";
          } else if (domain === "outpatient") {
            attrs.department = pick(opdDepartments);
          } else if (domain === "pharmacy") {
            priority = chance(0.3) ? "STAT" : "routine";
            attrs.ward = pick(["Ward 3B", "ICU", "ED", "Oncology day unit", "Maternity"]);
          }

          const txId = `${domain.slice(0, 3).toUpperCase()}-${facilities[fIdx].code.slice(4)}-${String(++txCounter).padStart(6, "0")}`;
          let steps = stagesFor(domain, priority, fIdx, attrs, progress);
          // Cancellations / left without being seen
          const cancelled = chance(domain === "ed" ? 0.02 : 0.012);
          if (cancelled) steps = [...steps.slice(0, domain === "ed" ? 2 : 1), [cfg.cancel, lognormal(30, 0.5)]];
          // Abandoned workflows (no completion recorded upstream)
          else if (chance(0.012)) steps = steps.slice(0, randInt(2, Math.max(2, steps.length - 1)));

          let t = t0;
          const timeline: { type: string; at: number }[] = [];
          for (const [type, delta] of steps) {
            t += delta * 60000;
            timeline.push({ type, at: t });
          }
          // Clock skew: one stage recorded before its predecessor
          if (!cancelled && timeline.length > 3 && chance(0.004)) timeline[2].at = timeline[1].at - randInt(3, 12) * 60000;

          const visible = timeline.filter((e) => e.at <= now.getTime());
          if (!visible.length) continue;
          const patientRef = `P-${crypto.createHash("sha1").update(`${txId}-patient`).digest("hex").slice(0, 10)}`;
          const last = visible.reduce((a, b) => (b.at >= a.at ? b : a));
          const complete = visible.some((e) => (cfg.terminal as readonly string[]).includes(e.type) || e.type === cfg.cancel);
          insTx.run(txId, domain, facilityId, priority, JSON.stringify(attrs), patientRef, new Date(visible[0].at).toISOString(), last.type, new Date(last.at).toISOString(), visible.length, complete ? 1 : 0);

          visible.forEach((e, seq) => {
            const eventId = uuid();
            const occurred = new Date(e.at).toISOString();
            const ingested = new Date(e.at + randInt(1, 40) * 1000).toISOString();
            const key = `${txId}:${seq + 1}`;
            insEv.run(eventId, txId, domain, e.type, facilityId, occurred, ingested, cfg.source, key, seq + 1, pick(STAFF[domain] ?? staff), "normal", null, JSON.stringify({ stage: e.type }));
            insLog.run(ingested, cfg.source, key, "accepted", null);
            eventCount++;
            if (chance(0.01)) {
              insLog.run(new Date(e.at + randInt(60, 600) * 1000).toISOString(), cfg.source, key, "duplicate", "Source event key already ingested; ignored");
              duplicateCount++;
            }
            // Occasional corrections: a verified time amended at source
            if (domain === "lab" && e.type === "result_verified" && chance(0.006)) {
              const corrected = new Date(e.at + randInt(2, 9) * 60000).toISOString();
              insEv.run(uuid(), txId, domain, e.type, facilityId, corrected, new Date(e.at + 3600000).toISOString(), cfg.source, `${key}:corr`, seq + 1, "MLT R. Das", "correction", eventId, JSON.stringify({ stage: e.type, reason: "Verification time amended in LIS" }));
              eventCount++;
            }
          });
        }
      });
    }
  }
});
seedEvents();
console.log(`  Event Pulse: ${txCounter} transactions, ${eventCount} events, ${duplicateCount} duplicate deliveries rejected`);

// ---------- indicator results ----------
const insRes = db.prepare(
  `INSERT INTO indicator_results (indicator_id, facility_id, period, numerator, denominator, value, status, source, version, calculated_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,1,?,?)`,
);
const facilitiesFor = (types: string[]) => facilityIds.filter((id) => types.includes(facilityById.get(id)!.type));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const seedResults = db.transaction(() => {
  for (const ind of indicators) {
    const indId = indIds[ind.code];
    for (const fid of facilitiesFor(ind.types)) {
      const f = facilityById.get(fid)!;
      periods.forEach((period, pIdx) => {
        if (ind.tat && eventMonths.includes(period)) return; // calculated from events below
        const sign = ind.direction === "higher" ? 1 : -1;
        const drift = f.perf + 0.06 * pIdx;
        let value = ind.base + sign * drift * ind.sd * 0.8 + normal() * ind.sd * 0.6;
        const den = Math.max(1, Math.round(randInt(ind.denRange[0], ind.denRange[1]) * (ind.unit === "per_1000" && f.beds ? f.beds / 320 : f.size + 0.4)));
        let num: number;
        if (ind.unit === "percent") {
          value = clamp(value, 0, 100);
          num = clamp(Math.round((den * value) / 100), 0, den);
        } else if (ind.unit === "per_1000") {
          const expected = Math.max(0, (value * den) / 1000);
          num = Math.max(0, Math.round(expected + normal() * Math.sqrt(expected + 0.25)));
        } else {
          value = Math.max(3, value);
          num = Math.round(value * den * 100) / 100;
        }
        const v = computeValue(ind.unit, num, den);
        const at = new Date(`${addMonths(period, 1)}-0${randInt(2, 9)}T0${randInt(5, 9)}:00:00Z`).toISOString();
        insRes.run(indId, fid, period, num, den, v === null ? null : Math.round(v * 100) / 100, "draft", ind.tat ? "events" : "manual", at, at);
      });
    }
  }
});
seedResults();

for (const ind of indicators.filter((i) => i.tat)) {
  const row = db.prepare("SELECT * FROM indicators WHERE id = ?").get(indIds[ind.code]) as any;
  recalculateFromEvents(row, eventMonths, null);
}

// Event-sourced indicators: earlier months were entered before Event Pulse went live. Scale their volumes
// to match what the event stream now produces, keeping each month's rate, so trends stay comparable.
{
  const volumes = db
    .prepare(
      `SELECT r.indicator_id, r.facility_id, AVG(r.denominator) AS avg_den
       FROM indicator_results r JOIN indicators i ON i.id = r.indicator_id
       WHERE i.source = 'events' AND r.period IN (${eventMonths.map(() => "?").join(",")}) AND r.denominator > 0
       GROUP BY r.indicator_id, r.facility_id`,
    )
    .all(...eventMonths) as { indicator_id: number; facility_id: number; avg_den: number }[];
  const unitOf = db.prepare("SELECT unit FROM indicators WHERE id = ?");
  const older = db.prepare(`SELECT id, value FROM indicator_results WHERE indicator_id = ? AND facility_id = ? AND period NOT IN (${eventMonths.map(() => "?").join(",")}) AND value IS NOT NULL`);
  const upd = db.prepare("UPDATE indicator_results SET numerator = ?, denominator = ?, value = ? WHERE id = ?");
  db.transaction(() => {
    for (const v of volumes) {
      const unit = (unitOf.get(v.indicator_id) as { unit: string }).unit;
      const mult = unit === "percent" ? 100 : unit === "per_1000" ? 1000 : 1;
      for (const r of older.all(v.indicator_id, v.facility_id, ...eventMonths) as { id: number; value: number }[]) {
        const den = Math.max(1, Math.round(v.avg_den * (0.88 + rand() * 0.24)));
        const num = unit === "minutes" ? Math.round((r.value * den) / mult * 10) / 10 : Math.round((r.value * den) / mult);
        const value = computeValue(unit, num, den);
        upd.run(num, den, value === null ? null : Math.round(value * 100) / 100, r.id);
      }
    }
  })();
}

// Data quality problems to exercise validation in the latest month
const latestDrafts = db.prepare("SELECT r.id, i.code FROM indicator_results r JOIN indicators i ON i.id = r.indicator_id WHERE r.period = ? AND r.source = 'manual' ORDER BY r.id").all(lastMonth) as { id: number; code: string }[];
const tamper = (idx: number, sql: string) => latestDrafts[idx] && db.prepare(sql).run(latestDrafts[idx].id);
tamper(3, "UPDATE indicator_results SET numerator = NULL, value = NULL WHERE id = ?");
tamper(17, "UPDATE indicator_results SET denominator = NULL, value = NULL WHERE id = ?");
tamper(29, "UPDATE indicator_results SET numerator = denominator + 14, value = (denominator + 14) * 100.0 / denominator WHERE id = ?");
tamper(41, "UPDATE indicator_results SET numerator = 0, denominator = 0, value = NULL WHERE id = ?");
tamper(52, "UPDATE indicator_results SET numerator = ROUND(numerator * 0.55), value = ROUND(numerator * 0.55) * 100.0 / denominator WHERE id = ?");
const missing = latestDrafts.filter((_, i) => i % 23 === 11).slice(0, 3);
for (const m of missing) db.prepare("DELETE FROM indicator_results WHERE id = ?").run(m.id);

// ---------- review workflow history ----------
const insReview = db.prepare("INSERT INTO result_reviews (result_id, action, from_status, to_status, user_id, comment, created_at) VALUES (?,?,?,?,?,?,?)");
const pendingAudit: AuditEntry[] = [];
const audit = (ts: string, userId: number | null, action: string, entityType: string, entityId: string | number | null, summary: string, details: Record<string, unknown> = {}) => {
  pendingAudit.push({ ts, user_id: userId, user_name: userId ? userName.get(userId) ?? null : "System scheduler", action, entity_type: entityType, entity_id: entityId === null ? null : String(entityId), summary, details: JSON.stringify(details), ip: userId ? `10.20.${randInt(1, 40)}.${randInt(2, 250)}` : null });
};

const allResults = db
  .prepare("SELECT r.id, r.period, r.facility_id, i.code FROM indicator_results r JOIN indicators i ON i.id = r.indicator_id ORDER BY r.period, r.id")
  .all() as { id: number; period: string; facility_id: number; code: string }[];
const tampered = new Set(latestDrafts.filter((_, i) => [3, 17, 29, 41, 52].includes(i)).map((d) => d.id));

const seedReviews = db.transaction(() => {
  for (const r of allResults) {
    const idx = periods.indexOf(r.period);
    const recent = idx >= periods.length - 3;
    let final: string;
    if (idx <= periods.length - 3) final = "approved";
    else if (idx === periods.length - 2) final = chance(0.62) ? "approved" : chance(0.75) ? "verified" : "submitted";
    else final = tampered.has(r.id) ? "draft" : pick(["draft", "draft", "submitted", "submitted", "submitted", "verified", "verified", "rejected", "approved"]);

    const base = new Date(`${addMonths(r.period, 1)}-10T06:00:00Z`).getTime() + randInt(0, 6) * 86400000;
    const step = (h: number) => new Date(Math.min(base + h * 3600000, now.getTime() - 3600000)).toISOString();
    const chain: [string, string, string, number, string | null, string][] = [];
    if (final !== "draft") chain.push(["submitted", "draft", "submitted", U.steward, null, step(0)]);
    if (final === "rejected") chain.push(["rejected", "submitted", "rejected", U.verifier, "Denominator does not match the ADT census for the month. Please reconcile and resubmit.", step(20)]);
    if (["verified", "approved"].includes(final)) chain.push(["verified", "submitted", "verified", U.verifier, chance(0.2) ? "Checked against source extract; sample of 10 cases reviewed." : null, step(18 + randInt(0, 30))]);
    if (final === "approved") chain.push(["approved", "verified", "approved", U.approver, null, step(60 + randInt(0, 40))]);
    for (const [action, from, to, uid, comment, ts] of chain) {
      insReview.run(r.id, action, from, to, uid, comment, ts);
      if (recent) audit(ts, uid, `result.${action}`, "indicator_result", r.id, `${r.code} · ${facilityById.get(r.facility_id)!.code} · ${r.period}: ${from} → ${to}`, comment ? { comment } : {});
    }
    db.prepare("UPDATE indicator_results SET status = ?, updated_at = ? WHERE id = ?").run(final, chain.length ? chain[chain.length - 1][5] : nowIso, r.id);
  }
});
seedReviews();

// ---------- validation rules & first run ----------
const rules = [
  ["VR-001", "Missing numerator or denominator", "A result cannot be calculated without both components.", "result", "blocking", {}],
  ["VR-002", "Numerator exceeds denominator", "For proportions the numerator must be a subset of the denominator.", "result", "blocking", {}],
  ["VR-003", "Zero denominator", "A zero denominator is reported as not calculable rather than 0%.", "result", "warning", {}],
  ["VR-004", "Value outside plausible range", "Values must fall within the plausible range for the unit.", "result", "blocking", { maxMinutes: 600, maxRate: 50 }],
  ["VR-005", "Large month-on-month change", "Flags changes larger than the threshold so a reviewer can confirm they are real.", "result", "warning", { threshold: 0.35 }],
  ["VR-006", "Denominator below minimum sample", "Small samples are flagged so results are interpreted with caution.", "result", "warning", {}],
  ["VR-007", "Missing result for applicable facility", "Every active indicator needs a result for each applicable facility and period.", "completeness", "blocking", {}],
  ["VR-008", "Event stage recorded out of order", "Detects clock skew where a stage is timestamped before its predecessor.", "events", "warning", { lookbackDays: 92 }],
  ["VR-009", "Stale incomplete workflow", "Workflows without a completion or cancellation event after the threshold.", "events", "warning", { lookbackDays: 92, staleHours: 48 }],
] as const;
const insRule = db.prepare("INSERT INTO validation_rules (code, name, description, scope, severity, params) VALUES (?,?,?,?,?,?)");
for (const r of rules) insRule.run(r[0], r[1], r[2], r[3], r[4], JSON.stringify(r[5]));
const vr = runValidation(periods.slice(-3), U.steward);
console.log(`  Validation: ${vr.opened} issues opened`);
// Assign and progress some issues
const openIssues = db.prepare("SELECT id FROM validation_issues WHERE status = 'open' ORDER BY id").all() as { id: number }[];
openIssues.forEach((iss, i) => {
  if (i % 3 === 0) db.prepare("UPDATE validation_issues SET assigned_to = ? WHERE id = ?").run(i % 2 ? userIds.data_steward6 : U.steward, iss.id);
});
const warn = db.prepare("SELECT vi.id FROM validation_issues vi JOIN validation_rules r ON r.id = vi.rule_id WHERE r.code = 'VR-006' AND vi.status = 'open' LIMIT 1").get() as { id: number } | undefined;
if (warn) {
  db.prepare("UPDATE validation_issues SET status = 'waived', resolution_note = ?, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?").run(
    "Low complaint volume is expected for this facility; result accepted with a small-sample note.",
    U.approver,
    nowIso,
    nowIso,
    warn.id,
  );
}

// ---------- report templates ----------
const insTpl = db.prepare("INSERT INTO report_templates (name, description, kind, program, authority_id, config, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)");
const sid = () => crypto.randomBytes(4).toString("hex");
const templates = [
  {
    name: "JAWDA quarterly submission",
    description: "Quarterly indicator package for the Department of Health – Abu Dhabi. Indicator set is illustrative; validate against the current DOH guidance before submission.",
    kind: "system", program: "JAWDA", authority: "DOH",
    sections: [
      { id: sid(), type: "scorecard", title: "Performance against target", program: "JAWDA" },
      { id: sid(), type: "kpi_table", title: "JAWDA indicators by facility", program: "JAWDA", breakdown: "facility" },
      { id: sid(), type: "verification_status", title: "Verification status of submitted results" },
      { id: sid(), type: "validation_summary", title: "Data validation" },
      { id: sid(), type: "text", title: "Declaration", body: "The indicator results in this package were calculated from the facility's source systems using the approved definitions, reviewed by the quality department, and approved by the accountable officer." },
    ],
  },
  {
    name: "Board quality and safety pack",
    description: "Monthly overview for the Board Quality & Safety Committee.",
    kind: "system", program: null, authority: "BOARD",
    sections: [
      { id: sid(), type: "scorecard", title: "Group scorecard" },
      { id: sid(), type: "kpi_trend", title: "Hand hygiene compliance", indicatorId: indIds["PS-05"], months: 12 },
      { id: sid(), type: "kpi_trend", title: "30-day unplanned readmissions", indicatorId: indIds["OUT-01"], months: 12 },
      { id: sid(), type: "facility_comparison", title: "ED length of stay within 4 hours by facility", indicatorId: indIds["ED-02"] },
      { id: sid(), type: "tat_summary", title: "Turnaround times", tatDefinitionIds: [tatIds["LAB-TAT-STAT"], tatIds["ED-D2P"], tatIds["OPD-WAIT"], tatIds["RAD-CT-RPT"]] },
      { id: sid(), type: "kpi_table", title: "Patient safety", domain: "Patient safety" },
    ],
  },
  {
    name: "Laboratory turnaround monthly",
    description: "Laboratory TAT, critical result communication and specimen quality.",
    kind: "system", program: null, authority: null,
    sections: [
      { id: sid(), type: "tat_summary", title: "Laboratory turnaround", tatDefinitionIds: ["LAB-TAT-STAT", "LAB-TAT-RTN", "LAB-COLL-RCV", "LAB-INLAB", "LAB-CRIT"].map((c) => tatIds[c]) },
      { id: sid(), type: "kpi_table", title: "Laboratory indicators", domain: "Laboratory", breakdown: "facility" },
      { id: sid(), type: "kpi_trend", title: "STAT results within 60 minutes", indicatorId: indIds["LAB-01"], months: 12 },
    ],
  },
  {
    name: "Infection prevention surveillance",
    description: "Device-associated infections, surgical site infections and hand hygiene.",
    kind: "system", program: null, authority: null,
    sections: [
      { id: sid(), type: "kpi_table", title: "Infection prevention indicators", domain: "Infection prevention", breakdown: "facility" },
      { id: sid(), type: "kpi_trend", title: "CLABSI rate", indicatorId: indIds["IC-01"], months: 12 },
      { id: sid(), type: "facility_comparison", title: "Surgical site infection rate by facility", indicatorId: indIds["IC-03"] },
    ],
  },
  {
    name: "Emergency department flow",
    description: "Door-to-triage, door-to-physician and length of stay.",
    kind: "system", program: null, authority: null,
    sections: [
      { id: sid(), type: "tat_summary", title: "ED time intervals", tatDefinitionIds: [tatIds["ED-D2T"], tatIds["ED-D2P"], tatIds["ED-LOS"]] },
      { id: sid(), type: "kpi_table", title: "Emergency indicators", domain: "Emergency", breakdown: "facility" },
      { id: sid(), type: "facility_comparison", title: "Seen by a physician within 30 minutes", indicatorId: indIds["ED-01"] },
    ],
  },
  {
    name: "DHA quality indicators",
    description: "Monthly indicator report for the Dubai Health Authority. Indicator selection is illustrative.",
    kind: "system", program: null, authority: "DHA",
    sections: [
      { id: sid(), type: "kpi_table", title: "Quality indicators", indicatorIds: ["ED-01", "ED-02", "LAB-01", "RAD-01", "PS-01", "IC-01", "OUT-01", "PX-01"].map((c) => indIds[c]) },
      { id: sid(), type: "verification_status", title: "Verification status" },
    ],
  },
  {
    name: "JCI patient safety evidence",
    description: "Evidence pack for accreditation readiness: identification, hand hygiene, surgical safety, critical results.",
    kind: "system", program: "JCI", authority: "JCI",
    sections: [
      { id: sid(), type: "kpi_table", title: "JCI-aligned measures", program: "JCI", breakdown: "facility" },
      { id: sid(), type: "kpi_trend", title: "Correct patient identification", indicatorId: indIds["PS-04"], months: 12 },
    ],
  },
  {
    name: "Dialysis unit monthly review",
    description: "Custom report built by the group quality team for the dialysis service.",
    kind: "custom", program: null, authority: null,
    sections: [
      { id: sid(), type: "kpi_table", title: "Dialysis indicators", domain: "Dialysis" },
      { id: sid(), type: "kpi_trend", title: "Kt/V adequacy", indicatorId: indIds["DIA-01"], months: 12 },
      { id: sid(), type: "text", title: "Unit commentary", body: "Fistula use continues to improve following the vascular access pathway launched last quarter." },
    ],
  },
];
const tplIds: Record<string, number> = {};
for (const t of templates) {
  const ts = new Date(now.getTime() - (t.kind === "custom" ? 40 : 300) * 86400000).toISOString();
  tplIds[t.name] = Number(insTpl.run(t.name, t.description, t.kind, t.program, t.authority ? authorityIds[t.authority] : null, JSON.stringify({ sections: t.sections }), t.kind === "custom" ? U.qm : U.admin, ts, ts).lastInsertRowid);
}
audit(new Date(now.getTime() - 40 * 86400000).toISOString(), U.qm, "report_template.created", "report_template", tplIds["Dialysis unit monthly review"], "Created report Dialysis unit monthly review");

// ---------- schedules ----------
const AD = facilityIds.slice(0, 4);
const schedules = [
  { name: "JAWDA quarterly to DOH", tpl: "JAWDA quarterly submission", auth: "DOH", frequency: "quarterly", dow: null, dom: 10, time: "09:00", facilities: AD, recipients: ["quality.reporting@doh.example"], format: "xlsx", approval: 1, active: 1 },
  { name: "Board pack — monthly", tpl: "Board quality and safety pack", auth: "BOARD", frequency: "monthly", dow: null, dom: 5, time: "08:00", facilities: [], recipients: ["board-quality@allyvora.health", "ceo.office@allyvora.health"], format: "pdf", approval: 1, active: 1 },
  { name: "Lab TAT — weekly to lab leads", tpl: "Laboratory turnaround monthly", auth: null, frequency: "weekly", dow: 1, dom: null, time: "07:30", facilities: [], recipients: ["lab.directors@allyvora.health"], format: "pdf", approval: 0, active: 1 },
  { name: "DHA monthly indicators", tpl: "DHA quality indicators", auth: "DHA", frequency: "monthly", dow: null, dom: 7, time: "10:00", facilities: [facilityIds[4]], recipients: ["indicators@dha.example"], format: "csv", approval: 1, active: 1 },
  { name: "Infection surveillance — monthly", tpl: "Infection prevention surveillance", auth: null, frequency: "monthly", dow: null, dom: 3, time: "08:30", facilities: [], recipients: ["ipc.committee@allyvora.health"], format: "pdf", approval: 0, active: 0 },
  { name: "ED flow — daily huddle", tpl: "Emergency department flow", auth: null, frequency: "daily", dow: null, dom: null, time: "07:00", facilities: [facilityIds[0], facilityIds[1]], recipients: ["ed.leads@allyvora.health"], format: "pdf", approval: 0, active: 1 },
];
const insSched = db.prepare(
  `INSERT INTO schedules (name, template_id, authority_id, frequency, day_of_week, day_of_month, time_of_day, facility_ids, recipients, format, require_approval, active, next_run_at, last_run_at, last_status, created_by, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
const schedIds: Record<string, number> = {};
for (const s of schedules) {
  const next = computeNextRun({ frequency: s.frequency as any, day_of_week: s.dow, day_of_month: s.dom, time_of_day: s.time });
  const ts = new Date(now.getTime() - 200 * 86400000).toISOString();
  schedIds[s.name] = Number(
    insSched.run(s.name, tplIds[s.tpl], s.auth ? authorityIds[s.auth] : null, s.frequency, s.dow, s.dom, s.time, JSON.stringify(s.facilities), JSON.stringify(s.recipients), s.format, s.approval, s.active, s.active ? next : null, null, null, U.qm, ts, ts).lastInsertRowid,
  );
  audit(ts, U.qm, "schedule.created", "schedule", schedIds[s.name], `Created schedule ${s.name}`, { frequency: s.frequency, time: s.time });
}

// ---------- historical submissions ----------
const insRun = db.prepare("INSERT INTO report_runs (template_id, period_from, period_to, facility_ids, trigger, schedule_id, generated_by, generated_at, checksum, summary) VALUES (?,?,?,?,?,?,?,?,?,?)");
const insSub = db.prepare(
  `INSERT INTO submissions (reference, template_id, authority_id, schedule_id, report_run_id, period_from, period_to, format, status, checksum, receipt_ref, rejection_reason, supersedes_id, created_by, approved_by, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
const insSubEv = db.prepare("INSERT INTO submission_events (submission_id, status, note, user_id, created_at) VALUES (?,?,?,?,?)");
let subSeq = 0;
function historicSubmission(o: { schedule: string; tpl: string; auth: string | null; from: string; to: string; facilities: number[]; format: string; createdAt: number; outcome: "accepted" | "rejected" | "transmitted"; supersedes?: number; rejection?: string }) {
  const tpl = templates.find((t) => t.name === o.tpl)!;
  const r = renderReport({ config: { sections: tpl.sections as any }, periodFrom: o.from, periodTo: o.to, facilityIds: o.facilities });
  const at = (h: number) => new Date(o.createdAt + h * 3600000).toISOString();
  const runId = Number(insRun.run(tplIds[o.tpl], o.from, o.to, JSON.stringify(o.facilities), "schedule", schedIds[o.schedule], null, at(0), r.checksum, JSON.stringify(r.summary)).lastInsertRowid);
  const ref = `SUB-${o.auth ?? "INT"}-${new Date(o.createdAt).getUTCFullYear()}-${String(++subSeq).padStart(5, "0")}`;
  const receipt = o.outcome === "accepted" ? `${o.auth}-RCPT-${randInt(100000, 999999)}` : null;
  const id = Number(
    insSub.run(ref, tplIds[o.tpl], o.auth ? authorityIds[o.auth] : null, schedIds[o.schedule], runId, o.from, o.to, o.format, o.outcome, r.checksum, receipt, o.rejection ?? null, o.supersedes ?? null, null, o.auth && o.auth !== "BOARD" ? U.approver : null, at(0), at(80)).lastInsertRowid,
  );
  insSubEv.run(id, "prepared", `Report generated for ${o.from}${o.to !== o.from ? ` to ${o.to}` : ""} (scheduled run).`, null, at(0));
  if (o.auth && o.auth !== "BOARD") {
    insSubEv.run(id, "pending_approval", "Awaiting approval before transmission.", null, at(0));
    insSubEv.run(id, "approved", "Approved for transmission.", U.approver, at(26));
  }
  const authName = o.auth ? authorities.find((a) => a.code === o.auth)!.name : "internal recipients";
  insSubEv.run(id, "transmitted", `${authName}: transmitted. Delivery adapter is simulated in this environment.`, o.auth ? U.qm : null, at(28));
  if (o.outcome === "accepted") insSubEv.run(id, "accepted", `Receipt ${receipt} recorded.`, U.qm, at(80));
  if (o.outcome === "rejected") insSubEv.run(id, "rejected", o.rejection ?? "Rejected by authority.", U.qm, at(72));
  audit(at(28), o.auth ? U.qm : null, "submission.transmitted", "submission", id, `${ref} transmitted to ${authName}`, { checksum: r.checksum });
  return id;
}
const quarterStart = (offset: number) => {
  const [y, m] = lastMonth.split("-").map(Number);
  const qStart = `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}`;
  return addMonths(qStart, -3 * offset);
};
for (const offset of [3, 2, 1]) {
  const from = quarterStart(offset);
  const to = addMonths(from, 2);
  const createdAt = new Date(`${addMonths(to, 1)}-10T05:00:00Z`).getTime();
  if (offset === 2) {
    const rejected = historicSubmission({ schedule: "JAWDA quarterly to DOH", tpl: "JAWDA quarterly submission", auth: "DOH", from, to, facilities: AD, format: "xlsx", createdAt, outcome: "rejected", rejection: "Template validation failed: facility AVD-MUS missing DIA-02 for the second month of the quarter." });
    historicSubmission({ schedule: "JAWDA quarterly to DOH", tpl: "JAWDA quarterly submission", auth: "DOH", from, to, facilities: AD, format: "xlsx", createdAt: createdAt + 5 * 86400000, outcome: "accepted", supersedes: rejected });
  } else {
    historicSubmission({ schedule: "JAWDA quarterly to DOH", tpl: "JAWDA quarterly submission", auth: "DOH", from, to, facilities: AD, format: "xlsx", createdAt, outcome: "accepted" });
  }
}
for (let k = 5; k >= 1; k--) {
  const p = addMonths(lastMonth, -k);
  historicSubmission({ schedule: "Board pack — monthly", tpl: "Board quality and safety pack", auth: "BOARD", from: p, to: p, facilities: [], format: "pdf", createdAt: new Date(`${addMonths(p, 1)}-05T04:00:00Z`).getTime(), outcome: "transmitted" });
}
for (let k = 3; k >= 1; k--) {
  const p = addMonths(lastMonth, -k);
  historicSubmission({ schedule: "DHA monthly indicators", tpl: "DHA quality indicators", auth: "DHA", from: p, to: p, facilities: [facilityIds[4]], format: "csv", createdAt: new Date(`${addMonths(p, 1)}-07T06:00:00Z`).getTime(), outcome: "accepted" });
}

// ---------- assorted audit history ----------
for (let d = 14; d >= 0; d--) {
  for (const uid of [U.admin, U.qm, U.verifier, U.approver, U.steward]) {
    if (chance(0.7)) audit(new Date(now.getTime() - d * 86400000 - randInt(1, 10) * 3600000).toISOString(), uid, "auth.login", "user", uid, `${userName.get(uid)} signed in`);
  }
}
audit(new Date(now.getTime() - 9 * 86400000).toISOString(), U.qm, "indicator.updated", "indicator", indIds["OP-03"], "Updated OP-03 target from 75 to 80", { before: { target: 75 }, after: { target: 80 } });
audit(new Date(now.getTime() - 6 * 86400000).toISOString(), U.admin, "user.updated", "user", userIds.verifier7, "Deactivated Rahul Menon", { before: { status: "active" }, after: { status: "inactive" } });
audit(new Date(now.getTime() - 2 * 86400000).toISOString(), U.steward, "validation.run", "validation", null, `Validation run for ${periods.slice(-3).join(", ")}`, vr);

// Schedules show when they last ran, based on the submissions they produced.
db.prepare(
  `UPDATE schedules SET
     last_run_at = (SELECT MAX(created_at) FROM submissions WHERE schedule_id = schedules.id),
     last_status = (SELECT status FROM submissions WHERE schedule_id = schedules.id ORDER BY created_at DESC LIMIT 1)
   WHERE EXISTS (SELECT 1 FROM submissions WHERE schedule_id = schedules.id)`,
).run();

// Historic audit entries are appended in chronological order so the hash chain reads naturally.
db.transaction(() => {
  for (const e of pendingAudit.sort((x, y) => x.ts.localeCompare(y.ts))) appendAudit(e);
})();

const counts = db.prepare("SELECT (SELECT COUNT(*) FROM indicator_results) AS results, (SELECT COUNT(*) FROM validation_issues) AS issues, (SELECT COUNT(*) FROM submissions) AS submissions, (SELECT COUNT(*) FROM audit_log) AS audit").get();
console.log("  Totals:", counts);
console.log('Quality demonstration bootstrap completed; sign-in is managed by the host.');
void monthKey;

// Completion marker prevents an interrupted first-run bootstrap from masquerading as a valid dataset.
db.exec("CREATE TABLE IF NOT EXISTS host_bootstrap (id INTEGER PRIMARY KEY CHECK(id=1), ready INTEGER NOT NULL CHECK(ready=1)); INSERT OR IGNORE INTO host_bootstrap(id,ready) VALUES(1,1)");
