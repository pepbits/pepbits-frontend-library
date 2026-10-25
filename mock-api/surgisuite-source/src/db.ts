import Database from "../../reference-sqlite.mjs";
import fs from "node:fs";
import path from "node:path";

const DB_FILE = process.env.DB_FILE ?? path.resolve(process.cwd(), "data", "surgisuite.db");
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

export const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS lookups (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  UNIQUE(category, code)
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY,
  emp_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  specialty TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  pin_hash TEXT NOT NULL,
  privileges TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY,
  mrn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  sex TEXT NOT NULL,
  blood_group TEXT,
  phone TEXT,
  allergies TEXT DEFAULT 'NKDA',
  comorbidities TEXT DEFAULT '',
  weight_kg REAL,
  height_cm REAL,
  insurer TEXT,
  policy_no TEXT
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id INTEGER PRIMARY KEY,
  icd10 TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS procedures (
  id INTEGER PRIMARY KEY,
  cpt TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  op_type TEXT NOT NULL,
  default_approach TEXT,
  default_duration_min INTEGER NOT NULL,
  t_time_min INTEGER NOT NULL,
  wound_class TEXT DEFAULT 'I',
  rvu REAL DEFAULT 0,
  fee REAL DEFAULT 0,
  is_addon INTEGER DEFAULT 0,
  high_risk INTEGER DEFAULT 0,
  requires_implant INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS procedure_diagnoses (
  procedure_id INTEGER REFERENCES procedures(id),
  diagnosis_id INTEGER REFERENCES diagnoses(id),
  PRIMARY KEY (procedure_id, diagnosis_id)
);

CREATE TABLE IF NOT EXISTS theatres (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  location TEXT,
  open_time TEXT DEFAULT '07:00',
  close_time TEXT DEFAULT '19:00',
  status TEXT DEFAULT 'Available'
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  home_theatre_id INTEGER REFERENCES theatres(id),
  status TEXT DEFAULT 'Ready',
  last_service TEXT,
  next_service TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  uom TEXT DEFAULT 'each',
  unit_cost REAL DEFAULT 0,
  billable INTEGER DEFAULT 1,
  stock_qty INTEGER DEFAULT 0,
  reserved_qty INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  lot_no TEXT,
  expiry TEXT,
  vendor TEXT,
  sterile_status TEXT DEFAULT 'Sterile',
  is_implant INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS preference_items (
  id INTEGER PRIMARY KEY,
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  qty INTEGER NOT NULL DEFAULT 1,
  UNIQUE(procedure_id, item_id)
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY,
  case_no TEXT UNIQUE NOT NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  theatre_id INTEGER REFERENCES theatres(id),
  scheduled_start TEXT NOT NULL,
  est_duration_min INTEGER NOT NULL,
  case_class TEXT NOT NULL DEFAULT 'Elective',
  op_type TEXT NOT NULL DEFAULT 'Major',
  anesthesia_type TEXT,
  position TEXT,
  laterality TEXT DEFAULT 'N/A',
  wound_class TEXT DEFAULT 'I',
  asa_class TEXT DEFAULT 'II',
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  ebl_ml INTEGER,
  delay_reason TEXT,
  cancel_reason TEXT,
  notes TEXT,
  rcri TEXT DEFAULT '{}',
  created_by INTEGER REFERENCES staff(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_start ON cases(scheduled_start);

CREATE TABLE IF NOT EXISTS case_diagnoses (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  diagnosis_id INTEGER NOT NULL REFERENCES diagnoses(id),
  is_primary INTEGER DEFAULT 0,
  UNIQUE(case_id, diagnosis_id)
);

CREATE TABLE IF NOT EXISTS case_procedures (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  role TEXT NOT NULL DEFAULT 'Primary',
  surgeon_id INTEGER REFERENCES staff(id),
  approach TEXT,
  laterality TEXT DEFAULT 'N/A',
  modifiers TEXT DEFAULT '',
  planned INTEGER DEFAULT 1,
  performed INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS case_team (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  role TEXT NOT NULL,
  time_in TEXT,
  time_out TEXT
);

CREATE TABLE IF NOT EXISTS case_equipment (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  PRIMARY KEY(case_id, equipment_id)
);

CREATE TABLE IF NOT EXISTS case_milestones (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  ts TEXT NOT NULL,
  recorded_by INTEGER REFERENCES staff(id),
  UNIQUE(case_id, code)
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  item TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  checked_by INTEGER REFERENCES staff(id),
  ts TEXT,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS counts (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  initial INTEGER DEFAULT 0,
  added INTEGER DEFAULT 0,
  final INTEGER,
  verified_by INTEGER REFERENCES staff(id),
  witness_id INTEGER REFERENCES staff(id),
  ts TEXT,
  UNIQUE(case_id, item)
);

CREATE TABLE IF NOT EXISTS anesthesia_vitals (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,
  hr INTEGER, sbp INTEGER, dbp INTEGER, spo2 INTEGER, etco2 INTEGER, temp REAL,
  recorded_by INTEGER REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS anesthesia_meds (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,
  drug TEXT NOT NULL,
  dose REAL NOT NULL,
  unit TEXT NOT NULL,
  route TEXT NOT NULL,
  given_by INTEGER REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS case_events (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  staff_id INTEGER REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS case_orders (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  test TEXT NOT NULL,
  priority TEXT DEFAULT 'STAT',
  status TEXT DEFAULT 'Ordered',
  result TEXT,
  critical INTEGER DEFAULT 0,
  radiation_mgy REAL,
  fluoro_sec INTEGER,
  quantity INTEGER,
  ordered_by INTEGER REFERENCES staff(id),
  ordered_at TEXT NOT NULL,
  resulted_at TEXT
);

CREATE TABLE IF NOT EXISTS case_items (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  qty_planned INTEGER DEFAULT 0,
  qty_used INTEGER DEFAULT 0,
  qty_wasted INTEGER DEFAULT 0,
  lot_no TEXT,
  serial_no TEXT,
  consumed INTEGER DEFAULT 0,
  UNIQUE(case_id, item_id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  required INTEGER DEFAULT 1,
  requested_by INTEGER REFERENCES staff(id),
  requested_at TEXT NOT NULL,
  approver_id INTEGER REFERENCES staff(id),
  decided_at TEXT,
  reference_no TEXT,
  valid_until TEXT,
  remarks TEXT,
  witness_id INTEGER REFERENCES staff(id),
  signature_hash TEXT
);

CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  signed_by_name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'Self',
  risks_explained TEXT,
  obtained_by INTEGER REFERENCES staff(id),
  witness_id INTEGER REFERENCES staff(id),
  ts TEXT NOT NULL,
  signature_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value REAL NOT NULL,
  band TEXT,
  details TEXT DEFAULT '{}',
  recorded_by INTEGER REFERENCES staff(id),
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  case_id INTEGER UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  indication TEXT DEFAULT '',
  findings TEXT DEFAULT '',
  technique TEXT DEFAULT '',
  specimens TEXT DEFAULT '',
  complications TEXT DEFAULT 'None',
  drains TEXT DEFAULT '',
  postop_plan TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft',
  version INTEGER NOT NULL DEFAULT 1,
  signed_by INTEGER REFERENCES staff(id),
  signed_at TEXT,
  cosigned_by INTEGER REFERENCES staff(id),
  cosigned_at TEXT,
  witness_id INTEGER REFERENCES staff(id),
  witnessed_at TEXT,
  signature_hash TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_versions (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  signature_hash TEXT,
  amended_by INTEGER REFERENCES staff(id),
  reason TEXT,
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  staff_id INTEGER REFERENCES staff(id),
  entity TEXT NOT NULL,
  entity_id INTEGER,
  case_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_log(case_id);
`;

export function migrate() {
  db.exec(SCHEMA);
}

export function now() {
  return new Date().toISOString();
}

export function audit(
  staffId: number | null,
  entity: string,
  entityId: number | null,
  action: string,
  detail?: unknown,
  caseId?: number | null,
) {
  db.prepare(
    `INSERT INTO audit_log (ts, staff_id, entity, entity_id, case_id, action, detail) VALUES (?,?,?,?,?,?,?)`,
  ).run(now(), staffId, entity, entityId, caseId ?? null, action, detail === undefined ? null : JSON.stringify(detail));
}
