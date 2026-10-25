PRAGMA foreign_keys = ON;

-- ── Organisation ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','pharmacist','technician','cashier','billing','viewer')),
  initials TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── Master data ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  email TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 3,
  rating REAL NOT NULL DEFAULT 4,
  terms TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  generic TEXT NOT NULL,
  ingredient TEXT NOT NULL,
  drug_class TEXT NOT NULL,
  strength TEXT,
  form TEXT NOT NULL,
  category TEXT NOT NULL,
  manufacturer TEXT,
  drug_code TEXT,
  barcode TEXT,
  schedule TEXT NOT NULL CHECK (schedule IN ('otc','rx','controlled')),
  requires_auth INTEGER NOT NULL DEFAULT 0,
  cold_chain INTEGER NOT NULL DEFAULT 0,
  dispense_unit TEXT NOT NULL,
  pack_size INTEGER NOT NULL DEFAULT 1,
  cost_per_unit REAL NOT NULL,
  price_per_unit REAL NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  max_level INTEGER NOT NULL DEFAULT 0,
  max_daily_dose REAL,
  dose_unit TEXT,
  location TEXT,
  preferred_supplier_id TEXT REFERENCES suppliers(id),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS interactions (
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('major','moderate','minor')),
  note TEXT NOT NULL,
  PRIMARY KEY (a, b)
);

CREATE TABLE IF NOT EXISTS payers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('insurer','tpa','government')),
  workflow TEXT NOT NULL CHECK (workflow IN ('pre_adjudication','post_dispense')),
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  contact TEXT
);

-- Expected reimbursement per unit, versioned by effective date
CREATE TABLE IF NOT EXISTS payer_contract_prices (
  payer_id TEXT NOT NULL REFERENCES payers(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_price REAL NOT NULL,
  effective_from TEXT NOT NULL,
  PRIMARY KEY (payer_id, product_id, effective_from)
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  mrn TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  gender TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  weight_kg REAL,
  allergies TEXT NOT NULL DEFAULT '[]',
  conditions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coverages (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  payer_id TEXT NOT NULL REFERENCES payers(id),
  member_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority IN (1,2)),
  coverage_pct REAL NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT,
  license_no TEXT NOT NULL,
  facility TEXT,
  phone TEXT
);

-- ── Inventory ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  supplier_id TEXT REFERENCES suppliers(id),
  batch_no TEXT NOT NULL,
  expiry TEXT NOT NULL,
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  qty_reserved INTEGER NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','quarantined','expired','recalled')),
  location TEXT,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);

-- Ledger: every physical or reservation change is a row; balances are never edited silently
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('receipt','reserve','release','issue','return','adjust','quarantine','unquarantine','recall','expire')),
  qty INTEGER NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  actor TEXT,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mov_product ON stock_movements(product_id, at);

