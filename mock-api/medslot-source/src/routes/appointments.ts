import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { idParam, parse, notFound, badRequest } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";
import { addDays, DATE_RE, DT_RE, nowLocal, todayLocal } from "../lib/time.js";
import { changeDuration, changeStatus, createAppointment, reschedule, TRANSITIONS, type Status } from "../lib/booking.js";
import { notifyLater, type NotifEvent } from "../lib/notify.js";
import { getAvailability, resourceDayGrid } from "../lib/availability.js";

export const appointmentsRouter = Router();
const staff = requireRole("admin", "scheduler");
const anyone = requireRole("admin", "scheduler", "provider");

const pick = z.object({ resource_id: z.number().int().positive(), role: z.string().default("") });
const create = z.object({
  patient_id: z.number({ required_error: "Choose a patient" }).int().positive(),
  patient_kind: z.enum(["new", "existing"]),
  service_id: z.number({ required_error: "Choose a service" }).int().positive(),
  start_at: z.string().regex(DT_RE, "Choose a time slot"),
  duration_minutes: z.number().int().min(5).max(1440).optional(),
  resources: z.array(pick).default([]),
  reason: z.string().trim().min(3, "Reason for visit is required"),
  visit_type: z.enum(["new_visit", "follow_up", "review", "procedure", "emergency"]),
  priority: z.enum(["routine", "urgent", "emergency"]).default("routine"),
  source: z.enum(["front_desk", "phone", "online", "walk_in", "referral", "whatsapp"]),
  notes: z.string().trim().max(2000).nullish(),
  referral_source: z.string().trim().nullish(),
  order_ref: z.string().trim().nullish(),
  preferred_at: z.string().regex(DT_RE).nullish(),
  notify_channels: z.array(z.enum(["email", "sms", "whatsapp"])).default(["sms", "email"]),
  status: z.enum(["requested", "scheduled", "confirmed"]).optional(),
});

const SELECT = `
  SELECT a.*, p.first_name, p.last_name, p.mrn, p.phone, p.is_provisional, p.dob, p.sex,
    s.name AS service_name, s.category AS service_category, d.name AS department_name, d.color AS department_color,
    u.name AS booked_by_name,
    (SELECT json_group_array(json_object('id', r.id, 'name', r.name, 'role', ar.role, 'type_name', rt.name))
       FROM appointment_resources ar JOIN resources r ON r.id = ar.resource_id JOIN resource_types rt ON rt.id = r.resource_type_id
       WHERE ar.appointment_id = a.id) AS resources_json
  FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN services s ON s.id = a.service_id
  JOIN departments d ON d.id = a.department_id LEFT JOIN users u ON u.id = a.booked_by`;

const shape = (r: Record<string, any>) => {
  const { resources_json, ...rest } = r;
  return { ...rest, is_provisional: !!r.is_provisional, resources: JSON.parse(resources_json ?? "[]"), allowed: TRANSITIONS[r.status as Status] ?? [] };
};

appointmentsRouter.get("/", anyone, (req, res) => {
  const where = ["1=1"]; const args: unknown[] = [];
  const q = req.query;
  if (q.from) { where.push("a.start_at >= ?"); args.push(`${q.from}T00:00`); }
  if (q.to) { where.push("a.start_at < ?"); args.push(`${addDays(String(q.to), 1)}T00:00`); }
  if (q.status) { const st = String(q.status).split(","); where.push(`a.status IN (${st.map(() => "?").join(",")})`); args.push(...st); }
  if (q.department_id) { where.push("a.department_id = ?"); args.push(Number(q.department_id)); }
  if (q.service_id) { where.push("a.service_id = ?"); args.push(Number(q.service_id)); }
  if (q.patient_id) { where.push("a.patient_id = ?"); args.push(Number(q.patient_id)); }
  if (q.category) { where.push("s.category = ?"); args.push(String(q.category)); }
  if (q.resource_id) { where.push("a.id IN (SELECT appointment_id FROM appointment_resources WHERE resource_id = ?)"); args.push(Number(q.resource_id)); }
  if (q.q) { where.push("(a.ref_code LIKE ? OR p.first_name || ' ' || p.last_name LIKE ? OR p.mrn LIKE ?)"); const l = `%${q.q}%`; args.push(l, l, l); }
  if (req.user!.role === "provider" && req.user!.resource_id) {
    where.push("a.id IN (SELECT appointment_id FROM appointment_resources WHERE resource_id = ?)"); args.push(req.user!.resource_id);
  }
  const limit = Math.min(Number(q.limit ?? 100), 500);
  const offset = Math.max(Number(q.offset ?? 0), 0);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN services s ON s.id = a.service_id WHERE ${where.join(" AND ")}`).get(...args) as { n: number }).n;
  const rows = db.prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY a.start_at ${q.order === "desc" ? "DESC" : "ASC"} LIMIT ? OFFSET ?`).all(...args, limit, offset) as Record<string, any>[];
  res.json({ total, items: rows.map(shape) });
});

