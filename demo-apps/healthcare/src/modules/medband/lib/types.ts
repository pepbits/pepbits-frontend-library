// ─── Core domain model for patient access: Patient → Episode → Encounter ───

export type Gender = "Male" | "Female" | "Other" | "Unknown";
export type CoveragePriority = "Primary" | "Secondary" | "Tertiary";
export type Relationship = "Self" | "Spouse" | "Child" | "Parent" | "Other";

/** One insurance coverage. A patient can hold several (multi-payer). */
export interface Coverage {
  id: string;
  priority: CoveragePriority;
  payerId: string;
  tpaId?: string;
  networkId: string;
  planId: string;
  policyNumber: string;
  memberId: string;
  validFrom: string; // yyyy-mm-dd
  validTo: string; // yyyy-mm-dd
  relationship: Relationship;
  holderName?: string;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob: string; // yyyy-mm-dd
  gender: Gender;
  phone: string;
  altPhone?: string;
  email?: string;
  nationalId?: string;
  nationality?: string;
  bloodGroup?: string;
  preferredLanguage?: string;
  address?: string;
  city?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  allergies?: string;
  vip?: boolean;
  /** Registered at the emergency counter before identity was known. */
  unidentified?: boolean;
  coverages: Coverage[];
  createdAt: string;
}

export type EpisodeStatus = "Active" | "On hold" | "Closed";
export type EpisodeKind =
  | "Acute illness"
  | "Chronic care"
  | "Maternity"
  | "Surgical"
  | "Rehabilitation"
  | "Preventive"
  | "Oncology";

/** An episode of care groups every encounter for one health problem. */
export interface Episode {
  id: string;
  code: string;
  patientId: string;
  title: string;
  kind: EpisodeKind;
  status: EpisodeStatus;
  departmentId: string;
  practitionerId?: string;
  startDate: string; // ISO
  endDate?: string;
  notes?: string;
}

export type CaseStatus = "Open" | "Closed";
export type DurationUnit = "hours" | "days" | "weeks" | "months";

/** One coded presenting complaint, picked from the complaint master. */
export interface ComplaintEntry {
  code: string;
  label: string;
  duration?: number;
  unit?: DurationUnit;
}

/**
 * A case is one clinical problem being worked up or treated, opened from the chief
 * complaint at its first visit. It sits inside an episode of care and gathers the
 * index visit, its follow-ups and any admission it leads to.
 * Patient → Episode → Case → Encounter.
 */
export interface Case {
  id: string;
  code: string;
  patientId: string;
  episodeId: string;
  title: string;
  complaints: ComplaintEntry[];
  departmentId: string;
  status: CaseStatus;
  openedAt: string; // ISO
  closedAt?: string;
  provisionalDiagnosis?: string;
  medicoLegal: boolean;
  mlcNumber?: string;
  policeStation?: string;
}

export type EncounterType =
  | "OP"
  | "FOLLOW_UP"
  | "IP"
  | "EMERGENCY"
  | "DAY_CARE"
  | "TELE"
  | "HOME_VISIT"
  | "OUTSIDE"
  | "NO_CONSULT"
  | "HEALTH_CHECK";

export type StartType =
  | "WALK_IN"
  | "APPOINTMENT"
  | "INTERNAL_REFERRAL"
  | "EXTERNAL_REFERRAL"
  | "SELF_ARRIVAL"
  | "AMBULANCE"
  | "POLICE_CASE"
  | "TRANSFER_IN"
  | "ADMIT_FROM_OP"
  | "ADMIT_FROM_ER"
  | "ELECTIVE"
  | "SCHEDULED_CALL"
  | "ON_DEMAND_CALL"
  | "SCHEDULED_VISIT"
  | "ORDER_ONLY"
  | "SAMPLE_COLLECTION";

export type EncounterStatus = "Planned" | "Arrived" | "In progress" | "Completed" | "Cancelled";
export type Priority = "Routine" | "Urgent" | "Emergency";
export type BillingMode = "Self pay" | "Insurance" | "Corporate";
export type TeleChannel = "Video" | "Audio" | "Chat";
export type TriageLevel = "Level 1" | "Level 2" | "Level 3" | "Level 4" | "Level 5";

export interface Encounter {
  id: string;
  code: string;
  patientId: string;
  episodeId: string;
  type: EncounterType;
  startType: StartType;
  status: EncounterStatus;
  priority: Priority;
  start: string; // ISO
  end?: string; // ISO (discharge / completion)
  departmentId: string;
  practitionerId?: string;
  /** Display text, kept in step with the coded complaints. */
  chiefComplaint?: string;
  complaints?: ComplaintEntry[];
  caseId: string;
  /** Registration counter that created the encounter. */
  counterId?: string;
  /** Inpatient encounters are always created from an admission request. */
  admissionRequestId?: string;
  broughtBy?: string;
  broughtByPhone?: string;

  // Follow-up linkage (derived or manual)
  parentEncounterId?: string;
  followUpDerived?: boolean;
  followUpChargeable?: boolean;

  // Billing
  billingMode: BillingMode;
  coverageIds: string[];
  authNumber?: string;
  corporateName?: string;

  // Type-specific details
  wardId?: string;
  bed?: string;
  admissionReason?: string;
  expectedStayDays?: number;
  teleChannel?: TeleChannel;
  teleLink?: string;
  visitAddress?: string;
  visitTeam?: string;
  referringFacility?: string;
  referringDoctor?: string;
  referralNote?: string;
  services?: string[];
  triage?: TriageLevel;
  packageId?: string;

  createdAt: string;
}

export type AdmissionUrgency = "Elective" | "Urgent" | "Emergency";
export type AdmissionRequestStatus = "Pending" | "Ready" | "Admitted" | "Cancelled";
export type AuthStatus = "Not required" | "Pending" | "Approved" | "Rejected";
export type BedCategory = "General" | "Semi-private" | "Private" | "ICU" | "Maternity" | "Day care" | "Observation";
export type Isolation = "None" | "Contact" | "Droplet" | "Airborne";

/**
 * A clinician's request to admit, raised from a clinic or ER visit or booked as elective.
 * The admissions desk turns a cleared request into an inpatient encounter.
 */
export interface AdmissionRequest {
  id: string;
  code: string;
  patientId: string;
  caseId: string;
  episodeId: string;
  sourceEncounterId?: string;
  requestedById: string;
  admittingDepartmentId: string;
  admittingPractitionerId: string;
  urgency: AdmissionUrgency;
  plannedDate: string; // ISO
  expectedStayDays: number;
  bedCategory: BedCategory;
  isolation: Isolation;
  reason: string;
  plannedProcedure?: string;
  specialNeeds: string[];
  billingMode: BillingMode;
  coverageId?: string;
  authStatus: AuthStatus;
  authNumber?: string;
  estimatedCost?: number;
  depositCollected?: boolean;
  notes?: string;
  status: AdmissionRequestStatus;
  admittedEncounterId?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Everything the front end works with, loaded from the API. */
export interface AppState {
  patients: Patient[];
  episodes: Episode[];
  cases: Case[];
  encounters: Encounter[];
  admissionRequests: AdmissionRequest[];
}

/** Records changed by a write. The API returns them so the client can merge. */
export type Changes = Partial<AppState>;

export type NewPatient = Omit<Patient, "id" | "mrn" | "createdAt">;
