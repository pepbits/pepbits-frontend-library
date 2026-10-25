import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { addDays, nowDate } from "../lib/clock.js";
import { actorOf, notFound, parse } from "../lib/http.js";
import { historyOf } from "../services/history.js";
import * as stock from "../services/stock.js";

export const inventory = Router();
const today = () => nowDate().toISOString().slice(0, 10);
const soon = () => addDays(nowDate(), 90).toISOString().slice(0, 10);

const PRODUCT_SQL = `
  SELECT p.*, s.name supplier_name,
    COALESCE((SELECT SUM(qty_on_hand) FROM batches b WHERE b.product_id = p.id AND b.status = 'available' AND b.expiry > @today), 0) on_hand,
    COALESCE((SELECT SUM(qty_reserved) FROM batches b WHERE b.product_id = p.id AND b.status = 'available'), 0) reserved,
    COALESCE((SELECT SUM(qty_on_hand) FROM batches b WHERE b.product_id = p.id AND (b.status != 'available' OR b.expiry <= @today)), 0) unsellable,
    COALESCE((SELECT SUM(qty_on_hand) FROM batches b WHERE b.product_id = p.id AND b.status = 'available' AND b.expiry > @today AND b.expiry <= @soon), 0) near_expiry,
    (SELECT MIN(expiry) FROM batches b WHERE b.product_id = p.id AND b.status = 'available' AND b.expiry > @today AND b.qty_on_hand > 0) next_expiry,
    COALESCE((SELECT -SUM(qty) FROM stock_movements m WHERE m.product_id = p.id AND m.type = 'issue' AND m.at >= @since), 0) used_30d
  FROM products p LEFT JOIN suppliers s ON s.id = p.preferred_supplier_id`;

inventory.get("/products", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const filter = String(req.query.filter ?? "");
  const params = { today: today(), soon: soon(), since: addDays(nowDate(), -30).toISOString(), q: `%${q}%`, cat: String(req.query.category ?? "") };
  let rows = db.prepare(`SELECT * FROM (${PRODUCT_SQL}) WHERE active = 1
    ${q ? "AND (name LIKE @q OR generic LIKE @q OR sku LIKE @q OR barcode LIKE @q)" : ""} ${params.cat ? "AND category = @cat" : ""} ORDER BY name`).all(params) as any[];
  rows = rows.map((r) => ({ ...r, available: r.on_hand - r.reserved, days_cover: r.used_30d > 0 ? Math.round((r.on_hand - r.reserved) / (r.used_30d / 30)) : null }));
  if (filter === "low") rows = rows.filter((r) => r.available <= r.reorder_level);
  if (filter === "expiring") rows = rows.filter((r) => r.near_expiry > 0);
  if (filter === "cold") rows = rows.filter((r) => r.cold_chain);
  if (filter === "controlled") rows = rows.filter((r) => r.schedule === "controlled");
  const categories = db.prepare("SELECT category, COUNT(*) n FROM products GROUP BY category ORDER BY category").all();
  res.json({ rows, categories });
});

/** Lightweight lookup for type-ahead fields (counter sale, new prescription). */
inventory.get("/products/lookup", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const schedule = String(req.query.schedule ?? "");
  const rows = db.prepare(`SELECT id, name, generic, strength, form, schedule, price_per_unit, dispense_unit, barcode, sku, tax_rate FROM products
    WHERE active = 1 AND (name LIKE ? OR generic LIKE ? OR barcode = ? OR sku = ?) ${schedule ? "AND schedule = ?" : ""} ORDER BY name LIMIT 12`)
    .all(...[`%${q}%`, `%${q}%`, q, q, ...(schedule ? [schedule] : [])]) as any[];
  res.json(rows.map((r) => ({ ...r, available: stock.availableQty(r.id) })));
});

