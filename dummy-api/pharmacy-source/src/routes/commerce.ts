import { addDays, nowDate } from "../lib/clock.js";
import * as orders from "../services/orders.js";
import * as sales from "../services/sales.js";
import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { actorOf, notFound, parse } from "../lib/http.js";
import { historyOf } from "../services/history.js";
import * as ops from "../services/ops.js";

export const commerce = Router();

commerce.post("/sales", (req, res) => {
  const body = parse(z.object({
    items: z.array(z.object({ product_id: z.string(), qty: z.number().int().positive() })).min(1),
    payment_method: z.enum(["cash", "card", "wallet"]), patient_id: z.string().nullish(), discount: z.number().min(0).optional(),
  }), req.body);
  const id = tx(() => ops.counterSale(body, actorOf(req)));
  res.status(201).json(db.prepare("SELECT * FROM bills WHERE id = ?").get(id));
});

commerce.get("/sales/recent", (_req, res) => {
  res.json(db.prepare(`SELECT b.*, (SELECT COUNT(*) FROM bill_lines l WHERE l.bill_id = b.id) lines,
    (SELECT method FROM payments p JOIN payment_allocations a ON a.payment_id = p.id WHERE a.bill_id = b.id LIMIT 1) method
    FROM bills b WHERE kind = 'otc' ORDER BY created_at DESC LIMIT 12`).all());
});

commerce.get("/suppliers", (_req, res) => res.json(db.prepare(`SELECT s.*,
  (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = s.id AND po.status IN ('approved','sent','partially_received')) open_orders
  FROM suppliers s ORDER BY name`).all()));

commerce.get("/reorder-suggestions", (_req, res) => res.json(ops.reorderSuggestions()));

commerce.get("/purchase-orders", (req, res) => {
  const status = String(req.query.status ?? "");
  res.json(db.prepare(`SELECT po.*, s.name supplier_name, (SELECT COUNT(*) FROM po_items i WHERE i.po_id = po.id) lines,
    (SELECT SUM(qty_received) * 1.0 / SUM(qty_ordered) FROM po_items i WHERE i.po_id = po.id) received_ratio
    FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id ${status ? "WHERE po.status = ?" : ""} ORDER BY po.created_at DESC`).all(...(status ? [status] : [])));
});

const poDetail = (id: string) => {
  const po = db.prepare("SELECT po.*, s.name supplier_name, s.lead_time_days FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?").get(id);
  if (!po) throw notFound("Purchase order");
  const items = db.prepare("SELECT i.*, p.name, p.sku, p.dispense_unit, p.pack_size FROM po_items i JOIN products p ON p.id = i.product_id WHERE po_id = ?").all(id);
  return { ...po, items, history: historyOf("purchase_order", id) };
};
commerce.get("/purchase-orders/:id", (req, res) => res.json(poDetail(req.params.id)));

commerce.post("/purchase-orders", (req, res) => {
  const body = parse(z.object({ supplier_id: z.string(), items: z.array(z.object({ product_id: z.string(), qty: z.number().int().positive(), unit_cost: z.number().positive().optional() })).min(1) }), req.body);
  const id = tx(() => ops.createPO(body, actorOf(req)));
  res.status(201).json(poDetail(id));
});

for (const action of ["approve", "send", "cancel"] as const) {
  commerce.post(`/purchase-orders/:id/${action}`, (req, res) => {
    tx(() => ops.advancePO(req.params.id, action, actorOf(req)));
    res.json(poDetail(req.params.id));
  });
}

commerce.post("/purchase-orders/:id/receive", (req, res) => {
  const body = parse(z.object({ lines: z.array(z.object({ po_item_id: z.string(), qty: z.number().int().min(0), batch_no: z.string().min(2), expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })) }), req.body);
  tx(() => ops.receivePO(req.params.id, body.lines, actorOf(req)));
  res.json(poDetail(req.params.id));
});

