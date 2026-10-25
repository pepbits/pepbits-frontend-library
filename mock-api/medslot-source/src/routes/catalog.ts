import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { idParam, parse, notFound, bools } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";

export const catalogRouter = Router();
const admin = requireRole("admin");

const dept = z.object({
  name: z.string().trim().min(2, "Name is required"),
  code: z.string().trim().min(2, "Code is required").max(10).transform((s) => s.toUpperCase()),
  description: z.string().trim().nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0F7A68").default("#0F7A68"),
  location: z.string().trim().nullish(),
  active: z.boolean().default(true),
});

catalogRouter.get("/departments", (_req, res) => {
  const rows = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM resources r WHERE r.department_id = d.id AND r.active = 1) AS resource_count,
      (SELECT COUNT(*) FROM services s WHERE s.department_id = d.id AND s.active = 1) AS service_count
    FROM departments d ORDER BY d.name`).all() as Record<string, unknown>[];
  const specs = db.prepare("SELECT * FROM specialties ORDER BY name").all() as Record<string, any>[];
  res.json(rows.map((d) => ({ ...bools(d, ["active"]), specialties: specs.filter((s) => s.department_id === d.id).map((s) => bools(s, ["active"])) })));
});

catalogRouter.post("/departments", admin, (req, res) => {
  const b = parse(dept, req.body);
  const info = db.prepare("INSERT INTO departments (name, code, description, color, location, active) VALUES (?,?,?,?,?,?)")
    .run(b.name, b.code, b.description ?? null, b.color, b.location ?? null, b.active ? 1 : 0);
  audit(req, "create", "department", Number(info.lastInsertRowid));
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

catalogRouter.put("/departments/:id", admin, (req, res) => {
  const id = idParam(req);
  const b = parse(dept, req.body);
  const info = db.prepare("UPDATE departments SET name=?, code=?, description=?, color=?, location=?, active=? WHERE id=?")
    .run(b.name, b.code, b.description ?? null, b.color, b.location ?? null, b.active ? 1 : 0, id);
  if (!info.changes) throw notFound("Department");
  audit(req, "update", "department", id);
  res.json({ ok: true });
});

const spec = z.object({ department_id: z.number().int().positive(), name: z.string().trim().min(2, "Name is required"), active: z.boolean().default(true) });

catalogRouter.get("/specialties", (_req, res) => {
  res.json(db.prepare("SELECT s.*, d.name AS department_name FROM specialties s JOIN departments d ON d.id = s.department_id ORDER BY d.name, s.name").all());
});
catalogRouter.post("/specialties", admin, (req, res) => {
  const b = parse(spec, req.body);
  const info = db.prepare("INSERT INTO specialties (department_id, name, active) VALUES (?,?,?)").run(b.department_id, b.name, b.active ? 1 : 0);
  audit(req, "create", "specialty", Number(info.lastInsertRowid));
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
catalogRouter.put("/specialties/:id", admin, (req, res) => {
  const id = idParam(req);
  const b = parse(spec, req.body);
  const info = db.prepare("UPDATE specialties SET department_id=?, name=?, active=? WHERE id=?").run(b.department_id, b.name, b.active ? 1 : 0, id);
  if (!info.changes) throw notFound("Specialty");
  audit(req, "update", "specialty", id);
  res.json({ ok: true });
});

const rtype = z.object({
  name: z.string().trim().min(2, "Name is required"),
  category: z.enum(["person", "room", "bed", "chair", "equipment", "other"]),
  default_slot_minutes: z.number().int().min(5).max(480),
  icon: z.string().trim().default("box"),
});
catalogRouter.get("/resource-types", (_req, res) => {
  res.json(db.prepare(`SELECT rt.*, (SELECT COUNT(*) FROM resources r WHERE r.resource_type_id = rt.id AND r.active = 1) AS resource_count
    FROM resource_types rt ORDER BY rt.category, rt.name`).all());
});
catalogRouter.post("/resource-types", admin, (req, res) => {
  const b = parse(rtype, req.body);
  const info = db.prepare("INSERT INTO resource_types (name, category, default_slot_minutes, icon) VALUES (?,?,?,?)").run(b.name, b.category, b.default_slot_minutes, b.icon);
  audit(req, "create", "resource_type", Number(info.lastInsertRowid));
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
catalogRouter.put("/resource-types/:id", admin, (req, res) => {
  const id = idParam(req);
  const b = parse(rtype, req.body);
  const info = db.prepare("UPDATE resource_types SET name=?, category=?, default_slot_minutes=?, icon=? WHERE id=?").run(b.name, b.category, b.default_slot_minutes, b.icon, id);
  if (!info.changes) throw notFound("Resource type");
  audit(req, "update", "resource_type", id);
  res.json({ ok: true });
});

/** One search box for the booking finder: services, resources, departments, specialties. */
catalogRouter.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) return res.json({ services: [], resources: [], departments: [], specialties: [] });
  const like = `%${q}%`;
  res.json({
    services: db.prepare(`SELECT s.id, s.name, s.category, s.duration_minutes, d.name AS department_name FROM services s JOIN departments d ON d.id = s.department_id
      WHERE s.active = 1 AND (s.name LIKE ? OR s.code LIKE ? OR s.category LIKE ?) ORDER BY s.name LIMIT 8`).all(like, like, like),
    resources: db.prepare(`SELECT r.id, r.name, r.title, rt.name AS type_name, d.name AS department_name FROM resources r
      JOIN resource_types rt ON rt.id = r.resource_type_id JOIN departments d ON d.id = r.department_id
      WHERE r.active = 1 AND (r.name LIKE ? OR r.title LIKE ? OR rt.name LIKE ?) ORDER BY r.name LIMIT 8`).all(like, like, like),
    departments: db.prepare("SELECT id, name, color FROM departments WHERE active = 1 AND name LIKE ? LIMIT 5").all(like),
    specialties: db.prepare("SELECT s.id, s.name, d.name AS department_name FROM specialties s JOIN departments d ON d.id = s.department_id WHERE s.active = 1 AND s.name LIKE ? LIMIT 5").all(like),
  });
});
