import { db } from "../db/index.js";
import { addDays, now, nowDate } from "../lib/clock.js";
import { badRequest, conflict, notFound, round2 } from "../lib/http.js";
import { nextNo, uid } from "../lib/ids.js";
import { logHistory, setStatus } from "./history.js";
import * as rcm from "./rcm.js";
import * as stock from "./stock.js";

interface BillRow { id: string; bill_no: string; kind: string; status: string; gross: number; tax: number; discount: number; patient_id: string | null }
interface LineRow { id: string; product_id: string; qty: number; qty_returned: number; gross: number; tax: number }

/**
 * Refund all or part of a counter or order sale. Returned stock goes to quarantine (never back on the shelf),
 * the patient is refunded, and the invoice is reversed once every unit has come back.
 * Prescription supplies are returned from the workbench so their claims are reversed too.
 */
export function returnSale(billId: string, input: { lines: { bill_line_id: string; qty: number }[]; reason: string; method: string }, actor: string) {
  const bill = db.prepare("SELECT * FROM bills WHERE id = ?").get(billId) as BillRow | undefined;
  if (!bill) throw notFound("Invoice");
  if (bill.kind === "rx") throw conflict(`${bill.bill_no} is a prescription supply. Use Return medicine on the prescription so its claims are reversed too.`);
  if (bill.status !== "finalized") throw conflict(`${bill.bill_no} is ${bill.status}; only finalized sales can be returned.`);
  const wanted = input.lines.filter((l) => l.qty > 0);
  if (!wanted.length) throw badRequest("Choose at least one item to return.");
  const sold = db.prepare("SELECT created_at FROM bills WHERE id = ?").get(billId) as { created_at: string };
  if (sold.created_at < addDays(nowDate(), -30).toISOString()) throw conflict("Sales older than 30 days cannot be returned at the counter.");

  const discountFactor = bill.gross + bill.tax > 0 ? 1 - bill.discount / (bill.gross + bill.tax) : 1;
  const id = uid("ret");
  const return_no = nextNo("ret", "CN");
  let amount = 0;
  const ref = { type: "bill", id: billId };
  const lines: { line: LineRow; qty: number; value: number }[] = [];

  for (const w of wanted) {
    const line = db.prepare("SELECT * FROM bill_lines WHERE id = ? AND bill_id = ?").get(w.bill_line_id, billId) as LineRow | undefined;
    if (!line) throw badRequest("That item is not on this invoice.");
    if (w.qty > line.qty - line.qty_returned) throw conflict(`Only ${line.qty - line.qty_returned} left to return on this line.`);
    const value = round2(((line.gross + line.tax) / line.qty) * w.qty * discountFactor);
    amount = round2(amount + value);
    lines.push({ line, qty: w.qty, value });
  }

  db.prepare("INSERT INTO sales_returns (id, return_no, bill_id, status, reason, method, amount, created_at, actor) VALUES (?,?,?, 'refunded', ?,?,?,?,?)")
    .run(id, return_no, billId, input.reason, input.method, amount, now(), actor);

  for (const { line, qty, value } of lines) {
    // Put units back against the batches they left from, newest issue first
    const issued = db.prepare(
      `SELECT m.batch_id, b.batch_no, -SUM(m.qty) q FROM stock_movements m JOIN batches b ON b.id = m.batch_id
       WHERE m.ref_type = 'bill' AND m.ref_id = ? AND m.product_id = ? AND m.type = 'issue' GROUP BY m.batch_id ORDER BY MAX(m.id) DESC`,
    ).all(billId, line.product_id) as { batch_id: string; batch_no: string; q: number }[];
    let left = qty;
    for (const b of issued) {
      if (left <= 0) break;
      const back = (db.prepare(
        `SELECT COALESCE(SUM(m.qty),0) q FROM stock_movements m JOIN batches rb ON rb.id = m.batch_id
         WHERE m.type = 'return' AND m.ref_type = 'bill' AND m.ref_id = ? AND rb.batch_no = ?`,
      ).get(billId, `${b.batch_no}-R`) as { q: number }).q;
      const take = Math.min(left, b.q - back);
      if (take <= 0) continue;
      stock.returnToQuarantine({ batch_id: b.batch_id, qty: take }, actor, ref, `${return_no}: ${input.reason}`);
      left -= take;
    }
    db.prepare("UPDATE bill_lines SET qty_returned = qty_returned + ? WHERE id = ?").run(qty, line.id);
    db.prepare("INSERT INTO sales_return_lines (id, return_id, bill_line_id, product_id, qty, amount) VALUES (?,?,?,?,?,?)").run(uid("rtl"), id, line.id, line.product_id, qty, value);
  }

  rcm.recordPatientPayment(billId, -amount, input.method, actor);
  db.prepare("UPDATE bills SET refunded = ROUND(refunded + ?, 2) WHERE id = ?").run(amount, billId);
  logHistory("sales_return", id, return_no, null, "refunded", actor, input.reason);
  const open = db.prepare("SELECT COUNT(*) n FROM bill_lines WHERE bill_id = ? AND qty_returned < qty").get(billId) as { n: number };
  if (!open.n) setStatus("bill", billId, "reversed", actor, `Fully returned on ${return_no}`);
  else logHistory("bill", billId, bill.bill_no, bill.status, bill.status, actor, `Part returned on ${return_no}, ${amount.toFixed(2)} refunded`);
  return id;
}
