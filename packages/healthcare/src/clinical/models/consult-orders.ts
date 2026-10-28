/** Pure consultation contracts extracted from the frozen AllyVora source; no transport or React. */
import type {CatalogItem, ConsultationPatient, Encounter, AllergyBlock, Observation, ClinicalPatientLite} from "../types";
import type {Clinic} from "./consult-reference";

export interface MedicationOrder extends PriorityOrder {
    urgent?: boolean;
    urgentReason?: string;
    emergencyReviewDueAt?: string;
    effective?: EffectiveMedicine;
    substitution?: Substitution;
    substitutionHistory?: Substitution[];
    id: string;
    kind: string;
    source?: string;
    code: string;
    display: string;
    status: string;
    authorId: string;
    authorName?: string;
    authoredAt: string;
    highAlert?: boolean;
    controlled?: boolean;
    version?: number;
    pharmacyStatus?: string;
    pharmacyReview?: PharmacyReview;
    pharmacyReviews?: PharmacyReview[];
    requiresCosign?: boolean;
    cosignStatus?: string;
    stoppedAt?: string;
    stoppedByName?: string;
    stopReason?: string;
    /** Also returned for procedure orders in a consultation. */
    completedAt?: string;
    performedByName?: string;
    outcome?: string;
    details: {
        timing?: string;
        consentRequired?: boolean;
        specialty?: string;
        allergyConflicts?: AllergyConflict[];
        safetyAlerts?: SafetyAlert[];
        administrationMode?: string;
        infusionVolumeMl?: number;
        infusionRateMlHour?: number;
        minimumRateMlHour?: number;
        maximumRateMlHour?: number;
        infusionPreparation?: string;
        infusionDosing?: InfusionDosing;
        dose?: string;
        route?: string;
        frequency?: string;
        startAt?: string;
        endAt?: string;
        indication?: string;
        instructions?: string;
        overrideReason?: string;
        duplicateReason?: string;
        minimumIntervalHours?: number;
        maximumDoses24h?: number;
        [key: string]: unknown;
    };
}

export interface PriorityOrder extends PriorityInput {
    priorityLabel?: string;
    priorityRank?: number;
    firstDoseBeforeVerification?: boolean;
    priorityPolicyVersion?: number;
    verifyDueAt?: string | null;
    dispenseDueAt?: string | null;
    firstDoseDueAt?: string | null;
    resultDueAt?: string | null;
}

export interface PriorityInput {
    priority?: string;
    priorityReason?: string;
    priorityAt?: string | null;
}

export interface EffectiveMedicine extends Medicine {
    substituted: boolean;
    original: Medicine;
    label: string;
}

export interface Medicine {
    code: string;
    display: string;
    dose?: string;
    doseValue?: number;
    doseUnit?: string;
    route?: string;
    frequency?: string;
    highAlert?: boolean;
    controlled?: boolean;
}

export interface Substitution {
    id: string;
    status: 'approved' | 'pending-prescriber' | 'rejected' | 'withdrawn' | 'reverted';
    type: 'generic' | 'therapeutic' | 'dosage-form';
    from: Medicine;
    to: Medicine;
    reasonCode: string;
    reasonLabel: string;
    note: string;
    interchangeId?: string | null;
    protocol?: Interchange | null;
    policyVersion: number;
    allergyConflicts: AllergyConflict[];
    alerts: SafetyAlert[];
    needsOverride: boolean;
    overrideReason?: string;
    approvalReasons: string[];
    approvedBy?: string | null;
    approvedByName?: string;
    approvedAt?: string;
    proposedBy: string;
    proposedByName: string;
    proposedAt: string;
    decidedByName?: string;
    decidedAt?: string;
    decisionNote?: string;
    endedByName?: string;
    endedAt?: string;
    endNote?: string;
    action?: string;
    at?: string;
    actorName?: string;
    actionNote?: string;
}

export interface Interchange {
    id: string;
    fromMatch: Match;
    from: string;
    to: string;
    dose: string;
    frequency: string | null;
    note: string;
    approvedBy: string;
    approvedOn: string;
    active: boolean;
}

export type Match = 'atc' | 'class' | 'ingredient' | 'code';

/** Drug–allergy check results come from the API, which owns the ingredient and class mapping. */
export interface AllergyConflict {
    allergyId: string;
    substance: string;
    reaction?: string;
    verification: string;
    criticality?: string;
    type?: string;
    match: "same-ingredient" | "same-class" | "cross-reactive";
    via: string;
    severity: "high" | "moderate";
    message: string;
}