/** Everything a resource calendar needs for a date range: resources, working hours, blocks, holidays, appointments. */
appointmentsRouter.get("/calendar", anyone, (req, res) => {
  const from = String(req.query.from ?? todayLocal());
  const to = String(req.query.to ?? from);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) throw badRequest("Invalid date range");
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (span > 42) throw badRequest("Choose a range of 6 weeks or less");

  const where = ["r.active = 1"]; const args: unknown[] = [];
  if (req.query.resource_ids) { const ids = String(req.query.resource_ids).split(",").map(Number).filter(Boolean); where.push(`r.id IN (${ids.map(() => "?").join(",") || "NULL"})`); args.push(...ids); }
  if (req.query.department_id) { where.push("r.department_id = ?"); args.push(Number(req.query.department_id)); }
  if (req.query.resource_type_id) { where.push("r.resource_type_id = ?"); args.push(Number(req.query.resource_type_id)); }
  if (req.query.category) { where.push("rt.category = ?"); args.push(String(req.query.category)); }
  if (req.user!.role === "provider" && req.user!.resource_id && !req.query.resource_ids) { where.push("r.id = ?"); args.push(req.user!.resource_id); }
  const resources = db.prepare(`SELECT r.id, r.name, r.title, r.slot_minutes, r.capacity, r.color, r.location, rt.name AS type_name, rt.category, d.name AS department_name, d.color AS department_color
    FROM resources r JOIN resource_types rt ON rt.id = r.resource_type_id JOIN departments d ON d.id = r.department_id
    WHERE ${where.join(" AND ")} ORDER BY d.name, rt.category, r.name LIMIT 40`).all(...args) as { id: number }[];

  const ids = resources.map((r) => r.id);
  const grids: Record<string, Record<number, ReturnType<typeof resourceDayGrid>>> = {};
  if (span <= 14) {
    for (let i = 0; i < span; i++) {
      const date = addDays(from, i);
      grids[date] = {};
      for (const id of ids) grids[date][id] = resourceDayGrid(id, date);
    }
  }
  const appts = ids.length ? (db.prepare(`${SELECT} WHERE a.start_at >= ? AND a.start_at < ? AND a.status NOT IN ('rescheduled')
      AND a.id IN (SELECT appointment_id FROM appointment_resources WHERE resource_id IN (${ids.map(() => "?").join(",")}))
      ORDER BY a.start_at`).all(`${from}T00:00`, `${addDays(to, 1)}T00:00`, ...ids) as Record<string, any>[]).map(shape) : [];
  const holidays = db.prepare("SELECT date, name, department_id FROM holidays WHERE date BETWEEN ? AND ?").all(from, to);
  res.json({ from, to, resources, grids, appointments: appts, holidays });
});

appointmentsRouter.get("/:id", anyone, (req, res) => {
  const id = idParam(req);
  const row = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Record<string, any> | undefined;
  if (!row) throw notFound("Appointment");
  audit(req, "view", "appointment", id);
  res.json({
    ...shape(row),
    events: db.prepare(`SELECT e.*, u.name AS user_name FROM appointment_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.appointment_id = ? ORDER BY e.id`).all(id),
    notifications: db.prepare("SELECT id, event, channel, status, error, created_at, sent_at FROM notifications WHERE appointment_id = ? ORDER BY id DESC").all(id),
  });
});

appointmentsRouter.post("/", staff, (req, res) => {
  const b = parse(create, req.body);
  const id = createAppointment(b, req.user!);
  audit(req, "create", "appointment", id, { service_id: b.service_id, start_at: b.start_at });
  notifyLater(id, b.status === "confirmed" ? "confirmed" : "booked");
  res.status(201).json(shape(db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Record<string, any>));
});

const EVENT_FOR: Partial<Record<Status, NotifEvent>> = { confirmed: "confirmed", cancelled: "cancelled", no_show: "no_show", checked_in: "checked_in", completed: "completed" };

appointmentsRouter.post("/:id/status", anyone, (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({
    status: z.enum(["requested", "scheduled", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show"]),
    note: z.string().trim().max(500).nullish(),
  }), req.body);
  if (req.user!.role === "provider" && ["cancelled", "confirmed", "scheduled"].includes(b.status)) throw badRequest("Ask the front desk to change this booking");
  const r = changeStatus(id, b.status, req.user!, b.note ?? undefined);
  audit(req, "status", "appointment", id, r);
  const ev = EVENT_FOR[b.status];
  if (ev) notifyLater(id, ev);
  res.json(shape(db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Record<string, any>));
});

appointmentsRouter.post("/:id/reschedule", staff, (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({
    start_at: z.string().regex(DT_RE, "Choose a new time"),
    duration_minutes: z.number().int().min(5).max(1440).optional(),
    resources: z.array(pick).default([]),
    reason: z.string().trim().min(3, "Reason for rescheduling is required"),
  }), req.body);
  const newId = reschedule(id, b.start_at, b.resources, b.duration_minutes, b.reason, req.user!);
  audit(req, "reschedule", "appointment", id, { new_id: newId, start_at: b.start_at });
  notifyLater(newId, "rescheduled");
  res.json(shape(db.prepare(`${SELECT} WHERE a.id = ?`).get(newId) as Record<string, any>));
});

appointmentsRouter.post("/:id/duration", anyone, (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ duration_minutes: z.number().int().min(5).max(1440) }), req.body);
  changeDuration(id, b.duration_minutes, req.user!);
  audit(req, "duration", "appointment", id, b);
  res.json(shape(db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Record<string, any>));
});

export const availabilityRouter = Router();
availabilityRouter.get("/", (req, res) => {
  const q = parse(z.object({
    service_id: z.coerce.number().int().positive(),
    from: z.string().regex(DATE_RE).default(todayLocal()),
    days: z.coerce.number().int().min(1).max(31).default(7),
    resource_id: z.coerce.number().int().positive().optional(),
    duration_minutes: z.coerce.number().int().min(5).max(1440).optional(),
    exclude_appointment_id: z.coerce.number().int().positive().optional(),
  }), req.query);
  const data = getAvailability({ serviceId: q.service_id, from: q.from, days: q.days, resourceId: q.resource_id, durationMinutes: q.duration_minutes, excludeAppointmentId: q.exclude_appointment_id });
  res.json({ ...data, now: nowLocal() });
});
