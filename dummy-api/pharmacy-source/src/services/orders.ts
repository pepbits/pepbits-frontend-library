import { db } from "../db/index.js";
import { addDays, now, nowDate } from "../lib/clock.js";
import { badRequest, conflict, notFound, round2 } from "../lib/http.js";
import { nextNo, uid } from "../lib/ids.js";
import { logHistory, setStatus } from "./history.js";
import * as rcm from "./rcm.js";
import * as stock from "./stock.js";

export interface NewOrder {
  patient_id?: string | null; customer_name: string; phone: string; channel: "phone" | "web" | "whatsapp" | "walk_in";
  fulfilment: "pickup" | "delivery"; address?: string; payment: "prepaid" | "cash_on_delivery" | "pay_at_counter"; notes?: string;
  items: { product_id: string; qty: number }[];
}
type OrderRow = { id: string; order_no: string; status: string; fulfilment: string; payment: string; patient_id: string | null; bill_id: string | null };

const get = (id: string) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!o) throw notFound("Order");
  return o;
};
const need = (o: OrderRow, allowed: string[], verb: string) => {
  if (!allowed.includes(o.status)) throw conflict(`${o.order_no} is ${o.status.replace(/_/g, " ")}; it cannot be ${verb} now.`);
};

/** Orders carry non-prescription items only. Prescription refills go through the Rx workbench. */
export function createOrder(input: NewOrder, actor: string) {
  if (!input.items.length) throw badRequest("Add at least one item.");
  if (input.fulfilment === "delivery" && !input.address?.trim()) throw badRequest("Delivery orders need an address.");
  const id = uid("ord");
  const order_no = nextNo("order", "ORD", 20000);
  let total = 0;
  const priced = input.items.map((it) => {
    const p = db.prepare("SELECT name, schedule, price_per_unit, tax_rate FROM products WHERE id = ?").get(it.product_id) as { name: string; schedule: string; price_per_unit: number; tax_rate: number } | undefined;
    if (!p) throw notFound("Product");
    if (p.schedule !== "otc") throw conflict(`${p.name} needs a prescription. Take it as a prescription in the Rx workbench and choose home delivery there.`);
    total += p.price_per_unit * it.qty * (1 + p.tax_rate);
    return { ...it, unit_price: p.price_per_unit };
  });
  const promised = addDays(nowDate(), input.fulfilment === "delivery" ? 0.25 : 0.08).toISOString();
  db.prepare(
    `INSERT INTO orders (id, order_no, patient_id, customer_name, phone, channel, fulfilment, address, payment, status, notes, total, promised_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?, 'new', ?,?,?,?)`,
  ).run(id, order_no, input.patient_id ?? null, input.customer_name, input.phone, input.channel, input.fulfilment, input.address ?? null, input.payment, input.notes ?? null, round2(total), promised, now());
  const ins = db.prepare("INSERT INTO order_items (id, order_id, product_id, qty, unit_price) VALUES (?,?,?,?,?)");
  for (const p of priced) ins.run(uid("ori"), id, p.product_id, p.qty, p.unit_price);
  logHistory("order", id, order_no, null, "new", actor, `Received by ${input.channel.replace("_", " ")}`);
  return id;
}

/** Confirming reserves stock first-expiry-first-out so it can't be sold to someone else. */
export function confirmOrder(id: string, actor: string) {
  const o = get(id);
  need(o, ["new"], "confirmed");
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id) as { id: string; product_id: string; qty: number }[];
  for (const it of items) {
    for (const a of stock.allocateFefo(it.product_id, it.qty)) {
      stock.reserve(a, actor, { type: "order", id });
      db.prepare("INSERT INTO order_allocations (id, order_item_id, batch_id, qty) VALUES (?,?,?,?)").run(uid("ora"), it.id, a.batch_id, a.qty);
    }
  }
  setStatus("order", id, "confirmed", actor, "Stock reserved");
}

export function markReady(id: string, actor: string) {
  const o = get(id);
  need(o, ["confirmed"], "marked packed");
  setStatus("order", id, "ready", actor, o.fulfilment === "delivery" ? "Packed, waiting for rider" : "Packed, waiting for customer");
}

export function dispatch(id: string, rider: string, actor: string) {
  const o = get(id);
  if (o.fulfilment !== "delivery") throw conflict("Pickup orders are completed at the counter.");
  need(o, ["ready"], "dispatched");
  setStatus("order", id, "out_for_delivery", actor, rider ? `With ${rider}` : undefined);
}

/** Collected or delivered: issue the reserved stock, raise the invoice and take payment. */
export function completeOrder(id: string, method: string, actor: string) {
  const o = get(id);
  need(o, o.fulfilment === "delivery" ? ["out_for_delivery"] : ["ready"], "completed");
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id) as { id: string; product_id: string; qty: number }[];
  const billId = rcm.createBill("otc", o.patient_id, null, rcm.priceLines(null, items.map((i) => ({ product_id: i.product_id, qty: i.qty }))), actor);
  for (const it of items) {
    for (const a of db.prepare("SELECT batch_id, qty FROM order_allocations WHERE order_item_id = ?").all(it.id) as stock.Allocation[]) {
      stock.issue(a, actor, { type: "bill", id: billId }, true);
    }
  }
  const bill = db.prepare("SELECT patient_share FROM bills WHERE id = ?").get(billId) as { patient_share: number };
  rcm.recordPatientPayment(billId, bill.patient_share, o.payment === "prepaid" ? "online" : method, actor);
  setStatus("bill", billId, "finalized", actor, `Order ${o.order_no}`);
  db.prepare("UPDATE orders SET bill_id = ?, completed_at = ? WHERE id = ?").run(billId, now(), id);
  setStatus("order", id, "completed", actor, o.fulfilment === "delivery" ? "Delivered" : "Collected");
  return billId;
}

export function cancelOrder(id: string, reason: string, actor: string) {
  const o = get(id);
  need(o, ["new", "confirmed", "ready", "out_for_delivery"], "cancelled");
  const allocs = db.prepare(
    "SELECT a.batch_id, a.qty FROM order_allocations a JOIN order_items i ON i.id = a.order_item_id WHERE i.order_id = ?",
  ).all(id) as stock.Allocation[];
  for (const a of allocs) stock.release(a, actor, { type: "order", id }, reason);
  setStatus("order", id, "cancelled", actor, reason);
}
