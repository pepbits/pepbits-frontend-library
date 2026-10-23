import type { EncounterStatus, EncounterType, Priority, StartType } from "./types";

/** Which extra fields a given encounter type asks for. */
export interface EncounterTypeConfig {
  code: EncounterType;
  label: string;
  short: string;
  description: string;
  startTypes: StartType[];
  defaultStart: StartType;
  defaultPriority: Priority;
  needsPractitioner: boolean;
  needsBed: boolean;
  needsTele: boolean;
  needsAddress: boolean;
  needsReferral: boolean;
  needsServices: boolean;
  needsTriage: boolean;
  needsPackage: boolean;
  needsParent: boolean;
  /** Counts as an index consultation that can start a follow-up window. */
  isConsultation: boolean;
  /** Tailwind classes. Kept as literal strings so Tailwind can detect them. */
  tone: { band: string; soft: string; text: string; ring: string; dot: string };
}

export const ENCOUNTER_TYPES: EncounterTypeConfig[] = [
  {
    code: "OP",
    label: "Outpatient",
    short: "OP",
    description: "Clinic consultation, same-day visit",
    startTypes: ["WALK_IN", "APPOINTMENT", "INTERNAL_REFERRAL", "EXTERNAL_REFERRAL"],
    defaultStart: "WALK_IN",
    defaultPriority: "Routine",
    needsPractitioner: true, needsBed: false, needsTele: false, needsAddress: false,
    needsReferral: false, needsServices: false, needsTriage: false, needsPackage: false, needsParent: false,
    isConsultation: true,
    tone: { band: "bg-sky-500", soft: "bg-sky-50", text: "text-sky-800", ring: "ring-sky-500", dot: "bg-sky-500" },
  },
  {
    code: "FOLLOW_UP",
    label: "Follow-up",
    short: "FU",
    description: "Return visit linked to an earlier consultation",
    startTypes: ["APPOINTMENT", "WALK_IN"],
    defaultStart: "APPOINTMENT",
    defaultPriority: "Routine",
    needsPractitioner: true, needsBed: false, needsTele: false, needsAddress: false,
    needsReferral: false, needsServices: false, needsTriage: false, needsPackage: false, needsParent: true,
    isConsultation: false,
    tone: { band: "bg-amber-400", soft: "bg-amber-50", text: "text-amber-900", ring: "ring-amber-500", dot: "bg-amber-400" },
  },
  {
    code: "IP",
    label: "Inpatient",
    short: "IP",
    description: "Admission with ward and bed",
    startTypes: ["ELECTIVE", "ADMIT_FROM_OP", "ADMIT_FROM_ER", "TRANSFER_IN", "EXTERNAL_REFERRAL"],
    defaultStart: "ELECTIVE",
    defaultPriority: "Urgent",
    needsPractitioner: true, needsBed: true, needsTele: false, needsAddress: false,
    needsReferral: false, needsServices: false, needsTriage: false, needsPackage: false, needsParent: false,
    isConsultation: true,
    tone: { band: "bg-violet-500", soft: "bg-violet-50", text: "text-violet-800", ring: "ring-violet-500", dot: "bg-violet-500" },
  },
  {
    code: "EMERGENCY",
    label: "Emergency",
    short: "ER",
    description: "Unplanned arrival needing triage",
    startTypes: ["SELF_ARRIVAL", "AMBULANCE", "POLICE_CASE", "TRANSFER_IN", "EXTERNAL_REFERRAL"],
    defaultStart: "SELF_ARRIVAL",
    defaultPriority: "Emergency",
    needsPractitioner: false, needsBed: false, needsTele: false, needsAddress: false,
    needsReferral: false, needsServices: false, needsTriage: true, needsPackage: false, needsParent: false,
    isConsultation: true,
    tone: { band: "bg-rose-500", soft: "bg-rose-50", text: "text-rose-800", ring: "ring-rose-500", dot: "bg-rose-500" },
  },
  {
    code: "DAY_CARE",
    label: "Day care",
    short: "DC",
    description: "Procedure or infusion, discharged same day",
    startTypes: ["APPOINTMENT", "ADMIT_FROM_OP", "INTERNAL_REFERRAL"],
    defaultStart: "APPOINTMENT",
    defaultPriority: "Routine",
    needsPractitioner: true, needsBed: true, needsTele: false, needsAddress: false,
    needsReferral: false, needsServices: false, needsTriage: false, needsPackage: false, needsParent: false,
    isConsultation: true,
    tone: { band: "bg-orange-500", soft: "bg-orange-50", text: "text-orange-800", ring: "ring-orange-500", dot: "bg-orange-500" },
  },
  {
    code: "TELE",
    label: "Teleconsultation",
    short: "TC",
    description: "Video, audio or chat consult",
    startTypes: ["SCHEDULED_CALL", "ON_DEMAND_CALL"],
    defaultStart: "SCHEDULED_CALL",
    defaultPriority: "Routine",
    needsPractitioner: true, needsBed: false, needsTele: true, needsAddress: false,
    needsReferral: false, needsServices: false, needsTriage: false, needsPackage: false, needsParent: false,
    isConsultation: true,
    tone: { band: "bg-cyan-500", soft: "bg-cyan-50", text: "text-cyan-800", ring: "ring-cyan-500", dot: "bg-cyan-500" },
  },
  {
    code: "HOME_VISIT",
    label: "Home visit",
    short: "HV",
    description: "Clinician or nurse visits the patient",
    startTypes: ["SCHEDULED_VISIT", "INTERNAL_REFERRAL"],
    defaultStart: "SCHEDULED_VISIT",
    defaultPriority: "Routine",
    needsPractitioner: true, needsBed: false, needsTele: false, needsAddress: true,
    needsReferral: false, needsServices: false, needsTriage: false, needsPackage: false, needsParent: false,
    isConsultation: true,
    tone: { band: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-800", ring: "ring-emerald-500", dot: "bg-emerald-500" },
  },
  {
    code: "OUTSIDE",
    label: "Outside patient",
    short: "OS",
    description: "Referred in by another facility for services",
    startTypes: ["EXTERNAL_REFERRAL", "SAMPLE_COLLECTION"],
    defaultStart: "EXTERNAL_REFERRAL",
    defaultPriority: "Routine",
    needsPractitioner: false, needsBed: false, needsTele: false, needsAddress: false,
    needsReferral: true, needsServices: true, needsTriage: false, needsPackage: false, needsParent: false,
    isConsultation: false,
    tone: { band: "bg-slate-500", soft: "bg-slate-100", text: "text-slate-800", ring: "ring-slate-500", dot: "bg-slate-500" },
  },
  {
    code: "NO_CONSULT",
    label: "No consultation",
    short: "NC",
    description: "Lab, imaging, pharmacy or nursing only",
    startTypes: ["ORDER_ONLY", "WALK_IN", "SAMPLE_COLLECTION"],
    defaultStart: "ORDER_ONLY",
    defaultPriority: "Routine",
    needsPractitioner: false, needsBed: false, needsTele: false, needsAddress: false,
    needsReferral: false, needsServices: true, needsTriage: false, needsPackage: false, needsParent: false,
    isConsultation: false,
    tone: { band: "bg-teal-500", soft: "bg-teal-50", text: "text-teal-800", ring: "ring-teal-500", dot: "bg-teal-500" },
  },
  {
    code: "HEALTH_CHECK",
    label: "Health check",
    short: "HC",
    description: "Preventive screening package",
    startTypes: ["APPOINTMENT", "WALK_IN"],
    defaultStart: "APPOINTMENT",
    defaultPriority: "Routine",
    needsPractitioner: false, needsBed: false, needsTele: false, needsAddress: false,
    needsReferral: false, needsServices: false, needsTriage: false, needsPackage: true, needsParent: false,
    isConsultation: true,
    tone: { band: "bg-pink-500", soft: "bg-pink-50", text: "text-pink-800", ring: "ring-pink-500", dot: "bg-pink-500" },
  },
];

const typeMap = new Map(ENCOUNTER_TYPES.map((t) => [t.code, t]));
export const encounterType = (code: EncounterType) => typeMap.get(code)!;

export const START_TYPES: Record<StartType, { label: string; hint: string }> = {
  WALK_IN: { label: "Walk-in", hint: "Arrived without booking" },
  APPOINTMENT: { label: "Appointment", hint: "Booked in advance" },
  INTERNAL_REFERRAL: { label: "Internal referral", hint: "Sent by another department" },
  EXTERNAL_REFERRAL: { label: "External referral", hint: "Sent by another facility" },
  SELF_ARRIVAL: { label: "Self arrival", hint: "Came to ER on their own" },
  AMBULANCE: { label: "Ambulance", hint: "Brought in by ambulance" },
  POLICE_CASE: { label: "Police / medico-legal", hint: "Medico-legal case" },
  TRANSFER_IN: { label: "Transfer in", hint: "Moved from another hospital" },
  ADMIT_FROM_OP: { label: "From outpatient", hint: "Admitted after a clinic visit" },
  ADMIT_FROM_ER: { label: "From emergency", hint: "Admitted from ER" },
  ELECTIVE: { label: "Elective", hint: "Planned admission" },
  SCHEDULED_CALL: { label: "Scheduled call", hint: "Booked tele slot" },
  ON_DEMAND_CALL: { label: "On-demand call", hint: "Instant tele consult" },
  SCHEDULED_VISIT: { label: "Scheduled visit", hint: "Booked home visit" },
  ORDER_ONLY: { label: "Order only", hint: "Has a prescription or order" },
  SAMPLE_COLLECTION: { label: "Sample collection", hint: "Sample or specimen drop-off" },
};

export const STATUS_TONE: Record<EncounterStatus, string> = {
  Planned: "bg-slate-100 text-slate-700",
  Arrived: "bg-sky-100 text-sky-800",
  "In progress": "bg-violet-100 text-violet-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-rose-100 text-rose-700",
};

export const NEXT_STATUS: Partial<Record<EncounterStatus, EncounterStatus>> = {
  Planned: "Arrived",
  Arrived: "In progress",
  "In progress": "Completed",
};

/** Visit types that cannot be created without a coded chief complaint. */
export const COMPLAINT_REQUIRED: EncounterType[] = ["OP", "EMERGENCY", "TELE", "HOME_VISIT"];
