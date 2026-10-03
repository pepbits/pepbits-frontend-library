import Database from "../../reference-sqlite.mjs";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });

export const db = new Database(config.databaseFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

const schema = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','scheduler','provider')),
  resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#0F7A68',
  location TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS specialties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (department_id, name)
);

-- What kind of thing a resource is: a person, room, bed, chair, machine...
CREATE TABLE IF NOT EXISTS resource_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('person','room','bed','chair','equipment','other')),
  default_slot_minutes INTEGER NOT NULL DEFAULT 15,
  icon TEXT NOT NULL DEFAULT 'box'
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  resource_type_id INTEGER NOT NULL REFERENCES resource_types(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  specialty_id INTEGER REFERENCES specialties(id) ON DELETE SET NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 15 CHECK (slot_minutes BETWEEN 5 AND 480),
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  location TEXT,
  title TEXT,
  description TEXT,
  color TEXT,
  online_booking INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resources_dept ON resources(department_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type_id);

-- Weekly working hours. Several rows per weekday allowed (split shifts).
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slot_minutes INTEGER,
  effective_from TEXT,
  effective_to TEXT,
  CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_schedules_res ON schedules(resource_id, weekday);

-- Leave, maintenance, blocked time for a single resource.
CREATE TABLE IF NOT EXISTS resource_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'leave' CHECK (kind IN ('leave','maintenance','meeting','blocked')),
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  CHECK (start_at < end_at)
);
CREATE INDEX IF NOT EXISTS idx_blocks_res ON resource_blocks(resource_id, start_at);

-- Facility-wide or department-wide closed days.
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE (date, department_id)
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('consultation','lab','radiology','dental','surgery','pharmacy','therapy','procedure','vaccination','telehealth','admission')),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  specialty_id INTEGER REFERENCES specialties(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  prep_instructions TEXT,
  requires_order INTEGER NOT NULL DEFAULT 0,
  requires_referral INTEGER NOT NULL DEFAULT 0,
  online_booking INTEGER NOT NULL DEFAULT 1,
  price REAL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which resource types a service needs at the same time (e.g. surgery = surgeon + OR + anaesthetist).
CREATE TABLE IF NOT EXISTS service_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  resource_type_id INTEGER NOT NULL REFERENCES resource_types(id),
  role TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Which individual resources can deliver a service.
CREATE TABLE IF NOT EXISTS service_resources (
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, resource_id)
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT,
  sex TEXT CHECK (sex IN ('female','male','other','unknown')),
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  preferred_language TEXT DEFAULT 'English',
  insurance_provider TEXT,
  insurance_member_id TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  is_provisional INTEGER NOT NULL DEFAULT 0,
  sms_opt_in INTEGER NOT NULL DEFAULT 1,
  email_opt_in INTEGER NOT NULL DEFAULT 1,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_code TEXT NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','scheduled','confirmed','checked_in','in_progress','completed','cancelled','no_show','rescheduled')),
  patient_kind TEXT NOT NULL CHECK (patient_kind IN ('new','existing')),
  visit_type TEXT NOT NULL DEFAULT 'new_visit' CHECK (visit_type IN ('new_visit','follow_up','review','procedure','emergency')),
  priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','emergency')),
  source TEXT NOT NULL DEFAULT 'front_desk' CHECK (source IN ('front_desk','phone','online','walk_in','referral','whatsapp')),
  reason TEXT NOT NULL,
  notes TEXT,
  referral_source TEXT,
  order_ref TEXT,
  requested_at TEXT NOT NULL,
  preferred_at TEXT,
  booked_by INTEGER REFERENCES users(id),
  confirmed_at TEXT,
  checked_in_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  no_show_at TEXT,
  rescheduled_from_id INTEGER REFERENCES appointments(id),
  rescheduled_to_id INTEGER REFERENCES appointments(id),
  notify_channels TEXT NOT NULL DEFAULT 'sms,email',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (start_at < end_at)
);
CREATE INDEX IF NOT EXISTS idx_appt_start ON appointments(start_at);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status);

-- Every resource an appointment occupies. Overlap checks run on this table.
CREATE TABLE IF NOT EXISTS appointment_resources (
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id),
  role TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  PRIMARY KEY (appointment_id, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_ar_res_time ON appointment_resources(resource_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS appointment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Message templates. Resolution order: resource > resource_type > specialty > department > global.
CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL CHECK (event IN ('booked','confirmed','reminder','rescheduled','cancelled','no_show','checked_in','completed')),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','specialty','resource_type','resource')),
  scope_id INTEGER NOT NULL DEFAULT 0,
  subject TEXT,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event, channel, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id INTEGER REFERENCES patients(id),
  event TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  template_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','not_configured','opted_out')),
  error TEXT,
  provider_ref TEXT,
  dedupe_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_appt ON notifications(appointment_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);
`;

export function migrate() {
  db.exec(schema);
  const defaults: Record<string, string> = {
    facility_name: "MedSlot General Hospital",
    channel_email_enabled: "1",
    channel_sms_enabled: "1",
    channel_whatsapp_enabled: "1",
    reminder_hours: "24,2",
    booking_horizon_days: "90",
    min_notice_minutes: "0",
    default_slot_minutes: "15",
  };
  const ins = db.prepare("INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
}

export function getSetting(key: string, fallback = ""): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}
