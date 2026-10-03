import { db } from "../db/index.js";
import { now, nowDate } from "../lib/clock.js";
import { conflict, notFound } from "../lib/http.js";
import { uid } from "../lib/ids.js";
import { logHistory } from "./history.js";

type MoveType = "receipt" | "reserve" | "release" | "issue" | "return" | "adjust" | "quarantine" | "unquarantine" | "recall" | "expire";
export interface Ref { type: string; id: string }
export interface Allocation { batch_id: string; qty: number }

interface BatchRow {
  id: string; product_id: string; batch_no: string; expiry: string; qty_on_hand: number; qty_reserved: number; status: string;
}

const today = () => nowDate().toISOString().slice(0, 10);

export function move(batch: BatchRow, type: MoveType, qty: number, actor: string, ref?: Ref, note?: string) {
  db.prepare(
    "INSERT INTO stock_movements (batch_id, product_id, type, qty, ref_type, ref_id, note, actor, at) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(batch.id, batch.product_id, type, qty, ref?.type ?? null, ref?.id ?? null, note ?? null, actor, now());
}

const getBatch = (id: string) => {
  const b = db.prepare("SELECT * FROM batches WHERE id = ?").get(id) as BatchRow | undefined;
  if (!b) throw notFound("Batch");
  return b;
};

/** Sellable batches, first-expiry-first-out. */
export function sellableBatches(productId: string) {
  return db.prepare(
    `SELECT *, qty_on_hand - qty_reserved AS available FROM batches
     WHERE product_id = ? AND status = 'available' AND expiry > ? AND qty_on_hand - qty_reserved > 0
     ORDER BY expiry ASC, received_at ASC`,
  ).all(productId, today()) as (BatchRow & { available: number })[];
}

export const availableQty = (productId: string) =>
  sellableBatches(productId).reduce((s, b) => s + b.available, 0);

export function allocateFefo(productId: string, qty: number): Allocation[] {
  const out: Allocation[] = [];
  let left = qty;
  for (const b of sellableBatches(productId)) {
    if (left <= 0) break;
    const take = Math.min(b.available, left);
    out.push({ batch_id: b.id, qty: take });
    left -= take;
  }
  if (left > 0) {
    const p = db.prepare("SELECT name FROM products WHERE id = ?").get(productId) as { name: string } | undefined;
    throw conflict(`Not enough sellable stock for ${p?.name ?? productId}. Short by ${left}.`, { product_id: productId, short: left });
  }
  return out;
}

export function reserve(a: Allocation, actor: string, ref: Ref) {
  const b = getBatch(a.batch_id);
  if (b.qty_on_hand - b.qty_reserved < a.qty) throw conflict(`Batch ${b.batch_no} no longer has ${a.qty} available.`);
  db.prepare("UPDATE batches SET qty_reserved = qty_reserved + ? WHERE id = ?").run(a.qty, b.id);
  move(b, "reserve", a.qty, actor, ref);
}

export function release(a: Allocation, actor: string, ref: Ref, note?: string) {
  const b = getBatch(a.batch_id);
  db.prepare("UPDATE batches SET qty_reserved = MAX(qty_reserved - ?, 0) WHERE id = ?").run(a.qty, b.id);
  move(b, "release", -a.qty, actor, ref, note);
}

/** Physical issue. When fromReserved, the reservation is consumed at the same time. */
export function issue(a: Allocation, actor: string, ref: Ref, fromReserved: boolean) {
  const b = getBatch(a.batch_id);
  if (b.qty_on_hand < a.qty) throw conflict(`Batch ${b.batch_no} has only ${b.qty_on_hand} on hand.`);
  db.prepare(
    `UPDATE batches SET qty_on_hand = qty_on_hand - ?, qty_reserved = MAX(qty_reserved - ?, 0) WHERE id = ?`,
  ).run(a.qty, fromReserved ? a.qty : 0, b.id);
  move(b, "issue", -a.qty, actor, ref);
}

/** Returned medicine goes to quarantine, never straight back to sellable stock. */
export function returnToQuarantine(a: Allocation, actor: string, ref: Ref, note: string) {
  const src = getBatch(a.batch_id);
  const full = db.prepare("SELECT * FROM batches WHERE id = ?").get(src.id) as Record<string, unknown>;
  const qid = uid("bat");
  db.prepare(
    `INSERT INTO batches (id, product_id, supplier_id, batch_no, expiry, qty_on_hand, qty_reserved, unit_cost, status, location, received_at)
     VALUES (?,?,?,?,?,?,0,?, 'quarantined', 'Returns bay', ?)`,
  ).run(qid, src.product_id, full.supplier_id, `${src.batch_no}-R`, src.expiry, a.qty, full.unit_cost, now());
  const q = getBatch(qid);
  move(q, "return", a.qty, actor, ref, note);
  logHistory("batch", qid, q.batch_no, null, "quarantined", actor, note);
  return qid;
}

export function receive(input: {
  product_id: string; supplier_id: string; batch_no: string; expiry: string; qty: number; unit_cost: number; location?: string;
}, actor: string, ref: Ref) {
  const existing = db.prepare("SELECT * FROM batches WHERE product_id = ? AND batch_no = ? AND status = 'available'")
    .get(input.product_id, input.batch_no) as BatchRow | undefined;
  let id = existing?.id;
  if (existing) {
    db.prepare("UPDATE batches SET qty_on_hand = qty_on_hand + ? WHERE id = ?").run(input.qty, existing.id);
  } else {
    id = uid("bat");
    const loc = input.location ?? (db.prepare("SELECT location FROM products WHERE id = ?").get(input.product_id) as { location: string })?.location;
    db.prepare(
      `INSERT INTO batches (id, product_id, supplier_id, batch_no, expiry, qty_on_hand, qty_reserved, unit_cost, status, location, received_at)
       VALUES (?,?,?,?,?,?,0,?, 'available', ?, ?)`,
    ).run(id, input.product_id, input.supplier_id, input.batch_no, input.expiry, input.qty, input.unit_cost, loc, now());
  }
  move(getBatch(id!), "receipt", input.qty, actor, ref);
  return id!;
}

export function adjust(batchId: string, delta: number, actor: string, reason: string) {
  const b = getBatch(batchId);
  if (b.qty_on_hand + delta < b.qty_reserved) throw conflict("Adjustment would take stock below reserved quantity.");
  db.prepare("UPDATE batches SET qty_on_hand = qty_on_hand + ? WHERE id = ?").run(delta, b.id);
  move(b, "adjust", delta, actor, { type: "adjustment", id: uid("adj") }, reason);
}

const STATUS_MOVE: Record<string, MoveType> = { quarantined: "quarantine", available: "unquarantine", recalled: "recall", expired: "expire" };

export function setBatchStatus(batchId: string, to: "available" | "quarantined" | "recalled" | "expired", actor: string, reason: string) {
  const b = getBatch(batchId);
  if (b.status === to) return;
  if (to === "available" && b.expiry <= today()) throw conflict("An expired batch cannot be released to sellable stock.");
  if (b.qty_reserved > 0 && to !== "available") throw conflict(`Batch ${b.batch_no} has ${b.qty_reserved} reserved for open dispensings. Cancel or reallocate them first.`);
  db.prepare("UPDATE batches SET status = ? WHERE id = ?").run(to, b.id);
  move(b, STATUS_MOVE[to], 0, actor, undefined, reason);
  logHistory("batch", b.id, b.batch_no, b.status, to, actor, reason);
}
