import type {NoteContent} from "./models/consult-note";
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

  encounterId?: string;
  category?: string;
  source?: string;
  valueCode?: string;
  valueDisplay?: string;
  enteredAt?: string;
  authorId?: string;
  authorName?: string;
  status?: "corrected" | "entered-in-error";
  version?: number;
  history?: RecordChange[];
}

export interface Allergy {
  id: string; substance: string; category: string; clinicalStatus: string; verification: string; criticality?: string; reaction?: string;

  substanceClass?: string;
  allergenCode?: string;
  type?: string;
  source?: string;
  recordedAt?: string;
  version?: number;
  history?: RecordChange[];
  updatedAt?: string;
  group?: string;
  reactions?: string[];
  reactionOther?: string | null;
  severity?: string | null;
  onset?: string | null;
  informant?: string | null;
  route?: string | null;
  note?: string | null;
  resolution?: string | null
}

export interface AllergyBlock {
  assessment: {state: "has-entries" | "nka" | "unknown" | "not-assessed"; at?: string; by?: string};
  entries: Allergy[];
}

export interface Encounter {
  id: string; patientId: string; class: EncounterClass; status: string; department: string; clinicianId?: string; clinicianName?: string;
  arrivedAt: string; reason?: string; acuity?: number; mode?: "in-person" | "video" | "phone"; reassessDueAt?: string; version: number; waitingMinutes: number;

