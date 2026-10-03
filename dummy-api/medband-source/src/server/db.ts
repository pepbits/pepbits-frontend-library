import "server-only";
import Database from "../../../reference-sqlite.mjs";
import fs from "node:fs";
import path from "node:path";

/**
 * One SQLite connection per server process. The file lives in ./data by default;
 * set MEDBAND_DB to put it elsewhere. Delete the file (npm run db:reset) to start fresh.
 */
export type DB = Database.Database;

const DB_PATH = process.env.MEDBAND_DB ?? path.join(process.cwd(), "data", "medband.db");
const SCHEMA_VERSION = 2;

const g = globalThis as unknown as { __medbandDb?: DB };

export function getDb(): DB {
  if (g.__medbandDb) return g.__medbandDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  g.__medbandDb = db;
  return db;
}

function migrate(db: DB) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version === SCHEMA_VERSION) return;
  if (version !== 0) throw new Error("Existing MedBand schema needs a reviewed migration; no records were deleted.");
  db.exec(SCHEMA);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

/** Drops every table, used by migrate() and the demo reset. */
export function recreateSchema(db: DB) {
  db.pragma("foreign_keys = OFF");
  db.exec(DROP_ALL);
  db.exec(SCHEMA);
  db.pragma("foreign_keys = ON");
}

const TABLES = [
  "audit_log", "admission_request_needs", "admission_requests", "encounter_services", "encounter_coverages",
  "encounter_complaints", "encounters", "case_complaints", "cases", "episodes", "coverages", "patients", "sequences",
  "counter_encounter_types", "counters", "complaints", "health_packages", "services", "beds", "wards", "practitioners",
  "departments", "plans", "plan_networks", "payer_tpas", "tpas", "payers",
];
const DROP_ALL = TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join("\n");

