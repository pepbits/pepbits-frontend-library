import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { idParam, parse, notFound, bools } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";

export const servicesRouter = Router();
const B = ["requires_order", "requires_referral", "online_booking", "active"];

export const CATEGORIES = ["consultation", "lab", "radiology", "dental", "surgery", "pharmacy", "therapy", "procedure", "vaccination", "telehealth", "admission"] as const;

const service = z.object({
  name: z.string().trim().min(2, "Name is required"),
  code: z.string().trim().min(2, "Code is required").transform((s) => s.toUpperCase()),
  category: z.enum(CATEGORIES),
  department_id: z.number({ required_error: "Choose a department" }).int().positive(),
  specialty_id: z.number().int().positive().nullish(),
  duration_minutes: z.number().int().min(5).max(1440),
  buffer_minutes: z.number().int().min(0).max(240).default(0),
  prep_instructions: z.string().trim().nullish(),
  requires_order: z.boolean().default(false),
  requires_referral: z.boolean().default(false),
  online_booking: z.boolean().default(true),
  price: z.number().min(0).nullish(),
  active: z.boolean().default(true),
  requirements: z.array(z.object({ resource_type_id: z.number().int().positive(), role: z.string().trim().min(1), is_primary: z.boolean() })).optional(),
  resource_ids: z.array(z.number().int().positive()).optional(),
});

servicesRouter.get("/", (req, res) => {
  const where = ["1=1"]; const args: unknown[] = [];
  if (req.query.q) { where.push("(s.name LIKE ? OR s.code LIKE ?)"); args.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  if (req.query.category) { where.push("s.category = ?"); args.push(String(req.query.category)); }
  if (req.query.department_id) { where.push("s.department_id = ?"); args.push(Number(req.query.department_id)); }
  if (req.query.specialty_id) { where.push("s.specialty_id = ?"); args.push(Number(req.query.specialty_id)); }
  if (req.query.resource_id) { where.push("s.id IN (SELECT service_id FROM service_resources WHERE resource_id = ?)"); args.push(Number(req.query.resource_id)); }
  if (req.query.active !== "all") where.push("s.active = 1");
  const rows = db.prepare(`
    SELECT s.*, d.name AS department_name, d.color AS department_color, sp.name AS specialty_name,
      (SELECT COUNT(*) FROM service_resources x JOIN resources r ON r.id = x.resource_id WHERE x.service_id = s.id AND r.active = 1) AS resource_count,
      (SELECT group_concat(rt.name, ' + ') FROM service_requirements q JOIN resource_types rt ON rt.id = q.resource_type_id WHERE q.service_id = s.id) AS needs
    FROM services s JOIN departments d ON d.id = s.department_id LEFT JOIN specialties sp ON sp.id = s.specialty_id
    WHERE ${where.join(" AND ")} ORDER BY d.name, s.category, s.name`).all(...args) as Record<string, unknown>[];
  res.json(rows.map((r) => bools(r, B)));
});

servicesRouter.get("/:id", (req, res) => {
  const id = idParam(req);
  const s = db.prepare(`SELECT s.*, d.name AS department_name, sp.name AS specialty_name FROM services s
    JOIN departments d ON d.id = s.department_id LEFT JOIN specialties sp ON sp.id = s.specialty_id WHERE s.id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!s) throw notFound("Service");
  res.json({
    ...bools(s, B),
    requirements: (db.prepare(`SELECT q.resource_type_id, q.role, q.is_primary, rt.name AS type_name FROM service_requirements q
      JOIN resource_types rt ON rt.id = q.resource_type_id WHERE q.service_id = ? ORDER BY q.is_primary DESC, q.sort`).all(id) as Record<string, unknown>[]).map((r) => bools(r, ["is_primary"])),
    resources: db.prepare(`SELECT r.id, r.name, r.title, r.resource_type_id, rt.name AS type_name FROM service_resources x
      JOIN resources r ON r.id = x.resource_id JOIN resource_types rt ON rt.id = r.resource_type_id WHERE x.service_id = ? ORDER BY rt.name, r.name`).all(id),
  });
});

function save(id: number | null, b: z.infer<typeof service>) {
  return db.transaction(() => {
    const vals = [b.name, b.code, b.category, b.department_id, b.specialty_id ?? null, b.duration_minutes, b.buffer_minutes, b.prep_instructions ?? null,
      b.requires_order ? 1 : 0, b.requires_referral ? 1 : 0, b.online_booking ? 1 : 0, b.price ?? null, b.active ? 1 : 0];
    if (id == null) {
      id = Number(db.prepare(`INSERT INTO services (name, code, category, department_id, specialty_id, duration_minutes, buffer_minutes, prep_instructions,
        requires_order, requires_referral, online_booking, price, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...vals).lastInsertRowid);
    } else {
      const info = db.prepare(`UPDATE services SET name=?, code=?, category=?, department_id=?, specialty_id=?, duration_minutes=?, buffer_minutes=?,
        prep_instructions=?, requires_order=?, requires_referral=?, online_booking=?, price=?, active=? WHERE id=?`).run(...vals, id);
      if (!info.changes) throw notFound("Service");
    }
    if (b.requirements) {
      db.prepare("DELETE FROM service_requirements WHERE service_id = ?").run(id);
      const ins = db.prepare("INSERT INTO service_requirements (service_id, resource_type_id, role, is_primary, sort) VALUES (?,?,?,?,?)");
      const hasPrimary = b.requirements.some((r) => r.is_primary);
      b.requirements.forEach((r, i) => ins.run(id, r.resource_type_id, r.role, r.is_primary || (!hasPrimary && i === 0) ? 1 : 0, i));
    }
    if (b.resource_ids) {
      db.prepare("DELETE FROM service_resources WHERE service_id = ?").run(id);
      const ins = db.prepare("INSERT OR IGNORE INTO service_resources (service_id, resource_id) VALUES (?,?)");
      for (const r of b.resource_ids) ins.run(id, r);
    }
    return id;
  })();
}

servicesRouter.post("/", requireRole("admin"), (req, res) => {
  const id = save(null, parse(service, req.body));
  audit(req, "create", "service", id);
  res.status(201).json({ id });
});
servicesRouter.put("/:id", requireRole("admin"), (req, res) => {
  const id = idParam(req);
  save(id, parse(service, req.body));
  audit(req, "update", "service", id);
  res.json({ ok: true });
});
