import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { now } from "../lib/clock.js";
import { notFound, parse } from "../lib/http.js";
import { nextNo, uid } from "../lib/ids.js";

export const people = Router();
const unpack = (p: any) => p && ({ ...p, allergies: JSON.parse(p.allergies), conditions: JSON.parse(p.conditions) });

people.get("/patients", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = db.prepare(`SELECT p.*,
      (SELECT pa.code FROM coverages c JOIN payers pa ON pa.id = c.payer_id WHERE c.patient_id = p.id AND c.priority = 1 ORDER BY c.valid_to DESC LIMIT 1) payer_code,
      (SELECT MAX(c.valid_to) FROM coverages c WHERE c.patient_id = p.id AND c.priority = 1) coverage_to,
      (SELECT MAX(received_at) FROM prescriptions r WHERE r.patient_id = p.id) last_visit,
      (SELECT COUNT(*) FROM prescriptions r WHERE r.patient_id = p.id AND r.status IN ('verified','partially_dispensed','received','in_review','on_hold')) open_rx
    FROM patients p ${q ? "WHERE p.name LIKE ? OR p.mrn LIKE ? OR p.phone LIKE ?" : ""} ORDER BY p.name LIMIT 200`).all(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []));
  res.json(rows.map(unpack));
});

people.get("/patients/:id", (req, res) => {
  const p = unpack(db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id));
  if (!p) throw notFound("Patient");
  const coverages = db.prepare("SELECT c.*, pa.name payer_name, pa.code payer_code, pa.workflow FROM coverages c JOIN payers pa ON pa.id = c.payer_id WHERE patient_id = ? ORDER BY priority").all(p.id);
  const prescriptions = db.prepare(`SELECT r.id, r.rx_no, r.status, r.received_at, r.diagnosis, d.name doctor_name,
      (SELECT GROUP_CONCAT(pr.name, ', ') FROM prescription_items i JOIN products pr ON pr.id = i.product_id WHERE i.prescription_id = r.id) items
    FROM prescriptions r JOIN doctors d ON d.id = r.doctor_id WHERE patient_id = ? ORDER BY received_at DESC LIMIT 40`).all(p.id);
  const medications = db.prepare(`SELECT pr.name, pr.generic, pr.strength, MAX(d.handed_over_at) last_supplied, SUM(di.qty) total_qty, pr.dispense_unit
    FROM dispensings d JOIN dispensing_items di ON di.dispensing_id = d.id JOIN products pr ON pr.id = di.product_id
    WHERE d.patient_id = ? AND d.status = 'handed_over' GROUP BY pr.id ORDER BY last_supplied DESC`).all(p.id);
  const balance = db.prepare("SELECT ROUND(SUM(net),2) billed, ROUND(SUM(patient_share),2) patient_share, ROUND(SUM(patient_paid),2) paid FROM bills WHERE patient_id = ? AND status != 'reversed'").get(p.id);
  res.json({ ...p, coverages, prescriptions, medications, balance });
});

people.post("/patients", (req, res) => {
  const body = parse(z.object({
    name: z.string().min(2), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), gender: z.enum(["F", "M", "X"]), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(), weight_kg: z.number().positive().optional(), allergies: z.array(z.string()).default([]), conditions: z.array(z.string()).default([]),
  }), req.body);
  const id = uid("pat");
  db.prepare("INSERT INTO patients VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id, nextNo("mrn", "MRN", 400000), body.name, body.dob, body.gender, body.phone ?? null, body.email || null,
    body.address ?? null, body.weight_kg ?? null, JSON.stringify(body.allergies), JSON.stringify(body.conditions), now());
  res.status(201).json(unpack(db.prepare("SELECT * FROM patients WHERE id = ?").get(id)));
});
