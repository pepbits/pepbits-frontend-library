import { db } from "../db/index.js";
import { now, nowDate } from "../lib/clock.js";
import { conflict, notFound, round2 } from "../lib/http.js";
import { nextNo, uid } from "../lib/ids.js";
import { logHistory, setStatus } from "./history.js";

export type Rng = () => number;

interface Coverage { id: string; payer_id: string; priority: 1 | 2; coverage_pct: number; valid_from: string; valid_to: string }
interface ProductRow { id: string; price_per_unit: number; tax_rate: number; schedule: string; requires_auth: number; name: string }

export function activeCoverages(patientId: string, at = nowDate()) {
  const d = at.toISOString().slice(0, 10);
  return db.prepare(
    "SELECT * FROM coverages WHERE patient_id = ? AND valid_from <= ? AND valid_to >= ? ORDER BY priority",
  ).all(patientId, d, d) as Coverage[];
}

export function contractPrice(payerId: string, productId: string, at = now()) {
  const r = db.prepare(
    "SELECT unit_price FROM payer_contract_prices WHERE payer_id = ? AND product_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1",
  ).get(payerId, productId, at.slice(0, 10)) as { unit_price: number } | undefined;
  return r?.unit_price;
}

/** Price each line and split responsibility: primary payer → secondary payer (COB) → patient. */
export function priceLines(patientId: string | null, lines: { product_id: string; qty: number }[]) {
  const covs = patientId ? activeCoverages(patientId) : [];
  const primary = covs.find((c) => c.priority === 1);
  const secondary = covs.find((c) => c.priority === 2);
  return lines.map((l) => {
    const p = db.prepare("SELECT * FROM products WHERE id = ?").get(l.product_id) as ProductRow;
    if (!p) throw notFound("Product");
    const gross = round2(p.price_per_unit * l.qty);
    const tax = round2(gross * p.tax_rate);
    const total = gross + tax;
    const covered = p.schedule !== "otc";
    const primary_share = covered && primary ? round2(total * primary.coverage_pct / 100) : 0;
    const secondary_share = covered && secondary ? round2((total - primary_share) * secondary.coverage_pct / 100) : 0;
    const patient_share = round2(total - primary_share - secondary_share);
    return { ...l, unit_price: p.price_per_unit, gross, tax, primary_share, secondary_share, patient_share };
  });
}
export type PricedLine = ReturnType<typeof priceLines>[number];

