import type { ChainNode } from "./RxChain";

export interface QueueRow {
  id: string; rx_no: string; status: string; priority: "routine" | "urgent" | "stat"; source: string; received_at: string; diagnosis: string | null; stage: string;
  patient_id: string; patient_name: string; mrn: string; dob: string; doctor_name: string; item_count: number; item_names: string; cold: number; controlled: number;
  auth_status: string | null; payer_code: string | null; collection: string | null; updated_at: string;
}
export interface Alert {
  key: string; type: string; severity: "major" | "moderate" | "info"; title: string; detail: string; item_ids: string[];
  overridden?: { reason: string; actor: string; at: string };
}
export interface RxItem {
  id: string; product_id: string; name: string; generic: string; strength: string; form: string; dispense_unit: string; schedule: string; cold_chain: number; requires_auth: number;
  qty_prescribed: number; qty_dispensed: number; qty_pending: number; qty_remaining: number; qty_authorized: number | null; available: number; sig: string; location: string;
  price_per_unit: number; batches: { id: string; batch_no: string; expiry: string; available: number }[];
}
export interface Coverage { id: string; payer_name: string; payer_code: string; workflow: string; priority: number; coverage_pct: number; member_id: string; plan_name: string; valid_to: string }
export interface Bill { id: string; bill_no: string; status: string; net: number; patient_share: number; payer_share: number; patient_paid: number }
export interface Dispensing {
  id: string; disp_no: string; status: string; collection: string; prepared_by: string; checked_by: string | null; created_at: string; handed_over_at: string | null;
  items: { id: string; name: string; qty: number; batch_no: string; expiry: string }[]; bill: Bill | null;
}
export interface Claim {
  id: string; claim_no: string; payer_name: string; payer_code: string; workflow: string; priority: number; status: string; claimed: number; expected: number; approved: number; paid: number;
  denial_code: string | null; denial_reason: string | null; submissions: number; bill_id: string;
}
export interface Authorization { id: string; auth_no: string; status: string; payer_name: string; requested_at: string; decided_at: string | null; valid_to: string | null; note: string | null; items: { name: string; qty_requested: number; qty_approved: number }[] }
export interface HistoryRow { id: number; entity: string; ref: string; from_status: string | null; to_status: string; note: string | null; actor: string; at: string }
export interface RxDetail extends QueueRow {
  doctor_id: string; diagnosis_code: string | null; notes: string | null; written_at: string;
  patient: { id: string; name: string; mrn: string; dob: string; gender: string; phone: string; weight_kg: number; allergies: string[]; conditions: string[] };
  doctor: { name: string; specialty: string; facility: string; license_no: string };
  coverages: Coverage[]; items: RxItem[]; authorizations: Authorization[]; dispensings: Dispensing[]; claims: Claim[]; history: HistoryRow[]; alerts: Alert[]; chain: ChainNode[];
}