/** Dose and interaction alerts from the API's medication check; "high" needs a reason to proceed. */
export interface SafetyAlert {
    kind: string;
    severity: "high" | "moderate" | "info";
    message: string;
    with?: string;
    ruleId?: string;
}

export interface PharmacyReview {
    id: string;
    action: 'verify' | 'return';
    mode?: 'individual' | 'batch';
    actorName: string;
    at: string;
    note: string;
    reviewedOrderVersion: number;
    policyVersion?: number;
    checks: Record<string, string>;
}

/** As signed on the order (details.infusionDosing). */
export interface InfusionDosing {
    doseUnit: DoseRateUnit;
    amount: number;
    amountUnit: string;
    volumeMl: number;
    dose: number;
    minimumDose: number;
    maximumDose: number;
    weightKg?: number;
    weightSource?: string;
    libraryCode?: string;
    libraryVersion?: string;
    softMin?: number;
    softMax?: number;
    hardMax?: number;
    limitOverrideReason?: string;
}

export type DoseRateUnit = (typeof DOSE_RATE_UNITS)[number];

export type Answers = Record<string, Answer>;

export type Answer = {
    value?: string | number | boolean;
    absent?: "unknown" | "not-asked" | "declined";
};

export interface OrderPriority {
    code: string;
    label: string;
    rank: number;
    verifyMinutes: number | null;
    dispenseMinutes: number | null;
    firstDoseMinutes: number | null;
    resultMinutes: number | null;
    firstDoseBeforeVerification: boolean;
    reasonRequired: boolean;
    active: boolean;
    default?: boolean;
    requiresTime?: boolean;
}

export interface MedicationCheckResult {
    lines: LineReview[];
    unmapped: UnmappedAllergy[];
    context: CheckContext;
}

export interface LineReview {
    code: string;
    allergy: AllergyConflict[];
    alerts: SafetyAlert[];
    needsReason: boolean;
}

export interface UnmappedAllergy {
    allergyId: string;
    substance: string;
}

export interface CheckContext {
    ageYears?: number | null;
    weightKg?: number | null;
    egfr?: number | null;
    pregnancy?: "pregnant" | "possibly" | null;
    breastfeeding?: boolean;
}

export interface SubstitutionOptions {
    options: SubstitutionOption[];
    policyVersion: number;
    reasons: Reason[];
    orderVersion: number;
}

export interface SubstitutionOption extends CatalogItem {
    type: Substitution['type'];
    needsPrescriberApproval: boolean;
    approvalReasons: string[];
    allergyConflicts: AllergyConflict[];
    alerts: SafetyAlert[];
    needsOverride: boolean;
    protocols: Interchange[];
    interchangeId?: string;
}

export interface Reason {
    code: string;
    label: string;
}

export interface MarDetail {
    eligible: boolean;
    administrationPolicy: MedicationPolicy['administration'];
    witnesses: {
        id: string;
        name: string;
    }[];
    reactions: AdverseReaction[];
    packScanRequired?: boolean;
    dispensingMode?: string;
    patient: ConsultationPatient;
    encounter: Encounter;
    admission: AdmissionLocation;
    allergies: AllergyBlock;
    observations: {
        latest: Record<string, Observation>;
    };
    orders: MarOrder[];
    slots: (PriorityOrder & {
        orderId: string;
        scheduledAt: string;
        status: string;
        recordId?: string;
        dueAt?: string;
    })[];
    records: MarRecord[];
    checks: MarCheck[];
    date: string;
    timezone: string;
    asOf: string;
}

export interface MedicationPolicy {
    version: number;
    priorities: OrderPriority[];
    substitution: {
        genericWithoutPrescriber: boolean;
        notifyPrescriberOnGeneric: boolean;
        approvalDueMinutes: number;
        reasons: Reason[];
        exclusions: Exclusion[];
        interchanges: Interchange[];
    };
    verification: {
        clinicOrders: 'all' | 'high-alert-only' | 'none';
        batchApproval: boolean;
        verificationTargetMinutes: number;
        emergencyFirstDose: boolean;
        emergencyReviewMinutes: number;
    };
    dispensing: {
        adherenceCheckDays: number;
        mode: 'bulk' | 'unit-dose';
        cartFillHours: number;
        scanRequired: boolean;
        highAlertSecondCheck: boolean;
        lasaGroups: {
            id: string;
            codes: string[];
            note: string;
        }[];
    };
    administration: {
        packScanRequired: boolean;
        sites: Reason[];
        observationMinutes: {
            match: 'route' | 'class';
            value: string;
            minutes: number;
            firstDoseOnly: boolean;
        }[];
    };
    returns: {
        reasons: Reason[];
        reconciliationGraceHours: number;
    };
}

