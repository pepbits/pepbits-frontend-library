export type BillStatus = 'A' | 'F' | 'C' | 'X';
export type Gate = { allowed: boolean; reasons: string[] };

export interface User {
  id: number; username: string; name: string; role: 'admin' | 'billing' | 'cashier' | 'finance';
  rights: string[]; counter_id: number | null; counter_name?: string | null; initials: string; isAdmin?: boolean;
}
export interface Counter { id: number; name: string; counter_type: string; center_id: number | null; is_system: number; card_terminal: string | null; active: number }
export interface PaymentMode {
  id: number; name: string; code: string; requires_bank: number; requires_reference: number; requires_card: number;
  realization_required: number; active: number; sort: number;
}
export interface RatePlan { id: number; name: string; discount_pct: number; active: number }
export interface DiscountCategory { id: number; name: string; percent: number; charge_groups: string[]; active: number }
export interface Plan { id: number; sponsor_id: number; name: string; copay_pct: number; claim_cap: number | null; sponsor_name: string }

export interface Meta {
  me: User; users: Pick<User, 'id' | 'username' | 'name' | 'role' | 'initials'>[]; counters: Counter[]; paymentModes: PaymentMode[];
  ratePlans: RatePlan[]; discountCategories: DiscountCategory[]; plans: Plan[]; rights: Record<string, string>;
  prefs: Record<string, string | number | boolean>; authorizers: string[]; reopenReasons: string[]; chargeGroups: string[];
  badges: { approvals: number; unrealized: number; overpaid: number }; hospital: { name: string };
}

export interface Patient { mr_no: string; name: string; gender: string | null; dob: string | null; phone: string | null; city: string | null; created_at: string }
export interface Visit {
  visit_id: string; mr_no: string; visit_type: 'i' | 'o'; doctor: string | null; department: string | null; ward: string | null;
  admitted_at: string; discharged_at: string | null; primary_plan_id: number | null; secondary_plan_id: number | null;
  primary_plan?: string | null; primary_sponsor?: string | null; secondary_plan?: string | null; secondary_sponsor?: string | null; bill_count?: number;
}

export interface Bill {
  bill_no: string; visit_id: string; mr_no: string; bill_type: 'P' | 'C'; restriction_type: 'N' | 'P' | 'T'; is_primary: number; is_tpa: number;
  status: BillStatus; status_label?: string; payment_status: 'U' | 'P'; claim_status: 'O' | 'S' | 'R'; rate_plan_id: number | null;
  discount_category_id: number | null; total_amount: number; total_discount: number; total_vat: number; total_claim: number;
  primary_claim: number; secondary_claim: number; sponsor_vat: number; round_off: number; patient_amount: number;
  total_receipts: number; sponsor_receipts: number; deposit_set_off: number; points_redeemed: number; points_amount: number;
  patient_due: number; sponsor_due: number; patient_writeoff: 'N' | 'M' | 'A'; sponsor_writeoff: 'N' | 'M' | 'A';
  cancellation_status: 'N' | 'S' | 'A'; finalized_at: string | null; finalized_by: string | null; closed_at: string | null; closed_by: string | null;
  reopen_reason: string | null; cancel_reason: string | null; remarks: string | null; created_at: string; created_by: string; updated_at: string;
  advance_balance?: number;
  patient_name?: string; phone?: string; visit_type?: string; doctor?: string; department?: string; pending_approvals?: number; sponsor_name?: string | null;
}

export interface Charge {
  charge_id: number; bill_no: string; catalogue_id: number | null; code: string | null; description: string; charge_group: string; charge_head: string;
  orig_rate: number; rate: number; qty: number; amount: number; discount: number; discount_by: string | null;
  discount_status: 'none' | 'pending' | 'approved'; vat_rate: number; vat: number; insurance_payable: number; claim_override: number;
  primary_claim: number; secondary_claim: number; sponsor_vat: number; status: 'A' | 'X'; order_linked: number; pending_result: number;
  is_system: number; posted_at: string; posted_by: string | null; remarks: string | null;
}

export interface ClaimPlan {
  id: number; bill_no: string; plan_id: number; priority: 1 | 2; claim_status: string; plan_name: string; copay_pct: number;
  claim_cap: number | null; sponsor_name: string; sponsor_id: number;
}

