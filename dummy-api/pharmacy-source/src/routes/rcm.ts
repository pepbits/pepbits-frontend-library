import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { nowDate } from "../lib/clock.js";
import { actorOf, notFound, parse } from "../lib/http.js";
import { historyOf } from "../services/history.js";
import * as rcm from "../services/rcm.js";

export const revenue = Router();

/**
 * Underpayment = money the payer owes but did not pay: lines approved below contract without a denial code,
 * plus short payments against what was approved. Denied lines are denials, not underpayments.
 */
const UNDERPAID_SQL = `
  (SELECT COALESCE(SUM(cl.expected - cl.approved), 0) FROM claim_lines cl
    WHERE cl.claim_id = c.id AND cl.denial_code IS NULL AND cl.approved < cl.expected - 0.01
      AND c.status IN ('approved','partially_approved','paid','partially_paid'))
  + CASE WHEN c.status IN ('paid','partially_paid') AND c.paid < c.approved - 0.01 THEN c.approved - c.paid ELSE 0 END`;

const CLAIM_SQL = `SELECT c.*, p.name payer_name, p.code payer_code, p.workflow, b.bill_no, pa.name patient_name, pa.mrn, rx.rx_no,
  CAST(julianday('now') - julianday(COALESCE(c.submitted_at, c.created_at)) AS INTEGER) age_days
  FROM claims c JOIN payers p ON p.id = c.payer_id JOIN bills b ON b.id = c.bill_id LEFT JOIN patients pa ON pa.id = b.patient_id LEFT JOIN prescriptions rx ON rx.id = c.prescription_id`;