export interface Exclusion {
    match: Match;
    value: string;
    label: string;
}

export interface AdverseReaction {
    aefi?: boolean;
    vaccineSeriousness?: string[];
    id: string;
    patientId: string;
    encounterId: string;
    administrationId: string;
    medicine: string;
    onsetAt: string;
    manifestations: {
        system: string;
        code: string;
        display: string;
    }[];
    severity: string;
    seriousness: string[];
    treatment: string;
    outcome: string;
    causality: string;
    reportable: boolean;
    reportedByName: string;
    version: number;
    allergyOffer: {
        status: string;
        substance: string;
        reaction: string;
        allergyId?: string;
    };
}

export interface AdmissionLocation {
    bed: {
        id: string;
        label: string;
        ward: string;
        room: string;
        isolationRoom: boolean;
    } | null;
    ward: string;
    department?: string;
    outlier?: {
        reason: string;
    } | null;
    attending?: string | null;
    clinicianId?: string;
    admittedAt?: string | null;
    arrivedAt?: string;
    stayHours?: number | null;
    isolation?: string;
    expectedDischarge?: string | null;
}

export interface MarOrder extends MedicationOrder {
    courseId?: string;
    courseSequence?: number;
    siteRequired?: boolean;
    verificationRequired?: boolean;
    firstDoseCompleted?: boolean;
    contextVersion: string;
    blockers: string[];
    requiresSecondCheck: boolean;
    emergencyFirstDoseAvailable?: boolean;
}

export interface MarRecord {
    vaccineCode?: {
        system: string;
        code: string;
        display: string;
    };
    product?: string;
    manufacturer?: string;
    lot?: string;
    expiry?: string;
    doseVolume?: number;
    doseNumber?: number;
    vaccinatorName?: string;
    consent?: string;
    visSheet?: string;
    historical?: boolean;
    givenOn?: string;
    dispenseId?: string;
    place?: string;
    country?: string;
    evidence?: string;
    invalidForSeries?: boolean;
    aefiCriteria?: {
        code: string;
        label: string;
    }[];
    site?: string;
    siteLabel?: string;
    deviceId?: string;
    administeredBy?: string;
    witness?: string;
    witnessName?: string;
    startedAt?: string;
    stoppedAt?: string;
    reactionIds?: string[];
    observation?: {
        status: string;
        minutes: number;
        dueAt: string;
        policyVersion: number;
        assessment?: MarEvent;
    };
    packId?: string;
    packCode?: string;
    beforeVerification?: boolean;
    id: string;
    code?: string;
    substitution?: Substitution | null;
    analgesic?: boolean;
    orderId: string;
    medicine: string;
    prescribedDose: string;
    dose?: string;
    route: string;
    mode: string;
    frequency: string;
    status: string;
    scheduledAt?: string;
    effectiveAt: string;
    recordedAt: string;
    actorName: string;
    version: number;
    note?: string;
    omissionReason?: string;
    indication?: string;
    afterScheduledSeconds: number;
    volumeMl?: number;
    rateMlHour?: number;
    prescribedVolumeMl?: number;
    reassessmentDueAt?: string;
    reassessment?: MarEvent;
    events: MarEvent[];
    secondCheck?: {
        checkedByName: string;
        checkedAt: string;
    };
}

export interface MarEvent {
    action: string;
    at: string;
    actorName: string;
    note?: string;
    outcome?: string;
    volumeMl?: number;
    rateMlHour?: number;
    secondCheck?: {
        checkedByName: string;
        checkedAt: string;
    };
}

export interface MarCheck {
    id: string;
    orderId: string;
    medicine: string;
    dose: string;
    route: string;
    prescription: MedicationOrder['details'];
    status: string;
    requestedBy: string;
    requestedByName: string;
    requestedAt: string;
    expiresAt: string;
    checkedByName?: string;
    proposal: Record<string, unknown>;
}

export interface CourseDetail {
    today: string;
    course: MedCourse;
    patient: ClinicalPatientLite;
    encounters: {
        id: string;
        class: string;
        status: string;
        department: string;
    }[];
    records: MarRecord[];
    clinicians: {
        value: string;
        label: string;
    }[];
    clinics: Clinic[];
}