export function createBill(kind: "rx" | "otc", patientId: string | null, dispensingId: string | null, lines: PricedLine[], actor: string) {
  const id = uid("bil");
  const bill_no = nextNo("bill", "INV");
  const sum = (k: keyof PricedLine) => round2(lines.reduce((s, l) => s + (l[k] as number), 0));
  const gross = sum("gross"), tax = sum("tax");
  const payer_share = round2(sum("primary_share") + sum("secondary_share"));
  db.prepare(
    `INSERT INTO bills (id, bill_no, kind, dispensing_id, patient_id, status, gross, discount, tax, net, patient_share, payer_share, patient_paid, created_at)
     VALUES (?,?,?,?,?, 'open', ?, 0, ?, ?, ?, ?, 0, ?)`,
  ).run(id, bill_no, kind, dispensingId, patientId, gross, tax, round2(gross + tax), sum("patient_share"), payer_share, now());
  const ins = db.prepare(
    `INSERT INTO bill_lines (id, bill_id, product_id, qty, unit_price, gross, tax, patient_share, primary_share, secondary_share)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const l of lines) ins.run(uid("bl"), id, l.product_id, l.qty, l.unit_price, l.gross, l.tax, l.patient_share, l.primary_share, l.secondary_share);
  logHistory("bill", id, bill_no, null, "open", actor);
  return id;
}

/** One claim per payer with a share on the bill. */
export function createClaimsForBill(billId: string, prescriptionId: string | null, patientId: string, actor: string) {
  const covs = activeCoverages(patientId);
  const lines = db.prepare("SELECT * FROM bill_lines WHERE bill_id = ?").all(billId) as {
    id: string; product_id: string; qty: number; gross: number; tax: number; primary_share: number; secondary_share: number;
  }[];
  const ids: string[] = [];
  for (const cov of covs) {
    const shareKey = cov.priority === 1 ? "primary_share" : "secondary_share";
    const claimLines = lines.filter((l) => l[shareKey] > 0).map((l) => {
      const claimed = l[shareKey];
      const contract = contractPrice(cov.payer_id, l.product_id);
      const lineTotal = l.gross + l.tax;
      const expected = contract === undefined ? claimed : round2(Math.min(claimed, contract * l.qty * (claimed / lineTotal)));
      return { ...l, claimed, expected };
    });
    if (!claimLines.length) continue;
    const id = uid("clm");
    const claim_no = nextNo("claim", "CLM");
    const claimed = round2(claimLines.reduce((s, l) => s + l.claimed, 0));
    const expected = round2(claimLines.reduce((s, l) => s + l.expected, 0));
    db.prepare(
      `INSERT INTO claims (id, claim_no, bill_id, prescription_id, payer_id, coverage_id, priority, status, claimed, expected, created_at)
       VALUES (?,?,?,?,?,?,?, 'draft', ?, ?, ?)`,
    ).run(id, claim_no, billId, prescriptionId, cov.payer_id, cov.id, cov.priority, claimed, expected, now());
    const ins = db.prepare("INSERT INTO claim_lines (id, claim_id, bill_line_id, product_id, qty, claimed, expected) VALUES (?,?,?,?,?,?,?)");
    for (const l of claimLines) ins.run(uid("cl"), id, l.id, l.product_id, l.qty, l.claimed, l.expected);
    logHistory("claim", id, claim_no, null, "draft", actor);
    ids.push(id);
  }
  return ids;
}

const ADJUDICATED = ["approved", "partially_approved", "rejected", "paid", "partially_paid"];

export function submitClaim(claimId: string, actor: string, note?: string) {
  const c = db.prepare("SELECT * FROM claims WHERE id = ?").get(claimId) as { id: string; status: string; priority: number; bill_id: string; claim_no: string } | undefined;
  if (!c) throw notFound("Claim");
  if (!["draft", "rejected"].includes(c.status)) throw conflict(`${c.claim_no} is ${c.status}; only draft or rejected claims can be submitted.`);
  if (c.priority === 2) {
    const primary = db.prepare("SELECT status FROM claims WHERE bill_id = ? AND priority = 1 AND status != 'reversed'").get(c.bill_id) as { status: string } | undefined;
    if (primary && !ADJUDICATED.includes(primary.status)) throw conflict("Submit the secondary claim after the primary payer has adjudicated.");
  }
  db.prepare("UPDATE claims SET submissions = submissions + 1, submitted_at = ?, denial_code = NULL, denial_reason = NULL WHERE id = ?").run(now(), c.id);
  setStatus("claim", c.id, "submitted", actor, note ?? (c.status === "rejected" ? "Resubmitted after correction" : undefined));
}

const RANDOM_DENIALS = [
  ["MN-11", "Member ID does not match payer records"],
  ["DX-04", "Diagnosis code not covered under plan"],
  ["QT-07", "Quantity exceeds plan limit"],
] as const;

/** Mock payer: adjudicates submitted claims and issues one remittance advice per payer. */
export function adjudicate(claimIds: string[], actor: string, rng: Rng = Math.random) {
  const claims = claimIds.map((id) => db.prepare("SELECT * FROM claims WHERE id = ?").get(id)) as {
    id: string; claim_no: string; payer_id: string; status: string; prescription_id: string | null; coverage_id: string; claimed: number; submissions: number; bill_id: string;
  }[];
  const pending = claims.filter((c) => c && c.status === "submitted");
  if (!pending.length) throw conflict("No submitted claims to adjudicate.");
  const byPayer = new Map<string, typeof pending>();
  for (const c of pending) byPayer.set(c.payer_id, [...(byPayer.get(c.payer_id) ?? []), c]);
  const raIds: string[] = [];

  for (const [payerId, list] of byPayer) {
    const raId = uid("ra");
    const ra_no = nextNo("ra", "RA");
    db.prepare("INSERT INTO remittances (id, ra_no, payer_id, status, received_at) VALUES (?,?,?, 'received', ?)").run(raId, ra_no, payerId, now());
    logHistory("remittance", raId, ra_no, null, "received", actor);
    let totC = 0, totA = 0;

    for (const c of list) {
      const cov = db.prepare("SELECT * FROM coverages WHERE id = ?").get(c.coverage_id) as Coverage;
      const bill = db.prepare("SELECT created_at FROM bills WHERE id = ?").get(c.bill_id) as { created_at: string };
      const svc = bill.created_at.slice(0, 10);
      const lines = db.prepare(
        "SELECT cl.*, p.requires_auth FROM claim_lines cl JOIN products p ON p.id = cl.product_id WHERE claim_id = ?",
      ).all(c.id) as { id: string; product_id: string; qty: number; claimed: number; expected: number; requires_auth: number }[];

      let claimDenial: readonly [string, string] | null = null;
      if (svc < cov.valid_from || svc > cov.valid_to) claimDenial = ["COV-02", "Coverage inactive on date of service"];
      else if (c.submissions === 1 && rng() < 0.12) claimDenial = RANDOM_DENIALS[Math.floor(rng() * RANDOM_DENIALS.length)];

      let approvedTotal = 0;
      let firstLineDenial: [string, string] | null = null;
      for (const l of lines) {
        let approved = 0;
        let code: string | null = claimDenial?.[0] ?? null;
        if (!claimDenial) {
          approved = l.expected;
          if (l.requires_auth) {
            const auth = db.prepare(
              `SELECT SUM(ai.qty_approved) q FROM authorizations a
               JOIN authorization_items ai ON ai.authorization_id = a.id
               JOIN prescription_items pi ON pi.id = ai.prescription_item_id
               WHERE a.prescription_id = ? AND a.payer_id = ? AND a.status IN ('approved','partially_approved') AND pi.product_id = ?`,
            ).get(c.prescription_id, payerId, l.product_id) as { q: number | null };
            const q = auth?.q ?? 0;
            if (q <= 0) { approved = 0; code = "PA-01"; firstLineDenial ??= ["PA-01", "Prior authorization missing"]; }
            else if (q < l.qty) { approved = round2(l.expected * q / l.qty); code = "PA-03"; firstLineDenial ??= ["PA-03", "Quantity above authorized amount"]; }
          }
        }
        approved = round2(approved);
        approvedTotal += approved;
        db.prepare("UPDATE claim_lines SET approved = ?, denial_code = ? WHERE id = ?").run(approved, code, l.id);
      }
      approvedTotal = round2(approvedTotal);
      const denial = claimDenial ?? firstLineDenial;
      const outcome = approvedTotal <= 0 ? "denied" : approvedTotal < c.claimed - 0.01 ? "partial" : "paid";
      const status = outcome === "denied" ? "rejected" : outcome === "partial" ? "partially_approved" : "approved";
      db.prepare("UPDATE claims SET approved = ?, adjudicated_at = ?, denial_code = ?, denial_reason = ? WHERE id = ?")
        .run(approvedTotal, now(), denial?.[0] ?? null, denial?.[1] ?? null, c.id);
      setStatus("claim", c.id, status, "payer", denial ? `${denial[0]}: ${denial[1]}` : `Approved ${approvedTotal.toFixed(2)} on ${ra_no}`);
      db.prepare(
        `INSERT INTO remittance_lines (id, remittance_id, claim_id, submission, claimed, approved, outcome, denial_code, denial_reason)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(uid("ral"), raId, c.id, c.submissions, c.claimed, approvedTotal, outcome, denial?.[0] ?? null, denial?.[1] ?? null);
      totC += c.claimed; totA += approvedTotal;
    }
    db.prepare("UPDATE remittances SET total_claimed = ?, total_approved = ? WHERE id = ?").run(round2(totC), round2(totA), raId);
    // A fully denied advice carries no money: close it so it never sits in the posting queue
    if (round2(totA) <= 0) setStatus("remittance", raId, "posted", actor, "Nothing to post: every line denied");
    raIds.push(raId);
  }
  return raIds;
}

