-- CareGrid scheduling schema (SQLite dialect; portable to PostgreSQL / MySQL with minor type changes)
-- Date-times are stored as local facility time 'YYYY-MM-DDTHH:MM'. Template times are minutes from midnight.
PRAGMA foreign_keys = ON;

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

-- A role is a bookable capability: a staff profession, a machine type, a room type, a chair, a bed or a vehicle.
CREATE TABLE roles (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('person','machine','room','chair','bed','vehicle')),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  turnover_min INTEGER NOT NULL DEFAULT 0          -- cleaning / reprocessing / reset time after each use
);

CREATE TABLE resources (
  id INTEGER PRIMARY KEY,
  role_code TEXT NOT NULL REFERENCES roles(code),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  capacity INTEGER NOT NULL DEFAULT 1,             -- concurrent patients (dialysis nurse = 3, hyperbaric chamber = 6)
  always_on INTEGER NOT NULL DEFAULT 0,            -- 24x7 resources keep running on facility holidays
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_resources_role ON resources(role_code);

-- Recurring weekly working pattern. end_min may exceed 1440 for overnight windows.
CREATE TABLE resource_templates (
  id INTEGER PRIMARY KEY,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  tag TEXT NOT NULL DEFAULT 'general' CHECK (tag IN ('general','urgent','walkin')),
  release_hours INTEGER NOT NULL DEFAULT 0,        -- reserved windows open to everyone this many hours before start
  week_parity INTEGER,                             -- NULL = every week; 0 / 1 = alternate weeks
  effective_from TEXT,
  effective_to TEXT
);
CREATE INDEX idx_templates_resource ON resource_templates(resource_id);

-- Facility-wide closures. 24x7 resources are not affected.
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL
);

-- Blocks on a resource: leave, maintenance, breakdown... Can repeat weekly.
CREATE TABLE resource_exceptions (
  id INTEGER PRIMARY KEY,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('leave','sick','training','conference','maintenance','breakdown','calibration','cleaning','other')),
  planned INTEGER NOT NULL DEFAULT 1,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  recur_weeks INTEGER,                             -- NULL = once; 1 = weekly; 2 = fortnightly; 4 = every 4 weeks
  recur_until TEXT,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'manual',           -- manual | hr_roster | maintenance_system | technician
  created_at TEXT NOT NULL
);
CREATE INDEX idx_exceptions_resource ON resource_exceptions(resource_id);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  sort INTEGER NOT NULL
);

CREATE TABLE appointment_types (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  setting TEXT,
  mode TEXT,
  pattern TEXT NOT NULL,
  duration_min INTEGER NOT NULL,                   -- patient-facing duration
  slot_step_min INTEGER NOT NULL,                  -- start-time granularity
  slot_model TEXT NOT NULL CHECK (slot_model IN ('fixed','capacity','block','open')),
  min_notice_min INTEGER NOT NULL DEFAULT 0,
  max_advance_days INTEGER NOT NULL DEFAULT 90,
  window_start INTEGER,                            -- earliest start (minute of day)
  window_end INTEGER,                              -- latest start (minute of day)
  recurring INTEGER NOT NULL DEFAULT 0,
  travel_min INTEGER NOT NULL DEFAULT 0,           -- home visits: travel before and after
  notes TEXT,
  prep_instructions TEXT,
  requires_consent INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Each requirement is one resource needed for one segment of the appointment.
-- Same role listed twice = two distinct resources. role_codes may hold alternatives 'a|b'.
CREATE TABLE type_requirements (
  id INTEGER PRIMARY KEY,
  type_id INTEGER NOT NULL REFERENCES appointment_types(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role_codes TEXT NOT NULL,
  offset_min INTEGER NOT NULL DEFAULT 0,           -- relative to patient start; negative = before arrival (e.g. drug prep)
  duration_min INTEGER,                            -- NULL = whole appointment
  is_primary INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_req_type ON type_requirements(type_id);

CREATE TABLE patients (
  id INTEGER PRIMARY KEY,
  mrn TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT,
  dob TEXT,
  phone TEXT,
  email TEXT,
  language TEXT,
  interpreter_needed INTEGER NOT NULL DEFAULT 0,
  mobility TEXT,
  allergies TEXT,
  payer TEXT,
  preferred_channel TEXT,
  notes TEXT
);

CREATE TABLE appointments (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  type_id INTEGER NOT NULL REFERENCES appointment_types(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('booked','confirmed','checked_in','in_progress','completed','no_show','cancelled')),
  priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent')),
  source TEXT NOT NULL DEFAULT 'desk',             -- desk | phone | portal | walkin | referral | series
  mode TEXT,
  at_risk INTEGER NOT NULL DEFAULT 0,              -- set when an exception hits one of its resources
  series_id TEXT,
  notes TEXT,
  checked_in_at TEXT,
  actual_start TEXT,
  actual_end TEXT,
  cancel_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_appt_start ON appointments(start_at);
CREATE INDEX idx_appt_patient ON appointments(patient_id);
CREATE INDEX idx_appt_status ON appointments(status);

-- Resource holds for an appointment. hold_* include turnover / travel buffers and are used for conflict checks.
CREATE TABLE appointment_resources (
  id INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  requirement_id INTEGER,
  resource_id INTEGER NOT NULL REFERENCES resources(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  hold_start TEXT NOT NULL,
  hold_end TEXT NOT NULL,
  released INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ar_resource ON appointment_resources(resource_id, hold_start);
CREATE INDEX idx_ar_appt ON appointment_resources(appointment_id);

CREATE TABLE reschedule_queue (
  id INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  exception_id INTEGER REFERENCES resource_exceptions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  type_id INTEGER NOT NULL REFERENCES appointment_types(id),
  earliest TEXT NOT NULL,
  latest TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'routine',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','offered','booked','removed')),
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE reminders (
  id INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  send_at TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','cancelled'))
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info','success','warning','critical')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  detail TEXT
);
