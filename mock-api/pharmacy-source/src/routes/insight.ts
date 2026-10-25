import { Router } from "express";
import { db } from "../db/index.js";
import { addDays, nowDate } from "../lib/clock.js";
import { paging } from "../lib/http.js";

export const insight = Router();
const dayStart = () => { const d = nowDate(); d.setUTCHours(0, 0, 0, 0); return d; };

insight.get("/dashboard", (_req, res) => {
  const start = dayStart().toISOString();
  const today = nowDate().toISOString().slice(0, 10);
  const soon = addDays(nowDate(), 90).toISOString().slice(0, 10);
  const one = (sql: string, ...a: unknown[]) => db.prepare(sql).get(...a) as Record<string, number>;

  const queues = db.prepare(`SELECT stage, COUNT(*) n FROM (SELECT CASE
      WHEN EXISTS (SELECT 1 FROM dispensings d WHERE d.prescription_id = rx.id AND d.status = 'checked') THEN 'handover'
      WHEN EXISTS (SELECT 1 FROM dispensings d WHERE d.prescription_id = rx.id AND d.status = 'prepared') THEN 'check'
      WHEN rx.status = 'received' THEN 'intake' WHEN rx.status IN ('in_review','on_hold') THEN 'review'
      WHEN rx.status IN ('verified','partially_dispensed') THEN 'fill' ELSE 'done' END stage FROM prescriptions rx) GROUP BY stage`).all() as { stage: string; n: number }[];

  const kpi = {
    rx_received: one("SELECT COUNT(*) n FROM prescriptions WHERE received_at >= ?", start).n,
    rx_handed_over: one("SELECT COUNT(*) n FROM dispensings WHERE status = 'handed_over' AND handed_over_at >= ?", start).n,
    turnaround_min: Math.round(one(`SELECT AVG((julianday(d.handed_over_at) - julianday(r.received_at)) * 1440) m FROM dispensings d JOIN prescriptions r ON r.id = d.prescription_id
      WHERE d.status = 'handed_over' AND d.handed_over_at >= ?`, addDays(nowDate(), -7).toISOString()).m ?? 0),
    sales_today: one("SELECT ROUND(COALESCE(SUM(net),0),2) v FROM bills WHERE status = 'finalized' AND created_at >= ?", start).v,
    collected_today: one("SELECT ROUND(COALESCE(SUM(amount),0),2) v FROM payments WHERE received_at >= ?", start).v,
    otc_today: one("SELECT COUNT(*) n FROM bills WHERE kind = 'otc' AND created_at >= ?", start).n,
    orders_open: one("SELECT COUNT(*) n FROM orders WHERE status IN ('new','confirmed','ready','out_for_delivery')").n,
    orders_new: one("SELECT COUNT(*) n FROM orders WHERE status = 'new'").n,
    auth_pending: one("SELECT COUNT(*) n FROM authorizations WHERE status = 'requested'").n,
    returns_today: one("SELECT ROUND(COALESCE(SUM(amount),0),2) v FROM sales_returns WHERE created_at >= ?", start).v,
  };
  const rcm = {
    drafts: one("SELECT COUNT(*) n, ROUND(COALESCE(SUM(claimed),0),2) v FROM claims WHERE status = 'draft'"),
    rejected: one("SELECT COUNT(*) n, ROUND(COALESCE(SUM(claimed),0),2) v FROM claims WHERE status = 'rejected'"),
    outstanding: one("SELECT COUNT(*) n, ROUND(COALESCE(SUM(CASE WHEN status = 'submitted' THEN claimed ELSE approved - paid END),0),2) v FROM claims WHERE status IN ('submitted','approved','partially_approved','partially_paid')"),
    unposted_ra: one("SELECT COUNT(*) n, ROUND(COALESCE(SUM(total_approved),0),2) v FROM remittances WHERE status = 'received'"),
    denial_rate: one("SELECT ROUND(100.0 * SUM(CASE WHEN outcome = 'denied' THEN 1 ELSE 0 END) / MAX(COUNT(*),1), 1) v FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id WHERE r.received_at >= ?", addDays(nowDate(), -30).toISOString()).v ?? 0,
    collected_30d: one("SELECT ROUND(COALESCE(SUM(amount),0),2) v FROM payments WHERE source = 'payer' AND received_at >= ?", addDays(nowDate(), -30).toISOString()).v,
  };
  const stock = {
    low: (db.prepare(`SELECT COUNT(*) n FROM products p WHERE COALESCE((SELECT SUM(qty_on_hand - qty_reserved) FROM batches b WHERE b.product_id = p.id AND b.status = 'available' AND b.expiry > ?),0) <= p.reorder_level`).get(today) as { n: number }).n,
    near_expiry: one("SELECT COUNT(*) n, ROUND(COALESCE(SUM(qty_on_hand * unit_cost),0),2) v FROM batches WHERE status = 'available' AND expiry > ? AND expiry <= ? AND qty_on_hand > 0", today, soon),
    expired: one("SELECT COUNT(*) n, ROUND(COALESCE(SUM(qty_on_hand * unit_cost),0),2) v FROM batches WHERE (status = 'expired' OR (status = 'available' AND expiry <= ?)) AND qty_on_hand > 0", today),
    quarantined: one("SELECT COUNT(*) n FROM batches WHERE status IN ('quarantined','recalled') AND qty_on_hand > 0").n,
    value: one("SELECT ROUND(COALESCE(SUM(qty_on_hand * unit_cost),0),2) v FROM batches WHERE status = 'available' AND expiry > ?", today).v,
  };

  // Today by hour: received vs handed over
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, received: 0, handed_over: 0 }));
  for (const r of db.prepare("SELECT CAST(strftime('%H', received_at) AS INTEGER) h, COUNT(*) n FROM prescriptions WHERE received_at >= ? GROUP BY h").all(start) as { h: number; n: number }[]) hours[r.h].received = r.n;
  for (const r of db.prepare("SELECT CAST(strftime('%H', handed_over_at) AS INTEGER) h, COUNT(*) n FROM dispensings WHERE handed_over_at >= ? GROUP BY h").all(start) as { h: number; n: number }[]) hours[r.h].handed_over = r.n;

  const trend = db.prepare(`SELECT substr(created_at,1,10) day, ROUND(SUM(CASE WHEN kind='rx' THEN net ELSE 0 END),2) rx, ROUND(SUM(CASE WHEN kind='otc' THEN net ELSE 0 END),2) otc
    FROM bills WHERE status = 'finalized' AND created_at >= ? GROUP BY day ORDER BY day`).all(addDays(dayStart(), -13).toISOString());

  const activity = db.prepare("SELECT h.*, u.name actor_name FROM status_history h LEFT JOIN users u ON u.id = h.actor ORDER BY h.at DESC, h.id DESC LIMIT 14").all();
  const urgent = db.prepare(`SELECT rx.id, rx.rx_no, rx.priority, rx.received_at, rx.status, p.name patient_name FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id
    WHERE rx.priority != 'routine' AND rx.status IN ('received','in_review','on_hold','verified') ORDER BY rx.priority = 'stat' DESC, rx.received_at LIMIT 5`).all();

  res.json({ queues: Object.fromEntries(queues.map((q) => [q.stage, q.n])), kpi, rcm, stock, hours, trend, activity, urgent });
});

