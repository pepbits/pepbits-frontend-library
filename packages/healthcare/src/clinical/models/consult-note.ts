/** Pure consultation contracts extracted from the frozen AllyVora source; no transport or React. */
import type {PriorityInput, Answers, SafetyAlert} from "./consult-orders";

export interface NoteContent {
    complaints: {
        code: string;
        display: string;
        primary: boolean;
        patientWords?: string;
        duration?: {
            value: number;
            unit: string;
        };
    }[];
    hpi: {
        onset: string;
        character: string;
        location: string;
        severity: number | null;
        timing: string;
        aggravating: string;
        relieving: string;
        context: string;
        narrative: string;
        concerns: string;
    };
    ros: Record<string, Record<string, TriValue>>;
    rosNotes: Record<string, string>;
    history: {
        smoking: "never" | "former" | "current" | "unknown" | null;
        alcohol: "none" | "occasional" | "regular" | "unknown" | null;
        occupation: string;
        family: string;
        /** Older drafts have no living situation. */
        living?: Living | null;
        meds: Record<string, "continue" | "change" | "stop" | null>;
        /** The new dose for each medicine marked Change; applied to the medicine list when the note is signed. */
        medChanges?: Record<string, {
            dose: string;
        }>;
        /** The medicine version each decision was made against; signing refuses decisions about medicines changed since. */
        medVersions?: Record<string, number>;
        problemsReviewed: boolean;
    };
    exam: Record<string, {
        state: "normal" | "abnormal" | "not-examined" | null;
        findings: string[];
        note: string;
    }>;
    scores: {
        id: string;
        methodId: string;
        label: string;
        total: number | null;
        band?: string;
    }[];
    assessment: string;
    diagnoses: Dx[];
    labs: OrderLine[];
    imaging: OrderLine[];
    prescriptions: RxLine[];
    ePrescription?: {
        pharmacy: string;
    } | null;
    /** doctorId: one of our doctors for an internal referral; doctorName: a doctor at another organisation. */
    referral: {
        specialty: string;
        urgency: "routine" | "urgent";
        question: string;
        organisation?: string;
        doctorId?: string;
        doctorName?: string;
    } | null;
    education: {
        templateId: string;
        title: string;
        language: string;
        method: string[];
        understanding: "understood" | "partial" | "not-assessed" | null;
    }[];
    advice: string;
    followUp: {
        value: number;
        unit: "day" | "week" | "month";
    } | null;
    followUpNone: boolean;
    disposition: "home" | "follow-up" | "refer-er" | "admit" | "refer-external" | null;
    /** When the patient left our care clinically (or the decision to admit), as an ISO instant; older drafts have none. */
    dischargeAt?: string | null;
    certificate: {
        needed: boolean | null;
        from: string;
        to: string;
        fitness: "unfit" | "light-duties" | "";
    };
    aiAccepted: {
        field: string;
        at: string;
    }[];
    /** Why no vitals were taken at this visit, when none were recorded. */
    vitalsNotTaken: string;
    /** Order clinical information; older drafts have none. */
    orderInfo?: OrderInfo;
    /** Procedures and services ordered; older drafts have none. */
    procedures?: ProcLine[];
    /** For "Admit": the admission request; older drafts have none. */
    admission?: AdmissionRequest | null;
    /** For "Send to emergency": where and how; older drafts have none. */
    emergency?: EmergencyTransfer | null;
}

export type Living = "alone" | "family" | "others" | "care-home" | "no-fixed-address" | "unknown";

export interface Dx {
    code: string;
    display: string;
    icd10?: string;
    primary: boolean;
    verification: "provisional" | "confirmed" | "differential";
    addToProblems?: boolean;
}

export interface OrderLine extends PriorityInput {
    code: string;
    display: string;
    indication: string;
    priorAuth?: boolean;
    questions?: Answers;
}

export interface RxLine extends PriorityInput {
    administration?: "take-home" | "in-clinic";
    administrationMode?: "dose" | "infusion";
    indication?: string;
    startAt?: string;
    minimumIntervalHours?: number;
    maximumDoses24h?: number;
    infusionVolumeMl?: number;
    infusionRateMlHour?: number;
    minimumRateMlHour?: number;
    maximumRateMlHour?: number;
    infusionPreparation?: string;
    code: string;
    display: string;
    dose: string;
    route: string;
    frequency: string;
    days: number;
    instructions: string;
    overrideReason?: string;
    drugClass?: string;
    /** The medicine-list entry this prescription renews, or replaces (which is then stopped); linked when the note is signed. */
    renews?: string;
    replaces?: string;
    flags: {
        allergy?: string;
        duplicate?: string;
        highAlert?: boolean;
        controlled?: boolean;
        priorAuth?: boolean;
        safety?: SafetyAlert[];
        needsReason?: boolean;
    };
}