export interface Receipt {
  receipt_no: string; bill_no: string; mr_no: string; payment_type: 'R' | 'F' | 'S'; recpt_type: 'U' | 'A' | 'S'; sponsor_index: 'P' | 'S' | null;
  amount: number; tds_amount: number; mode_id: number; mode_name: string; bank: string | null; reference: string | null; card_last4: string | null;
  card_auth: string | null; card_rrn: string | null; terminal_id: string | null; counter_id: number | null; counter_name: string | null;
  username: string; created_at: string; remarks: string | null; status: 'A' | 'X'; reversal_of: string | null; cancel_reason: string | null;
  source: string; label: string;
}

export interface SetOff { id: number; deposit_no: string; set_off_type: 'R' | 'F'; bill_no: string | null; refund_no: string | null; amount: number; created_at: string; username: string; deposit_date?: string; available_for?: string; bill_status?: string }

export interface Approval {
  id: number; kind: 'discount' | 'writeoff' | 'cancellation'; bill_no: string; amount: number; reason: string | null;
  payload: { changes?: { chargeId: number; description: string; from: number; to: number }[] };
  status: 'pending' | 'approved' | 'rejected'; requested_by: string; requested_at: string; decided_by: string | null; decided_at: string | null;
  decision_note: string | null; patient_name?: string; mr_no?: string; bill_type?: string; is_tpa?: number; bill_status?: BillStatus;
  patient_amount?: number; patient_due?: number; total_amount?: number; total_discount?: number; department?: string; doctor?: string; canDecide?: boolean;
}

export interface AuditEntry {
  id: number; entity: string; entity_id: string; bill_no: string | null; mr_no: string | null; action: string; summary: string;
  detail: Record<string, unknown>; username: string; at: string;
}

export interface BillPayload {
  bill: Bill; patient: Patient; visit: Visit; ratePlan: RatePlan | null; claims: ClaimPlan[]; charges: Charge[]; receipts: Receipt[];
  setoffs: SetOff[]; approvals: Approval[]; siblings: Pick<Bill, 'bill_no' | 'bill_type' | 'restriction_type' | 'is_primary' | 'status' | 'patient_amount' | 'patient_due'>[];
  history: AuditEntry[];
  deposits: { collected: number; pending: number; setOff: number; refunded: number; balance: number; hospital: number; pharmacy: number; usable: number };
  points: { balance: number; rate: number };
  actions: Record<'finalize' | 'close' | 'reopen' | 'cancel' | 'writeoff' | 'sendClaim' | 'editCharges' | 'takePayment', Gate>;
  result?: {
    receipts?: string[]; notes?: string[]; requested?: boolean;
    overpayment?: { refunds: { receipt_no: string; amount: number }[]; deposit: string | null; trimmed: number } | null;
  };
}

export interface CatalogueItem { id: number; code: string; name: string; charge_group: string; charge_head: string; rate: number; vat_rate: number; insurance_payable: number }

export interface Deposit {
  deposit_no: string; mr_no: string; deposit_type: 'R' | 'F'; amount: number; mode_id: number; mode_name: string; bank: string | null;
  reference: string | null; card_last4: string | null; realized: number; realized_at: string | null; available_for: 'H' | 'P' | 'B';
  payer_name: string | null; payer_phone: string | null; package_name: string | null; counter_id: number | null; username: string;
  created_at: string; remarks: string | null; status: 'A' | 'X'; origin: string; origin_ref: string | null; balance: number; set_off: number; refunded: number;
  patient_name?: string;
}

export interface LedgerRow {
  no: string; kind: 'bill' | 'pharmacy' | 'deposit'; payment_type: string; recpt_type: string; sponsor_index: string | null; amount: number;
  tds_amount: number; created_at: string; bill_no: string | null; mr_no: string; patient_name: string; mode_name: string; mode_id: number;
  reference: string | null; bank: string | null; card_last4: string | null; counter_name: string | null; counter_id: number | null;
  username: string; status: 'A' | 'X'; reversal_of: string | null; realized: number; source: string; available_for: string | null;
  payer_name: string | null; bill_status: BillStatus | null; label: string;
}