// ── Sales: invoices, receipts, returns ─────────────────────────

const since = (days: unknown) => addDays(nowDate(), -Math.min(Math.max(Number(days) || 1, 1), 365)).toISOString();
const dayStartIso = (days: unknown) => { const d = new Date(since(days)); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

const SALE_SQL = `SELECT b.*, pa.name patient_name, pa.mrn, o.order_no, o.id order_id, rx.rx_no, rx.id prescription_id,
    (SELECT COUNT(*) FROM bill_lines l WHERE l.bill_id = b.id) lines,
    (SELECT p.method FROM payments p JOIN payment_allocations a ON a.payment_id = p.id WHERE a.bill_id = b.id AND p.amount > 0 ORDER BY p.received_at LIMIT 1) method,
    CASE WHEN o.id IS NOT NULL THEN 'order' WHEN b.kind = 'rx' THEN 'prescription' ELSE 'counter' END channel
  FROM bills b LEFT JOIN patients pa ON pa.id = b.patient_id LEFT JOIN orders o ON o.bill_id = b.id
  LEFT JOIN dispensings d ON d.id = b.dispensing_id LEFT JOIN prescriptions rx ON rx.id = d.prescription_id`;

commerce.get("/sales", (req, res) => {
  const where = ["b.created_at >= ?", "b.status != 'open'"];
  const args: unknown[] = [dayStartIso(req.query.days ?? 1)];
  const channel = String(req.query.channel ?? "");
  if (channel === "counter") where.push("b.kind = 'otc' AND o.id IS NULL");
  if (channel === "order") where.push("o.id IS NOT NULL");
  if (channel === "prescription") where.push("b.kind = 'rx'");
  if (req.query.returned === "1") where.push("b.refunded > 0 OR b.status = 'reversed'");
  const q = String(req.query.q ?? "").trim();
  if (q) { where.push("(b.bill_no LIKE ? OR pa.name LIKE ? OR o.order_no LIKE ? OR rx.rx_no LIKE ?)"); args.push(...Array(4).fill(`%${q}%`)); }
  res.json(db.prepare(`${SALE_SQL} WHERE ${where.join(" AND ")} ORDER BY b.created_at DESC LIMIT 400`).all(...args));
});

commerce.get("/sales/summary", (req, res) => {
  const from = dayStartIso(req.query.days ?? 1);
  const totals = db.prepare(`SELECT COUNT(*) invoices, ROUND(COALESCE(SUM(net),0),2) gross, ROUND(COALESCE(SUM(refunded),0),2) refunded,
      ROUND(COALESCE(SUM(patient_share),0),2) patient, ROUND(COALESCE(SUM(payer_share),0),2) payer,
      ROUND(COALESCE(SUM(CASE WHEN kind='otc' THEN net ELSE 0 END),0),2) otc, ROUND(COALESCE(SUM(CASE WHEN kind='rx' THEN net ELSE 0 END),0),2) rx
    FROM bills WHERE created_at >= ? AND status != 'open'`).get(from) as Record<string, number>;
  const reversedRx = db.prepare("SELECT ROUND(COALESCE(SUM(net),0),2) v FROM bills WHERE created_at >= ? AND status = 'reversed' AND kind = 'rx'").get(from) as { v: number };
  const methods = db.prepare(`SELECT p.method, ROUND(SUM(p.amount),2) amount, COUNT(*) n FROM payments p WHERE p.source = 'patient' AND p.received_at >= ? GROUP BY p.method ORDER BY amount DESC`).all(from);
  const top = db.prepare(`SELECT pr.name, SUM(l.qty - l.qty_returned) qty, ROUND(SUM((l.gross + l.tax) * (l.qty - l.qty_returned) * 1.0 / l.qty),2) amount
    FROM bill_lines l JOIN bills b ON b.id = l.bill_id JOIN products pr ON pr.id = l.product_id
    WHERE b.created_at >= ? AND b.status = 'finalized' GROUP BY pr.id ORDER BY amount DESC LIMIT 6`).all(from);
  res.json({ ...totals, net: Math.round((totals.gross - totals.refunded - reversedRx.v) * 100) / 100, methods, top });
});

commerce.get("/sales/returns", (req, res) => {
  const from = dayStartIso(req.query.days ?? 30);
  const counter = db.prepare(`SELECT r.id, r.return_no ref, 'sale' type, r.amount, r.reason, r.method, r.created_at, r.actor, b.bill_no, b.id bill_id, pa.name patient_name,
      (SELECT GROUP_CONCAT(l.qty || ' x ' || p.name, ', ') FROM sales_return_lines l JOIN products p ON p.id = l.product_id WHERE l.return_id = r.id) items
    FROM sales_returns r JOIN bills b ON b.id = r.bill_id LEFT JOIN patients pa ON pa.id = b.patient_id WHERE r.created_at >= ?`).all(from);
  const rx = db.prepare(`SELECT d.id, d.disp_no ref, 'prescription' type, b.patient_paid amount,
      (SELECT note FROM status_history h WHERE h.entity = 'dispensing' AND h.entity_id = d.id AND h.to_status = 'returned' ORDER BY id DESC LIMIT 1) reason,
      'refund' method, (SELECT at FROM status_history h WHERE h.entity = 'dispensing' AND h.entity_id = d.id AND h.to_status = 'returned' ORDER BY id DESC LIMIT 1) created_at,
      (SELECT actor FROM status_history h WHERE h.entity = 'dispensing' AND h.entity_id = d.id AND h.to_status = 'returned' ORDER BY id DESC LIMIT 1) actor,
      b.bill_no, b.id bill_id, pa.name patient_name, rx.id prescription_id,
      (SELECT GROUP_CONCAT(di.qty || ' x ' || p.name, ', ') FROM dispensing_items di JOIN products p ON p.id = di.product_id WHERE di.dispensing_id = d.id) items
    FROM dispensings d JOIN bills b ON b.dispensing_id = d.id JOIN patients pa ON pa.id = d.patient_id JOIN prescriptions rx ON rx.id = d.prescription_id
    WHERE d.status = 'returned'`).all() as { created_at: string }[];
  const rows = [...counter, ...rx.filter((r) => r.created_at >= from)] as { created_at: string }[];
  res.json(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)));
});