export interface MedCourse {
    id: string;
    patientId: string;
    version: number;
    name: string;
    kind: string;
    clinic: string;
    protocolId: string;
    protocolVersion: number;
    protocol: SeriesProtocol;
    startedAt: string;
    status: string;
    plannedDoses: PlannedDose[];
}

export interface SeriesProtocol {
    id: string;
    version: number;
    name: string;
    kind: 'vaccine' | 'recurring' | 'cyclic';
    products: (Coding & {
        sequences: number[];
    })[];
    doses: SeriesDose[];
    cycle: {
        treatmentDays: number;
        restDays: number;
        cycles: number;
    } | null;
    source: {
        name: string;
        date: string;
    };
    active: boolean;
    example: boolean;
    screening: {
        id: string;
        label: string;
        blocking: boolean;
    }[];
    fundingSources: {
        code: string;
        label: string;
    }[];
    aefiCriteria: {
        code: string;
        label: string;
    }[];
}

export type Coding = Pick<CatalogItem, 'system' | 'code' | 'display'>;

export interface SeriesDose {
    sequence: number;
    label: string;
    minAge: number;
    minIntervalDays: number;
    recommendedIntervalDays: number;
    maxIntervalDays: number | null;
    productRule: 'same' | 'any-allowed';
}

export interface PlannedDose {
    sequence: number;
    label: string;
    status: string;
    dueFrom: string;
    dueAt: string;
    dueBy: string | null;
    heldForAcceptance?: boolean;
    invalidForSeries?: boolean;
    givenOn?: string;
    administrationId?: string;
    orderId?: string;
    appointmentId?: string;
    reason?: string;
    screeningDecision?: {
        answers: Record<string, boolean>;
        decision: string;
        clinicianName: string;
        note: string;
        date: string;
    };
}

export interface StockLot {
    id: string;
    version: number;
    batch: string;
    expiry: string;
    gtin?: string;
    quantity: number;
    unit: string;
}

export interface SuppliedLot extends StockLot {
    stockId: string;
    unitsPerDose: number;
}

export interface ReturnAvailable {
    packs: ReturnPack[];
    supplies: BulkSupply[];
    reasons: {
        code: string;
        label: string;
    }[];
}

export interface ReturnPack {
    id: string;
    patientId: string;
    encounterId: string;
    patient: PackPatient;
    location: PackLocation;
    packCode: string;
    label: string;
    dose: string;
    route: string;
    quantity: number;
    unit: string;
    batch: string;
    expiry: string;
    version: number;
    status: string;
    dueReason: string;
    scheduledAt?: string;
}

export interface PackPatient {
    id: string;
    name: string;
    mrn: string;
}

export interface PackLocation {
    ward: string;
    bed?: string;
    room?: string;
}

export interface BulkSupply {
    id: string;
    version: number;
    availableQuantity: number;
    data: {
        medicine: string;
        dose: string;
        quantity: number;
        unit: string;
        batch: string;
        expiry: string;
        unitsPerDose: number;
    };
}

export interface QuestionTest {
    code: string;
    display: string;
    profile: CollectionProfile;
    questions: LabQuestion[];
}

export interface CollectionProfile {
    specimen?: string | null;
    container?: string | null;
    minVolumeMl?: number | null;
    fasting?: boolean | null;
    transport?: string | null;
    stabilityHours?: number | null;
    catalogueVersion?: number;
}

export interface LabQuestion {
    code: string;
    label: string;
    type: QuestionType;
    stage: "order" | "collection";
    required: boolean;
    min?: number | null;
    max?: number | null;
    options?: string[];
}

/** Collection profile and clinical questions of a catalogue test (asked when ordering or at collection). */
export type QuestionType = "boolean" | "integer" | "decimal" | "code" | "text" | "date";

export interface OrderEvaluation {
    results: InfoResult[];
    problems: string[];
}

export interface InfoResult {
    list: OrderList;
    index: number;
    code: string;
    display: string;
    sections: {
        code: string;
        title: string;
        description?: string;
        safety: boolean;
        fields: InfoField[];
    }[];
    missing: {
        key: string;
        label: string;
    }[];
    invalid: {
        key: string;
        message: string;
    }[];
    blocks: InfoCheck[];
    warnings: InfoCheck[];
    informs: InfoCheck[];
    complete: boolean;
}

export type OrderList = "labs" | "imaging" | "prescriptions" | "procedures";