/** Post the payer's money against an RA, allocating to each claim. Short payments stay visible. */
export function postRemittancePayment(raId: string, input: { amount?: number; method: string; reference?: string }, actor: string) {
  const ra = db.prepare("SELECT * FROM remittances WHERE id = ?").get(raId) as { id: string; ra_no: string; payer_id: string; status: string; total_approved: number } | undefined;
  if (!ra) throw notFound("Remittance");
  if (ra.status === "posted") throw conflict(`${ra.ra_no} is already posted.`);
  const amount = round2(input.amount ?? ra.total_approved);
  if (amount > ra.total_approved + 0.01) throw conflict("Payment exceeds the approved total on this RA.");
  const lines = db.prepare("SELECT * FROM remittance_lines WHERE remittance_id = ? AND approved > 0").all(raId) as { claim_id: string; approved: number }[];
  const payId = uid("pay");
  const ref = input.reference || nextNo("pay", "EFT");
  db.prepare(
    `INSERT INTO payments (id, payment_ref, source, payer_id, remittance_id, method, amount, allocated, status, received_at)
     VALUES (?,?, 'payer', ?, ?, ?, ?, 0, 'unallocated', ?)`,
  ).run(payId, ref, ra.payer_id, raId, input.method, amount, now());
  logHistory("payment", payId, ref, null, "unallocated", actor);

  const ratio = ra.total_approved > 0 ? amount / ra.total_approved : 0;
  let allocated = 0;
  lines.forEach((l, i) => {
    const share = i === lines.length - 1 ? round2(amount - allocated) : round2(l.approved * ratio);
    allocated = round2(allocated + share);
    db.prepare("INSERT INTO payment_allocations (id, payment_id, claim_id, amount, at) VALUES (?,?,?,?,?)").run(uid("alc"), payId, l.claim_id, share, now());
    const c = db.prepare("UPDATE claims SET paid = ROUND(paid + ?, 2) WHERE id = ? RETURNING paid, approved").get(share, l.claim_id) as { paid: number; approved: number };
    setStatus("claim", l.claim_id, c.paid >= c.approved - 0.01 ? "paid" : "partially_paid", actor, `${share.toFixed(2)} received via ${ref}`);
  });
  db.prepare("UPDATE payments SET allocated = ? WHERE id = ?").run(allocated, payId);
  setStatus("payment", payId, "allocated", actor, `Allocated to ${lines.length} claim(s)`);
  setStatus("remittance", raId, "posted", actor, amount < ra.total_approved ? `Short paid by ${(ra.total_approved - amount).toFixed(2)}` : undefined);
  return payId;
}