/** Answers to the published order forms, shared by every order of the visit and keyed by data element. */
export interface OrderInfo {
    answers: Record<string, unknown>;
    absent: Record<string, string>;
    reasons: Record<string, string>;
}

/** A procedure or service from the "procedures" catalogue; site is teeth (FDI) or a side, as the item needs. */
export interface ProcLine extends PriorityInput {
    code: string;
    display: string;
    indication: string;
    specialty?: string;
    timing?: "this-visit" | "booked";
    consent?: boolean;
    siteKind?: "tooth" | "side" | "none";
    site?: {
        teeth?: string[];
        surfaces?: string[];
        side?: "left" | "right" | "both";
    };
    note?: string;
}

/** The doctor's admission request: admit now (to the bed board) or a planned admission (to the planned admissions list). */
export interface AdmissionRequest {
    timing: "now" | "planned" | null;
    specialty?: string;
    department?: string;
    clinicianId?: string;
    level?: "ward" | "hdu" | "icu" | "isolation-room";
    urgency?: "immediate" | "within-4h";
    admissionType?: string;
    priority?: "routine" | "urgent" | "asap";
    targetDate?: string;
    expectedStayDays?: number | null;
    reason?: string;
    requirements?: string;
    isolation?: "none" | "contact" | "droplet" | "airborne";
    needs?: string[];
}

/** Where the patient goes for emergency care, and how. */
export interface EmergencyTransfer {
    destination: "internal" | "external" | null;
    department?: string;
    facility?: string;
    transport?: "walk-in" | "wheelchair" | "stretcher" | "ambulance" | null;
    handover?: string;
}

export type TriValue = "present" | "absent" | "unknown" | "not-asked" | "declined";
/** Labels are catalog keys: translate at rendering; values remain API codes. */
export const TRI_OPTIONS: {value: TriValue; label: string; tone?: "danger" | "success"}[] = [
 {value:"present",label:"Present",tone:"danger"},{value:"absent",label:"Absent",tone:"success"},
 {value:"unknown",label:"Unknown"},{value:"not-asked",label:"Not asked"},
];
export const LIVING: { value: Living; label: string }[] = [
  { value: "alone", label: "Lives alone" }, { value: "family", label: "With family or partner" }, { value: "others", label: "With others" },
  { value: "care-home", label: "Care or nursing home" }, { value: "no-fixed-address", label: "No fixed address" }, { value: "unknown", label: "Unknown" },
];

export const emptyNote = (): NoteContent => ({
  complaints: [], hpi: { onset: "", character: "", location: "", severity: null, timing: "", aggravating: "", relieving: "", context: "", narrative: "", concerns: "" },
  ros: {}, rosNotes: {}, history: { smoking: null, alcohol: null, occupation: "", family: "", living: null, meds: {}, medChanges: {}, problemsReviewed: false },
  exam: {}, scores: [], assessment: "", diagnoses: [], labs: [], imaging: [], prescriptions: [], referral: null, education: [], advice: "",
  followUp: null, followUpNone: false, disposition: null, certificate: { needed: null, from: "", to: "", fitness: "" }, aiAccepted: [], vitalsNotTaken: "",
});

export const ROS_SYSTEMS: { id: string; label: string; symptoms: string[] }[] = [
  { id: "general", label: "General", symptoms: ["Fever", "Weight loss", "Night sweats", "Fatigue"] },
  { id: "eyes", label: "Eyes", symptoms: ["Visual change", "Eye pain"] },
  { id: "ent", label: "Ears, nose and throat", symptoms: ["Sore throat", "Ear pain", "Nasal congestion"] },
  { id: "cardiovascular", label: "Cardiovascular", symptoms: ["Chest pain", "Palpitations", "Leg swelling", "Orthopnoea"] },
  { id: "respiratory", label: "Respiratory", symptoms: ["Cough", "Shortness of breath", "Wheeze", "Haemoptysis"] },
  { id: "gastrointestinal", label: "Gastrointestinal", symptoms: ["Nausea", "Vomiting", "Abdominal pain", "Diarrhoea", "Blood in stool"] },
  { id: "genitourinary", label: "Genitourinary", symptoms: ["Dysuria", "Frequency", "Haematuria"] },
  { id: "musculoskeletal", label: "Musculoskeletal", symptoms: ["Joint pain", "Back pain", "Muscle weakness"] },
  { id: "skin", label: "Skin", symptoms: ["Rash", "Itching"] },
  { id: "neurological", label: "Neurological", symptoms: ["Headache", "Dizziness", "Numbness", "Limb weakness"] },
  { id: "psychological", label: "Psychological", symptoms: ["Low mood", "Anxiety", "Sleep problems"] },
  { id: "endocrine", label: "Endocrine", symptoms: ["Excessive thirst", "Heat or cold intolerance"] },
];

