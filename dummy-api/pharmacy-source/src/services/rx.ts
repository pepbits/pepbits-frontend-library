import { db } from "../db/index.js";
import { addDays, now, nowDate } from "../lib/clock.js";
import { badRequest, conflict, notFound, round2 } from "../lib/http.js";
import { nextNo, uid } from "../lib/ids.js";
import { logHistory, setStatus } from "./history.js";
import * as rcm from "./rcm.js";
import * as stock from "./stock.js";

export interface NewRxItem { product_id: string; dose: number; frequency_per_day: number; days: number; qty?: number; sig: string; substitution_allowed?: boolean }
export interface NewRx {
  patient_id: string; doctor_id: string; source: "erx" | "paper" | "hospital"; priority: "routine" | "urgent" | "stat";
  diagnosis_code?: string; diagnosis?: string; notes?: string; written_at?: string; items: NewRxItem[];
}

type RxRow = { id: string; rx_no: string; status: string; patient_id: string };
const getRx = (id: string) => {
  const r = db.prepare("SELECT * FROM prescriptions WHERE id = ?").get(id) as RxRow | undefined;
  if (!r) throw notFound("Prescription");
  return r;
};

export function createPrescription(input: NewRx, actor: string) {
  if (!input.items.length) throw badRequest("Add at least one medicine.");
  const id = uid("rx");
  const rx_no = nextNo("rx", "RX");
  db.prepare(
    `INSERT INTO prescriptions (id, rx_no, patient_id, doctor_id, source, priority, diagnosis_code, diagnosis, status, written_at, received_at, notes)
     VALUES (?,?,?,?,?,?,?,?, 'received', ?, ?, ?)`,
  ).run(id, rx_no, input.patient_id, input.doctor_id, input.source, input.priority, input.diagnosis_code ?? null, input.diagnosis ?? null,
    input.written_at ?? now(), now(), input.notes ?? null);
  const ins = db.prepare(
    `INSERT INTO prescription_items (id, prescription_id, product_id, qty_prescribed, dose, frequency_per_day, days, sig, substitution_allowed)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  for (const it of input.items) {
    const qty = it.qty ?? Math.ceil(it.dose * it.frequency_per_day * it.days);
    ins.run(uid("rxi"), id, it.product_id, qty, it.dose, it.frequency_per_day, it.days, it.sig, it.substitution_allowed === false ? 0 : 1);
  }
  logHistory("prescription", id, rx_no, null, "received", actor, input.source === "erx" ? "Received via eRx network" : undefined);
  return id;
}

export interface SafetyAlert {
  key: string; type: "allergy" | "interaction" | "duplicate" | "max_dose" | "authorization" | "stock" | "coverage" | "cold_chain" | "controlled";
  severity: "major" | "moderate" | "info"; title: string; detail: string; item_ids: string[]; overridden?: { reason: string; actor: string; at: string };
}

export function safety(rxId: string): SafetyAlert[] {
  const rx = getRx(rxId);
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(rx.patient_id) as { allergies: string };
  const allergies = (JSON.parse(patient.allergies) as string[]).map((a) => a.toLowerCase());
  const items = db.prepare(
    `SELECT pi.*, p.name, p.ingredient, p.drug_class, p.max_daily_dose, p.dose_unit, p.requires_auth, p.cold_chain, p.schedule
     FROM prescription_items pi JOIN products p ON p.id = pi.product_id WHERE pi.prescription_id = ?`,
  ).all(rxId) as {
    id: string; name: string; ingredient: string; drug_class: string; max_daily_dose: number | null; dose_unit: string; dose: number; frequency_per_day: number;
    requires_auth: number; cold_chain: number; schedule: string; product_id: string; qty_prescribed: number; qty_dispensed: number;
  }[];
  const alerts: SafetyAlert[] = [];

  for (const it of items) {
    const hit = allergies.find((a) => a === it.ingredient.toLowerCase() || a === it.drug_class.toLowerCase());
    if (hit) alerts.push({ key: `allergy:${it.id}`, type: "allergy", severity: "major", title: `Allergy to ${hit}`, detail: `${it.name} contains ${it.ingredient} (${it.drug_class}). Patient record lists ${hit}.`, item_ids: [it.id] });
    if (it.max_daily_dose && it.dose * it.frequency_per_day > it.max_daily_dose) {
      alerts.push({ key: `dose:${it.id}`, type: "max_dose", severity: "major", title: "Above maximum daily dose", detail: `${it.name}: ${it.dose * it.frequency_per_day} ${it.dose_unit}/day prescribed; limit is ${it.max_daily_dose} ${it.dose_unit}/day.`, item_ids: [it.id] });
    }
    if (it.cold_chain) alerts.push({ key: `cold:${it.id}`, type: "cold_chain", severity: "info", title: "Cold chain", detail: `${it.name} must stay at 2–8 °C. Pack with a cool pack at handover.`, item_ids: [it.id] });
    if (it.schedule === "controlled") alerts.push({ key: `ctrl:${it.id}`, type: "controlled", severity: "info", title: "Controlled medicine", detail: `${it.name} is recorded in the controlled register. Check patient ID at handover.`, item_ids: [it.id] });
  }

  // Duplicate ingredient / therapeutic class within the prescription
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.ingredient === b.ingredient) alerts.push({ key: `dup:${a.id}:${b.id}`, type: "duplicate", severity: "major", title: "Duplicate ingredient", detail: `${a.name} and ${b.name} both contain ${a.ingredient}.`, item_ids: [a.id, b.id] });
    else if (a.drug_class === b.drug_class) alerts.push({ key: `cls:${a.id}:${b.id}`, type: "duplicate", severity: "moderate", title: "Therapeutic duplication", detail: `${a.name} and ${b.name} are both ${a.drug_class}.`, item_ids: [a.id, b.id] });
  }

  // Interactions against this prescription and medicines handed over in the last 90 days
  const since = addDays(nowDate(), -90).toISOString();
  const recent = db.prepare(
    `SELECT DISTINCT p.ingredient, p.name FROM dispensings d JOIN dispensing_items di ON di.dispensing_id = d.id JOIN products p ON p.id = di.product_id
     WHERE d.patient_id = ? AND d.status = 'handed_over' AND d.handed_over_at >= ? AND d.prescription_id != ?`,
  ).all(rx.patient_id, since, rxId) as { ingredient: string; name: string }[];
  const pool = [...items.map((i) => ({ ingredient: i.ingredient, name: i.name, id: i.id as string | null })), ...recent.map((r) => ({ ...r, id: null }))];
  const seen = new Set<string>();
  for (const it of items) for (const other of pool) {
    if (other.id === it.id) continue;
    const ix = db.prepare("SELECT * FROM interactions WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)").get(it.ingredient, other.ingredient, other.ingredient, it.ingredient) as { severity: string; note: string } | undefined;
    if (!ix) continue;
    const k = `ix:${[it.ingredient, other.ingredient].sort().join("+")}`;
    if (seen.has(k)) continue;
    seen.add(k);
    alerts.push({
      key: k, type: "interaction", severity: ix.severity === "minor" ? "info" : (ix.severity as "major" | "moderate"),
      title: `Interaction: ${it.ingredient} + ${other.ingredient}`, detail: `${ix.note}${other.id ? "" : ` (${other.name} handed over in the last 90 days)`}`,
      item_ids: [it.id, ...(other.id ? [other.id] : [])],
    });
  }

  // Coverage and prior authorization
  const covs = rcm.activeCoverages(rx.patient_id);
  if (!covs.length) alerts.push({ key: "coverage:none", type: "coverage", severity: "info", title: "Self-pay", detail: "No active coverage on file. The patient pays the full amount.", item_ids: [] });
  const primary = covs.find((c) => c.priority === 1);
  if (primary) for (const it of items.filter((i) => i.requires_auth)) {
    const auth = db.prepare(
      `SELECT a.status, ai.qty_approved FROM authorizations a JOIN authorization_items ai ON ai.authorization_id = a.id
       WHERE a.prescription_id = ? AND ai.prescription_item_id = ? ORDER BY a.requested_at DESC LIMIT 1`,
    ).get(rxId, it.id) as { status: string; qty_approved: number } | undefined;
    if (!auth || auth.status === "denied") alerts.push({ key: `auth:${it.id}`, type: "authorization", severity: "moderate", title: auth ? "Authorization denied" : "Prior authorization needed", detail: `${it.name} needs payer approval. Without it the claim line will be denied.`, item_ids: [it.id] });
    else if (auth.status === "requested") alerts.push({ key: `auth:${it.id}`, type: "authorization", severity: "info", title: "Authorization pending", detail: `Waiting for the payer decision on ${it.name}.`, item_ids: [it.id] });
  }

  // Stock
  for (const it of items) {
    const remaining = it.qty_prescribed - it.qty_dispensed;
    if (remaining <= 0) continue;
    const avail = stock.availableQty(it.product_id);
    if (avail < remaining) alerts.push({ key: `stock:${it.id}`, type: "stock", severity: "moderate", title: avail ? "Partial stock" : "Out of stock", detail: `${it.name}: ${avail} available, ${remaining} needed. Dispense partially or source from another branch.`, item_ids: [it.id] });
  }

  const overrides = db.prepare("SELECT alert_key, reason, actor, at FROM safety_overrides WHERE prescription_id = ?").all(rxId) as { alert_key: string; reason: string; actor: string; at: string }[];
  for (const a of alerts) {
    const o = overrides.find((x) => x.alert_key === a.key);
    if (o) a.overridden = { reason: o.reason, actor: o.actor, at: o.at };
  }
  const rank = { major: 0, moderate: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function startReview(rxId: string, actor: string) {
  const rx = getRx(rxId);
  if (rx.status === "received") setStatus("prescription", rxId, "in_review", actor);
}

export function verify(rxId: string, overrides: { key: string; reason: string }[], actor: string) {
  const rx = getRx(rxId);
  if (!["received", "in_review", "on_hold"].includes(rx.status)) throw conflict(`${rx.rx_no} is ${rx.status.replace("_", " ")} and cannot be verified.`);
  const ins = db.prepare("INSERT INTO safety_overrides (prescription_id, alert_key, reason, actor, at) VALUES (?,?,?,?,?)");
  for (const o of overrides) ins.run(rxId, o.key, o.reason, actor, now());
  const open = safety(rxId).filter((a) => a.severity === "major" && !a.overridden);
  if (open.length) throw conflict("Resolve or document an override for every major alert before verifying.", { alerts: open.map((a) => a.key) });
  setStatus("prescription", rxId, "verified", actor, overrides.length ? `${overrides.length} alert override(s) documented` : undefined);
}

export function hold(rxId: string, note: string, actor: string) {
  const rx = getRx(rxId);
  if (!["received", "in_review", "verified"].includes(rx.status)) throw conflict(`${rx.rx_no} cannot be put on hold now.`);
  setStatus("prescription", rxId, "on_hold", actor, note);
}

export function cancelRx(rxId: string, reason: string, actor: string) {
  const rx = getRx(rxId);
  const open = db.prepare("SELECT COUNT(*) n FROM dispensings WHERE prescription_id = ? AND status IN ('prepared','checked')").get(rxId) as { n: number };
  if (open.n) throw conflict("Cancel the open dispensing first.");
  if (["dispensed", "cancelled"].includes(rx.status)) throw conflict(`${rx.rx_no} is already ${rx.status}.`);
  setStatus("prescription", rxId, "cancelled", actor, reason);
}

export function requestAuthorization(rxId: string, actor: string, justification?: string) {
  const rx = getRx(rxId);
  const primary = rcm.activeCoverages(rx.patient_id).find((c) => c.priority === 1);
  if (!primary) throw conflict("Patient has no active primary coverage.");
  const items = db.prepare(
    "SELECT pi.id, pi.qty_prescribed FROM prescription_items pi JOIN products p ON p.id = pi.product_id WHERE pi.prescription_id = ? AND p.requires_auth = 1",
  ).all(rxId) as { id: string; qty_prescribed: number }[];
  if (!items.length) throw conflict("No medicine on this prescription needs authorization.");
  const pending = db.prepare("SELECT auth_no FROM authorizations WHERE prescription_id = ? AND status = 'requested'").get(rxId) as { auth_no: string } | undefined;
  if (pending) throw conflict(`${pending.auth_no} is still waiting for the payer.`);
  const id = uid("au");
  const auth_no = nextNo("auth", "PA");
  db.prepare("INSERT INTO authorizations (id, auth_no, prescription_id, payer_id, status, requested_at, justification) VALUES (?,?,?,?, 'requested', ?, ?)").run(id, auth_no, rxId, primary.payer_id, now(), justification ?? null);
  const ins = db.prepare("INSERT INTO authorization_items (id, authorization_id, prescription_item_id, qty_requested) VALUES (?,?,?,?)");
  for (const it of items) ins.run(uid("aui"), id, it.id, it.qty_prescribed);
  logHistory("authorization", id, auth_no, null, "requested", actor, justification);
  return id;
}

/** Mock payer decision for a prior authorization. */
export function decideAuthorization(authId: string, actor: string, rng: rcm.Rng = Math.random, forced?: "approved" | "partially_approved" | "denied") {
  const a = db.prepare("SELECT * FROM authorizations WHERE id = ?").get(authId) as { id: string; status: string; auth_no: string } | undefined;
  if (!a) throw notFound("Authorization");
  if (a.status !== "requested") throw conflict(`${a.auth_no} is already ${a.status}.`);
  const r = rng();
  const decision = forced ?? (r < 0.72 ? "approved" : r < 0.88 ? "partially_approved" : "denied");
  const items = db.prepare("SELECT * FROM authorization_items WHERE authorization_id = ?").all(authId) as { id: string; qty_requested: number }[];
  for (const it of items) {
    const q = decision === "approved" ? it.qty_requested : decision === "partially_approved" ? Math.max(1, Math.floor(it.qty_requested / 2)) : 0;
    db.prepare("UPDATE authorization_items SET qty_approved = ? WHERE id = ?").run(q, it.id);
  }
  db.prepare("UPDATE authorizations SET decided_at = ?, valid_to = ?, note = ? WHERE id = ?").run(
    now(), decision === "denied" ? null : addDays(nowDate(), 90).toISOString().slice(0, 10),
    decision === "denied" ? "Clinical criteria not met" : decision === "partially_approved" ? "Approved for reduced quantity" : null, authId);
  setStatus("authorization", authId, decision, "payer");
  return decision;
}

function remainingFor(itemId: string) {
  const it = db.prepare("SELECT qty_prescribed, qty_dispensed FROM prescription_items WHERE id = ?").get(itemId) as { qty_prescribed: number; qty_dispensed: number };
  const pending = db.prepare(
    "SELECT COALESCE(SUM(di.qty),0) q FROM dispensing_items di JOIN dispensings d ON d.id = di.dispensing_id WHERE di.prescription_item_id = ? AND d.status IN ('prepared','checked')",
  ).get(itemId) as { q: number };
  return it.qty_prescribed - it.qty_dispensed - pending.q;
}

function recalcRx(rxId: string, actor: string) {
  const items = db.prepare("SELECT qty_prescribed, qty_dispensed FROM prescription_items WHERE prescription_id = ?").all(rxId) as { qty_prescribed: number; qty_dispensed: number }[];
  const all = items.every((i) => i.qty_dispensed >= i.qty_prescribed);
  const any = items.some((i) => i.qty_dispensed > 0);
  setStatus("prescription", rxId, all ? "dispensed" : any ? "partially_dispensed" : "verified", actor);
}

/** Prepare a (possibly partial) supply: reserve FEFO stock, open a bill, draft claims; adjudicate now for real-time payers. */
export function createDispensing(rxId: string, input: { items: { prescription_item_id: string; qty: number }[]; collection?: "pickup" | "delivery" }, actor: string, rng?: rcm.Rng) {
  const rx = getRx(rxId);
  if (!["verified", "partially_dispensed"].includes(rx.status)) throw conflict(`Verify ${rx.rx_no} before dispensing.`);
  const lines = input.items.filter((i) => i.qty > 0);
  if (!lines.length) throw badRequest("Choose a quantity for at least one medicine.");
  const id = uid("dsp");
  const disp_no = nextNo("disp", "DSP");
  db.prepare("INSERT INTO dispensings (id, disp_no, prescription_id, patient_id, status, collection, prepared_by, created_at) VALUES (?,?,?,?, 'prepared', ?, ?, ?)")
    .run(id, disp_no, rxId, rx.patient_id, input.collection ?? "pickup", actor, now());
  const ref = { type: "dispensing", id };
  const billLines: { product_id: string; qty: number }[] = [];
  for (const l of lines) {
    const pi = db.prepare("SELECT product_id FROM prescription_items WHERE id = ? AND prescription_id = ?").get(l.prescription_item_id, rxId) as { product_id: string } | undefined;
    if (!pi) throw badRequest("Item does not belong to this prescription.");
    const remaining = remainingFor(l.prescription_item_id);
    if (l.qty > remaining) throw conflict(`Only ${remaining} left to dispense on this line.`);
    for (const a of stock.allocateFefo(pi.product_id, l.qty)) {
      stock.reserve(a, actor, ref);
      db.prepare("INSERT INTO dispensing_items (id, dispensing_id, prescription_item_id, product_id, batch_id, qty) VALUES (?,?,?,?,?,?)")
        .run(uid("dsi"), id, l.prescription_item_id, pi.product_id, a.batch_id, a.qty);
    }
    billLines.push({ product_id: pi.product_id, qty: l.qty });
  }
  logHistory("dispensing", id, disp_no, null, "prepared", actor);

  const billId = rcm.createBill("rx", rx.patient_id, id, rcm.priceLines(rx.patient_id, billLines), actor);
  const claimIds = rcm.createClaimsForBill(billId, rxId, rx.patient_id, actor);
  // Real-time payers adjudicate before handover so the co-pay is known at the counter
  for (const cid of claimIds) {
    const c = db.prepare("SELECT c.priority, p.workflow FROM claims c JOIN payers p ON p.id = c.payer_id WHERE c.id = ?").get(cid) as { priority: number; workflow: string };
    if (c.workflow !== "pre_adjudication") continue;
    try {
      rcm.submitClaim(cid, actor, "Real-time submission at dispensing");
      rcm.adjudicate([cid], actor, rng);
    } catch { /* secondary waits for primary; stays draft */ }
  }
  return id;
}

export function checkDispensing(dispId: string, actor: string) {
  const d = db.prepare("SELECT * FROM dispensings WHERE id = ?").get(dispId) as { status: string; disp_no: string; prepared_by: string } | undefined;
  if (!d) throw notFound("Dispensing");
  if (d.status !== "prepared") throw conflict(`${d.disp_no} is ${d.status}; only prepared supplies can be checked.`);
  db.prepare("UPDATE dispensings SET checked_by = ? WHERE id = ?").run(actor, dispId);
  setStatus("dispensing", dispId, "checked", actor, d.prepared_by === actor ? "Self-checked (single-pharmacist mode)" : undefined);
}

export function handover(dispId: string, input: { payment_method: string; override_rejected?: boolean }, actor: string) {
  const d = db.prepare("SELECT * FROM dispensings WHERE id = ?").get(dispId) as { id: string; status: string; disp_no: string; prescription_id: string } | undefined;
  if (!d) throw notFound("Dispensing");
  if (d.status !== "checked") throw conflict(`${d.disp_no} must be checked by a pharmacist before handover.`);
  const bill = db.prepare("SELECT * FROM bills WHERE dispensing_id = ?").get(dispId) as { id: string; patient_share: number; patient_paid: number };
  const rejected = db.prepare(
    "SELECT c.claim_no FROM claims c JOIN payers p ON p.id = c.payer_id WHERE c.bill_id = ? AND c.status = 'rejected' AND p.workflow = 'pre_adjudication'",
  ).get(bill.id) as { claim_no: string } | undefined;
  if (rejected && !input.override_rejected) throw conflict(`${rejected.claim_no} was rejected in real time. Resubmit it, or confirm handover with the claim outstanding.`, { claim_rejected: true });

  const items = db.prepare("SELECT * FROM dispensing_items WHERE dispensing_id = ?").all(dispId) as { batch_id: string; qty: number; prescription_item_id: string }[];
  for (const it of items) {
    stock.issue({ batch_id: it.batch_id, qty: it.qty }, actor, { type: "dispensing", id: dispId }, true);
    db.prepare("UPDATE prescription_items SET qty_dispensed = qty_dispensed + ? WHERE id = ?").run(it.qty, it.prescription_item_id);
  }
  db.prepare("UPDATE dispensings SET handed_over_at = ? WHERE id = ?").run(now(), dispId);
  setStatus("dispensing", dispId, "handed_over", actor);
  const due = round2(bill.patient_share - bill.patient_paid);
  if (due > 0) rcm.recordPatientPayment(bill.id, due, input.payment_method, actor);
  setStatus("bill", bill.id, "finalized", actor);
  recalcRx(d.prescription_id, actor);
}

export function cancelDispensing(dispId: string, reason: string, actor: string) {
  const d = db.prepare("SELECT * FROM dispensings WHERE id = ?").get(dispId) as { id: string; status: string; disp_no: string; prescription_id: string } | undefined;
  if (!d) throw notFound("Dispensing");
  if (!["prepared", "checked"].includes(d.status)) throw conflict(`${d.disp_no} was already ${d.status.replace("_", " ")}. Use a return instead.`);
  const bill = db.prepare("SELECT id FROM bills WHERE dispensing_id = ?").get(dispId) as { id: string };
  rcm.reverseClaimsForBill(bill.id, actor, `Dispensing cancelled: ${reason}`);
  for (const it of db.prepare("SELECT batch_id, qty FROM dispensing_items WHERE dispensing_id = ?").all(dispId) as stock.Allocation[]) {
    stock.release(it, actor, { type: "dispensing", id: dispId }, reason);
  }
  setStatus("bill", bill.id, "reversed", actor, reason);
  setStatus("dispensing", dispId, "cancelled", actor, reason);
}

export function returnDispensing(dispId: string, reason: string, actor: string) {
  const d = db.prepare("SELECT * FROM dispensings WHERE id = ?").get(dispId) as { id: string; status: string; disp_no: string; prescription_id: string } | undefined;
  if (!d) throw notFound("Dispensing");
  if (d.status !== "handed_over") throw conflict("Only handed-over supplies can be returned.");
  const bill = db.prepare("SELECT id, patient_paid FROM bills WHERE dispensing_id = ?").get(dispId) as { id: string; patient_paid: number };
  rcm.reverseClaimsForBill(bill.id, actor, `Medicine returned: ${reason}`);
  for (const it of db.prepare("SELECT batch_id, qty, prescription_item_id FROM dispensing_items WHERE dispensing_id = ?").all(dispId) as (stock.Allocation & { prescription_item_id: string })[]) {
    stock.returnToQuarantine(it, actor, { type: "dispensing", id: dispId }, reason);
    db.prepare("UPDATE prescription_items SET qty_dispensed = qty_dispensed - ? WHERE id = ?").run(it.qty, it.prescription_item_id);
  }
  if (bill.patient_paid > 0) rcm.recordPatientPayment(bill.id, -bill.patient_paid, "refund", actor);
  setStatus("bill", bill.id, "reversed", actor, reason);
  setStatus("dispensing", dispId, "returned", actor, reason);
  recalcRx(d.prescription_id, actor);
}

/** Record the decision the payer actually sent (portal, phone or letter), line by line. */
export function recordAuthorizationDecision(authId: string, input: {
  decision: "approved" | "partially_approved" | "denied"; items: { id: string; qty_approved: number }[]; payer_ref?: string; valid_to?: string; note?: string;
}, actor: string) {
  const a = db.prepare("SELECT * FROM authorizations WHERE id = ?").get(authId) as { id: string; status: string; auth_no: string } | undefined;
  if (!a) throw notFound("Authorization");
  if (a.status !== "requested") throw conflict(`${a.auth_no} already has a decision (${a.status.replace("_", " ")}).`);
  const rows = db.prepare("SELECT id, qty_requested FROM authorization_items WHERE authorization_id = ?").all(authId) as { id: string; qty_requested: number }[];
  for (const r of rows) {
    const given = input.items.find((i) => i.id === r.id)?.qty_approved;
    const q = input.decision === "denied" ? 0 : input.decision === "approved" ? (given ?? r.qty_requested) : (given ?? 0);
    if (q < 0 || q > r.qty_requested) throw badRequest("Approved quantity must be between 0 and the quantity requested.");
    db.prepare("UPDATE authorization_items SET qty_approved = ? WHERE id = ?").run(q, r.id);
  }
  if (input.decision !== "denied" && !input.valid_to) throw badRequest("Enter how long the approval is valid.");
  if (input.decision === "denied" && !input.note?.trim()) throw badRequest("Record the payer's reason for the denial.");
  db.prepare("UPDATE authorizations SET decided_at = ?, valid_to = ?, note = ?, payer_ref = ?, decided_by = ? WHERE id = ?").run(
    now(), input.decision === "denied" ? null : input.valid_to, input.note ?? null, input.payer_ref ?? null, actor, authId);
  setStatus("authorization", authId, input.decision, actor, [input.payer_ref && `Payer ref ${input.payer_ref}`, input.note].filter(Boolean).join(". ") || undefined);
}
