import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SETTLE_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_FILE = path.join(DATA_DIR, 'settle.db');

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS centers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, counter_type TEXT NOT NULL DEFAULT 'billing',
  center_id INTEGER REFERENCES centers(id), is_system INTEGER NOT NULL DEFAULT 0,
  card_terminal TEXT, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
  rights TEXT NOT NULL DEFAULT '[]', counter_id INTEGER REFERENCES counters(id), initials TEXT
);
CREATE TABLE IF NOT EXISTS payment_modes (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL,
  requires_bank INTEGER NOT NULL DEFAULT 0, requires_reference INTEGER NOT NULL DEFAULT 0,
  requires_card INTEGER NOT NULL DEFAULT 0, realization_required INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS number_series (
  key TEXT PRIMARY KEY, label TEXT NOT NULL, prefix TEXT NOT NULL,
  next_value INTEGER NOT NULL DEFAULT 1, pad INTEGER NOT NULL DEFAULT 6
);
CREATE TABLE IF NOT EXISTS discount_categories (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, percent REAL NOT NULL DEFAULT 0,
  charge_groups TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text',
  grp TEXT NOT NULL DEFAULT 'General', help TEXT
);
CREATE TABLE IF NOT EXISTS rate_plans (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, discount_pct REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'TPA'
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY, sponsor_id INTEGER NOT NULL REFERENCES sponsors(id), name TEXT NOT NULL,
  copay_pct REAL NOT NULL DEFAULT 0, claim_cap REAL, non_payable_groups TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS patients (
  mr_no TEXT PRIMARY KEY, name TEXT NOT NULL, gender TEXT, dob TEXT, phone TEXT, city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS visits (
  visit_id TEXT PRIMARY KEY, mr_no TEXT NOT NULL REFERENCES patients(mr_no), visit_type TEXT NOT NULL,
  doctor TEXT, department TEXT, ward TEXT, admitted_at TEXT NOT NULL, discharged_at TEXT,
  primary_plan_id INTEGER REFERENCES plans(id), secondary_plan_id INTEGER REFERENCES plans(id),
  center_id INTEGER REFERENCES centers(id)
);
CREATE TABLE IF NOT EXISTS catalogue (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, charge_group TEXT NOT NULL,
  charge_head TEXT NOT NULL, rate REAL NOT NULL, vat_rate REAL NOT NULL DEFAULT 0,
  insurance_payable INTEGER NOT NULL DEFAULT 1, orderable INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS bills (
  bill_no TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits(visit_id),
  mr_no TEXT NOT NULL REFERENCES patients(mr_no),
  bill_type TEXT NOT NULL CHECK (bill_type IN ('P','C')),
  restriction_type TEXT NOT NULL DEFAULT 'N' CHECK (restriction_type IN ('N','P','T')),
  is_primary INTEGER NOT NULL DEFAULT 0, is_tpa INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'A' CHECK (status IN ('A','F','C','X')),
  payment_status TEXT NOT NULL DEFAULT 'U', claim_status TEXT NOT NULL DEFAULT 'O',
  rate_plan_id INTEGER REFERENCES rate_plans(id), discount_category_id INTEGER REFERENCES discount_categories(id),
  total_amount REAL NOT NULL DEFAULT 0, total_discount REAL NOT NULL DEFAULT 0, total_vat REAL NOT NULL DEFAULT 0,
  total_claim REAL NOT NULL DEFAULT 0, primary_claim REAL NOT NULL DEFAULT 0, secondary_claim REAL NOT NULL DEFAULT 0,
  sponsor_vat REAL NOT NULL DEFAULT 0, round_off REAL NOT NULL DEFAULT 0, patient_amount REAL NOT NULL DEFAULT 0,
  total_receipts REAL NOT NULL DEFAULT 0, sponsor_receipts REAL NOT NULL DEFAULT 0,
  deposit_set_off REAL NOT NULL DEFAULT 0, points_redeemed INTEGER NOT NULL DEFAULT 0,
  points_amount REAL NOT NULL DEFAULT 0, patient_due REAL NOT NULL DEFAULT 0, sponsor_due REAL NOT NULL DEFAULT 0,
  patient_writeoff TEXT NOT NULL DEFAULT 'N', sponsor_writeoff TEXT NOT NULL DEFAULT 'N',
  cancellation_status TEXT NOT NULL DEFAULT 'N',
  finalized_at TEXT, finalized_by TEXT, closed_at TEXT, closed_by TEXT,
  reopen_reason TEXT, cancel_reason TEXT, remarks TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bills_visit ON bills(visit_id);
CREATE INDEX IF NOT EXISTS ix_bills_mr ON bills(mr_no);
CREATE TABLE IF NOT EXISTS bill_claims (
  id INTEGER PRIMARY KEY, bill_no TEXT NOT NULL REFERENCES bills(bill_no) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id), priority INTEGER NOT NULL,
  claim_status TEXT NOT NULL DEFAULT 'O', UNIQUE (bill_no, priority)
);
CREATE TABLE IF NOT EXISTS charges (
  charge_id INTEGER PRIMARY KEY, bill_no TEXT NOT NULL REFERENCES bills(bill_no) ON DELETE CASCADE,
  catalogue_id INTEGER REFERENCES catalogue(id), code TEXT, description TEXT NOT NULL,
  charge_group TEXT NOT NULL, charge_head TEXT NOT NULL,
  orig_rate REAL NOT NULL DEFAULT 0, rate REAL NOT NULL, qty REAL NOT NULL DEFAULT 1, amount REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0, discount_by TEXT, discount_status TEXT NOT NULL DEFAULT 'none',
  vat_rate REAL NOT NULL DEFAULT 0, vat REAL NOT NULL DEFAULT 0,
  insurance_payable INTEGER NOT NULL DEFAULT 1, claim_override INTEGER NOT NULL DEFAULT 0,
  primary_claim REAL NOT NULL DEFAULT 0, secondary_claim REAL NOT NULL DEFAULT 0, sponsor_vat REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'A', order_linked INTEGER NOT NULL DEFAULT 0, pending_result INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0, posted_at TEXT NOT NULL, posted_by TEXT, remarks TEXT
);
CREATE INDEX IF NOT EXISTS ix_charges_bill ON charges(bill_no);
CREATE TABLE IF NOT EXISTS receipts (
  receipt_no TEXT PRIMARY KEY, bill_no TEXT NOT NULL REFERENCES bills(bill_no), mr_no TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('R','F','S')),
  recpt_type TEXT NOT NULL CHECK (recpt_type IN ('U','A','S')),
  sponsor_index TEXT, amount REAL NOT NULL, tds_amount REAL NOT NULL DEFAULT 0,
  mode_id INTEGER NOT NULL REFERENCES payment_modes(id), bank TEXT, reference TEXT,
  card_last4 TEXT, card_auth TEXT, card_rrn TEXT, terminal_id TEXT,
  counter_id INTEGER REFERENCES counters(id), username TEXT NOT NULL, created_at TEXT NOT NULL,
  remarks TEXT, status TEXT NOT NULL DEFAULT 'A', reversal_of TEXT, cancel_reason TEXT, source TEXT NOT NULL DEFAULT 'bill'
);
CREATE INDEX IF NOT EXISTS ix_receipts_bill ON receipts(bill_no);
CREATE INDEX IF NOT EXISTS ix_receipts_date ON receipts(created_at);
CREATE TABLE IF NOT EXISTS deposits (
  deposit_no TEXT PRIMARY KEY, mr_no TEXT NOT NULL REFERENCES patients(mr_no),
  deposit_type TEXT NOT NULL CHECK (deposit_type IN ('R','F')), amount REAL NOT NULL,
  mode_id INTEGER NOT NULL REFERENCES payment_modes(id), bank TEXT, reference TEXT, card_last4 TEXT,
  realized INTEGER NOT NULL DEFAULT 1, realized_at TEXT, available_for TEXT NOT NULL DEFAULT 'B',
  payer_name TEXT, payer_phone TEXT, package_name TEXT,
  counter_id INTEGER REFERENCES counters(id), username TEXT NOT NULL, created_at TEXT NOT NULL,
  remarks TEXT, status TEXT NOT NULL DEFAULT 'A', origin TEXT NOT NULL DEFAULT 'counter', origin_ref TEXT
);
CREATE INDEX IF NOT EXISTS ix_deposits_mr ON deposits(mr_no);
CREATE TABLE IF NOT EXISTS deposit_setoffs (
  id INTEGER PRIMARY KEY, deposit_no TEXT NOT NULL REFERENCES deposits(deposit_no),
  set_off_type TEXT NOT NULL CHECK (set_off_type IN ('R','F')),
  bill_no TEXT REFERENCES bills(bill_no), refund_no TEXT, amount REAL NOT NULL,
  created_at TEXT NOT NULL, username TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_setoff_deposit ON deposit_setoffs(deposit_no);
CREATE INDEX IF NOT EXISTS ix_setoff_bill ON deposit_setoffs(bill_no);
CREATE TABLE IF NOT EXISTS reward_points (
  mr_no TEXT PRIMARY KEY REFERENCES patients(mr_no), earned INTEGER NOT NULL DEFAULT 0, redeemed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('discount','writeoff','cancellation')),
  bill_no TEXT NOT NULL REFERENCES bills(bill_no), amount REAL NOT NULL DEFAULT 0, reason TEXT,
  payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL, requested_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, decision_note TEXT
);
CREATE TABLE IF NOT EXISTS card_txns (
  id TEXT PRIMARY KEY, bill_no TEXT, mr_no TEXT, purpose TEXT NOT NULL, amount REAL NOT NULL,
  payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', terminal_id TEXT,
  created_at TEXT NOT NULL, username TEXT NOT NULL, result TEXT
);
CREATE TABLE IF NOT EXISTS counter_closures (
  id INTEGER PRIMARY KEY, counter_id INTEGER NOT NULL REFERENCES counters(id), business_date TEXT NOT NULL,
  expected_cash REAL NOT NULL, declared_cash REAL NOT NULL, variance REAL NOT NULL,
  note TEXT, closed_by TEXT NOT NULL, closed_at TEXT NOT NULL, UNIQUE (counter_id, business_date)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, entity TEXT NOT NULL, entity_id TEXT NOT NULL, bill_no TEXT, mr_no TEXT,
  action TEXT NOT NULL, summary TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}',
  username TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_bill ON audit_log(bill_no);
CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_log(at);
`;

export function migrate() {
  db.exec(SCHEMA);
}
migrate();

export function resetDatabase() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  db.pragma('foreign_keys = OFF');
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  db.pragma('foreign_keys = ON');
  migrate();
}

export const tx = (fn) => db.transaction(fn);