revenue.get("/claims", (req, res) => {
  const status = String(req.query.status ?? "");
  const payer = String(req.query.payer ?? "");
  const q = String(req.query.q ?? "").trim();
  const where: string[] = []; const args: unknown[] = [];
  if (status === "outstanding") where.push("c.status IN ('submitted','approved','partially_approved','partially_paid')");
  else if (status === "underpaid") where.push(`(${UNDERPAID_SQL}) > 0.01`);
  else if (status) { where.push("c.status = ?"); args.push(status); }
  if (payer) { where.push("c.payer_id = ?"); args.push(payer); }
  if (q) { where.push("(c.claim_no LIKE ? OR pa.name LIKE ? OR rx.rx_no LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = db.prepare(`${CLAIM_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.created_at DESC LIMIT 400`).all(...args);
  res.json(rows);
});

revenue.get("/claims/summary", (_req, res) => {
  const byStatus = db.prepare("SELECT status, COUNT(*) n, ROUND(SUM(claimed),2) claimed, ROUND(SUM(approved),2) approved, ROUND(SUM(paid),2) paid FROM claims GROUP BY status").all();
  const underpaid = db.prepare(`SELECT COUNT(*) n, ROUND(COALESCE(SUM(gap), 0), 2) amount FROM (SELECT (${UNDERPAID_SQL}) gap FROM claims c) WHERE gap > 0.01`).get();
  const aging = db.prepare(`SELECT p.id payer_id, p.code, p.name,
      ROUND(SUM(CASE WHEN age <= 30 THEN amt ELSE 0 END),2) b30, ROUND(SUM(CASE WHEN age BETWEEN 31 AND 60 THEN amt ELSE 0 END),2) b60,
      ROUND(SUM(CASE WHEN age BETWEEN 61 AND 90 THEN amt ELSE 0 END),2) b90, ROUND(SUM(CASE WHEN age > 90 THEN amt ELSE 0 END),2) b90p, ROUND(SUM(amt),2) total
    FROM (SELECT payer_id, julianday('now') - julianday(submitted_at) age, CASE WHEN status = 'submitted' THEN claimed ELSE approved - paid END amt
          FROM claims WHERE status IN ('submitted','approved','partially_approved','partially_paid')) x
    JOIN payers p ON p.id = x.payer_id GROUP BY p.id ORDER BY total DESC`).all();
  const denials = db.prepare("SELECT denial_code code, denial_reason reason, COUNT(*) n FROM remittance_lines WHERE denial_code IS NOT NULL GROUP BY denial_code ORDER BY n DESC").all();
  res.json({ byStatus, underpaid, aging, denials });
});

revenue.get("/claims/:id", (req, res) => {
  const c = db.prepare(`${CLAIM_SQL} WHERE c.id = ?`).get(req.params.id) as any;
  if (!c) throw notFound("Claim");
  const lines = db.prepare("SELECT cl.*, p.name, p.drug_code FROM claim_lines cl JOIN products p ON p.id = cl.product_id WHERE claim_id = ?").all(c.id);
  const remits = db.prepare("SELECT rl.*, r.ra_no, r.received_at, r.status ra_status FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id WHERE claim_id = ? ORDER BY r.received_at").all(c.id);
  const allocations = db.prepare("SELECT a.*, p.payment_ref, p.method FROM payment_allocations a JOIN payments p ON p.id = a.payment_id WHERE claim_id = ? ORDER BY a.at").all(c.id);
  const coverage = db.prepare("SELECT * FROM coverages WHERE id = ?").get(c.coverage_id);
  const siblings = db.prepare("SELECT c.id, c.claim_no, c.priority, c.status, p.code payer_code FROM claims c JOIN payers p ON p.id = c.payer_id WHERE bill_id = ? AND c.id != ?").all(c.bill_id, c.id);
  res.json({ ...c, lines, remits, allocations, coverage, siblings, history: historyOf("claim", c.id) });
});

const Ids = z.object({ ids: z.array(z.string()).min(1), note: z.string().optional() });

revenue.post("/claims/submit", (req, res) => {
  const { ids, note } = parse(Ids, req.body);
  const results = ids.map((id) => {
    try { tx(() => rcm.submitClaim(id, actorOf(req), note)); return { id, ok: true }; }
    catch (e) { return { id, ok: false, error: (e as Error).message }; }
  });
  res.json({ results, submitted: results.filter((r) => r.ok).length });
});

/** Mock payer response: generates remittance advice for submitted claims. */
revenue.post("/claims/adjudicate", (req, res) => {
  const { ids } = parse(Ids, req.body);
  const ras = tx(() => rcm.adjudicate(ids, actorOf(req)));
  res.json({ remittances: ras });
});

revenue.get("/remittances", (req, res) => {
  const status = String(req.query.status ?? "");
  res.json(db.prepare(`SELECT r.*, p.name payer_name, p.code payer_code,
      (SELECT COUNT(*) FROM remittance_lines l WHERE l.remittance_id = r.id) lines,
      (SELECT COUNT(*) FROM remittance_lines l WHERE l.remittance_id = r.id AND l.outcome = 'denied') denied,
      (SELECT SUM(amount) FROM payments x WHERE x.remittance_id = r.id) paid
    FROM remittances r JOIN payers p ON p.id = r.payer_id ${status ? "WHERE r.status = ?" : ""} ORDER BY r.received_at DESC LIMIT 300`).all(...(status ? [status] : [])));
});

revenue.get("/remittances/:id", (req, res) => {
  const r = db.prepare("SELECT r.*, p.name payer_name, p.code payer_code FROM remittances r JOIN payers p ON p.id = r.payer_id WHERE r.id = ?").get(req.params.id);
  if (!r) throw notFound("Remittance");
  const lines = db.prepare(`SELECT l.*, c.claim_no, c.status claim_status, c.expected, c.paid, pa.name patient_name FROM remittance_lines l JOIN claims c ON c.id = l.claim_id
    JOIN bills b ON b.id = c.bill_id LEFT JOIN patients pa ON pa.id = b.patient_id WHERE l.remittance_id = ?`).all(req.params.id);
  const payments = db.prepare("SELECT * FROM payments WHERE remittance_id = ?").all(req.params.id);
  res.json({ ...r, lines, payments, history: historyOf("remittance", req.params.id) });
});

revenue.post("/remittances/:id/post-payment", (req, res) => {
  const body = parse(z.object({ amount: z.number().positive().optional(), method: z.string().default("eft"), reference: z.string().optional() }), req.body);
  const id = tx(() => rcm.postRemittancePayment(req.params.id, body, actorOf(req)));
  res.status(201).json(db.prepare("SELECT * FROM payments WHERE id = ?").get(id));
});

revenue.get("/payments", (req, res) => {
  const source = String(req.query.source ?? "");
  res.json(db.prepare(`SELECT pm.*, p.name payer_name, p.code payer_code, r.ra_no FROM payments pm LEFT JOIN payers p ON p.id = pm.payer_id LEFT JOIN remittances r ON r.id = pm.remittance_id
    ${source ? "WHERE pm.source = ?" : ""} ORDER BY pm.received_at DESC LIMIT 300`).all(...(source ? [source] : [])));
});

revenue.get("/payers", (_req, res) => {
  res.json(db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM coverages c WHERE c.payer_id = p.id) members,
    (SELECT COUNT(*) FROM claims c WHERE c.payer_id = p.id AND c.created_at >= ?) claims_30d,
    (SELECT ROUND(100.0 * SUM(CASE WHEN outcome = 'denied' THEN 1 ELSE 0 END) / COUNT(*), 1) FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id WHERE r.payer_id = p.id) denial_rate
    FROM payers p ORDER BY name`).all(new Date(nowDate().getTime() - 30 * 86400000).toISOString()));
});

revenue.patch("/payers/:id", (req, res) => {
  const body = parse(z.object({ workflow: z.enum(["pre_adjudication", "post_dispense"]).optional(), payment_terms_days: z.number().int().positive().optional() }), req.body);
  if (body.workflow) db.prepare("UPDATE payers SET workflow = ? WHERE id = ?").run(body.workflow, req.params.id);
  if (body.payment_terms_days) db.prepare("UPDATE payers SET payment_terms_days = ? WHERE id = ?").run(body.payment_terms_days, req.params.id);
  res.json(db.prepare("SELECT * FROM payers WHERE id = ?").get(req.params.id));
});
