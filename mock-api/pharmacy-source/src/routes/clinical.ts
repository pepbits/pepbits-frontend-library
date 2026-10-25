import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { actorOf, notFound, paging, parse } from "../lib/http.js";
import { chainFor } from "../services/chain.js";
import { historyOf } from "../services/history.js";
import * as rx from "../services/rx.js";
import * as stock from "../services/stock.js";
import * as rcm from "../services/rcm.js";

export const clinical = Router();

/** Workbench stage derived from the prescription and any open dispensing. */
const STAGE_SQL = `
  CASE
    WHEN EXISTS (SELECT 1 FROM dispensings d WHERE d.prescription_id = rx.id AND d.status = 'checked') THEN 'handover'
    WHEN EXISTS (SELECT 1 FROM dispensings d WHERE d.prescription_id = rx.id AND d.status = 'prepared') THEN 'check'
    WHEN rx.status IN ('received') THEN 'intake'
    WHEN rx.status IN ('in_review','on_hold') THEN 'review'
    WHEN rx.status IN ('verified','partially_dispensed') THEN 'fill'
    ELSE 'done'
  END`;

const LIST_SQL = `
  SELECT rx.id, rx.rx_no, rx.status, rx.priority, rx.source, rx.received_at, rx.diagnosis, ${STAGE_SQL} AS stage,
    p.id patient_id, p.name patient_name, p.mrn, p.dob, d.name doctor_name,
    (SELECT COUNT(*) FROM prescription_items i WHERE i.prescription_id = rx.id) item_count,
    (SELECT GROUP_CONCAT(pr.name, ', ') FROM prescription_items i JOIN products pr ON pr.id = i.product_id WHERE i.prescription_id = rx.id) item_names,
    (SELECT COUNT(*) FROM prescription_items i JOIN products pr ON pr.id = i.product_id WHERE i.prescription_id = rx.id AND pr.cold_chain = 1) cold,
    (SELECT COUNT(*) FROM prescription_items i JOIN products pr ON pr.id = i.product_id WHERE i.prescription_id = rx.id AND pr.schedule = 'controlled') controlled,
    (SELECT a.status FROM authorizations a WHERE a.prescription_id = rx.id ORDER BY a.requested_at DESC LIMIT 1) auth_status,
    (SELECT pa.code FROM coverages c JOIN payers pa ON pa.id = c.payer_id WHERE c.patient_id = p.id AND c.priority = 1 AND c.valid_to >= date('now') LIMIT 1) payer_code,
    (SELECT d2.collection FROM dispensings d2 WHERE d2.prescription_id = rx.id AND d2.status IN ('prepared','checked') LIMIT 1) collection,
    (SELECT MAX(h.at) FROM status_history h WHERE h.entity = 'prescription' AND h.entity_id = rx.id) updated_at
  FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id JOIN doctors d ON d.id = rx.doctor_id`;

