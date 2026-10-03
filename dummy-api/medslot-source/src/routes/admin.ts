import { Router } from "express";
import { z } from "zod";
import {hashPassword} from "../lib/password.js";
import { db, getSetting } from "../db.js";
import { idParam, parse, notFound, badRequest } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";
import { addDays, DATE_RE, diffMinutes, nowLocal, todayLocal, weekday, timeToMinutes } from "../lib/time.js";

export const adminRouter = Router();
const admin = requireRole("admin");

/* ---------- KPIs ---------- */
adminRouter.get("/kpis", (req, res) => {
  const to = DATE_RE.test(String(req.query.to)) ? String(req.query.to) : todayLocal();
  const from = DATE_RE.test(String(req.query.from)) ? String(req.query.from) : addDays(to, -29);
  const dept = req.query.department_id ? Number(req.query.department_id) : null;
  const range = [`${from}T00:00`, `${addDays(to, 1)}T00:00`];
  const provider=req.user!.role==="provider";
  const dWhere = (dept ? " AND a.department_id = ?" : "")+(provider?" AND EXISTS(SELECT 1 FROM appointment_resources ar WHERE ar.appointment_id=a.id AND ar.resource_id=?)":"");
  const dArgs = [...(dept?[dept]:[]),...(provider?[req.user!.resource_id!]:[])];

  const byStatus = Object.fromEntries((db.prepare(`SELECT a.status, COUNT(*) n FROM appointments a WHERE a.start_at >= ? AND a.start_at < ?${dWhere} GROUP BY a.status`)
    .all(...range, ...dArgs) as { status: string; n: number }[]).map((r) => [r.status, r.n]));
  const total = Object.values(byStatus).reduce((a: number, b) => a + (b as number), 0);
  const now = nowLocal();
  // Rates use only appointments whose outcome is known (start time has passed).
  const past = db.prepare(`SELECT
      SUM(status = 'completed') completed, SUM(status = 'no_show') no_show, SUM(status = 'cancelled') cancelled,
      SUM(status IN ('completed','no_show','checked_in','in_progress')) attended_base
    FROM appointments a WHERE a.start_at >= ? AND a.start_at < ? AND a.start_at < ? AND a.status <> 'rescheduled'${dWhere}`).get(...range, now, ...dArgs) as Record<string, number | null>;
  const pastTotal = (past.attended_base ?? 0) + (past.cancelled ?? 0);
  const lead = db.prepare(`SELECT AVG(julianday(a.start_at) - julianday(a.requested_at)) v FROM appointments a
    WHERE a.start_at >= ? AND a.start_at < ? AND a.status NOT IN ('cancelled','rescheduled')${dWhere}`).get(...range, ...dArgs) as { v: number | null };
  const wait = db.prepare(`SELECT AVG((julianday(a.started_at) - julianday(a.checked_in_at)) * 1440) v FROM appointments a
    WHERE a.start_at >= ? AND a.start_at < ? AND a.started_at IS NOT NULL AND a.checked_in_at IS NOT NULL${dWhere}`).get(...range, ...dArgs) as { v: number | null };
  const punctual = db.prepare(`SELECT AVG((julianday(a.checked_in_at) - julianday(a.start_at)) * 1440) v FROM appointments a
    WHERE a.start_at >= ? AND a.start_at < ? AND a.checked_in_at IS NOT NULL${dWhere}`).get(...range, ...dArgs) as { v: number | null };
  const kinds = Object.fromEntries((db.prepare(`SELECT a.patient_kind k, COUNT(*) n FROM appointments a WHERE a.start_at >= ? AND a.start_at < ? AND a.status <> 'rescheduled'${dWhere} GROUP BY k`)
    .all(...range, ...dArgs) as { k: string; n: number }[]).map((r) => [r.k, r.n]));
  const sources = db.prepare(`SELECT a.source, COUNT(*) n FROM appointments a WHERE a.start_at >= ? AND a.start_at < ? AND a.status <> 'rescheduled'${dWhere} GROUP BY a.source ORDER BY n DESC`).all(...range, ...dArgs);
  const trend = db.prepare(`SELECT substr(a.start_at,1,10) date, COUNT(*) total, SUM(status='completed') completed, SUM(status='no_show') no_show, SUM(status='cancelled') cancelled
    FROM appointments a WHERE a.start_at >= ? AND a.start_at < ? AND a.status <> 'rescheduled'${dWhere} GROUP BY date ORDER BY date`).all(...range, ...dArgs);
  const byDept = db.prepare(`SELECT d.id, d.name, d.color, COUNT(a.id) total, SUM(a.status='no_show') no_show, SUM(a.status='completed') completed
    FROM departments d LEFT JOIN appointments a ON a.department_id = d.id AND a.start_at >= ? AND a.start_at < ? AND a.status <> 'rescheduled' ${provider?"AND EXISTS(SELECT 1 FROM appointment_resources ar WHERE ar.appointment_id=a.id AND ar.resource_id=?)":""}
    WHERE d.active = 1 ${dept ? "AND d.id = ?" : ""} GROUP BY d.id ORDER BY total DESC`).all(...range,...(provider?[req.user!.resource_id]:[]),...(dept?[dept]:[]));
  const topServices = db.prepare(`SELECT s.name, s.category, COUNT(*) n FROM appointments a JOIN services s ON s.id = a.service_id
    WHERE a.start_at >= ? AND a.start_at < ? AND a.status <> 'rescheduled'${dWhere} GROUP BY s.id ORDER BY n DESC LIMIT 6`).all(...range, ...dArgs);
  const notif = provider?{}:Object.fromEntries((db.prepare(`SELECT status, COUNT(*) n FROM notifications WHERE created_at >= ? GROUP BY status`).all(from) as { status: string; n: number }[]).map((r) => [r.status, r.n]));

  // Utilisation = booked minutes / scheduled minutes per resource over the range (capped at 14 resources).
  const resources = db.prepare(`SELECT r.id, r.name, r.capacity, rt.name type_name FROM resources r JOIN resource_types rt ON rt.id = r.resource_type_id
    WHERE r.active = 1 ${dept ? "AND r.department_id = ?" : ""} ${provider?"AND r.id=?":""}`).all(...dArgs) as { id: number; name: string; capacity: number; type_name: string }[];
  const sched = db.prepare("SELECT weekday, start_time, end_time FROM schedules WHERE resource_id = ?");
  const booked = db.prepare(`SELECT ar.start_at, ar.end_at FROM appointment_resources ar JOIN appointments a ON a.id = ar.appointment_id
    WHERE ar.resource_id = ? AND ar.start_at >= ? AND ar.start_at < ? AND a.status IN ('scheduled','confirmed','checked_in','in_progress','completed','requested')`);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const utilisation = resources.map((r) => {
    const rows = sched.all(r.id) as { weekday: number; start_time: string; end_time: string }[];
    let open = 0;
    for (let i = 0; i < days; i++) {
      const wd = weekday(addDays(from, i));
      for (const s of rows) if (s.weekday === wd) open += timeToMinutes(s.end_time) - timeToMinutes(s.start_time);
    }
    const used = (booked.all(r.id, ...range) as { start_at: string; end_at: string }[]).reduce((m, b) => m + diffMinutes(b.start_at, b.end_at), 0);
    return { id: r.id, name: r.name, type_name: r.type_name, open_minutes: open * r.capacity, booked_minutes: used, rate: open ? Math.min(1, used / (open * r.capacity)) : 0 };
  }).filter((u) => u.open_minutes > 0).sort((a, b) => b.rate - a.rate);
  const totalOpen = utilisation.reduce((a, u) => a + u.open_minutes, 0);
  const totalUsed = utilisation.reduce((a, u) => a + u.booked_minutes, 0);

  const today = todayLocal();
  const todayStats = db.prepare(`SELECT COUNT(*) total, SUM(status IN ('checked_in','in_progress')) waiting, SUM(status = 'completed') done,
      SUM(status IN ('scheduled','confirmed','requested')) upcoming FROM appointments a WHERE substr(a.start_at,1,10) = ? AND a.status NOT IN ('cancelled','rescheduled')${dWhere}`).get(today, ...dArgs);

  res.json({
    from, to, total, by_status: byStatus,
    rates: {
      completion: pastTotal ? (past.completed ?? 0) / pastTotal : 0,
      no_show: pastTotal ? (past.no_show ?? 0) / pastTotal : 0,
      cancellation: pastTotal ? (past.cancelled ?? 0) / pastTotal : 0,
      utilisation: totalOpen ? totalUsed / totalOpen : 0,
    },
    avg_lead_days: lead.v ?? 0,
    avg_wait_minutes: wait.v ?? 0,
    avg_arrival_offset_minutes: punctual.v ?? 0,
    patient_kinds: kinds, sources, trend, by_department: byDept, top_services: topServices,
    utilisation: utilisation.slice(0, 14), notifications: notif, today: todayStats,
  });
});

