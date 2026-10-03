import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = process.env.RIS_DATA_DIR || path.join(process.cwd(), 'data');
export const DICOM_DIR = process.env.RIS_DICOM_DIR || path.join(process.cwd(), 'storage', 'dicom');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,              -- ADMIN, FRONT_DESK, TECHNOLOGIST, RADIOLOGIST, RESIDENT, BILLING
  title TEXT,
  license_no TEXT,
  modalities TEXT,                 -- comma separated competencies
  signature TEXT,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS modalities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  ae_title TEXT,
  room TEXT,
  manufacturer TEXT,
  daily_capacity INTEGER DEFAULT 40,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS procedures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  modality_code TEXT NOT NULL,
  body_part TEXT,
  cpt TEXT,
  price REAL NOT NULL DEFAULT 0,
  duration_min INTEGER DEFAULT 15,
  contrast INTEGER NOT NULL DEFAULT 0,
  prep TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  modality_code TEXT,
  body_part TEXT,
  technique TEXT,
  findings TEXT,
  impression TEXT,
  kind TEXT NOT NULL DEFAULT 'TEMPLATE',   -- TEMPLATE, NORMAL, MACRO
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tat_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  priority TEXT NOT NULL,
  modality_code TEXT NOT NULL DEFAULT '*',
  target_minutes INTEGER NOT NULL,
  warn_percent INTEGER NOT NULL DEFAULT 75
);

CREATE TABLE IF NOT EXISTS referrers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  specialty TEXT,
  facility TEXT,
  phone TEXT,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT,
  sex TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  insurance TEXT,
  allergies TEXT,
  external_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  accession TEXT UNIQUE NOT NULL,
  placer_order_no TEXT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  modality_code TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'ROUTINE',   -- STAT, URGENT, ROUTINE
  status TEXT NOT NULL DEFAULT 'ORDERED',     -- ORDERED, SCHEDULED, ARRIVED, IN_PROGRESS, COMPLETED, PRELIMINARY, FINAL, CANCELLED
  patient_class TEXT DEFAULT 'OP',            -- OP, IP, ER
  clinical_history TEXT,
  reason TEXT,
  referrer_id INTEGER REFERENCES referrers(id),
  source TEXT NOT NULL DEFAULT 'RIS',         -- RIS, HL7, FHIR
  source_system TEXT,
  ordered_at TEXT NOT NULL,
  scheduled_at TEXT,
  arrived_at TEXT,
  exam_started_at TEXT,
  exam_completed_at TEXT,
  prelim_at TEXT,
  final_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  technologist_id INTEGER REFERENCES users(id),
  radiologist_id INTEGER REFERENCES users(id),
  room TEXT,
  contrast_used TEXT,
  dose_ctdivol REAL,
  dose_dlp REAL,
  tech_notes TEXT,
  created_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_patient ON orders(patient_id);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'DRAFT',        -- DRAFT, PRELIMINARY, FINAL, CORRECTED
  report_type TEXT NOT NULL DEFAULT 'FREE',    -- FREE, TEMPLATE, STRUCTURED
  technique TEXT,
  comparison TEXT,
  findings TEXT,
  impression TEXT,
  structured_json TEXT,
  template_id INTEGER,
  critical INTEGER NOT NULL DEFAULT 0,
  critical_category TEXT,
  author_id INTEGER,
  prelim_by INTEGER,
  prelim_at TEXT,
  signed_by INTEGER,
  signed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'RIS',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  technique TEXT, comparison TEXT, findings TEXT, impression TEXT,
  reason TEXT,
  changed_by INTEGER,
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addenda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id),
  text TEXT NOT NULL,
  author_id INTEGER,
  signed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS critical_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  report_id INTEGER,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'RED',   -- RED (immediate), ORANGE (hours), YELLOW (days)
  finding TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',    -- OPEN, COMMUNICATED, ACKNOWLEDGED
  flagged_by INTEGER,
  flagged_at TEXT NOT NULL,
  communicated_to TEXT,
  method TEXT,
  communicated_by INTEGER,
  communicated_at TEXT,
  readback INTEGER DEFAULT 0,
  acknowledged_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  payer TEXT NOT NULL DEFAULT 'SELF',
  amount REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  net REAL NOT NULL,
  paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'UNPAID',   -- UNPAID, PARTIAL, PAID, CANCELLED, REFUNDED
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL,
  mode TEXT NOT NULL,
  reference TEXT,
  received_by INTEGER,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_uid TEXT UNIQUE NOT NULL,
  accession TEXT,
  order_id INTEGER REFERENCES orders(id),
  patient_id_dicom TEXT,
  patient_name TEXT,
  patient_dob TEXT,
  patient_sex TEXT,
  modality TEXT,
  study_date TEXT,
  description TEXT,
  num_series INTEGER NOT NULL DEFAULT 0,
  num_instances INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  source_ae TEXT,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_studies_acc ON studies(accession);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_uid TEXT UNIQUE NOT NULL,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  modality TEXT,
  series_number INTEGER,
  description TEXT,
  body_part TEXT,
  num_instances INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sop_uid TEXT UNIQUE NOT NULL,
  sop_class TEXT,
  series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  instance_number INTEGER,
  rows INTEGER, cols INTEGER,
  transfer_syntax TEXT,
  path TEXT NOT NULL,
  size INTEGER
);

CREATE TABLE IF NOT EXISTS interfaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- HL7_MLLP, HL7_HTTP, FHIR, DICOM
  direction TEXT NOT NULL DEFAULT 'OUT',
  host TEXT, port INTEGER, url TEXT,
  ae_title TEXT,
  events TEXT,                  -- ORDER_NEW,ORDER_UPDATE,ORDER_CANCEL,REPORT_PRELIM,REPORT_FINAL,REPORT_CORRECTED,STUDY_ROUTE
  facility TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,      -- IN, OUT
  protocol TEXT NOT NULL,       -- HL7, FHIR, DICOM
  message_type TEXT,
  control_id TEXT,
  interface_id INTEGER,
  order_id INTEGER,
  accession TEXT,
  status TEXT NOT NULL,         -- PROCESSED, REJECTED, PENDING, SENT, FAILED
  payload TEXT,
  response TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT
);
`;

type G = typeof globalThis & { __risDb?: Database.Database; __risSeeding?: boolean };
const g = globalThis as G;

export function db(): Database.Database {
  if (!g.__risDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(DICOM_DIR, { recursive: true });
    const conn = new Database(path.join(DATA_DIR, 'ris.db'));
    conn.exec(SCHEMA);
    g.__risDb = conn;
    const count = conn.prepare('SELECT COUNT(*) c FROM users').get() as { c: number };
    if (count.c === 0 && !g.__risSeeding) {
      g.__risSeeding = true;
      // Lazy import avoids a circular import at module load.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { seed } = require('./seed') as typeof import('./seed');
      seed();
      g.__risSeeding = false;
    }
  }
  return g.__risDb;
}

export type Row = Record<string, any>;

export function all<T = Row>(sql: string, ...params: any[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}
export function get<T = Row>(sql: string, ...params: any[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: any[]) {
  return db().prepare(sql).run(...params);
}
export function tx<T>(fn: () => T): T {
  return db().transaction(fn)();
}

export function insert(table: string, data: Row): number {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return Number(run(sql, ...keys.map((k) => normalize(data[k]))).lastInsertRowid);
}

export function update(table: string, id: number, data: Row) {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  run(sql, ...keys.map((k) => normalize(data[k])), id);
}

function normalize(v: any) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '') return null;
  return v;
}

export function now(): string {
  return new Date().toISOString();
}
