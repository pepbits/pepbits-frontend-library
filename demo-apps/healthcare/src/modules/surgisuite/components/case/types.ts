export type Milestone = { code: string; label: string; requires?: string; status?: string };

export type CaseBundle = {
  id: number; case_no: string; status: string; case_class: string; op_type: string; anesthesia_type: string | null; position: string | null;
  laterality: string; wound_class: string; asa_class: string; scheduled_start: string; est_duration_min: number; theatre_id: number;
  ebl_ml: number | null; delay_reason: string | null; cancel_reason: string | null; notes: string | null; rcri: Record<string, boolean>;
  patient: { id: number; name: string; mrn: string; dob: string; sex: string; blood_group: string | null; allergies: string; comorbidities: string; weight_kg: number | null; height_cm: number | null; insurer: string | null; policy_no: string | null };
  theatre: { id: number; code: string; name: string; kind: string } | null;
  diagnoses: { id: number; is_primary: number; diagnosis_id: number; icd10: string; description: string; category: string }[];
  procedures: {
    id: number; procedure_id: number; role: string; surgeon_id: number | null; surgeon_name: string | null; approach: string; laterality: string; modifiers: string;
    planned: number; performed: number; cpt: string; name: string; specialty: string; fee: number; is_addon: number; default_duration_min: number; linked_dx: number; mapped_dx: number;
  }[];
  team: { id: number; staff_id: number; role: string; time_in: string | null; time_out: string | null; name: string; emp_code: string; title: string; staff_role: string }[];
  equipment: { id: number; code: string; name: string; category: string; status: string }[];
  milestones: { code: string; ts: string; recorded_by: string }[];
  checklist: { id: number; phase: string; item: string; checked: number; checked_by_name: string | null; ts: string | null }[];
  counts: { id: number; item: string; initial: number; added: number; final: number | null; verified_by_name: string | null; witness_name: string | null; ts: string | null }[];
  vitals: { id: number; ts: string; hr: number | null; sbp: number | null; dbp: number | null; spo2: number | null; etco2: number | null; temp: number | null }[];
  meds: { id: number; ts: string; drug: string; dose: number; unit: string; route: string; given_by_name: string }[];
  events: { id: number; ts: string; kind: string; text: string; severity: string; staff_name: string | null }[];
  orders: { id: number; kind: string; test: string; priority: string; status: string; result: string | null; critical: number; radiation_mgy: number | null; fluoro_sec: number | null; quantity: number | null; ordered_by_name: string; ordered_at: string; resulted_at: string | null }[];
  items: { id: number; item_id: number; qty_planned: number; qty_used: number; qty_wasted: number; lot_no: string | null; serial_no: string | null; consumed: number; sku: string; name: string; category: string; uom: string; unit_cost: number; is_implant: number; stock_qty: number; sterile_status: string; expiry: string | null }[];
  approvals: { id: number; kind: string; status: string; required: number; requested_by_name: string; requested_at: string; approver_name: string | null; decided_at: string | null; reference_no: string | null; valid_until: string | null; remarks: string | null; witness_name: string | null; signature_hash: string | null }[];
  consents: { id: number; kind: string; signed_by_name: string; relationship: string; risks_explained: string; obtained_by_name: string; witness_name: string; ts: string; signature_hash: string }[];
  scores: { id: number; kind: string; value: number; band: string; details: string; recorded_by_name: string; ts: string }[];
  report: {
    id: number; indication: string; findings: string; technique: string; specimens: string; complications: string; drains: string; postop_plan: string;
    status: string; version: number; signed_by_name: string | null; signed_at: string | null; cosigned_by_name: string | null; cosigned_at: string | null;
    witness_name: string | null; witnessed_at: string | null; signature_hash: string | null; updated_at: string;
  };
  nextMilestones: (Milestone & { blockers: string[] })[];
  milestoneDefs: Milestone[];
  readiness: { approvals: { kind: string; status: string }[]; consents: string[]; signIn: boolean; timeOut: boolean; signOut: boolean; counts: boolean; sterileTraysPending: number; stockShort: string[] };
};

export type TabProps = { c: CaseBundle; reload: () => void };
