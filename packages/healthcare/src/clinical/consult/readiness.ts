import {admissionComplete, emergencyComplete, referralComplete, type SectionId, type SectionState} from "../models/consult-note";
import {stillDue, type AssessmentRow, type ConsultSectionProps, type Programme} from "../models/consult-workflow";

/** Workspace orchestration only; the server repeats validation against current records at signing. */
export function consultReadiness({detail, draft: n}: ConsultSectionProps, extra: {
  visitVitals: boolean; assessments: AssessmentRow[]; care: Programme[];
  orderPending: boolean; orderProblems: string[]; ordersOpen: number; prescriptionsOpen: number;
  medicationProblems: string[]; medicationReady: boolean;
}) {
  const tasks = detail.reviews.filter(r => r.assigneeRole === "doctor" && !["acknowledged", "completed", "cancelled", "closed"].includes(r.status));
  const has = (value: object) => Object.values(value).some(v => v !== "" && v != null && !(Array.isArray(v) && !v.length));
  const ros = Object.values(n.ros).reduce((sum, value) => sum + Object.keys(value).length, 0);
  const exam = Object.values(n.exam).filter(value => value.state).length;
  const meds = detail.medications.filter(m => m.status !== "stopped");
  const pain = detail.observations.history.some(o => o.encounterId === detail.encounter.id && o.status !== "entered-in-error" && (o.category === "pain" || o.code === "72514-3"));
  const problems: string[] = [];
  if (tasks.some(r => r.abnormal)) problems.push("Acknowledge each abnormal finding before signing.");
  if (!extra.visitVitals && !n.vitalsNotTaken.trim()) problems.push("Record vitals or document why they were not taken.");
  if (detail.allergies.assessment.state === "not-assessed") problems.push("Review allergies before signing.");
  if (!n.diagnoses.some(d => d.primary)) problems.push("Add a primary diagnosis before signing.");
  if (!n.disposition) problems.push("Choose a disposition before signing.");
  const at = Date.parse(n.dischargeAt ?? "");
  const arrived = Date.parse(detail.encounter.arrivedAt);
  if (!Number.isFinite(at)) problems.push("Record the clinical discharge time before signing.");
  else if (at > Date.now() + 300000 || at < arrived - 60000) problems.push("Clinical discharge time must be during this visit and cannot be in the future.");
  if (n.disposition === "follow-up" && !n.followUp && !n.followUpNone) problems.push("Record follow-up or choose follow-up as needed.");
  if (n.disposition === "admit" && !admissionComplete(n.admission, 0)) problems.push("Complete the admission request before signing.");
  if (n.disposition === "refer-er" && !emergencyComplete(n.emergency)) problems.push("Complete the emergency destination and transport before signing.");
  if (n.disposition === "refer-external" && (!n.referral || !referralComplete(n.referral, true))) problems.push("Complete the external referral before signing.");
  const planBlocked = problems.some(p => /disposition|discharge|follow-up|admission|emergency destination|external referral/.test(p));
  const siteMissing = (n.procedures ?? []).some(p => p.siteKind === "tooth" ? !p.site?.teeth?.length : p.siteKind === "side" && !p.site?.side);
  if (siteMissing) problems.push("Choose the required procedure site before signing.");
  if (extra.orderPending) problems.push("Wait for order information evaluation before signing.");
  problems.push(...extra.orderProblems);
  if (extra.ordersOpen || extra.prescriptionsOpen) problems.push("Complete the required order information before signing.");
  problems.push(...extra.medicationProblems);
  if (n.prescriptions.length && !extra.medicationReady) problems.push("Resolve medication safety checks before signing.");
  const stopped = n.prescriptions.some(r => detail.medications.some(m => m.drugCode === r.code && n.history.meds[m.id] === "stop" && r.replaces !== m.id));
  if (stopped) problems.push("Link prescriptions replacing a stopped medicine before signing.");
  const states: Record<SectionId, SectionState> = {
    review: tasks.some(r => r.abnormal) || (!extra.visitVitals && !n.vitalsNotTaken.trim()) ? "blocked" : tasks.length ? "partial" : "done",
    allergies: detail.allergies.assessment.state === "not-assessed" ? "blocked" : detail.allergies.entries.some(a => a.verification === "unconfirmed") ? "partial" : "done",
    complaint: n.complaints.length ? "done" : "empty",
    hpi: n.hpi.narrative.trim().length > 20 ? "done" : has(n.hpi) ? "partial" : "empty",
    pain: pain ? "done" : "empty", ros: ros >= 8 ? "done" : ros ? "partial" : "empty",
    problems: n.history.problemsReviewed ? "done" : "empty",
    history: n.history.smoking && n.history.alcohol ? "done" : n.history.smoking || n.history.alcohol || n.history.family.trim() || n.history.occupation.trim() ? "partial" : "empty",
    exam: exam >= 3 ? "done" : exam ? "partial" : "empty",
    scores: n.scores.length || extra.assessments.some(a => ["final", "amended"].includes(a.status)) || detail.note?.assessments?.length ? "done" : extra.assessments.length ? "partial" : "empty",
    assessment: n.diagnoses.some(d => d.primary) ? "done" : "blocked",
    care: detail.note?.status === "final" && detail.note.careGaps?.length ? "done" : !extra.care.length ? "empty" : stillDue(extra.care, n).length ? "partial" : "done",
    orders: extra.orderPending || extra.orderProblems.length || extra.ordersOpen || siteMissing ? "blocked" : n.labs.length || n.imaging.length || n.procedures?.length ? "done" : "empty",
    rx: extra.prescriptionsOpen || extra.medicationProblems.length || (n.prescriptions.length && !extra.medicationReady) || stopped ? "blocked" : meds.every(m => n.history.meds[m.id]) && (meds.length || n.prescriptions.length) ? "done" : meds.some(m => n.history.meds[m.id]) || n.prescriptions.length ? "partial" : "empty",
    referral: n.referral && !n.referral.question.trim() ? "partial" : n.referral || n.education.length ? "done" : "empty",
    plan: planBlocked ? "blocked" : "done",
  };
  return {states, problems: [...new Set(problems)]};
}
