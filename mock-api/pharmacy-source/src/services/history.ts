import { db } from "../db/index.js";
import { now } from "../lib/clock.js";

export type Entity = "prescription" | "authorization" | "dispensing" | "bill" | "claim" | "remittance" | "payment" | "purchase_order" | "batch" | "order" | "sales_return";

const TABLE: Record<Entity, [string, string]> = {
  prescription: ["prescriptions", "rx_no"],
  authorization: ["authorizations", "auth_no"],
  dispensing: ["dispensings", "disp_no"],
  bill: ["bills", "bill_no"],
  claim: ["claims", "claim_no"],
  remittance: ["remittances", "ra_no"],
  payment: ["payments", "payment_ref"],
  purchase_order: ["purchase_orders", "po_no"],
  batch: ["batches", "batch_no"],
  order: ["orders", "order_no"],
  sales_return: ["sales_returns", "return_no"],
};

/** Change a record's status and append the transition to its own history. */
export function setStatus(entity: Entity, id: string, to: string, actor: string, note?: string) {
  const [table, refCol] = TABLE[entity];
  const row = db.prepare(`SELECT status, ${refCol} AS ref FROM ${table} WHERE id = ?`).get(id) as { status: string; ref: string } | undefined;
  if (!row) throw new Error(`${entity} ${id} missing`);
  if (row.status === to && !note) return;
  db.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).run(to, id);
  logHistory(entity, id, row.ref, row.status, to, actor, note);
}

export function logHistory(entity: Entity, id: string, ref: string, from: string | null, to: string, actor: string, note?: string) {
  db.prepare(
    "INSERT INTO status_history (entity, entity_id, ref, from_status, to_status, note, actor, at) VALUES (?,?,?,?,?,?,?,?)",
  ).run(entity, id, ref, from, to, note ?? null, actor, now());
}

export const historyOf = (entity: Entity, id: string) =>
  db.prepare("SELECT * FROM status_history WHERE entity = ? AND entity_id = ? ORDER BY id").all(entity, id);