  intake?: { screening?: Record<string, string> };
  bedId?: string;
  disposition?: string | null;
  clinicalDischargeAt?: string | null;
  clinicalDischargeKind?: "discharged" | "left-care" | "admit-decision" | null;
  clinicalDischargeChanges?: { from: string; to: string; reason: string; byName: string; at: string }[];
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
export type CatalogName = "complaints" | "diagnoses" | "labs" | "imaging" | "drugs" | "allergens" | "vaccines" | "procedures";

export interface ScoreResult {
  status: "complete" | "incomplete"; total: number | null; band?: string; severity?: "low" | "moderate" | "high" | "critical";
  display?: string; methodVersion?: string;
  interpretation: string; components: {key: string; label: string; points: number | null}[]; missing: string[];
}

/** LOINC codes the observation store is keyed by. */
export const LOINC = {bp: "85354-9", hr: "8867-4", rr: "9279-1", temp: "8310-5", spo2: "59408-5", weight: "29463-7", height: "8302-2", pain: "72514-3"} as const;

/** The signed-in clinician, as far as the forms need it. UI gating only: the server enforces access. */
export interface ClinicalActor { role: string; permissions: string[]; id?: string; name?: string; licence?: string; requiresCosign?: boolean; facility?: string; features?: string[] }

import type {ProgrammeSnapshot} from "./models/consult-workflow";
import type {MedicationOrder} from "./models/consult-orders";

export interface ConsultationDetail {
    encounter: Encounter;
    patient: ConsultationPatient;
    allergies: AllergyBlock;
    problems: Condition[];
    medications: MedStatement[];
    socialHistory?: SocialHistory;
    reproductiveStatus?: ReproductiveStatus;
    screeningReviews?: ScreeningReview[];
    observations: {
        latest: Record<string, Observation>;
        history: Observation[];
        enteredInError?: Observation[];
    };
    note: {
        id: string;
        version: number;
        status: string;
        content: Partial<NoteContent>;
        updatedAt: string;
        addenda?: {
            id: string;
            reason: string;
            text: string;
            authorName: string;
            signedAt: string;
        }[];
        assessments?: SignedAssessment[];
        careGaps?: ProgrammeSnapshot[];
    } | null;
    orders: ConsultationOrder[];
    reviews: ReviewTask[];
    scores: {
        id: string;
        methodId: string;
        total: number | null;
        band?: string;
        calculatedAt: string;
    }[];
}

/** Consultation orders retain medication details and procedure completion metadata. */
export interface ConsultationOrder extends MedicationOrder {
    priorAuth?: string;
}

export interface ConsultationPatient extends ClinicalPatientLite {
    age: number;
    sex: string;
    givenName: string;
    middleName?: string;
    familyName: string;
    birthDate: string;
    nationality: string;
    mobile?: string;
    email?: string;
    preferredLanguage: string;
    identifiers: PatientIdentifier[];
    address?: {
        emirate: string;
        area: string;
        line: string;
    };
    emergencyContact?: {
        name: string;
        relationship: string;
        phone: string;
    };
    coverage?: {
        payer: string;
        plan: string;
        memberId: string;
        expiry: string;
        eligibility: string;
    };
    version: number;
}

export interface PatientIdentifier {
    id: string;
    type: string;
    label: string;
    value?: string;
    masked: string;
    country: string;
    expiry?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    addedAt: string;
    retiredAt?: string;
}

export interface Condition {
    id: string;
    display: string;
    icd10?: string;
    snomed?: string;
    clinicalStatus: string;
    verification: string;
    onset?: string;
}

export interface MedStatement {
    id: string;
    display: string;
    dose?: string;
    status: string;
    source: string;
    drugCode?: string;
    version?: number;
    history?: RecordChange[];
    reviewedAt?: string;
    lastDecision?: string;
    stoppedAt?: string;
    /** Set when another facility prescribed it, as reported to us. */
    externalFacility?: string;
    facility?: string;
    orderId?: string;
    replacedBy?: string;
}

/** One change to a record: who made it, when, why, and the values before and after. */
export interface RecordChange {
    at: string;
    actorId: string;
    actorName?: string;
    action?: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    reason?: string;
}

/** The patient's social and family history; version 0 when nothing has been recorded yet. */
export interface SocialHistory {
    version: number;
    smoking?: string;
    alcohol?: string;
    occupation?: string;
    living?: string;
    family?: string;
    updatedAt?: string;
    encounterId?: string;
    history?: RecordChange[];
}

/** Pregnancy and breastfeeding status; version 0 when nothing has been recorded. */
export interface ReproductiveStatus {
    version: number;
    pregnancy?: "pregnant" | "possibly" | "not-pregnant" | "unknown";
    breastfeeding?: "yes" | "no" | "unknown";
    lmp?: string;
    edd?: string;
    note?: string;
    verification?: "unconfirmed" | "confirmed";
    source?: "intake-screening" | "nurse" | "clinician";
    recordedAt?: string;
    recordedByName?: string;
    history?: RecordChange[];
}

export interface ScreeningReview {
    id: string;
    action: "reviewed" | "reassessed";
    answers: Record<string, string>;
    note?: string;
    at: string;
    byName?: string;
    byRole?: string;
}

/** A governed assessment as it stood when the consultation note was signed. */
export interface SignedAssessment {
    id: string;
    number: string;
    toolId: string;
    status: string;
    label: string;
    revision: number;
    result: string;
    band?: string | null;
    severity?: string | null;
    signedByName?: string | null;
    signedAt?: string | null;
}

export interface ReviewTask {
    id: string;
    kind: string;
    title: string;
    detail: string;
    recordType: string;
    recordId: string;
    recordVersion: number;
    patientId: string;
    encounterId?: string;
    stage?: "verify" | "dispense" | "first-dose" | "result";
    orderSource?: string;
    requiredAction: "adherence-check" | "acknowledge" | "cosign" | "verify" | "dispense" | "first-dose" | "result";
    assigneeRole: string;
    priority: "routine" | "urgent" | "critical";
    status: string;
    authorId: string;
    authorName?: string;
    createdAt: string;
    dueAt: string;
    abnormal: boolean;
    overdue?: boolean;
    patient?: ClinicalPatientLite;
    followup?: boolean;
    acknowledgedAt?: string;
    acknowledgedByName?: string;
}

export interface ScoreDef {
    id: string;
    name: string;
    short: string;
    version: string;
    category: string;
    purpose: string;
    citation: string;
    licence: string;
    inputs: ScoreInput[];
}

export interface ScoreInput {
    key: string;
    label: string;
    kind: "number" | "choice" | "flag";
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: {
        value: string;
        label: string;
        points: number | null;
    }[];
    points?: number;
    help?: string;
    autofill?: string;
}

export type ConsultationEncounter = Encounter;

export interface ProcedureHistory {
  id: string; procedure: string; performed?: string; note?: string; verification: "unconfirmed" | "confirmed" | "refuted" | "entered-in-error";
  source: string; recordedAt: string; version: number; history?: RecordChange[];
}