export interface InfoField {
    key: string;
    label: string;
    help?: string | null;
    dataType: "boolean" | "integer" | "decimal" | "code" | "text" | "date";
    options?: {
        code: string;
        display: string;
    }[];
    unit?: string | null;
    min?: number | null;
    max?: number | null;
    absence: string[];
    visible: boolean;
    required: boolean;
    calculated: boolean;
    status: string;
    value?: unknown;
    absentReason?: string | null;
    suggested?: unknown;
    problems: string[];
    checks: InfoCheck[];
}

export interface InfoCheck {
    id: string;
    key: string;
    label: string;
    level: "block" | "warn" | "inform";
    message: string;
    reason?: string | null;
}
export function conflictSummary(conflicts: AllergyConflict[] | undefined): string | undefined {
  if (!conflicts?.length) return undefined;
  return [...conflicts].sort((a, b) => (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1)).map((c) => c.message).join(" ");
}

export function unmappedNotice(unmapped: UnmappedAllergy[] | undefined): string | undefined {
  if (!unmapped?.length) return undefined;
  return `${unmapped.map((u) => u.substance).join(", ")}: recorded as free text, so not checked automatically. Review these allergies yourself.`;
}
export const ORDER = { high: 0, moderate: 1, info: 2 } as const;

export function sortedAlerts(alerts: SafetyAlert[] | undefined): SafetyAlert[] {
  return [...(alerts ?? [])].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

export function checkContext(c: CheckContext): string {
  const age = c.ageYears == null ? "age not recorded" : c.ageYears < 1 ? `age ${Math.round(c.ageYears * 12)} months` : `age ${Math.floor(c.ageYears)} years`;
  const weight = c.weightKg == null ? "weight not recorded" : `weight ${c.weightKg} kg`;
  const egfr = c.egfr == null ? "eGFR not recorded" : `eGFR ${c.egfr}`;
  const status = [c.pregnancy === "pregnant" ? "pregnant" : c.pregnancy === "possibly" ? "may be pregnant" : "", c.breastfeeding ? "breastfeeding" : ""].filter(Boolean);
  return `Checked for ${age}, ${weight}, ${egfr}${status.length ? `, ${status.join(", ")}` : ""}.`;
}
export function priorityProblem(value:PriorityInput,priorities:OrderPriority[],now=Date.now()){
 const selected=priorities.find(p=>p.code===(value.priority||priorities.find(p=>p.active&&p.default)?.code));
 if(!selected?.active)return 'Choose an active priority from the medication policy.';
 if(selected.reasonRequired&&(value.priorityReason??'').trim().length<10)return 'Explain this order’s priority in at least 10 characters.';
 if(selected.requiresTime&&(!value.priorityAt||!Number.isFinite(Date.parse(value.priorityAt))||Date.parse(value.priorityAt)<now))return 'Choose a current or future priority time.';
 return '';
}

export function priorityCountdown(due:string,now:number,formatNumber:(value:number)=>string=String){
 const remaining=Date.parse(due)-now;if(!Number.isFinite(remaining))return '';const minutes=formatNumber(Math.ceil(Math.abs(remaining)/60000));
 return remaining>0?`Due in ${minutes} min`:remaining===0?'Due now':`Overdue by ${minutes} min`;
}
export const ABSENT_ANSWER: { value: NonNullable<Answer["absent"]>; label: string }[] = [
  { value: "unknown", label: "Unknown" }, { value: "not-asked", label: "Not asked" }, { value: "declined", label: "Declined" },
];

export const unanswered = (questions: LabQuestion[], answers: Answers | undefined) =>
  questions.filter((q) => q.required && !answers?.[q.code]?.absent && (answers?.[q.code]?.value === undefined || answers?.[q.code]?.value === ""));

export const profileText = (p?: CollectionProfile | null) =>
  !p ? "" : [p.container, p.specimen, p.minVolumeMl != null ? `≥ ${p.minVolumeMl} mL` : null, p.fasting ? "fasting" : null, p.transport?.replace(/-/g, " "), p.stabilityHours != null ? `stable ${p.stabilityHours} h` : null].filter(Boolean).join(" · ");
export const FREQUENCIES:Record<string,string>={once:'Once',daily:'Once daily','twice-daily':'Twice daily','three-times-daily':'Three times daily','four-times-daily':'Four times daily','every-4-hours':'Every 4 hours','every-6-hours':'Every 6 hours','every-8-hours':'Every 8 hours','every-12-hours':'Every 12 hours',prn:'As needed (PRN)'};
export const DOSE_UNITS=['mg','microgram','g','mL','unit','tablet','capsule','puff','drop','patch'];

export function validDose(value:string) {
  const match=/^([0-9]+(?:\.[0-9]+)?) (mg|microgram|g|mL|unit|tablet|capsule|puff|drop|patch)$/.exec(value.trim());
  return !!match&&Number.isFinite(Number(match[1]))&&Number(match[1])>0;
}
export const SUBSTITUTION_TYPES={generic:'Generic equivalent','dosage-form':'Dosage form or strength',therapeutic:'Therapeutic alternative'};

export const SUBSTITUTION_STATUS={approved:'Substitution approved','pending-prescriber':'Awaiting prescriber approval',rejected:'Substitution rejected',withdrawn:'Proposal withdrawn',reverted:'Returned to original medicine'};

import type {OrderInfo} from "./consult-note";
import type {PainInput} from "./consult-records";
export interface OrderEvaluationContent {
  labs: {code: string; priority?: string}[]; imaging: {code: string; priority?: string}[];
  prescriptions: {code: string; priority?: string; route: string}[];
  procedures: {code: string; priority?: string}[]; orderInfo: OrderInfo;
}
export interface MedicationCheckInput { lines: {code: string; dose: string; frequency: string}[]; stopping: string[] }
export interface ProcedureCompletion { outcome: string; consentConfirmed: boolean }
export interface SubstitutionDecisionInput { version: number; decision: "approve" | "reject"; note: string; requestId: string }
export interface SubstitutionPreview { toCode?: string; dose?: string; route?: string; interchangeId?: string }
export interface SubstitutionProposal {
  requestId: string; version: number; type: Substitution["type"]; toCode: string; dose: string; doseValue: number; doseUnit: string;
  route: string; reasonCode: string; note: string; overrideReason: string; interchangeId?: string;
}
export interface SubstitutionWithdrawal { requestId: string; version: number; note: string }
export interface VaccineAdministrationFields {
  courseVersion?: number; screening?: Record<string, boolean>; earlyOverrideReason?: string; vaccineCode?: Coding;
  product?: string; manufacturer?: string; doseVolume?: number; fundingSource?: string; consent?: string; visSheet?: string;
  dispenseId?: string; dispenseVersion?: number; stockId?: string; stockVersion?: number; stockUnits?: number;
}
export interface AdministrationIdentity {
  requestId: string; orderId: string; orderVersion: number; contextVersion: string; identityMode: string;
  identityConfirmed: boolean; patientCode: string; medicationCode: string; identityReason: string; note: string;
}
export type AdministrationProposal = AdministrationIdentity & (
  ({kind: "dose"; outcome: "given" | "omitted"; packCode?: string; site?: string; deviceId?: string; witness?: string;
    scheduledAt?: string; omissionReason?: string; indication?: string; reassessMinutes?: number} & VaccineAdministrationFields) |
  {kind: "infusion"; administrationId: string; version: number; action: string; volumeMl: number; rateMlHour?: number}
);
export type AdministrationRecordInput = AdministrationProposal & {checkId?: string};
export interface CheckApproval { confirmed: true; requestId: string }
export interface PostDoseObservationInput { version: number; note: string; confirmed: boolean; requestId: string }
export interface AdverseReactionInput {
  version: number; onsetAt: string; manifestations: {system: string; code: string; display: string}[];
  severity: string; seriousness: string[]; treatment: string; outcome: string; causality: string;
  reportable: boolean; aefi: boolean; vaccineSeriousness: string[]; requestId: string;
}
export interface PrnReassessmentInput { version: number; outcome: string; note: string; pain?: PainInput; requestId: string }
export interface MedicationReturnInput {
  encounterId: string; packIds: string[]; versions: Record<string, number>;
  bulkItems: {dispenseId: string; version: number; quantity: number}[]; reasonCode: string; note: string; requestId: string;
}
export interface CourseLots { lots: StockLot[]; supplies: SuppliedLot[] }
export interface LabQuestionQuery { stage: "order" | "collection"; test?: string; orderId?: string }
export interface LabQuestionCatalogue { catalogueVersion: number; tests: QuestionTest[] }
export interface CodedTest { code: string; display: string }

export const DOSE_RATE_UNITS = ["microgram/kg/min", "mg/kg/hour", "unit/kg/hour", "microgram/min", "mg/hour", "unit/hour"] as const;