inventory.get("/products/:id", (req, res) => {
  const params = { today: today(), soon: soon(), since: addDays(nowDate(), -30).toISOString(), id: req.params.id };
  const p = db.prepare(`SELECT * FROM (${PRODUCT_SQL}) WHERE id = @id`).get(params) as any;
  if (!p) throw notFound("Product");
  const batches = db.prepare("SELECT b.*, s.name supplier_name FROM batches b LEFT JOIN suppliers s ON s.id = b.supplier_id WHERE product_id = ? ORDER BY CASE status WHEN 'available' THEN 0 ELSE 1 END, expiry").all(req.params.id);
  const movements = db.prepare(`SELECT m.*, b.batch_no FROM stock_movements m JOIN batches b ON b.id = m.batch_id WHERE m.product_id = ? ORDER BY m.id DESC LIMIT 60`).all(req.params.id);
  const daily = db.prepare(`SELECT substr(at,1,10) day, -SUM(qty) qty FROM stock_movements WHERE product_id = ? AND type = 'issue' AND at >= ? GROUP BY day ORDER BY day`)
    .all(req.params.id, addDays(nowDate(), -28).toISOString());
  const contracts = db.prepare("SELECT c.*, pa.name payer_name, pa.code FROM payer_contract_prices c JOIN payers pa ON pa.id = c.payer_id WHERE product_id = ?").all(req.params.id);
  res.json({ ...p, available: p.on_hand - p.reserved, batches, movements, daily, contracts });
});

inventory.get("/batches", (req, res) => {
  const filter = String(req.query.filter ?? "expiring");
  const cond: Record<string, string> = {
    expiring: "b.status = 'available' AND b.expiry > @today AND b.expiry <= @soon AND b.qty_on_hand > 0",
    expired: "(b.status = 'expired' OR (b.status = 'available' AND b.expiry <= @today)) AND b.qty_on_hand > 0",
    quarantined: "b.status = 'quarantined'",
    recalled: "b.status = 'recalled'",
  };
  const rows = db.prepare(`SELECT b.*, p.name, p.sku, p.cost_per_unit, s.name supplier_name, ROUND(b.qty_on_hand * b.unit_cost, 2) value
    FROM batches b JOIN products p ON p.id = b.product_id LEFT JOIN suppliers s ON s.id = b.supplier_id WHERE ${cond[filter] ?? cond.expiring} ORDER BY b.expiry`)
    .all({ today: today(), soon: soon() });
  res.json(rows);
});

inventory.get("/batches/:id/trace", (req, res) => {
  const b = db.prepare("SELECT b.*, p.name, s.name supplier_name FROM batches b JOIN products p ON p.id = b.product_id LEFT JOIN suppliers s ON s.id = b.supplier_id WHERE b.id = ?").get(req.params.id);
  if (!b) throw notFound("Batch");
  const movements = db.prepare("SELECT * FROM stock_movements WHERE batch_id = ? ORDER BY id").all(req.params.id);
  const patients = db.prepare(
    `SELECT d.disp_no, d.status, d.handed_over_at, di.qty, pa.id patient_id, pa.name, pa.mrn, pa.phone, rx.rx_no
     FROM dispensing_items di JOIN dispensings d ON d.id = di.dispensing_id JOIN patients pa ON pa.id = d.patient_id JOIN prescriptions rx ON rx.id = d.prescription_id
     WHERE di.batch_id = ? ORDER BY d.created_at DESC`,
  ).all(req.params.id);
  res.json({ batch: b, movements, patients, history: historyOf("batch", req.params.id) });
});

inventory.post("/batches/:id/status", (req, res) => {
  const body = parse(z.object({ status: z.enum(["available", "quarantined", "recalled", "expired"]), reason: z.string().min(3) }), req.body);
  tx(() => stock.setBatchStatus(req.params.id, body.status, actorOf(req), body.reason));
  res.json({ ok: true });
});

inventory.post("/batches/:id/adjust", (req, res) => {
  const body = parse(z.object({ delta: z.number().int().refine((n) => n !== 0, "Change cannot be zero"), reason: z.string().min(3) }), req.body);
  tx(() => stock.adjust(req.params.id, body.delta, actorOf(req), body.reason));
  res.json({ ok: true });
});

inventory.get("/movements", (req, res) => {
  const type = String(req.query.type ?? "");
  const rows = db.prepare(`SELECT m.*, p.name, b.batch_no FROM stock_movements m JOIN products p ON p.id = m.product_id JOIN batches b ON b.id = m.batch_id
    ${type ? "WHERE m.type = ?" : ""} ORDER BY m.id DESC LIMIT 200`).all(...(type ? [type] : []));
  res.json(rows);
});
