import { db } from "../db/index.js";
import { addDays, now, nowDate } from "../lib/clock.js";
import { badRequest, conflict, notFound, round2 } from "../lib/http.js";
import { nextNo, uid } from "../lib/ids.js";
import { logHistory, setStatus } from "./history.js";
import * as rcm from "./rcm.js";
import * as stock from "./stock.js";

/** Counter sale of non-prescription items. */
export function counterSale(input: { items: { product_id: string; qty: number }[]; payment_method: string; patient_id?: string | null; discount?: number }, actor: string) {
  if (!input.items.length) throw badRequest("The basket is empty.");
  for (const it of input.items) {
    const p = db.prepare("SELECT name, schedule FROM products WHERE id = ?").get(it.product_id) as { name: string; schedule: string } | undefined;
    if (!p) throw notFound("Product");
    if (p.schedule !== "otc") throw conflict(`${p.name} needs a prescription. Dispense it from the Rx workbench.`);
  }
  const priced = rcm.priceLines(null, input.items);
  const billId = rcm.createBill("otc", input.patient_id ?? null, null, priced, actor);
  const ref = { type: "bill", id: billId };
  for (const it of input.items) for (const a of stock.allocateFefo(it.product_id, it.qty)) stock.issue(a, actor, ref, false);
  const discount = round2(Math.min(input.discount ?? 0, priced.reduce((s, l) => s + l.patient_share, 0)));
  if (discount) db.prepare("UPDATE bills SET discount = ?, net = ROUND(net - ?, 2), patient_share = ROUND(patient_share - ?, 2) WHERE id = ?").run(discount, discount, discount, billId);
  const bill = db.prepare("SELECT patient_share FROM bills WHERE id = ?").get(billId) as { patient_share: number };
  rcm.recordPatientPayment(billId, bill.patient_share, input.payment_method, actor);
  setStatus("bill", billId, "finalized", actor);
  return billId;
}

export function reorderSuggestions() {
  const today = nowDate().toISOString().slice(0, 10);
  return db.prepare(
    `SELECT p.id product_id, p.name, p.sku, p.reorder_level, p.max_level, p.cost_per_unit, p.preferred_supplier_id supplier_id, s.name supplier_name,
       COALESCE((SELECT SUM(qty_on_hand - qty_reserved) FROM batches b WHERE b.product_id = p.id AND b.status = 'available' AND b.expiry > ?), 0) available,
       COALESCE((SELECT SUM(pi.qty_ordered - pi.qty_received) FROM po_items pi JOIN purchase_orders po ON po.id = pi.po_id
                 WHERE pi.product_id = p.id AND po.status IN ('draft','approved','sent','partially_received')), 0) on_order
     FROM products p LEFT JOIN suppliers s ON s.id = p.preferred_supplier_id WHERE p.active = 1`,
  ).all(today).map((r: any) => ({ ...r, suggested: Math.max(r.max_level - r.available - r.on_order, 0) }))
    .filter((r: any) => r.available + r.on_order <= r.reorder_level && r.suggested > 0);
}

export function createPO(input: { supplier_id: string; items: { product_id: string; qty: number; unit_cost?: number }[] }, actor: string) {
  if (!input.items.length) throw badRequest("Add at least one line.");
  const sup = db.prepare("SELECT lead_time_days FROM suppliers WHERE id = ?").get(input.supplier_id) as { lead_time_days: number } | undefined;
  if (!sup) throw notFound("Supplier");
  const id = uid("po");
  const po_no = nextNo("po", "PO", 5000);
  db.prepare("INSERT INTO purchase_orders (id, po_no, supplier_id, status, created_at, expected_at) VALUES (?,?,?, 'draft', ?, ?)")
    .run(id, po_no, input.supplier_id, now(), addDays(nowDate(), sup.lead_time_days).toISOString().slice(0, 10));
  let total = 0;
  for (const it of input.items) {
    const cost = it.unit_cost ?? (db.prepare("SELECT cost_per_unit c FROM products WHERE id = ?").get(it.product_id) as { c: number }).c;
    db.prepare("INSERT INTO po_items (id, po_id, product_id, qty_ordered, unit_cost) VALUES (?,?,?,?,?)").run(uid("poi"), id, it.product_id, it.qty, cost);
    total += cost * it.qty;
  }
  db.prepare("UPDATE purchase_orders SET total = ? WHERE id = ?").run(round2(total), id);
  logHistory("purchase_order", id, po_no, null, "draft", actor);
  return id;
}

const PO_FLOW: Record<string, string[]> = { approve: ["draft"], send: ["approved"], cancel: ["draft", "approved", "sent"] };
export function advancePO(id: string, action: "approve" | "send" | "cancel", actor: string) {
  const po = db.prepare("SELECT status, po_no FROM purchase_orders WHERE id = ?").get(id) as { status: string; po_no: string } | undefined;
  if (!po) throw notFound("Purchase order");
  if (!PO_FLOW[action].includes(po.status)) throw conflict(`${po.po_no} is ${po.status}; cannot ${action}.`);
  setStatus("purchase_order", id, action === "approve" ? "approved" : action === "send" ? "sent" : "cancelled", actor);
}

export function receivePO(id: string, lines: { po_item_id: string; qty: number; batch_no: string; expiry: string }[], actor: string) {
  const po = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as { status: string; po_no: string; supplier_id: string } | undefined;
  if (!po) throw notFound("Purchase order");
  if (!["sent", "partially_received"].includes(po.status)) throw conflict(`${po.po_no} must be sent before receiving.`);
  const minExpiry = addDays(nowDate(), 60).toISOString().slice(0, 10);
  for (const l of lines.filter((x) => x.qty > 0)) {
    const it = db.prepare("SELECT * FROM po_items WHERE id = ? AND po_id = ?").get(l.po_item_id, id) as { product_id: string; qty_ordered: number; qty_received: number; unit_cost: number } | undefined;
    if (!it) throw badRequest("Line does not belong to this order.");
    if (it.qty_received + l.qty > it.qty_ordered) throw conflict("Received quantity exceeds what was ordered.");
    if (l.expiry < minExpiry) throw conflict(`Batch ${l.batch_no} expires within 60 days. Refuse it or record it as a short-dated exception.`);
    stock.receive({ product_id: it.product_id, supplier_id: po.supplier_id, batch_no: l.batch_no, expiry: l.expiry, qty: l.qty, unit_cost: it.unit_cost }, actor, { type: "purchase_order", id });
    db.prepare("UPDATE po_items SET qty_received = qty_received + ? WHERE id = ?").run(l.qty, l.po_item_id);
  }
  const open = db.prepare("SELECT COUNT(*) n FROM po_items WHERE po_id = ? AND qty_received < qty_ordered").get(id) as { n: number };
  setStatus("purchase_order", id, open.n ? "partially_received" : "received", actor);
}