-- ── Clinical: prescription → authorization → dispensing ─────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  rx_no TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  source TEXT NOT NULL CHECK (source IN ('erx','paper','hospital')),
  priority TEXT NOT NULL CHECK (priority IN ('routine','urgent','stat')),
  diagnosis_code TEXT,
  diagnosis TEXT,
  status TEXT NOT NULL CHECK (status IN ('received','in_review','on_hold','verified','partially_dispensed','dispensed','cancelled')),
  written_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty_prescribed INTEGER NOT NULL,
  qty_dispensed INTEGER NOT NULL DEFAULT 0,
  dose REAL NOT NULL,
  frequency_per_day INTEGER NOT NULL,
  days INTEGER NOT NULL,
  sig TEXT NOT NULL,
  substitution_allowed INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS safety_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
  alert_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authorizations (
  id TEXT PRIMARY KEY,
  auth_no TEXT NOT NULL UNIQUE,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
  payer_id TEXT NOT NULL REFERENCES payers(id),
  status TEXT NOT NULL CHECK (status IN ('requested','approved','partially_approved','denied','expired')),
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  valid_to TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS authorization_items (
  id TEXT PRIMARY KEY,
  authorization_id TEXT NOT NULL REFERENCES authorizations(id),
  prescription_item_id TEXT NOT NULL REFERENCES prescription_items(id),
  qty_requested INTEGER NOT NULL,
  qty_approved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dispensings (
  id TEXT PRIMARY KEY,
  disp_no TEXT NOT NULL UNIQUE,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  status TEXT NOT NULL CHECK (status IN ('prepared','checked','handed_over','cancelled','returned')),
  collection TEXT NOT NULL DEFAULT 'pickup' CHECK (collection IN ('pickup','delivery')),
  prepared_by TEXT,
  checked_by TEXT,
  handed_over_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dispensing_items (
  id TEXT PRIMARY KEY,
  dispensing_id TEXT NOT NULL REFERENCES dispensings(id),
  prescription_item_id TEXT NOT NULL REFERENCES prescription_items(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  qty INTEGER NOT NULL
);

-- ── Revenue cycle: bill → claim → RA → payment ─────────────────
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_no TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('rx','otc')),
  dispensing_id TEXT REFERENCES dispensings(id),
  patient_id TEXT REFERENCES patients(id),
  status TEXT NOT NULL CHECK (status IN ('open','finalized','reversed')),
  gross REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  net REAL NOT NULL DEFAULT 0,
  patient_share REAL NOT NULL DEFAULT 0,
  payer_share REAL NOT NULL DEFAULT 0,
  patient_paid REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bill_lines (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES bills(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  gross REAL NOT NULL,
  tax REAL NOT NULL,
  patient_share REAL NOT NULL,
  primary_share REAL NOT NULL DEFAULT 0,
  secondary_share REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  claim_no TEXT NOT NULL UNIQUE,
  bill_id TEXT NOT NULL REFERENCES bills(id),
  prescription_id TEXT REFERENCES prescriptions(id),
  payer_id TEXT NOT NULL REFERENCES payers(id),
  coverage_id TEXT NOT NULL REFERENCES coverages(id),
  priority INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','partially_approved','rejected','paid','partially_paid','reversed')),
  claimed REAL NOT NULL,
  expected REAL NOT NULL,
  approved REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  denial_code TEXT,
  denial_reason TEXT,
  submissions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  adjudicated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

CREATE TABLE IF NOT EXISTS claim_lines (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id),
  bill_line_id TEXT NOT NULL REFERENCES bill_lines(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  claimed REAL NOT NULL,
  expected REAL NOT NULL,
  approved REAL NOT NULL DEFAULT 0,
  denial_code TEXT
);

CREATE TABLE IF NOT EXISTS remittances (
  id TEXT PRIMARY KEY,
  ra_no TEXT NOT NULL UNIQUE,
  payer_id TEXT NOT NULL REFERENCES payers(id),
  status TEXT NOT NULL CHECK (status IN ('received','posted')),
  total_claimed REAL NOT NULL DEFAULT 0,
  total_approved REAL NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS remittance_lines (
  id TEXT PRIMARY KEY,
  remittance_id TEXT NOT NULL REFERENCES remittances(id),
  claim_id TEXT NOT NULL REFERENCES claims(id),
  submission INTEGER NOT NULL,
  claimed REAL NOT NULL,
  approved REAL NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('paid','partial','denied')),
  denial_code TEXT,
  denial_reason TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payment_ref TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('payer','patient')),
  payer_id TEXT REFERENCES payers(id),
  remittance_id TEXT REFERENCES remittances(id),
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  allocated REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('unallocated','partially_allocated','allocated','reversed')),
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  claim_id TEXT REFERENCES claims(id),
  bill_id TEXT REFERENCES bills(id),
  amount REAL NOT NULL,
  at TEXT NOT NULL
);

-- ── Purchasing ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_no TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL CHECK (status IN ('draft','approved','sent','partially_received','received','cancelled')),
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expected_at TEXT
);

CREATE TABLE IF NOT EXISTS po_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL
);

-- ── Audit: every status change of every record ─────────────────
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  ref TEXT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  actor TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hist_entity ON status_history(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_hist_at ON status_history(at);

-- ── Customer orders (phone, web, WhatsApp) for pickup or delivery ──
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  patient_id TEXT REFERENCES patients(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('phone','web','whatsapp','walk_in')),
  fulfilment TEXT NOT NULL CHECK (fulfilment IN ('pickup','delivery')),
  address TEXT,
  payment TEXT NOT NULL CHECK (payment IN ('prepaid','cash_on_delivery','pay_at_counter')),
  status TEXT NOT NULL CHECK (status IN ('new','confirmed','ready','out_for_delivery','completed','cancelled')),
  notes TEXT,
  total REAL NOT NULL DEFAULT 0,
  bill_id TEXT REFERENCES bills(id),
  promised_at TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS order_allocations (
  id TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  qty INTEGER NOT NULL
);

-- ── Sales returns (credit notes) for counter and order sales ──
CREATE TABLE IF NOT EXISTS sales_returns (
  id TEXT PRIMARY KEY,
  return_no TEXT NOT NULL UNIQUE,
  bill_id TEXT NOT NULL REFERENCES bills(id),
  status TEXT NOT NULL CHECK (status IN ('refunded')),
  reason TEXT NOT NULL,
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales_return_lines (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES sales_returns(id),
  bill_line_id TEXT NOT NULL REFERENCES bill_lines(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  amount REAL NOT NULL
);
