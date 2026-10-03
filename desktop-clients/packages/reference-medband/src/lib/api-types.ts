import type { MasterData } from "./master";
import type { AdmissionUrgency, AppState, BedCategory, BillingMode, ComplaintEntry, Coverage, EncounterType, EpisodeKind, Gender, Isolation, Priority, StartType, TeleChannel, TriageLevel } from "./types";

/** The trusted identity the backend resolved for this host session. The page never chooses who it acts as. */
export interface CurrentUser { id?: string; name?: string; displayName?: string; role?: string; roles?: string[]; [key: string]: unknown }

/** GET /bootstrap: the source's `{ master, data }` plus the host-managed identity. */
export interface Bootstrap {
  master: MasterData;
  data: AppState;
  currentUser?: CurrentUser;
  hostManagedIdentity?: boolean;
  demo?: boolean | { notice?: string; [key: string]: unknown };
}

export interface CoverageBody extends Omit<Coverage, "tpaId" | "holderName"> { tpaId?: string; holderName?: string }

/** Request bodies, as the source contract validates them server side (the client only needs the shapes). */
export interface PatientBody {
  firstName: string; middleName?: string; lastName: string; dob: string; gender: Gender; phone: string; altPhone?: string; email?: string;
  nationalId?: string; nationality?: string; bloodGroup?: string; preferredLanguage?: string; address?: string; city?: string;
  emergencyName?: string; emergencyPhone?: string; allergies?: string; vip?: boolean; unidentified?: boolean; coverages?: CoverageBody[];
}
export type EpisodeChoice = { mode: "existing"; episodeId: string } | { mode: "new"; title: string; kind: EpisodeKind };
export type CaseChoiceBody =
  | { mode: "existing"; caseId: string }
  | { mode: "new"; title?: string; provisionalDiagnosis?: string; medicoLegal?: boolean; mlcNumber?: string; policeStation?: string; episode: EpisodeChoice };
export interface EncounterRequest {
  counterId: string; patientId: string; type: EncounterType; startType: StartType; priority: Priority; start: string; departmentId: string;
  practitionerId?: string; complaints?: ComplaintEntry[]; case?: CaseChoiceBody; parentEncounterId?: string; admissionRequestId?: string;
  billingMode: BillingMode; coverageIds?: string[]; authNumber?: string; corporateName?: string; wardId?: string; bed?: string;
  admissionReason?: string; expectedStayDays?: number; teleChannel?: TeleChannel; teleLink?: string; visitAddress?: string; visitTeam?: string;
  referringFacility?: string; referringDoctor?: string; referralNote?: string; services?: string[]; triage?: TriageLevel; packageId?: string;
  broughtBy?: string; broughtByPhone?: string;
}
export interface AdmissionRequestBody {
  patientId: string; sourceEncounterId?: string; case?: CaseChoiceBody; complaints?: ComplaintEntry[]; requestedById: string;
  admittingDepartmentId: string; admittingPractitionerId: string; urgency: AdmissionUrgency; plannedDate: string; expectedStayDays: number;
  bedCategory: Exclude<BedCategory, "Day care" | "Observation">; isolation: Isolation; reason: string; plannedProcedure?: string; specialNeeds?: string[];
  billingMode: BillingMode; coverageId?: string; authNumber?: string; estimatedCost?: number; depositCollected?: boolean; notes?: string;
}
export type AdmissionAction =
  | { action: "authorize"; decision: "Approved" | "Rejected"; authNumber?: string }
  | { action: "deposit" }
  | { action: "reschedule"; plannedDate: string }
  | { action: "cancel"; reason: string };
