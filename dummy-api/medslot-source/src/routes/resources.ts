import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { idParam, parse, notFound, badRequest, bools } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";
import { DT_RE, TIME_RE, DATE_RE } from "../lib/time.js";
import { OCCUPYING } from "../lib/availability.js";

export const resourcesRouter = Router();
const admin = requireRole("admin");
const B = ["active", "online_booking"];

const scheduleRow = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(TIME_RE, "Use HH:MM"),
  end_time: z.string().regex(TIME_RE, "Use HH:MM"),
  slot_minutes: z.number().int().min(5).max(480).nullish(),
  effective_from: z.string().regex(DATE_RE).nullish(),
  effective_to: z.string().regex(DATE_RE).nullish(),
}).refine((r) => r.start_time < r.end_time, { message: "Start must be before end", path: ["end_time"] });

const resource = z.object({
  name: z.string().trim().min(2, "Name is required"),
  title: z.string().trim().nullish(),
  resource_type_id: z.number({ required_error: "Choose a resource type" }).int().positive(),
  department_id: z.number({ required_error: "Choose a department" }).int().positive(),
  specialty_id: z.number().int().positive().nullish(),
  slot_minutes: z.number().int().min(5, "Minimum 5 minutes").max(480),
  capacity: z.number().int().min(1).max(100).default(1),
  location: z.string().trim().nullish(),
  description: z.string().trim().nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  online_booking: z.boolean().default(true),
  active: z.boolean().default(true),
  service_ids: z.array(z.number().int().positive()).optional(),
  schedules: z.array(scheduleRow).optional(),
});

function assertNoScheduleOverlap(rows: z.infer<typeof scheduleRow>[]) {
  for (let d = 0; d < 7; d++) {
    const day = rows.filter((r) => r.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < day.length; i++) {
      if (day[i].start_time < day[i - 1].end_time) throw badRequest("Working hours overlap on the same day. Adjust the shifts so they don't overlap");
    }
  }
}

resourcesRouter.get("/", (req, res) => {
  const where: string[] = ["1=1"]; const args: unknown[] = [];
  if (req.query.q) { where.push("(r.name LIKE ? OR r.title LIKE ? OR r.location LIKE ?)"); const l = `%${req.query.q}%`; args.push(l, l, l); }
  if (req.query.department_id) { where.push("r.department_id = ?"); args.push(Number(req.query.department_id)); }
  if (req.query.resource_type_id) { where.push("r.resource_type_id = ?"); args.push(Number(req.query.resource_type_id)); }
  if (req.query.category) { where.push("rt.category = ?"); args.push(String(req.query.category)); }
  if (req.query.specialty_id) { where.push("r.specialty_id = ?"); args.push(Number(req.query.specialty_id)); }
  if (req.query.active !== "all") where.push("r.active = 1");
  const rows = db.prepare(`
    SELECT r.*, rt.name AS type_name, rt.category, rt.icon, d.name AS department_name, d.color AS department_color, sp.name AS specialty_name,
      (SELECT COUNT(*) FROM schedules s WHERE s.resource_id = r.id) AS schedule_count
    FROM resources r JOIN resource_types rt ON rt.id = r.resource_type_id JOIN departments d ON d.id = r.department_id
    LEFT JOIN specialties sp ON sp.id = r.specialty_id
    WHERE ${where.join(" AND ")} ORDER BY d.name, rt.category, r.name`).all(...args) as Record<string, unknown>[];
  res.json(rows.map((r) => bools(r, B)));
});

