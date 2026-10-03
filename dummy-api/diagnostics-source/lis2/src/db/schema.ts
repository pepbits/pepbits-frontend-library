import { REGISTRY, registryByKey } from '../masters/registry';

function masterDDL(): string {
  return REGISTRY.map((e) => {
    const cols = e.fields.map((fd) => {
      if (fd.type === 'password') return 'password_hash TEXT';
      if (fd.type === 'ref') return `${fd.name} INTEGER REFERENCES ${registryByKey.get(fd.ref!)!.table}(id)`;
      const t = fd.type === 'number' || fd.type === 'bool' ? (fd.type === 'bool' ? 'INTEGER' : 'REAL') : 'TEXT';
      const def = fd.default !== undefined ? ` DEFAULT ${typeof fd.default === 'number' ? fd.default : `'${fd.default}'`}` : '';
      return `${fd.name} ${t}${def}`;
    });
    const uniq = e.unique ? `, UNIQUE(${e.unique.join(',')})` : '';
    return `CREATE TABLE IF NOT EXISTS ${e.table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols.join(', ')},
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))${uniq});`;
  }).join('\n');
}

export const TRANSACTIONAL_DDL = `
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT, mrn TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT,
  dob TEXT, gender TEXT NOT NULL DEFAULT 'U', ethnicity_id INTEGER REFERENCES m_ethnicities(id), pregnant INTEGER DEFAULT 0,
  phone TEXT, email TEXT, address TEXT, national_id TEXT, source_facility_id INTEGER REFERENCES m_facilities(id),
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_pat_name ON patients(last_name, first_name);
CREATE TABLE IF NOT EXISTS patient_identifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id), facility_id INTEGER REFERENCES m_facilities(id),
  identifier TEXT NOT NULL, id_type TEXT DEFAULT 'MR', UNIQUE(facility_id, identifier));

CREATE TABLE IF NOT EXISTS encounters (
  id INTEGER PRIMARY KEY AUTOINCREMENT, encounter_no TEXT UNIQUE NOT NULL, patient_id INTEGER NOT NULL REFERENCES patients(id),
  type TEXT NOT NULL DEFAULT 'OP', facility_id INTEGER REFERENCES m_facilities(id), location_id INTEGER REFERENCES m_locations(id),
  doctor_id INTEGER REFERENCES m_doctors(id), external_encounter_no TEXT, bed TEXT, status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_enc_ext ON encounters(facility_id, external_encounter_no);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT UNIQUE NOT NULL, patient_id INTEGER NOT NULL REFERENCES patients(id),
  encounter_id INTEGER REFERENCES encounters(id), facility_id INTEGER REFERENCES m_facilities(id),
  source TEXT NOT NULL DEFAULT 'INTERNAL', external_order_no TEXT, priority TEXT NOT NULL DEFAULT 'ROUTINE',
  doctor_id INTEGER REFERENCES m_doctors(id), clinical_info TEXT, diagnosis TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
  message_id INTEGER, created_by INTEGER REFERENCES users(id), created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_ord_pat ON orders(patient_id);
CREATE INDEX IF NOT EXISTS ix_ord_ext ON orders(facility_id, external_order_no);

CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sample_no TEXT UNIQUE NOT NULL, patient_id INTEGER NOT NULL REFERENCES patients(id),
  sample_type_id INTEGER REFERENCES m_sample_types(id), container_id INTEGER REFERENCES m_containers(id),
  body_site_id INTEGER REFERENCES m_body_sites(id), laterality TEXT, external_sample_no TEXT, facility_id INTEGER REFERENCES m_facilities(id),
  status TEXT NOT NULL DEFAULT 'COLLECTED', priority TEXT DEFAULT 'ROUTINE',
  collected_at TEXT, collected_by INTEGER REFERENCES users(id), received_at TEXT, received_by INTEGER REFERENCES users(id),
  rejection_reason_id INTEGER REFERENCES m_rejection_reasons(id), rejection_note TEXT, storage_location TEXT,
  created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_smp_ext ON samples(external_sample_no);

CREATE TABLE IF NOT EXISTS outsource_shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, manifest_no TEXT UNIQUE NOT NULL, outsource_lab_id INTEGER NOT NULL REFERENCES m_outsource_labs(id),
  status TEXT NOT NULL DEFAULT 'CREATED', courier TEXT, tracking_no TEXT, notes TEXT, dispatched_at TEXT,
  created_by INTEGER REFERENCES users(id), created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id), test_id INTEGER NOT NULL REFERENCES m_tests(id),
  status TEXT NOT NULL DEFAULT 'ORDERED', priority TEXT NOT NULL DEFAULT 'ROUTINE', price REAL DEFAULT 0,
  sample_id INTEGER REFERENCES samples(id), body_site_id INTEGER REFERENCES m_body_sites(id),
  is_outsourced INTEGER DEFAULT 0, outsource_lab_id INTEGER REFERENCES m_outsource_labs(id), shipment_id INTEGER REFERENCES outsource_shipments(id),
  due_at TEXT, received_at TEXT, resulted_at TEXT, validated_at TEXT, validated_by INTEGER REFERENCES users(id),
  signed_at TEXT, signed_by INTEGER REFERENCES users(id), report_version INTEGER DEFAULT 0, amend_reason TEXT,
  is_critical INTEGER DEFAULT 0, is_abnormal INTEGER DEFAULT 0, has_delta INTEGER DEFAULT 0, interpretation TEXT,
  sent_back_reason TEXT, reagent_consumed INTEGER DEFAULT 0, external_line_no TEXT, cancelled_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_oi_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS ix_oi_sample ON order_items(sample_id);
CREATE INDEX IF NOT EXISTS ix_oi_status ON order_items(status);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bill_no TEXT UNIQUE NOT NULL, order_id INTEGER NOT NULL REFERENCES orders(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id), payer_type TEXT DEFAULT 'SELF', facility_id INTEGER REFERENCES m_facilities(id),
  gross REAL DEFAULT 0, discount REAL DEFAULT 0, net REAL DEFAULT 0, paid REAL DEFAULT 0, status TEXT DEFAULT 'UNPAID',
  created_by INTEGER REFERENCES users(id), created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bill_id INTEGER NOT NULL REFERENCES bills(id), order_item_id INTEGER REFERENCES order_items(id),
  test_id INTEGER REFERENCES m_tests(id), amount REAL DEFAULT 0, status TEXT DEFAULT 'ACTIVE');
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bill_id INTEGER NOT NULL REFERENCES bills(id), amount REAL NOT NULL, mode TEXT NOT NULL,
  reference TEXT, created_by INTEGER REFERENCES users(id), created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS sample_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sample_id INTEGER NOT NULL REFERENCES samples(id), event TEXT NOT NULL, details TEXT,
  user_id INTEGER REFERENCES users(id), at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_item_id INTEGER NOT NULL REFERENCES order_items(id), parameter_id INTEGER NOT NULL REFERENCES m_parameters(id),
  value TEXT, numeric_value REAL, unit TEXT, flag TEXT, is_critical INTEGER DEFAULT 0, ref_low REAL, ref_high REAL, ref_text TEXT,
  prev_value TEXT, prev_at TEXT, delta_flag INTEGER DEFAULT 0, source TEXT DEFAULT 'MANUAL', analyzer_id INTEGER REFERENCES m_analyzers(id),
  raw_value TEXT, comment TEXT, entered_by INTEGER REFERENCES users(id), entered_at TEXT DEFAULT (datetime('now')), updated_at TEXT,
  UNIQUE(order_item_id, parameter_id));
CREATE TABLE IF NOT EXISTS result_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, result_id INTEGER NOT NULL REFERENCES results(id), old_value TEXT, new_value TEXT,
  source TEXT, reason TEXT, changed_by INTEGER REFERENCES users(id), at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS report_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_item_id INTEGER NOT NULL REFERENCES order_items(id), version INTEGER NOT NULL,
  kind TEXT NOT NULL, reason TEXT, addendum_text TEXT, snapshot TEXT, signed_by INTEGER REFERENCES users(id), signed_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS critical_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_item_id INTEGER NOT NULL REFERENCES order_items(id), result_id INTEGER REFERENCES results(id),
  status TEXT DEFAULT 'PENDING', notified_to TEXT, method TEXT, read_back INTEGER DEFAULT 0, notes TEXT,
  notified_by INTEGER REFERENCES users(id), notified_at TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS interface_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, interface_id INTEGER REFERENCES m_interfaces(id), facility_id INTEGER REFERENCES m_facilities(id),
  direction TEXT NOT NULL, protocol TEXT NOT NULL, message_type TEXT, control_id TEXT, transport TEXT, remote TEXT,
  raw TEXT NOT NULL, response TEXT, status TEXT NOT NULL, error TEXT, ref_type TEXT, ref_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')), processed_at TEXT);
CREATE INDEX IF NOT EXISTS ix_msg_status ON interface_messages(direction, status);

CREATE TABLE IF NOT EXISTS instrument_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sample_id INTEGER NOT NULL REFERENCES samples(id), analyzer_id INTEGER NOT NULL REFERENCES m_analyzers(id),
  order_item_id INTEGER NOT NULL REFERENCES order_items(id), order_codes TEXT, status TEXT DEFAULT 'QUEUED', message_id INTEGER REFERENCES interface_messages(id),
  created_at TEXT DEFAULT (datetime('now')), sent_at TEXT, resulted_at TEXT, UNIQUE(analyzer_id, order_item_id));

CREATE TABLE IF NOT EXISTS result_publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_item_id INTEGER NOT NULL REFERENCES order_items(id), order_id INTEGER NOT NULL REFERENCES orders(id),
  facility_id INTEGER REFERENCES m_facilities(id), interface_id INTEGER REFERENCES m_interfaces(id), event TEXT NOT NULL,
  report_version INTEGER, format TEXT NOT NULL, mode TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER DEFAULT 0, next_attempt_at TEXT DEFAULT (datetime('now')), last_error TEXT, message_id INTEGER REFERENCES interface_messages(id),
  created_at TEXT DEFAULT (datetime('now')), delivered_at TEXT, acked_at TEXT);
CREATE INDEX IF NOT EXISTS ix_pub_status ON result_publications(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS reagent_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, reagent_id INTEGER NOT NULL REFERENCES m_reagents(id), qty REAL NOT NULL, type TEXT NOT NULL,
  order_item_id INTEGER REFERENCES order_items(id), note TEXT, user_id INTEGER REFERENCES users(id), at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT, entity_id INTEGER,
  details TEXT, at TEXT DEFAULT (datetime('now')));
`;

export const SCHEMA_SQL = masterDDL() + '\n' + TRANSACTIONAL_DDL;