const SCHEMA = /* sql */ `
-- ─── Reference data ───
CREATE TABLE payers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL, tpa_required INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE tpas (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE payer_tpas (
  payer_id TEXT NOT NULL REFERENCES payers(id), tpa_id TEXT NOT NULL REFERENCES tpas(id),
  PRIMARY KEY (payer_id, tpa_id)
);
CREATE TABLE plan_networks (
  id TEXT PRIMARY KEY, payer_id TEXT NOT NULL REFERENCES payers(id), name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Platinum','Gold','Silver','Basic'))
);
CREATE TABLE plans (
  id TEXT PRIMARY KEY, network_id TEXT NOT NULL REFERENCES plan_networks(id), name TEXT NOT NULL,
  copay_pct REAL NOT NULL, op_limit INTEGER NOT NULL, ip_covered INTEGER NOT NULL, tele_covered INTEGER NOT NULL
);
CREATE TABLE departments (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, follow_up_days INTEGER NOT NULL, free_follow_ups INTEGER NOT NULL,
  consults INTEGER NOT NULL
);
CREATE TABLE practitioners (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, department_id TEXT NOT NULL REFERENCES departments(id),
  title TEXT NOT NULL, tele INTEGER NOT NULL
);
CREATE TABLE wards (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, sort INTEGER NOT NULL);
CREATE TABLE beds (code TEXT PRIMARY KEY, ward_id TEXT NOT NULL REFERENCES wards(id), sort INTEGER NOT NULL);
CREATE TABLE services (name TEXT PRIMARY KEY, sort INTEGER NOT NULL);
CREATE TABLE health_packages (id TEXT PRIMARY KEY, name TEXT NOT NULL, items INTEGER NOT NULL);
CREATE TABLE complaints (code TEXT PRIMARY KEY, label TEXT NOT NULL, category TEXT NOT NULL, sort INTEGER NOT NULL);
CREATE TABLE counters (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL, sort INTEGER NOT NULL);
CREATE TABLE counter_encounter_types (
  counter_id TEXT NOT NULL REFERENCES counters(id), encounter_type TEXT NOT NULL,
  PRIMARY KEY (counter_id, encounter_type)
);

-- ─── Numbering ───
CREATE TABLE sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL);

-- ─── Patients and coverage ───
CREATE TABLE patients (
  id TEXT PRIMARY KEY, mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL, middle_name TEXT, last_name TEXT NOT NULL, dob TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male','Female','Other','Unknown')),
  phone TEXT NOT NULL, alt_phone TEXT, email TEXT, national_id TEXT, nationality TEXT, blood_group TEXT,
  preferred_language TEXT, address TEXT, city TEXT, emergency_name TEXT, emergency_phone TEXT, allergies TEXT,
  vip INTEGER NOT NULL DEFAULT 0, unidentified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX ix_patients_name ON patients(last_name, first_name);
CREATE INDEX ix_patients_phone ON patients(phone);
CREATE INDEX ix_patients_national_id ON patients(national_id);

CREATE TABLE coverages (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('Primary','Secondary','Tertiary')),
  payer_id TEXT NOT NULL REFERENCES payers(id), tpa_id TEXT REFERENCES tpas(id),
  network_id TEXT NOT NULL REFERENCES plan_networks(id), plan_id TEXT NOT NULL REFERENCES plans(id),
  policy_number TEXT NOT NULL, member_id TEXT NOT NULL, valid_from TEXT NOT NULL, valid_to TEXT NOT NULL,
  relationship TEXT NOT NULL, holder_name TEXT
);
CREATE INDEX ix_coverages_patient ON coverages(patient_id);
CREATE INDEX ix_coverages_payer ON coverages(payer_id, network_id, plan_id);
CREATE INDEX ix_coverages_member ON coverages(member_id);

-- ─── Episode → Case → Encounter ───
CREATE TABLE episodes (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL REFERENCES patients(id),
  title TEXT NOT NULL, kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active','On hold','Closed')),
  department_id TEXT NOT NULL REFERENCES departments(id), practitioner_id TEXT REFERENCES practitioners(id),
  start_date TEXT NOT NULL, end_date TEXT, notes TEXT
);
CREATE INDEX ix_episodes_patient ON episodes(patient_id);

CREATE TABLE cases (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL REFERENCES patients(id),
  episode_id TEXT NOT NULL REFERENCES episodes(id), title TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES departments(id),
  status TEXT NOT NULL CHECK (status IN ('Open','Closed')),
  opened_at TEXT NOT NULL, closed_at TEXT, provisional_diagnosis TEXT,
  medico_legal INTEGER NOT NULL DEFAULT 0, mlc_number TEXT, police_station TEXT
);
CREATE INDEX ix_cases_patient ON cases(patient_id);
CREATE INDEX ix_cases_episode ON cases(episode_id);

CREATE TABLE case_complaints (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, seq INTEGER NOT NULL,
  complaint_code TEXT NOT NULL REFERENCES complaints(code), label TEXT NOT NULL, duration INTEGER, unit TEXT,
  PRIMARY KEY (case_id, seq)
);

CREATE TABLE admission_requests (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL REFERENCES patients(id),
  case_id TEXT NOT NULL REFERENCES cases(id), episode_id TEXT NOT NULL REFERENCES episodes(id),
  source_encounter_id TEXT, requested_by_id TEXT NOT NULL REFERENCES practitioners(id),
  admitting_department_id TEXT NOT NULL REFERENCES departments(id),
  admitting_practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  urgency TEXT NOT NULL CHECK (urgency IN ('Elective','Urgent','Emergency')),
  planned_date TEXT NOT NULL, expected_stay_days INTEGER NOT NULL, bed_category TEXT NOT NULL,
  isolation TEXT NOT NULL, reason TEXT NOT NULL, planned_procedure TEXT,
  billing_mode TEXT NOT NULL, coverage_id TEXT REFERENCES coverages(id),
  auth_status TEXT NOT NULL CHECK (auth_status IN ('Not required','Pending','Approved','Rejected')),
  auth_number TEXT, estimated_cost REAL, deposit_collected INTEGER NOT NULL DEFAULT 0, notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('Pending','Ready','Admitted','Cancelled')),
  admitted_encounter_id TEXT, cancel_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX ix_admreq_patient ON admission_requests(patient_id);
CREATE INDEX ix_admreq_status ON admission_requests(status);

CREATE TABLE admission_request_needs (
  request_id TEXT NOT NULL REFERENCES admission_requests(id) ON DELETE CASCADE, seq INTEGER NOT NULL,
  need TEXT NOT NULL, PRIMARY KEY (request_id, seq)
);

CREATE TABLE encounters (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id), episode_id TEXT NOT NULL REFERENCES episodes(id),
  case_id TEXT NOT NULL REFERENCES cases(id),
  type TEXT NOT NULL, start_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Planned','Arrived','In progress','Completed','Cancelled')),
  priority TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT,
  department_id TEXT NOT NULL REFERENCES departments(id), practitioner_id TEXT REFERENCES practitioners(id),
  chief_complaint TEXT, counter_id TEXT REFERENCES counters(id),
  admission_request_id TEXT REFERENCES admission_requests(id),
  brought_by TEXT, brought_by_phone TEXT,
  parent_encounter_id TEXT REFERENCES encounters(id),
  follow_up_derived INTEGER, follow_up_chargeable INTEGER,
  billing_mode TEXT NOT NULL, auth_number TEXT, corporate_name TEXT,
  ward_id TEXT REFERENCES wards(id), bed_code TEXT REFERENCES beds(code),
  admission_reason TEXT, expected_stay_days INTEGER,
  tele_channel TEXT, tele_link TEXT, visit_address TEXT, visit_team TEXT,
  referring_facility TEXT, referring_doctor TEXT, referral_note TEXT,
  triage TEXT, package_id TEXT REFERENCES health_packages(id),
  created_at TEXT NOT NULL
);
CREATE INDEX ix_encounters_patient ON encounters(patient_id, start_at);
CREATE INDEX ix_encounters_case ON encounters(case_id);
CREATE INDEX ix_encounters_episode ON encounters(episode_id);
CREATE INDEX ix_encounters_start ON encounters(start_at);
-- A bed can hold only one open stay at a time.
CREATE UNIQUE INDEX ux_encounters_open_bed ON encounters(bed_code)
  WHERE bed_code IS NOT NULL AND status IN ('Planned','Arrived','In progress');

CREATE TABLE encounter_complaints (
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE, seq INTEGER NOT NULL,
  complaint_code TEXT NOT NULL REFERENCES complaints(code), label TEXT NOT NULL, duration INTEGER, unit TEXT,
  PRIMARY KEY (encounter_id, seq)
);
CREATE TABLE encounter_coverages (
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE, seq INTEGER NOT NULL,
  coverage_id TEXT NOT NULL REFERENCES coverages(id), PRIMARY KEY (encounter_id, seq)
);
CREATE TABLE encounter_services (
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE, seq INTEGER NOT NULL,
  service TEXT NOT NULL REFERENCES services(name), PRIMARY KEY (encounter_id, seq)
);

-- ─── Audit trail ───
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  action TEXT NOT NULL, counter_id TEXT, detail TEXT
);
CREATE INDEX ix_audit_entity ON audit_log(entity, entity_id);
`;