resourcesRouter.get("/:id", (req, res) => {
  const id = idParam(req);
  const r = db.prepare(`SELECT r.*, rt.name AS type_name, rt.category, d.name AS department_name, sp.name AS specialty_name
    FROM resources r JOIN resource_types rt ON rt.id = r.resource_type_id JOIN departments d ON d.id = r.department_id
    LEFT JOIN specialties sp ON sp.id = r.specialty_id WHERE r.id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!r) throw notFound("Resource");
  res.json({
    ...bools(r, B),
    schedules: db.prepare("SELECT * FROM schedules WHERE resource_id = ? ORDER BY weekday, start_time").all(id),
    blocks: db.prepare("SELECT * FROM resource_blocks WHERE resource_id = ? AND end_at >= date('now','-30 day') ORDER BY start_at").all(id),
    services: db.prepare("SELECT s.id, s.name, s.category, s.duration_minutes FROM service_resources x JOIN services s ON s.id = x.service_id WHERE x.resource_id = ? ORDER BY s.name").all(id),
  });
});

function saveLinks(id: number, b: z.infer<typeof resource>) {
  if (b.service_ids) {
    db.prepare("DELETE FROM service_resources WHERE resource_id = ?").run(id);
    const ins = db.prepare("INSERT OR IGNORE INTO service_resources (service_id, resource_id) VALUES (?,?)");
    for (const s of b.service_ids) ins.run(s, id);
  }
  if (b.schedules) {
    assertNoScheduleOverlap(b.schedules);
    db.prepare("DELETE FROM schedules WHERE resource_id = ?").run(id);
    const ins = db.prepare("INSERT INTO schedules (resource_id, weekday, start_time, end_time, slot_minutes, effective_from, effective_to) VALUES (?,?,?,?,?,?,?)");
    for (const s of b.schedules) ins.run(id, s.weekday, s.start_time, s.end_time, s.slot_minutes ?? null, s.effective_from ?? null, s.effective_to ?? null);
  }
}

resourcesRouter.post("/", admin, (req, res) => {
  const b = parse(resource, req.body);
  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO resources (name, title, resource_type_id, department_id, specialty_id, slot_minutes, capacity, location, description, color, online_booking, active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.name, b.title ?? null, b.resource_type_id, b.department_id, b.specialty_id ?? null, b.slot_minutes, b.capacity,
      b.location ?? null, b.description ?? null, b.color ?? null, b.online_booking ? 1 : 0, b.active ? 1 : 0);
    const id = Number(info.lastInsertRowid);
    saveLinks(id, b);
    return id;
  })();
  audit(req, "create", "resource", id);
  res.status(201).json({ id });
});

resourcesRouter.put("/:id", admin, (req, res) => {
  const id = idParam(req);
  const b = parse(resource, req.body);
  db.transaction(() => {
    const info = db.prepare(`UPDATE resources SET name=?, title=?, resource_type_id=?, department_id=?, specialty_id=?, slot_minutes=?, capacity=?, location=?,
      description=?, color=?, online_booking=?, active=?, updated_at=datetime('now') WHERE id=?`).run(b.name, b.title ?? null, b.resource_type_id, b.department_id,
      b.specialty_id ?? null, b.slot_minutes, b.capacity, b.location ?? null, b.description ?? null, b.color ?? null, b.online_booking ? 1 : 0, b.active ? 1 : 0, id);
    if (!info.changes) throw notFound("Resource");
    saveLinks(id, b);
  })();
  audit(req, "update", "resource", id);
  res.json({ ok: true });
});

resourcesRouter.put("/:id/schedules", admin, (req, res) => {
  const id = idParam(req);
  const rows = parse(z.array(scheduleRow), req.body?.schedules);
  db.transaction(() => saveLinks(id, { schedules: rows } as z.infer<typeof resource>))();
  audit(req, "update_schedule", "resource", id, { rows: rows.length });
  res.json({ ok: true });
});

const block = z.object({
  start_at: z.string().regex(DT_RE, "Use a valid date and time"),
  end_at: z.string().regex(DT_RE, "Use a valid date and time"),
  kind: z.enum(["leave", "maintenance", "meeting", "blocked"]),
  reason: z.string().trim().nullish(),
}).refine((b) => b.start_at < b.end_at, { message: "End must be after start", path: ["end_at"] });

resourcesRouter.post("/:id/blocks", requireRole("admin", "scheduler"), (req, res) => {
  const id = idParam(req);
  const b = parse(block, req.body);
  const clashes = db.prepare(`SELECT COUNT(*) AS n FROM appointment_resources ar JOIN appointments a ON a.id = ar.appointment_id
    WHERE ar.resource_id = ? AND ar.start_at < ? AND ar.end_at > ? AND a.status IN (${OCCUPYING.filter((s) => s !== "completed").map((s) => `'${s}'`).join(",")})`)
    .get(id, b.end_at, b.start_at) as { n: number };
  const info = db.prepare("INSERT INTO resource_blocks (resource_id, start_at, end_at, kind, reason, created_by) VALUES (?,?,?,?,?,?)")
    .run(id, b.start_at, b.end_at, b.kind, b.reason ?? null, req.user!.id);
  audit(req, "create", "resource_block", Number(info.lastInsertRowid), { resource_id: id });
  res.status(201).json({ id: Number(info.lastInsertRowid), affected_appointments: clashes.n });
});

resourcesRouter.delete("/:id/blocks/:blockId", requireRole("admin", "scheduler"), (req, res) => {
  const id = idParam(req);
  db.prepare("DELETE FROM resource_blocks WHERE id = ? AND resource_id = ?").run(Number(req.params.blockId), id);
  audit(req, "delete", "resource_block", String(req.params.blockId));
  res.json({ ok: true });
});
