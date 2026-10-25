import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { parse, idParam } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";
import { DATE_RE } from "../lib/time.js";

export const holidaysRouter = Router();

holidaysRouter.get("/", (req, res) => {
  const year = String(req.query.year ?? new Date().getFullYear());
  res.json(db.prepare(`SELECT h.*, d.name AS department_name,
      (SELECT COUNT(*) FROM appointments a WHERE substr(a.start_at,1,10) = h.date AND a.status IN ('requested','scheduled','confirmed')
        AND (h.department_id IS NULL OR a.department_id = h.department_id)) AS affected
    FROM holidays h LEFT JOIN departments d ON d.id = h.department_id WHERE substr(h.date,1,4) = ? ORDER BY h.date`).all(year));
});

holidaysRouter.post("/", requireRole("admin"), (req, res) => {
  const b = parse(z.object({
    date: z.string().regex(DATE_RE, "Pick a date"),
    name: z.string().trim().min(2, "Name is required"),
    department_id: z.number().int().positive().nullish(),
  }), req.body);
  const info = db.prepare("INSERT INTO holidays (date, name, department_id) VALUES (?,?,?)").run(b.date, b.name, b.department_id ?? null);
  audit(req, "create", "holiday", Number(info.lastInsertRowid));
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

holidaysRouter.delete("/:id", requireRole("admin"), (req, res) => {
  const id = idParam(req);
  db.prepare("DELETE FROM holidays WHERE id = ?").run(id);
  audit(req, "delete", "holiday", id);
  res.json({ ok: true });
});
