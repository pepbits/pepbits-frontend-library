import type {CatalogItem} from "../types";
import type {IntakeProfile} from "../context/profiles";
import {vitalsErrors, vitalsPayload, type NotMeasured, type Vitals, type VitalsPayload} from "../vitals/model";
import {screeningPayload, type ScreeningAnswer, type ScreeningAnswers} from "../screening/model";

export type AllergyReviewOutcome = "reviewed-no-change" | "nka" | "updated" | "unknown";
export interface ArrivalValue { mode: string | null; source: string | null; interpreter: string | null }
export interface ComplaintValue { item: CatalogItem | null; words: string }

/** Everything an intake form holds before saving. */
export interface IntakeState {
  arrival: ArrivalValue; complaint: ComplaintValue; vitals: Vitals; notMeasured: NotMeasured;
  screening: ScreeningAnswers; allergyReview: AllergyReviewOutcome | null;
}

/** `POST /encounters/{id}/intake`, as the AllyVora workspace sends it. */
export interface IntakePayload {
  mode: "op" | "er";
  complaint?: {code: string; display: string; patientWords?: string};
  arrival?: {mode: string; historySource: string; interpreter: boolean};
  vitals: VitalsPayload;
  screening: Record<string, ScreeningAnswer>;
  allergyReview?: AllergyReviewOutcome;
}

/** Problems to fix before saving, in the order the form shows them. */
export function intakeProblems(state: IntakeState, profile: IntakeProfile): string[] {
  const problems: string[] = [];
  if (profile.requireComplaint && !state.complaint.item) problems.push("Choose the presenting complaint.");
  if (profile.sections.includes("vitals")) problems.push(...vitalsErrors(state.vitals, state.notMeasured));
  if (profile.sections.includes("allergies") && !state.allergyReview) problems.push("Review the allergy list with the patient.");
  return problems;
}

export function intakePayload(state: IntakeState, profile: IntakeProfile): IntakePayload {
  const {arrival, complaint} = state;
  return {
    mode: profile.encounterClass === "ER" ? "er" : "op",
    complaint: complaint.item ? {code: complaint.item.code, display: complaint.item.display, patientWords: complaint.words || undefined} : undefined,
    arrival: arrival.mode ? {mode: arrival.mode, historySource: arrival.source ?? "patient", interpreter: arrival.interpreter === "yes"} : undefined,
    vitals: vitalsPayload(state.vitals, state.notMeasured),
    screening: screeningPayload(state.screening),
    allergyReview: state.allergyReview ?? undefined,
  };
}
