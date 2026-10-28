/**
 * Clinical record shapes shared by every encounter type. Field names follow the AllyVora clinical
 * workspace API (`lib/types.ts`), so a host can pass its responses through unchanged.
 */

/** OP outpatient, ER emergency, OBS observation, IP inpatient, DAY day care, HH home care, LTC long-term care. */
export type EncounterClass = "OP" | "ER" | "OBS" | "IP" | "DAY" | "HH" | "LTC";

export interface ClinicalPatientLite {
  id: string; mrn: string; name: string; nameAr?: string; age?: number; sex?: string; restricted: boolean;
  primaryId?: string; primaryIdLabel?: string; deceasedAt?: string | null;
  identityStatus?: "verified" | "unverified" | "unknown" | "merged" | null;
}

export interface ClinicalPatient extends ClinicalPatientLite {
  age: number; sex: string; birthDate: string;
  coverage?: {payer: string; plan: string; memberId: string; expiry: string; eligibility: string};
}

export interface Observation {
  id: string; code: string; display: string; value?: number; value2?: number; unit?: string; effectiveAt: string; absentReason?: string;
}

export interface Allergy {
  id: string; substance: string; category: string; clinicalStatus: string; verification: string; criticality?: string; reaction?: string;
}

export interface AllergyBlock {
  assessment: {state: "has-entries" | "nka" | "unknown" | "not-assessed"; at?: string; by?: string};
  entries: Allergy[];
}

export interface Encounter {
  id: string; patientId: string; class: EncounterClass; status: string; department: string; clinicianId?: string; clinicianName?: string;
  arrivedAt: string; reason?: string; acuity?: number; mode?: "in-person" | "video" | "phone"; reassessDueAt?: string; version: number; waitingMinutes: number;
}

/** One row of an encounter queue (`GET /encounters?class=…`). */
export interface QueueRow extends Encounter {
  visitType?: "walk-in" | "appointment" | "referral" | "emergency";
  referral?: {referrerName: string; organisation: string; priority: string} | null;
  clinicalVisible: boolean; patient: ClinicalPatientLite; allergyState: string | null; allergyCount: number;
  news2: number | null; openReviews: number; reassessOverdue?: boolean;
}

/** The parts of `GET /encounters/{id}` the clinical forms use. */
export interface EncounterDetail {
  encounter: Encounter; patient: ClinicalPatient; allergies: AllergyBlock;
  observations: {latest: Record<string, Observation>};
}

export interface CatalogItem { code: string; system: string; display: string; synonyms?: string[]; meta?: Record<string, unknown> }
export type CatalogName = "complaints" | "diagnoses" | "labs" | "imaging" | "drugs" | "allergens" | "vaccines";

export interface ScoreResult {
  status: "complete" | "incomplete"; total: number | null; band?: string; severity?: "low" | "moderate" | "high" | "critical";
  interpretation: string; components: {key: string; label: string; points: number | null}[]; missing: string[];
}

/** LOINC codes the observation store is keyed by. */
export const LOINC = {bp: "85354-9", hr: "8867-4", rr: "9279-1", temp: "8310-5", spo2: "59408-5", weight: "29463-7", height: "8302-2", pain: "72514-3"} as const;

/** The signed-in clinician, as far as the forms need it. UI gating only: the server enforces access. */
export interface ClinicalActor { role: string; permissions: string[] }