export const EXAM_SYSTEMS: { id: string; label: string; findings: string[] }[] = [
  { id: "general", label: "General appearance", findings: ["Unwell-looking", "In pain", "Pale", "Dehydrated", "Breathless at rest", "Jaundiced"] },
  { id: "heent", label: "Head, eyes, ears, nose, throat", findings: ["Pharyngeal erythema", "Tonsillar exudate", "Tympanic membrane bulging", "Conjunctival pallor"] },
  { id: "neck", label: "Neck", findings: ["Lymphadenopathy", "Raised JVP", "Thyroid enlargement"] },
  { id: "cardiovascular", label: "Cardiovascular", findings: ["Irregular rhythm", "Murmur", "Peripheral oedema", "Weak peripheral pulses"] },
  { id: "respiratory", label: "Respiratory", findings: ["Crackles", "Wheeze", "Reduced air entry", "Dull percussion"] },
  { id: "abdomen", label: "Abdomen", findings: ["Tenderness", "Guarding", "Distension", "Organomegaly", "Mass"] },
  { id: "musculoskeletal", label: "Musculoskeletal", findings: ["Joint swelling", "Reduced range of movement", "Spinal tenderness"] },
  { id: "neurological", label: "Neurological", findings: ["Focal weakness", "Sensory loss", "Abnormal gait", "Abnormal reflexes"] },
  { id: "skin", label: "Skin", findings: ["Rash", "Wound", "Cellulitis", "Pressure injury"] },
  { id: "mental", label: "Mental state", findings: ["Low mood", "Anxious", "Confused", "Agitated"] },
];

export const SECTIONS = [
  { id: "review", label: "Vitals and nurse findings" }, { id: "allergies", label: "Allergies" }, { id: "problems", label: "Problem list" }, { id: "complaint", label: "Complaint" }, { id: "hpi", label: "History of illness" }, { id: "pain", label: "Pain" },
  { id: "ros", label: "Review of systems" }, { id: "history", label: "Past history" }, { id: "exam", label: "Examination" },
  { id: "scores", label: "Scores and assessments" }, { id: "assessment", label: "Assessment and diagnoses" }, { id: "care", label: "Care gaps" }, { id: "orders", label: "Investigations and procedures" },
  { id: "rx", label: "Medicines" }, { id: "referral", label: "Patient education" }, { id: "plan", label: "Follow-up, disposition and certificate" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export type SectionState = "done" | "partial" | "empty" | "blocked";

export const SCORE_SUGGESTIONS: Record<string, string[]> = {
  "29857009": ["heart", "wellspe", "cha2ds2vasc"], "267036007": ["wellspe", "curb65", "news2"], "49727002": ["curb65", "qsofa"], "386661006": ["qsofa", "news2"],
  "25064002": ["gcs"], "404640003": ["gcs", "news2"], "80313002": ["cha2ds2vasc", "hasbled"],
};

export const DEFAULT_SCORES = ["news2", "bmi", "egfr", "heart", "curb65", "cha2ds2vasc", "hasbled", "wellsdvt", "wellspe", "qsofa", "gcs"];
export const referralComplete = (r: Partial<NonNullable<NoteContent["referral"]>>, external: boolean) => !!r.specialty && !!r.question?.trim() && (!external || (r.organisation ?? "").trim().length >= 2);

export const admissionComplete = (a: AdmissionRequest | null | undefined, inpatientDepts: number) => !!a && !!a.timing && !!a.specialty && !!a.reason?.trim() && a.expectedStayDays !== null && a.expectedStayDays !== undefined
  && (a.timing === "now" ? !!a.urgency && !!a.level && (!inpatientDepts || !!a.department) : !!a.clinicianId && !!a.admissionType && !!a.priority && !!a.targetDate && !!a.requirements?.trim());

export const emergencyComplete = (e: EmergencyTransfer | null | undefined) => !!e && !!e.destination && !!e.transport && (e.destination === "internal" ? !!e.department : (e.facility ?? "").trim().length >= 2);

/** Initialize once per encounter. Subsequent refreshes must not overwrite the workspace's unsaved draft. */
export function initialConsultNote(detail: import("../types").ConsultationDetail): NoteContent {
  const note = emptyNote();
  if (detail.note) return {...note, ...structuredClone(detail.note.content)};
  const history = detail.socialHistory;
  if (history?.version) {
    note.history = {...note.history,
      smoking: (history.smoking as NoteContent["history"]["smoking"]) ?? null,
      alcohol: (history.alcohol as NoteContent["history"]["alcohol"]) ?? null,
      occupation: history.occupation ?? "", family: history.family ?? "",
      living: (history.living as NoteContent["history"]["living"]) ?? null};
  }
  return note;
}
