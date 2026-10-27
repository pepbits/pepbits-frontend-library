import type {EncounterClass} from "../types";

/** Sections an intake-style form can show. A profile lists the ones that apply, in order. */
export type IntakeSectionId = "arrival" | "vitals" | "allergies" | "screening";

/**
 * How one encounter type runs its intake: which sections show, what must be complete before saving,
 * and which queue statuses it covers. Hosts can pass their own profile to the same form.
 */
export interface IntakeProfile {
  id: string;
  encounterClass: EncounterClass;
  title: string;
  sections: IntakeSectionId[];
  requireComplaint: boolean;
  /** Statuses still waiting for this intake; opening the form moves `startStatus` on to `inProgressStatus`. */
  waitingStatuses: string[];
  startStatus?: string;
  inProgressStatus?: string;
  saveLabel: string;
  saveNote: string;
  savedMessage: (patientName: string) => string;
}

export const OUTPATIENT_INTAKE: IntakeProfile = {
  id: "op-intake",
  encounterClass: "OP",
  title: "Outpatient intake",
  sections: ["arrival", "vitals", "allergies", "screening"],
  requireComplaint: false,
  waitingStatuses: ["registered", "intake"],
  startStatus: "registered",
  inProgressStatus: "intake",
  saveLabel: "Save and send to doctor",
  saveNote: "Saving signs this intake as you and creates a doctor review task.",
  savedMessage: name => `Intake saved. ${name} is ready for the doctor.`,
};

/** Profiles shipped with the package. Emergency triage (ESI) and inpatient observations are not available yet. */
export const INTAKE_PROFILES: Partial<Record<EncounterClass, IntakeProfile>> = {OP: OUTPATIENT_INTAKE};

/** The intake profile for an encounter type, or undefined when that type has no intake (inpatients record observations instead). */
export const intakeProfileFor = (encounterClass: EncounterClass) => INTAKE_PROFILES[encounterClass];
