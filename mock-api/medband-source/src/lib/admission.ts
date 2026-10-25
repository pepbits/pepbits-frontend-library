import type { AdmissionRequest, Encounter, StartType } from "./types";

/** A request is cleared for admission once its money side is settled. */
export function computeRequestStatus(r: Pick<AdmissionRequest, "billingMode" | "authStatus" | "depositCollected">): AdmissionRequest["status"] {
  if (r.billingMode === "Insurance") return r.authStatus === "Approved" ? "Ready" : "Pending";
  if (r.billingMode === "Self pay") return r.depositCollected ? "Ready" : "Pending";
  return "Ready";
}

export function pendingReason(r: AdmissionRequest) {
  if (r.billingMode === "Insurance") return r.authStatus === "Rejected" ? "the insurer rejected pre-authorization" : "pre-authorization is pending";
  if (r.billingMode === "Self pay" && !r.depositCollected) return "the admission deposit has not been collected";
  return "it is not cleared";
}

/** Cleared requests can be admitted. Emergencies can be admitted first and cleared afterwards. */
export const canAdmit = (r: AdmissionRequest) => r.status === "Ready" || (r.status === "Pending" && r.urgency === "Emergency");

/** How the inpatient stay starts, from where the request came from. */
export function admissionStartType(source?: Encounter): StartType {
  if (!source) return "ELECTIVE";
  if (source.type === "EMERGENCY") return "ADMIT_FROM_ER";
  if (source.type === "OP" || source.type === "FOLLOW_UP" || source.type === "TELE") return "ADMIT_FROM_OP";
  return "ELECTIVE";
}

export const REQUEST_TONE: Record<AdmissionRequest["status"], string> = {
  Pending: "bg-amber-50 text-amber-800",
  Ready: "bg-emerald-50 text-emerald-700",
  Admitted: "bg-violet-50 text-violet-800",
  Cancelled: "bg-canvas text-ink-faint",
};

export const URGENCY_TONE: Record<AdmissionRequest["urgency"], string> = {
  Elective: "bg-sky-50 text-sky-800",
  Urgent: "bg-amber-50 text-amber-800",
  Emergency: "bg-rose-50 text-rose-700",
};

export const SPECIAL_NEEDS = [
  "Oxygen", "Walker or wheelchair", "Fall risk", "Diabetic diet", "Interpreter", "Bariatric bed", "Cardiac monitor", "Pressure care",
];