insight.get("/audit", (req, res) => {
  const { limit, offset } = paging(req.query);
  const entity = String(req.query.entity ?? "");
  const q = String(req.query.q ?? "").trim();
  const where: string[] = []; const args: unknown[] = [];
  if (entity) { where.push("h.entity = ?"); args.push(entity); }
  if (q) { where.push("(h.ref LIKE ? OR h.note LIKE ? OR u.name LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const rows = db.prepare(`SELECT h.*, u.name actor_name FROM status_history h LEFT JOIN users u ON u.id = h.actor ${w} ORDER BY h.at DESC, h.id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const total = (db.prepare(`SELECT COUNT(*) n FROM status_history h LEFT JOIN users u ON u.id = h.actor ${w}`).get(...args) as { n: number }).n;
  res.json({ rows, total });
});

insight.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json([]);
  const like = `%${q}%`;
  const out = [
    ...db.prepare("SELECT 'patient' type, id, name title, mrn subtitle FROM patients WHERE name LIKE ? OR mrn LIKE ? OR phone LIKE ? LIMIT 5").all(like, like, like),
    ...db.prepare("SELECT 'prescription' type, rx.id, rx.rx_no title, p.name || ', ' || rx.status subtitle FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id WHERE rx.rx_no LIKE ? OR p.name LIKE ? ORDER BY rx.received_at DESC LIMIT 5").all(like, like),
    ...db.prepare("SELECT 'product' type, id, name title, generic || ' ' || COALESCE(strength,'') subtitle FROM products WHERE name LIKE ? OR generic LIKE ? OR barcode = ? OR sku = ? LIMIT 5").all(like, like, q, q),
    ...db.prepare("SELECT 'claim' type, c.id, c.claim_no title, p.code || ', ' || c.status subtitle FROM claims c JOIN payers p ON p.id = c.payer_id WHERE c.claim_no LIKE ? LIMIT 4").all(like),
    ...db.prepare("SELECT 'purchase_order' type, id, po_no title, status subtitle FROM purchase_orders WHERE po_no LIKE ? LIMIT 3").all(like),
    ...db.prepare("SELECT 'invoice' type, b.id, b.bill_no title, COALESCE(pa.name, 'Counter sale') || ', ' || b.status subtitle FROM bills b LEFT JOIN patients pa ON pa.id = b.patient_id WHERE b.bill_no LIKE ? LIMIT 4").all(like),
    ...db.prepare("SELECT 'order' type, id, order_no title, customer_name || ', ' || status subtitle FROM orders WHERE order_no LIKE ? OR customer_name LIKE ? OR phone LIKE ? LIMIT 4").all(like, like, like),
    ...db.prepare("SELECT 'authorization' type, a.id, a.auth_no title, p.name || ', ' || a.status subtitle FROM authorizations a JOIN prescriptions rx ON rx.id = a.prescription_id JOIN patients p ON p.id = rx.patient_id WHERE a.auth_no LIKE ? LIMIT 3").all(like),
  ];
  res.json(out);
});

insight.get("/meta", (_req, res) => {
  const settings = Object.fromEntries((db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE 'seq:%'").all() as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  res.json({
    settings,
    users: db.prepare("SELECT * FROM users").all(),
    payers: db.prepare("SELECT id, name, code, workflow FROM payers ORDER BY name").all(),
    doctors: db.prepare("SELECT id, name, specialty, facility FROM doctors ORDER BY name").all(),
  });
});
