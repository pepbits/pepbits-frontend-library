import { db } from "../db/index.js";

export interface ChainNode {
  key: "prescription" | "authorization" | "dispensing" | "bill" | "claim" | "remittance" | "payment";
  label: string; ref: string | null; status: string; detail: string; count: number;
}

/** The linked-but-independent record chain for one prescription. */
export function chainFor(rxId: string): ChainNode[] {
  const rx = db.prepare("SELECT rx_no, status FROM prescriptions WHERE id = ?").get(rxId) as { rx_no: string; status: string };
  const items = db.prepare("SELECT SUM(qty_prescribed) p, SUM(qty_dispensed) d FROM prescription_items WHERE prescription_id = ?").get(rxId) as { p: number; d: number };
  const auths = db.prepare("SELECT auth_no, status FROM authorizations WHERE prescription_id = ? ORDER BY requested_at DESC").all(rxId) as { auth_no: string; status: string }[];
  const needsAuth = (db.prepare("SELECT COUNT(*) n FROM prescription_items pi JOIN products p ON p.id = pi.product_id WHERE pi.prescription_id = ? AND p.requires_auth = 1").get(rxId) as { n: number }).n > 0;
  const disps = db.prepare("SELECT id, disp_no, status FROM dispensings WHERE prescription_id = ? ORDER BY created_at DESC").all(rxId) as { id: string; disp_no: string; status: string }[];
  const bills = db.prepare("SELECT b.bill_no, b.status, b.net, b.patient_share, b.payer_share, b.patient_paid FROM bills b JOIN dispensings d ON d.id = b.dispensing_id WHERE d.prescription_id = ? ORDER BY b.created_at DESC").all(rxId) as { bill_no: string; status: string; net: number; patient_share: number; payer_share: number; patient_paid: number }[];
  const claims = db.prepare("SELECT id, claim_no, status, claimed, approved, paid FROM claims WHERE prescription_id = ? ORDER BY created_at DESC").all(rxId) as { id: string; claim_no: string; status: string; claimed: number; approved: number; paid: number }[];
  const ras = db.prepare(
    `SELECT r.ra_no, r.status, rl.outcome FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id JOIN claims c ON c.id = rl.claim_id
     WHERE c.prescription_id = ? ORDER BY r.received_at DESC`,
  ).all(rxId) as { ra_no: string; status: string; outcome: string }[];

  const liveBills = bills.filter((b) => b.status !== "reversed");
  const liveClaims = claims.filter((c) => c.status !== "reversed");
  const approved = liveClaims.reduce((s, c) => s + c.approved, 0);
  const paid = liveClaims.reduce((s, c) => s + c.paid, 0);
  const patientPaid = liveBills.reduce((s, b) => s + b.patient_paid, 0);
  const fmt = (n: number) => n.toFixed(2);

  const claimStatus = !claims.length ? "none"
    : liveClaims.some((c) => c.status === "rejected") ? "rejected"
    : liveClaims.some((c) => ["draft"].includes(c.status)) ? "draft"
    : liveClaims.some((c) => c.status === "submitted") ? "submitted"
    : liveClaims.every((c) => c.status === "paid") && liveClaims.length ? "paid"
    : liveClaims[0]?.status ?? claims[0].status;

  const payStatus = !liveClaims.length && !patientPaid ? "none"
    : approved > 0 && paid >= approved - 0.01 ? "received"
    : paid > 0 ? "partial" : patientPaid > 0 ? "patient_only" : "awaiting";

  return [
    { key: "prescription", label: "Prescription", ref: rx.rx_no, status: rx.status, count: 1, detail: `${items.d ?? 0} of ${items.p ?? 0} units supplied` },
    { key: "authorization", label: "Authorization", ref: auths[0]?.auth_no ?? null, status: auths[0]?.status ?? (needsAuth ? "needed" : "not_required"), count: auths.length,
      detail: auths.length ? `${auths.length} request${auths.length > 1 ? "s" : ""}` : needsAuth ? "Payer approval needed" : "Not required" },
    { key: "dispensing", label: "Dispensing", ref: disps[0]?.disp_no ?? null, status: disps[0]?.status ?? "none", count: disps.length,
      detail: disps.length ? `${disps.filter((d) => d.status === "handed_over").length} handed over of ${disps.length}` : "Nothing supplied yet" },
    { key: "bill", label: "Bill", ref: liveBills[0]?.bill_no ?? bills[0]?.bill_no ?? null, status: liveBills[0]?.status ?? bills[0]?.status ?? "none", count: bills.length,
      detail: liveBills.length ? `Patient ${fmt(liveBills.reduce((s, b) => s + b.patient_share, 0))}, payer ${fmt(liveBills.reduce((s, b) => s + b.payer_share, 0))}` : "No charges" },
    { key: "claim", label: "Claim", ref: liveClaims[0]?.claim_no ?? claims[0]?.claim_no ?? null, status: claimStatus, count: claims.length,
      detail: claims.length ? `${fmt(liveClaims.reduce((s, c) => s + c.claimed, 0))} claimed` : "No payer share" },
    { key: "remittance", label: "Remittance", ref: ras[0]?.ra_no ?? null, status: ras[0]?.outcome ?? "none", count: ras.length,
      detail: ras.length ? `${fmt(approved)} approved` : "Awaiting payer" },
    { key: "payment", label: "Payment", ref: null, status: payStatus, count: 0,
      detail: `Payer ${fmt(paid)}, patient ${fmt(patientPaid)}` },
  ];
}