export function recordPatientPayment(billId: string, amount: number, method: string, actor: string) {
  const payId = uid("pay");
  const ref = nextNo("rcpt", "RCPT");
  db.prepare(
    `INSERT INTO payments (id, payment_ref, source, method, amount, allocated, status, received_at)
     VALUES (?,?, 'patient', ?, ?, ?, 'allocated', ?)`,
  ).run(payId, ref, method, amount, amount, now());
  db.prepare("INSERT INTO payment_allocations (id, payment_id, bill_id, amount, at) VALUES (?,?,?,?,?)").run(uid("alc"), payId, billId, amount, now());
  db.prepare("UPDATE bills SET patient_paid = ROUND(patient_paid + ?, 2) WHERE id = ?").run(amount, billId);
  logHistory("payment", payId, ref, null, "allocated", actor, amount < 0 ? "Refund to patient" : undefined);
  return payId;
}

/** Reverse every unpaid claim on a bill. Paid claims block reversal (needs payer recoupment). */
export function reverseClaimsForBill(billId: string, actor: string, reason: string) {
  const claims = db.prepare("SELECT id, claim_no, status, paid FROM claims WHERE bill_id = ? AND status != 'reversed'").all(billId) as { id: string; claim_no: string; status: string; paid: number }[];
  const paid = claims.find((c) => c.paid > 0);
  if (paid) throw conflict(`${paid.claim_no} has payer money posted. Raise a recoupment with the payer before reversing.`);
  for (const c of claims) setStatus("claim", c.id, "reversed", actor, reason);
}