/* ---------- Audit log ---------- */
adminRouter.get("/audit", admin, (req, res) => {
  const where = ["1=1"]; const args: unknown[] = [];
  if (req.query.entity) { where.push("entity = ?"); args.push(String(req.query.entity)); }
  if (req.query.action) { where.push("action = ?"); args.push(String(req.query.action)); }
  if (req.query.user_id) { where.push("user_id = ?"); args.push(Number(req.query.user_id)); }
  if (req.query.q) { where.push("(user_name LIKE ? OR entity_id = ?)"); args.push(`%${req.query.q}%`, String(req.query.q)); }
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const total = (db.prepare(`SELECT COUNT(*) n FROM audit_logs WHERE ${where.join(" AND ")}`).get(...args) as { n: number }).n;
  res.json({ total, items: db.prepare(`SELECT * FROM audit_logs WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset) });
});

/* ---------- Users ---------- */
const user = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["admin", "scheduler", "provider"]),
  resource_id: z.number().int().positive().nullish(),
  active: z.boolean().default(true),
  password: z.string().min(10, "Use at least 10 characters").regex(/[A-Z]/, "Add an uppercase letter").regex(/[0-9]/, "Add a number").optional().or(z.literal("")),
});

adminRouter.get("/users", admin, (_req, res) => {
  const rows = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.resource_id, u.active, u.last_login_at, u.created_at, r.name AS resource_name
    FROM users u LEFT JOIN resources r ON r.id = u.resource_id ORDER BY u.name`).all() as Record<string, any>[];
  res.json(rows.map((r) => ({ ...r, active: !!r.active })));
});
adminRouter.post("/users", admin, (req, res) => {
  const b = parse(user, req.body);
  if (!b.password) throw badRequest("Set a password for the new user");
  const info = db.prepare("INSERT INTO users (name, email, password_hash, role, resource_id, active) VALUES (?,?,?,?,?,?)")
    .run(b.name, b.email, hashPassword(b.password), b.role, b.resource_id ?? null, b.active ? 1 : 0);
  audit(req, "create", "user", Number(info.lastInsertRowid));
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
adminRouter.put("/users/:id", admin, (req, res) => {
  const id = idParam(req);
  if(db.prepare("SELECT 1 FROM host_identity WHERE user_id=?").get(id)) throw badRequest("Workspace identities are managed by the host administrator");
  const b = parse(user, req.body);
  if (id === req.user!.id && (!b.active || b.role !== "admin")) throw badRequest("You can't remove your own admin access");
  const info = db.prepare("UPDATE users SET name=?, email=?, role=?, resource_id=?, active=? WHERE id=?").run(b.name, b.email, b.role, b.resource_id ?? null, b.active ? 1 : 0, id);
  if (!info.changes) throw notFound("User");
  if (b.password) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(b.password), id);
  audit(req, "update", "user", id, { password_changed: !!b.password });
  res.json({ ok: true });
});

/* ---------- Settings ---------- */
const SETTING_KEYS = ["facility_name", "channel_email_enabled", "channel_sms_enabled", "channel_whatsapp_enabled", "reminder_hours", "booking_horizon_days", "min_notice_minutes", "default_slot_minutes"] as const;
adminRouter.get("/settings", (_req, res) => {
  res.json({ ...Object.fromEntries(SETTING_KEYS.map((k) => [k, getSetting(k)])), facility_now: nowLocal() });
});
adminRouter.put("/settings", admin, (req, res) => {
  const b = parse(z.object({
    facility_name: z.string().trim().min(2),
    channel_email_enabled: z.enum(["0", "1"]),
    channel_sms_enabled: z.enum(["0", "1"]),
    channel_whatsapp_enabled: z.enum(["0", "1"]),
    reminder_hours: z.string().regex(/^\d+(,\d+)*$/, "Use hours separated by commas, like 24,2"),
    booking_horizon_days: z.string().regex(/^\d+$/),
    min_notice_minutes: z.string().regex(/^\d+$/),
    default_slot_minutes: z.enum(["10", "15", "20", "30", "45", "60"]),
  }), req.body);
  const up = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db.transaction(() => { for (const [k, v] of Object.entries(b)) up.run(k, v); })();
  audit(req, "update", "settings", null);
  res.json({ ok: true });
});