clinical.get("/prescriptions", (req, res) => {
  const { limit, offset } = paging(req.query);
  const q = String(req.query.q ?? "").trim();
  const stage = String(req.query.stage ?? "");
  const where: string[] = [];
  const args: unknown[] = [];
  if (q) { where.push("(rx.rx_no LIKE ? OR p.name LIKE ? OR p.mrn LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const sql = `SELECT * FROM (${LIST_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""}) t
    ${stage ? "WHERE stage = ?" : ""}
    ORDER BY CASE priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, ${stage === "done" ? "updated_at DESC" : "received_at ASC"} LIMIT ? OFFSET ?`;
  if (stage) args.push(stage);
  const rows = db.prepare(sql).all(...args, limit, offset);
  const counts = db.prepare(`SELECT stage, COUNT(*) n FROM (SELECT ${STAGE_SQL} AS stage, rx.status, rx.received_at FROM prescriptions rx) GROUP BY stage`).all() as { stage: string; n: number }[];
  res.json({ rows, counts: Object.fromEntries(counts.map((c) => [c.stage, c.n])) });
});

function detail(id: string) {
  const r = db.prepare(`SELECT * FROM (${LIST_SQL}) WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!r) throw notFound("Prescription");
  const full = db.prepare("SELECT * FROM prescriptions WHERE id = ?").get(id) as Record<string, unknown>;
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(r.patient_id) as Record<string, string>;
  const coverages = db.prepare("SELECT c.*, p.name payer_name, p.code payer_code, p.workflow FROM coverages c JOIN payers p ON p.id = c.payer_id WHERE c.patient_id = ? ORDER BY priority").all(r.patient_id);
  const doctor = db.prepare("SELECT * FROM doctors WHERE id = ?").get(full.doctor_id);
  const items = (db.prepare(
    `SELECT i.*, p.name, p.generic, p.strength, p.form, p.dispense_unit, p.schedule, p.cold_chain, p.requires_auth, p.price_per_unit, p.location,
      (SELECT COALESCE(SUM(di.qty),0) FROM dispensing_items di JOIN dispensings d ON d.id = di.dispensing_id WHERE di.prescription_item_id = i.id AND d.status IN ('prepared','checked')) qty_pending,
      (SELECT SUM(ai.qty_approved) FROM authorization_items ai JOIN authorizations a ON a.id = ai.authorization_id WHERE ai.prescription_item_id = i.id AND a.status IN ('approved','partially_approved')) qty_authorized
     FROM prescription_items i JOIN products p ON p.id = i.product_id WHERE i.prescription_id = ?`,
  ).all(id) as Record<string, number | string>[]).map((i) => ({
    ...i, qty_remaining: (i.qty_prescribed as number) - (i.qty_dispensed as number) - (i.qty_pending as number),
    available: stock.availableQty(i.product_id as string), batches: stock.sellableBatches(i.product_id as string).slice(0, 3).map((b) => ({ id: b.id, batch_no: b.batch_no, expiry: b.expiry, available: b.available })),
  }));
  const authorizations: any[] = (db.prepare("SELECT a.*, p.name payer_name FROM authorizations a JOIN payers p ON p.id = a.payer_id WHERE prescription_id = ? ORDER BY requested_at DESC").all(id) as Record<string, string>[])
    .map((a) => ({ ...a, items: db.prepare("SELECT ai.*, pr.name FROM authorization_items ai JOIN prescription_items pi ON pi.id = ai.prescription_item_id JOIN products pr ON pr.id = pi.product_id WHERE authorization_id = ?").all(a.id) }));
  const dispensings: any[] = (db.prepare("SELECT * FROM dispensings WHERE prescription_id = ? ORDER BY created_at DESC").all(id) as Record<string, string>[]).map((d) => ({
    ...d,
    items: db.prepare("SELECT di.*, p.name, b.batch_no, b.expiry FROM dispensing_items di JOIN products p ON p.id = di.product_id JOIN batches b ON b.id = di.batch_id WHERE dispensing_id = ?").all(d.id),
    bill: db.prepare("SELECT * FROM bills WHERE dispensing_id = ?").get(d.id),
  }));
  const claims = db.prepare("SELECT c.*, p.name payer_name, p.code payer_code, p.workflow FROM claims c JOIN payers p ON p.id = c.payer_id WHERE prescription_id = ? ORDER BY created_at DESC").all(id);
  const related = [
    ...historyOf("prescription", id),
    ...authorizations.flatMap((a) => historyOf("authorization", a.id as string)),
    ...dispensings.flatMap((d) => [...historyOf("dispensing", d.id), ...(d.bill ? historyOf("bill", (d.bill as { id: string }).id) : [])]),
    ...(claims as { id: string }[]).flatMap((c) => historyOf("claim", c.id)),
  ].sort((a, b) => String((a as { at: string }).at).localeCompare(String((b as { at: string }).at)));
  return {
    ...r, ...full, patient: { ...patient, allergies: JSON.parse(patient.allergies), conditions: JSON.parse(patient.conditions) }, coverages, doctor,
    items, authorizations, dispensings, claims, history: related, alerts: rx.safety(id), chain: chainFor(id),
  };
}

clinical.get("/prescriptions/:id", (req, res) => res.json(detail(req.params.id)));

const ItemSchema = z.object({
  product_id: z.string(), dose: z.number().positive(), frequency_per_day: z.number().int().positive(), days: z.number().int().positive(),
  qty: z.number().int().positive().optional(), sig: z.string().min(2), substitution_allowed: z.boolean().optional(),
});
const RxSchema = z.object({
  patient_id: z.string(), doctor_id: z.string(), source: z.enum(["erx", "paper", "hospital"]), priority: z.enum(["routine", "urgent", "stat"]),
  diagnosis_code: z.string().optional(), diagnosis: z.string().optional(), notes: z.string().optional(), items: z.array(ItemSchema).min(1),
});

clinical.post("/prescriptions", (req, res) => {
  const body = parse(RxSchema, req.body);
  const id = tx(() => rx.createPrescription(body, actorOf(req)));
  res.status(201).json(detail(id));
});

/** Demo helper: an inbound eRx from a random clinic. */
clinical.post("/prescriptions/simulate-erx", (req, res) => {
  const pat = db.prepare("SELECT id FROM patients ORDER BY RANDOM() LIMIT 1").get() as { id: string };
  const doc = db.prepare("SELECT id FROM doctors ORDER BY RANDOM() LIMIT 1").get() as { id: string };
  const prods = db.prepare("SELECT id FROM products WHERE schedule = 'rx' ORDER BY RANDOM() LIMIT ?").all(1 + Math.floor(Math.random() * 2)) as { id: string }[];
  const id = tx(() => rx.createPrescription({
    patient_id: pat.id, doctor_id: doc.id, source: "erx", priority: Math.random() < 0.15 ? "urgent" : "routine", diagnosis_code: "Z00.00", diagnosis: "Routine follow-up",
    items: prods.map((p) => ({ product_id: p.id, dose: 1, frequency_per_day: 1 + Math.floor(Math.random() * 2), days: 30, sig: "As directed by physician" })),
  }, actorOf(req)));
  res.status(201).json(detail(id));
});

const act = (fn: (id: string, body: any, actor: string) => unknown) => (req: any, res: any) => {
  tx(() => fn(req.params.id, req.body ?? {}, actorOf(req)));
  res.json(detail(req.params.rxId ?? req.params.id));
};

clinical.post("/prescriptions/:id/review", act((id, _b, a) => rx.startReview(id, a)));
clinical.post("/prescriptions/:id/verify", act((id, b, a) => rx.verify(id, parse(z.object({ overrides: z.array(z.object({ key: z.string(), reason: z.string().min(5) })).default([]) }), b).overrides, a)));
clinical.post("/prescriptions/:id/hold", act((id, b, a) => rx.hold(id, parse(z.object({ note: z.string().min(3) }), b).note, a)));
clinical.post("/prescriptions/:id/cancel", act((id, b, a) => rx.cancelRx(id, parse(z.object({ reason: z.string().min(3) }), b).reason, a)));
clinical.post("/prescriptions/:id/authorizations", act((id, b, a) => rx.requestAuthorization(id, a, typeof b.justification === "string" ? b.justification : undefined)));
clinical.post("/prescriptions/:id/dispensings", act((id, b, a) => rx.createDispensing(id, parse(z.object({
  items: z.array(z.object({ prescription_item_id: z.string(), qty: z.number().int().min(0) })), collection: z.enum(["pickup", "delivery"]).optional(),
}), b), a)));

// Actions keyed by child record; respond with the parent prescription so the UI refreshes in one round trip
const viaChild = (table: string, fn: (id: string, body: any, actor: string) => unknown) => (req: any, res: any) => {
  const row = db.prepare(`SELECT prescription_id FROM ${table} WHERE id = ?`).get(req.params.id) as { prescription_id: string } | undefined;
  if (!row) throw notFound("Record");
  tx(() => fn(req.params.id, req.body ?? {}, actorOf(req)));
  res.json(detail(row.prescription_id));
};
clinical.post("/authorizations/:id/decide", viaChild("authorizations", (id, b, a) => rx.decideAuthorization(id, a, Math.random, b.decision)));
clinical.post("/dispensings/:id/check", viaChild("dispensings", (id, _b, a) => rx.checkDispensing(id, a)));
clinical.post("/dispensings/:id/handover", viaChild("dispensings", (id, b, a) => rx.handover(id, parse(z.object({ payment_method: z.string().default("card"), override_rejected: z.boolean().optional() }), b), a)));
clinical.post("/dispensings/:id/cancel", viaChild("dispensings", (id, b, a) => rx.cancelDispensing(id, parse(z.object({ reason: z.string().min(3) }), b).reason, a)));
clinical.post("/dispensings/:id/return", viaChild("dispensings", (id, b, a) => rx.returnDispensing(id, parse(z.object({ reason: z.string().min(3) }), b).reason, a)));
clinical.post("/claims/:id/resubmit-realtime", viaChild("claims", (id, b, a) => { rcm.submitClaim(id, a, b.note); rcm.adjudicate([id], a); }));

clinical.get("/doctors", (_req, res) => res.json(db.prepare("SELECT * FROM doctors ORDER BY name").all()));

// ── Prior authorization worklist ───────────────────────────────
const AUTH_SQL = `SELECT a.*, pa.name payer_name, pa.code payer_code, rx.rx_no, rx.priority, rx.diagnosis_code, rx.diagnosis, p.id patient_id, p.name patient_name, p.mrn,
    d.name doctor_name, c.member_id, c.plan_name,
    CAST((julianday(COALESCE(a.decided_at, 'now')) - julianday(a.requested_at)) * 24 AS INTEGER) hours_open,
    (SELECT GROUP_CONCAT(pr.name, ', ') FROM authorization_items ai JOIN prescription_items pi ON pi.id = ai.prescription_item_id JOIN products pr ON pr.id = pi.product_id WHERE ai.authorization_id = a.id) item_names
  FROM authorizations a JOIN payers pa ON pa.id = a.payer_id JOIN prescriptions rx ON rx.id = a.prescription_id JOIN patients p ON p.id = rx.patient_id JOIN doctors d ON d.id = rx.doctor_id
  LEFT JOIN coverages c ON c.patient_id = p.id AND c.payer_id = a.payer_id`;

clinical.get("/authorizations", (req, res) => {
  const status = String(req.query.status ?? "");
  const q = String(req.query.q ?? "").trim();
  const where: string[] = []; const args: unknown[] = [];
  if (status) { where.push("a.status = ?"); args.push(status); }
  if (q) { where.push("(a.auth_no LIKE ? OR p.name LIKE ? OR rx.rx_no LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = db.prepare(`${AUTH_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.status = 'requested' DESC, a.requested_at DESC LIMIT 300`).all(...args);
  const counts = Object.fromEntries((db.prepare("SELECT status, COUNT(*) n FROM authorizations GROUP BY status").all() as { status: string; n: number }[]).map((c) => [c.status, c.n]));
  res.json({ rows, counts });
});

clinical.get("/authorizations/:id", (req, res) => {
  const a = db.prepare(`${AUTH_SQL} WHERE a.id = ?`).get(req.params.id);
  if (!a) throw notFound("Authorization");
  const items = db.prepare(`SELECT ai.*, pr.name, pr.generic, pr.strength, pi.sig, pi.days, pi.qty_prescribed, pr.price_per_unit
    FROM authorization_items ai JOIN prescription_items pi ON pi.id = ai.prescription_item_id JOIN products pr ON pr.id = pi.product_id WHERE authorization_id = ?`).all(req.params.id);
  res.json({ ...a, items, history: historyOf("authorization", req.params.id) });
});

clinical.post("/authorizations/:id/decision", (req, res) => {
  const body = parse(z.object({
    decision: z.enum(["approved", "partially_approved", "denied"]),
    items: z.array(z.object({ id: z.string(), qty_approved: z.number().int().min(0) })).default([]),
    payer_ref: z.string().optional(), valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note: z.string().optional(),
  }), req.body);
  tx(() => rx.recordAuthorizationDecision(req.params.id, body, actorOf(req)));
  res.json(db.prepare(`${AUTH_SQL} WHERE a.id = ?`).get(req.params.id));
});
