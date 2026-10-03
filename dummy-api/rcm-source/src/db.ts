import Database from '../../reference-sqlite.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { RESOURCES, tableName } from './registry';

const dataDir = path.dirname(process.env.DB_PATH!);
fs.mkdirSync(dataDir, { recursive: true });

export const DB_PATH = process.env.DB_PATH ?? path.join(dataDir, 'workspace.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_user (id INTEGER PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, email TEXT NOT NULL UNIQUE, initials TEXT NOT NULL, tone TEXT NOT NULL, home_branch TEXT);
    CREATE TABLE IF NOT EXISTS ref_patient (id INTEGER PRIMARY KEY, mrn TEXT NOT NULL UNIQUE, name TEXT NOT NULL, dob TEXT, sex TEXT, nationality TEXT, phone TEXT, branch TEXT);
    CREATE TABLE IF NOT EXISTS ref_payer (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ref_plan (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, payer_id INTEGER REFERENCES ref_payer(id));
    CREATE TABLE IF NOT EXISTS ref_item (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL, price_minor INTEGER NOT NULL, vat_rate REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS ref_account (id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ref_contract (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, payer_id INTEGER REFERENCES ref_payer(id), model TEXT);
    CREATE TABLE IF NOT EXISTS seq (prefix TEXT PRIMARY KEY, n INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor_id INTEGER NOT NULL REFERENCES app_user(id),
      resource TEXT NOT NULL, record_id INTEGER, record_ref TEXT, action TEXT NOT NULL,
      from_status TEXT, to_status TEXT, summary TEXT NOT NULL, reason TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_audit_record ON audit_event(resource, record_id);
    CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_event(at DESC);
  `);
  for (const r of RESOURCES) {
    const t = tableName(r.key);
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ref           TEXT NOT NULL UNIQUE,
        status        TEXT NOT NULL,
        title         TEXT NOT NULL DEFAULT '',
        patient_id    INTEGER REFERENCES ref_patient(id),
        branch        TEXT,
        currency      TEXT NOT NULL DEFAULT 'SAR',
        amount_minor  INTEGER NOT NULL DEFAULT 0,
        balance_minor INTEGER NOT NULL DEFAULT 0,
        due_date      TEXT,
        assignee_id   INTEGER REFERENCES app_user(id),
        priority      TEXT,
        data          TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
        row_version   INTEGER NOT NULL DEFAULT 1,
        created_by    INTEGER NOT NULL REFERENCES app_user(id),
        created_at    TEXT NOT NULL,
        updated_by    INTEGER NOT NULL REFERENCES app_user(id),
        updated_at    TEXT NOT NULL,
        status_by     INTEGER NOT NULL REFERENCES app_user(id),
        status_at     TEXT NOT NULL,
        reason        TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_${t}_status ON ${t}(status);
      CREATE INDEX IF NOT EXISTS ix_${t}_patient ON ${t}(patient_id);
      CREATE INDEX IF NOT EXISTS ix_${t}_branch ON ${t}(branch);
    `);
  }
}

export const nowIso = () => new Date().toISOString();
export const todayUtc = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function nextRef(prefix: string): string {
  const row = db.prepare('SELECT n FROM seq WHERE prefix = ?').get(prefix) as { n: number } | undefined;
  const n = (row?.n ?? 0) + 1;
  db.prepare('INSERT INTO seq (prefix, n) VALUES (?, ?) ON CONFLICT(prefix) DO UPDATE SET n = excluded.n').run(prefix, n);
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String(n).padStart(5, '0')}`;
}

export function audit(e: { actorId: number; resource: string; recordId?: number | null; recordRef?: string | null; action: string; from?: string | null; to?: string | null; summary: string; reason?: string | null; at?: string }) {
  db.prepare(`INSERT INTO audit_event (at, actor_id, resource, record_id, record_ref, action, from_status, to_status, summary, reason)
              VALUES (@at, @actorId, @resource, @recordId, @recordRef, @action, @from, @to, @summary, @reason)`)
    .run({ at: e.at ?? nowIso(), recordId: null, recordRef: null, from: null, to: null, reason: null, ...e });
}
