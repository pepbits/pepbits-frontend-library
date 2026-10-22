import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS organizations (
  id               INTEGER PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  patient_prefix   TEXT NOT NULL,
  next_patient_seq INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS branches (
  id               INTEGER PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  city             TEXT,
  mrn_prefix       TEXT NOT NULL,
  mrn_pad          INTEGER NOT NULL DEFAULT 6,
  mrn_reset_yearly INTEGER NOT NULL DEFAULT 1,
  mrn_year         INTEGER,
  next_mrn_seq     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,
  organization_id   INTEGER NOT NULL REFERENCES organizations(id),
  default_branch_id INTEGER NOT NULL REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS lookups (
  category TEXT NOT NULL,
  code     TEXT NOT NULL,
  label    TEXT NOT NULL,
  parent   TEXT,
  hint     TEXT,
  sort     INTEGER NOT NULL DEFAULT 0,
  active   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (category, code)
);

CREATE TABLE IF NOT EXISTS pincodes (
  pincode  TEXT PRIMARY KEY,
  city     TEXT NOT NULL,
  district TEXT NOT NULL,
  state    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn               TEXT NOT NULL UNIQUE,
  org_number        TEXT NOT NULL UNIQUE,
  branch_id         INTEGER NOT NULL REFERENCES branches(id),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  display_name      TEXT NOT NULL,
  given_name        TEXT,
  family_name       TEXT,
  local_name        TEXT,
  sex               TEXT,
  date_of_birth     TEXT,
  mobile            TEXT,
  email             TEXT,
  blood_group       TEXT,
  allergy_status    TEXT,
  payer_type        TEXT,
  registration_type TEXT,
  department        TEXT,
  completion        INTEGER NOT NULL DEFAULT 0,
  data              TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  created_by        TEXT NOT NULL,
  updated_by        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patients_name    ON patients (display_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_patients_mobile  ON patients (mobile);
CREATE INDEX IF NOT EXISTS idx_patients_updated ON patients (updated_at);
CREATE INDEX IF NOT EXISTS idx_patients_created ON patients (created_at);
CREATE INDEX IF NOT EXISTS idx_patients_status  ON patients (status);

CREATE TABLE IF NOT EXISTS patient_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  actor      TEXT NOT NULL,
  at         TEXT NOT NULL,
  changes    TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON patient_audit (patient_id, at);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL
);
`;

export function migrate(): void {
  db.exec(SCHEMA);
}

export function resetDatabase(): void {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS patient_audit;
    DROP TABLE IF EXISTS patients;
    DROP TABLE IF EXISTS settings_history;
    DROP TABLE IF EXISTS settings;
    DROP TABLE IF EXISTS pincodes;
    DROP TABLE IF EXISTS lookups;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS branches;
    DROP TABLE IF EXISTS organizations;
    PRAGMA foreign_keys = ON;
  `);
  migrate();
}

export const nowISO = () => new Date().toISOString();