commerce.get("/sales/:id", (req, res) => {
  const b = db.prepare(`${SALE_SQL} WHERE b.id = ?`).get(req.params.id) as Record<string, unknown> | undefined;
  if (!b) throw notFound("Invoice");
  const lines = db.prepare("SELECT l.*, p.name, p.generic, p.strength, p.dispense_unit, p.schedule FROM bill_lines l JOIN products p ON p.id = l.product_id WHERE bill_id = ?").all(req.params.id);
  const payments = db.prepare("SELECT p.*, a.amount allocated_amount FROM payment_allocations a JOIN payments p ON p.id = a.payment_id WHERE a.bill_id = ? ORDER BY p.received_at").all(req.params.id);
  const returns = db.prepare("SELECT * FROM sales_returns WHERE bill_id = ? ORDER BY created_at").all(req.params.id);
  const claims = db.prepare("SELECT c.id, c.claim_no, c.status, c.claimed, c.approved, c.paid, p.code payer_code FROM claims c JOIN payers p ON p.id = c.payer_id WHERE bill_id = ?").all(req.params.id);
  const settings = Object.fromEntries((db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE 'seq:%'").all() as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  res.json({ ...b, lines, payments, returns, claims, settings, history: historyOf("bill", req.params.id) });
});

commerce.post("/sales/:id/returns", (req, res) => {
  const body = parse(z.object({
    lines: z.array(z.object({ bill_line_id: z.string(), qty: z.number().int().min(0) })).min(1),
    reason: z.string().min(3), method: z.enum(["cash", "card", "wallet", "store_credit"]),
  }), req.body);
  const id = tx(() => sales.returnSale(req.params.id, body, actorOf(req)));
  res.status(201).json(db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(id));
});

// ── Customer orders ─────────────────────────────────────────────
const ORDER_SQL = `SELECT o.*, b.bill_no, (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) lines,
    (SELECT GROUP_CONCAT(i.qty || ' x ' || p.name, ', ') FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = o.id) item_names
  FROM orders o LEFT JOIN bills b ON b.id = o.bill_id`;

commerce.get("/orders", (req, res) => {
  const status = String(req.query.status ?? "");
  const q = String(req.query.q ?? "").trim();
  const where: string[] = []; const args: unknown[] = [];
  if (status === "open") where.push("o.status IN ('new','confirmed','ready','out_for_delivery')");
  else if (status) { where.push("o.status = ?"); args.push(status); }
  if (q) { where.push("(o.order_no LIKE ? OR o.customer_name LIKE ? OR o.phone LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = db.prepare(`${ORDER_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY CASE o.status WHEN 'new' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'ready' THEN 2 WHEN 'out_for_delivery' THEN 3 ELSE 4 END, o.created_at DESC LIMIT 300`).all(...args);
  const counts = Object.fromEntries((db.prepare("SELECT status, COUNT(*) n FROM orders GROUP BY status").all() as { status: string; n: number }[]).map((c) => [c.status, c.n]));
  res.json({ rows, counts });
});

const orderDetail = (id: string) => {
  const o = db.prepare(`${ORDER_SQL} WHERE o.id = ?`).get(id);
  if (!o) throw notFound("Order");
  const items = (db.prepare("SELECT i.*, p.name, p.generic, p.strength, p.tax_rate, p.location FROM order_items i JOIN products p ON p.id = i.product_id WHERE order_id = ?").all(id) as { id: string; product_id: string }[])
    .map((i) => ({ ...i, allocations: db.prepare("SELECT a.qty, b.batch_no, b.expiry FROM order_allocations a JOIN batches b ON b.id = a.batch_id WHERE order_item_id = ?").all(i.id) }));
  return { ...o, items, history: historyOf("order", id) };
};
commerce.get("/orders/:id", (req, res) => res.json(orderDetail(req.params.id)));

commerce.post("/orders", (req, res) => {
  const body = parse(z.object({
    patient_id: z.string().nullish(), customer_name: z.string().min(2), phone: z.string().min(5),
    channel: z.enum(["phone", "web", "whatsapp", "walk_in"]), fulfilment: z.enum(["pickup", "delivery"]), address: z.string().optional(),
    payment: z.enum(["prepaid", "cash_on_delivery", "pay_at_counter"]), notes: z.string().optional(),
    items: z.array(z.object({ product_id: z.string(), qty: z.number().int().positive() })).min(1),
  }), req.body);
  const id = tx(() => orders.createOrder(body, actorOf(req)));
  res.status(201).json(orderDetail(id));
});

const orderAction = (path: string, fn: (id: string, body: any, actor: string) => unknown) =>
  commerce.post(`/orders/:id/${path}`, (req, res) => { tx(() => fn(req.params.id, req.body ?? {}, actorOf(req))); res.json(orderDetail(req.params.id)); });
orderAction("confirm", (id, _b, a) => orders.confirmOrder(id, a));
orderAction("ready", (id, _b, a) => orders.markReady(id, a));
orderAction("dispatch", (id, b, a) => orders.dispatch(id, String(b.rider ?? ""), a));
orderAction("complete", (id, b, a) => orders.completeOrder(id, parse(z.object({ payment_method: z.enum(["cash", "card", "wallet", "online"]).default("card") }), b).payment_method, a));
orderAction("cancel", (id, b, a) => orders.cancelOrder(id, parse(z.object({ reason: z.string().min(3) }), b).reason, a));
