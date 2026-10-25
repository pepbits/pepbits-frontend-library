import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { DB_PATH } from "./paths.js";

export { DB_PATH };

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,            -- hospital | clinic | dialysis
  city TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,    -- e.g. Abu Dhabi, Dubai
  beds INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  title TEXT,
  role TEXT NOT NULL,
  facility_id INTEGER REFERENCES facilities(id),
  status TEXT NOT NULL DEFAULT 'active',
  password_hash TEXT NOT NULL,
  last_login_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authorities (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  channel TEXT NOT NULL,         -- portal_upload | sftp | api | email
  endpoint TEXT,
  contact_email TEXT,
  programs TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS indicators (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  program TEXT NOT NULL,
  category TEXT NOT NULL,        -- structure | process | outcome | experience | operational
  unit TEXT NOT NULL,            -- percent | minutes | per_1000 | count
  direction TEXT NOT NULL,       -- higher | lower
  target REAL NOT NULL,
  warning REAL NOT NULL,
  numerator_def TEXT NOT NULL,
  denominator_def TEXT NOT NULL,
  exclusions TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  facility_types TEXT NOT NULL,  -- JSON array
  source TEXT NOT NULL DEFAULT 'manual',  -- manual | events
  tat_definition_id INTEGER REFERENCES tat_definitions(id),
  min_sample INTEGER NOT NULL DEFAULT 30,
  owner_id INTEGER REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indicator_results (
  id INTEGER PRIMARY KEY,
  indicator_id INTEGER NOT NULL REFERENCES indicators(id),
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  period TEXT NOT NULL,          -- YYYY-MM
  numerator REAL,
  denominator REAL,
  value REAL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | verified | approved | rejected
  source TEXT NOT NULL DEFAULT 'manual',
  comment TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  calculated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(indicator_id, facility_id, period)
);
CREATE INDEX IF NOT EXISTS ix_results_period ON indicator_results(period);
CREATE INDEX IF NOT EXISTS ix_results_status ON indicator_results(status);

CREATE TABLE IF NOT EXISTS result_reviews (
  id INTEGER PRIMARY KEY,
  result_id INTEGER NOT NULL REFERENCES indicator_results(id),
  action TEXT NOT NULL,          -- submitted | verified | approved | rejected | returned | recalculated | edited
  from_status TEXT,
  to_status TEXT,
  user_id INTEGER REFERENCES users(id),
  comment TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_reviews_result ON result_reviews(result_id);

-- Event Pulse: transaction current state (projection) + immutable event history
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,          -- lab | radiology | ed | outpatient | pharmacy
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  priority TEXT NOT NULL,        -- STAT | routine
  attributes TEXT NOT NULL DEFAULT '{}',
  patient_ref TEXT NOT NULL,
  started_at TEXT NOT NULL,
  current_state TEXT NOT NULL,
  current_state_at TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  is_complete INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tx_domain ON transactions(domain, started_at);

CREATE TABLE IF NOT EXISTS clinical_events (
  event_id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  domain TEXT NOT NULL,
  event_type TEXT NOT NULL,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  occurred_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_event_key TEXT NOT NULL,
  source_sequence INTEGER NOT NULL DEFAULT 0,
  actor TEXT,
  event_kind TEXT NOT NULL DEFAULT 'normal', -- normal | correction | retraction
  supersedes_event_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source_system, source_event_key)
);
CREATE INDEX IF NOT EXISTS ix_events_tx ON clinical_events(transaction_id);
CREATE INDEX IF NOT EXISTS ix_events_type ON clinical_events(domain, event_type, occurred_at);

CREATE TABLE IF NOT EXISTS ingestion_log (
  id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_event_key TEXT NOT NULL,
  outcome TEXT NOT NULL,         -- accepted | duplicate | rejected
  reason TEXT
);

CREATE TABLE IF NOT EXISTS tat_definitions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  start_event TEXT NOT NULL,
  end_event TEXT NOT NULL,
  target_minutes REAL NOT NULL,
  filter TEXT NOT NULL DEFAULT '{}',   -- {"priority":"STAT","critical":true}
  description TEXT
);

CREATE TABLE IF NOT EXISTS validation_rules (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  scope TEXT NOT NULL,           -- result | completeness | events
  severity TEXT NOT NULL,        -- blocking | warning
  params TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS validation_issues (
  id INTEGER PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES validation_rules(id),
  fingerprint TEXT NOT NULL UNIQUE,
  indicator_id INTEGER REFERENCES indicators(id),
  facility_id INTEGER REFERENCES facilities(id),
  result_id INTEGER REFERENCES indicator_results(id),
  period TEXT,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | resolved | waived
  assigned_to INTEGER REFERENCES users(id),
  resolution_note TEXT,
  resolved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_issues_status ON validation_issues(status);

CREATE TABLE IF NOT EXISTS validation_runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  scope TEXT NOT NULL,
  checked INTEGER NOT NULL,
  opened INTEGER NOT NULL,
  auto_resolved INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS report_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL,            -- system | custom
  program TEXT,
  authority_id INTEGER REFERENCES authorities(id),
  config TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS report_runs (
  id INTEGER PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES report_templates(id),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  facility_ids TEXT NOT NULL,
  trigger TEXT NOT NULL,         -- manual | schedule
  schedule_id INTEGER,
  generated_by INTEGER REFERENCES users(id),
  generated_at TEXT NOT NULL,
  checksum TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  template_id INTEGER NOT NULL REFERENCES report_templates(id),
  authority_id INTEGER REFERENCES authorities(id),
  frequency TEXT NOT NULL,       -- daily | weekly | monthly | quarterly
  day_of_week INTEGER,
  day_of_month INTEGER,
  time_of_day TEXT NOT NULL,     -- HH:MM (Asia/Dubai)
  facility_ids TEXT NOT NULL DEFAULT '[]',
  recipients TEXT NOT NULL DEFAULT '[]',
  format TEXT NOT NULL DEFAULT 'pdf',
  require_approval INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT,
  last_run_at TEXT,
  last_status TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  template_id INTEGER NOT NULL REFERENCES report_templates(id),
  authority_id INTEGER REFERENCES authorities(id),
  schedule_id INTEGER REFERENCES schedules(id),
  report_run_id INTEGER REFERENCES report_runs(id),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL,          -- pending_approval | approved | transmitted | accepted | rejected | cancelled
  checksum TEXT NOT NULL,
  receipt_ref TEXT,
  rejection_reason TEXT,
  supersedes_id INTEGER REFERENCES submissions(id),
  created_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_events (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  status TEXT NOT NULL,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log(entity_type, entity_id);
-- The audit trail is append-only: the database itself refuses edits and deletions.
CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
`;

export function migrate() {
  db.exec(SCHEMA);
}

export const nowIso = () => new Date().toISOString();

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}


// ---------- tamper-evident audit chain ----------
export interface AuditEntry {
  ts: string;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  details: string;
  ip: string | null;
}

export const AUDIT_GENESIS = "0".repeat(64);

export function auditHash(prev: string, e: AuditEntry): string {
  return createHash("sha256")
    .update([prev, e.ts, e.user_id ?? "", e.user_name ?? "", e.action, e.entity_type, e.entity_id ?? "", e.summary, e.details, e.ip ?? ""].join("\u001f"))
    .digest("hex");
}

/** Appends an entry whose hash covers the previous entry's hash, so any later edit breaks the chain. */
export function appendAudit(e: AuditEntry): number {
  const prev = (db.prepare("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1").get() as { hash: string } | undefined)?.hash ?? AUDIT_GENESIS;
  const hash = auditHash(prev, e);
  const r = db
    .prepare("INSERT INTO audit_log (ts, user_id, user_name, action, entity_type, entity_id, summary, details, ip, prev_hash, hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(e.ts, e.user_id, e.user_name, e.action, e.entity_type, e.entity_id, e.summary, e.details, e.ip, prev, hash);
  return Number(r.lastInsertRowid);
}

export function verifyAuditChain(): { valid: boolean; checked: number; brokenAt: number | null; lastHash: string } {
  let prev = AUDIT_GENESIS;
  let checked = 0;
  for (const row of db.prepare("SELECT * FROM audit_log ORDER BY id").iterate() as Iterable<AuditEntry & { id: number; prev_hash: string; hash: string }>) {
    checked++;
    if (row.prev_hash !== prev || auditHash(prev, row) !== row.hash) return { valid: false, checked, brokenAt: row.id, lastHash: prev };
    prev = row.hash;
  }
  return { valid: true, checked, brokenAt: null, lastHash: prev };
}
