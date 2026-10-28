/** Pure consultation contracts extracted from the frozen AllyVora source; no transport or React. */
import type {RecordChange} from "../types";

/** A vital-sign parameter from the organisation's catalogue (/api/vital-parameters). Low limits mean below, high limits at or above. */
export interface VitalParameter {
    key: string;
    type: "number" | "pair" | "scale";
    code: string;
    display: string;
    label: string;
    unit: string;
    unitDisplay: string;
    decimals: number;
    min: number;
    max: number;
    min2?: number;
    max2?: number;
    normalLow?: number | null;
    normalHigh?: number | null;
    normalLow2?: number | null;
    normalHigh2?: number | null;
    warnLow?: number | null;
    warnHigh?: number | null;
    alertLow?: number | null;
    alertHigh?: number | null;
    order: number;
    tile: boolean;
    news2: boolean;
    screens: string[];
    status: "active" | "retired";
    version: number;
    history?: {
        at: string;
        actorName: string;
        action: string;
        before: Record<string, unknown> | null;
        after: Record<string, unknown>;
        reason: string;
    }[];
}

/** The administrator's settings for recording vitals (from /api/vital-parameters). */
export interface VitalSettings {
    correctionGraceSeconds: number;
    maxBackdateHours: number;
}

export type AllergyMasterData = Record<MasterList, MasterEntry[]> & {
    fixed: Record<FixedList, MasterEntry[]>;
};

export type MasterList = "categories" | "allergens" | "reactions" | "routes" | "informants" | "ingredients" | "crossReactivity";

/** One entry of an allergy master list (category, allergen, reaction, route, informant or a fixed value). */
export interface MasterEntry {
    code: string;
    display: string;
    order?: number;
    status?: "active" | "retired";
    version?: number;
    history?: RecordChange[];
    synonyms?: string[];
    group?: string;
    kind?: string;
    fhir?: string;
    snomed?: string;
    serious?: boolean;
    exclusive?: boolean;
    /** Medicine allergens and formulary ingredients: what prescribing checks match on. */
    ingredients?: string[];
    allergyClasses?: string[];
    rxcui?: string;
    /** Cross-reactivity rules: an allergy to the "from" class warns when prescribing from the "to" class. */
    from?: string;
    to?: string;
    severity?: string;
    note?: string;
}

export type FixedList = "type" | "severity" | "criticality" | "clinicalStatus" | "verification" | "resolution";

/** One allergen to add: from the list (with its code) or as the patient described it. */
export interface AllergenPick {
    substance: string;
    allergenCode: string;
    group: string;
}

export interface AllergyDraft {
    /** Allergens already picked when adding several at once; substance is then the one being typed. */
    items: AllergenPick[];
    group: string;
    substance: string;
    allergenCode: string;
    type: string;
    reactions: string[];
    reactionOther: string;
    severity: string;
    criticality: string;
    onset: string;
    informant: string;
    route: string;
    note: string;
    clinicalStatus: string;
    verification: string;
}

export type AllergyAction = "edit" | "inactive" | "resolved" | "refuted" | "entered-in-error" | "reactivate";

export type Codesets = Record<string, Code[]>;

/** One code set entry as served by GET /api/codesets (mirrors Codesets.java). */
export interface Code {
    code: string;
    display: string;
    body?: Record<string, unknown>;
}

export interface PainMaps {
    primary: string;
    applicable: string[];
    maps: BodyMapDef[];
    sex: string;
    ageGroup: string;
    department: string;
}

export interface BodyMapDef {
    id: string;
    title: string;
    kind: "body" | "detail";
    sex: string[];
    ageGroup: string;
    departments: string[];
    views: MapView[];
}

/** A view; `outline` (optional) is the body silhouette that regions are clipped to. */
export interface MapView {
    id: string;
    label: string;
    aspect: string;
    viewBox: string;
    outline?: string;
    regions: MapRegion[];
    markers: {
        text: string;
        x: number;
        y: number;
    }[];
}

export interface MapRegion {
    id: string;
    part: string;
    side: string;
    aspect: string;
    d: string;
    label?: string;
}

/** A recorded pain site (mirrors Pain.details sites). */
export interface PainSite {
    part: string;
    side: string;
    aspect: string;
    score?: number | null;
    characters: string[];
    pattern: string;
    radiating: boolean;
    radiatesTo: string;
    note: string;
    mapId?: string;
    regionId?: string;
    label?: string;
}

/** Pain scale definition served by /api/pain/scales (mirrors PainScales.java). */
export interface PainScale {
    id: string;
    name: string;
    use: string;
    min: number;
    max: number;
    choices: number[];
    items: {
        key: string;
        label: string;
        options: {
            score: number;
            label: string;
        }[];
    }[];
    bands: {
        none: number;
        mild: number;
        moderate: number;
    };
}

export interface PainHistory {
    assessments: PainObservation[];
    analgesia: {
        id: string;
        medicine: string;
        dose: string;
        at: string;
        frequency: string;
    }[];
    reassessments: {
        administrationId: string;
        encounterId: string;
        medicine: string;
        givenAt: string;
        dueAt: string;
        overdue: boolean;
    }[];
    suggested: PainSuggestion;
}

export interface PainObservation {
    id: string;
    encounterId: string;
    scale: string;
    scaleName: string;
    value: number;
    min: number;
    max: number;
    band: string;
    normalised: number;
    goal?: number | null;
    details?: Record<string, unknown>;
    administrationId?: string | null;
    effectiveAt: string;
    authorName?: string;
}

/** The scale the API suggests for this patient, why, and what it considered (age, consciousness, department…). */
export interface PainSuggestion {
    scale: string;
    reason: string;
    basis?: string[];
}

export interface PainInput {
    scale: string;
    score?: number;
    items: Record<string, number>;
}

export interface MedHistoryResponse {
    scope: MedHistoryScope;
    facility: string;
    externalSource: {
        connected: boolean;
        note: string;
    };
    groups: MedGroup[];
}

export type MedHistoryScope = "visit" | "organisation" | "external";

export interface MedGroup {
    key: string;
    display: string;
    external: boolean;
    past?: boolean;
    latestAt: string;
    events: MedEvent[];
    current?: {
        medId: string;
        display: string;
        dose?: string;
        status: string;
        externalFacility?: string;
        replacedBy?: string;
    };
}

export interface MedEvent {
    at: string;
    action: string;
    text: string;
    by?: string;
    facility?: string;
    department?: string;
    encounterId?: string;
    meta?: {
        reason?: string;
        orderStatus?: string;
        administration?: string;
        source?: string;
        pastId?: string;
        origin?: string;
    };
}

export interface InvestigationHistoryResponse {
    groups: InvestigationGroup[];
    externalSource: {
        connected: boolean;
        note: string;
    };
}

export interface InvestigationGroup {
    key: string;
    display: string;
    external: boolean;
    open?: boolean;
    latestAt: string;
    events: InvestigationEvent[];
}

export interface InvestigationEvent {
    at: string;
    action: string;
    text: string;
    by?: string;
    facility?: string;
    department?: string;
    encounterId?: string;
    meta?: {
        reason?: string;
        source?: string;
        externalId?: string;
        orderStatus?: string;
        verification?: string;
    };
}

export type HistoryKind = "lab" | "imaging" | "procedure";

export interface ProblemTimeline {
    problem: ConditionRow;
    events: ProblemTimelineEvent[];
}

/** FHIR-style Condition as returned by /patients/{id}/conditions. */
export interface ConditionRow {
    id: string;
    category: "problem-list-item" | "encounter-diagnosis";
    display: string;
    snomed: string;
    icd10?: string;
    clinicalStatus: string;
    verification: string;
    severity?: string;
    onset?: string;
    abatement?: string;
    note?: string;
    encounterId?: string;
    use?: string;
    rank?: number;
    recordedAt: string;
    recorderName?: string;
    version: number;
    problemId?: string;
    problemDisplay?: string;
    diagnosedAt?: {
        conditionId: string;
        encounterId: string;
        use: string;
        recordedAt: string;
    }[];
    sourceFactId?: string;
    documentedIn?: {
        factId: string;
        documentType: string;
        title?: string;
        date?: string;
    }[];
}

export interface ProblemTimelineEvent {
    kind: "added" | "status" | "verification" | "change" | "diagnosed" | "document";
    at: string;
    actor?: string | null;
    text: string;
    reason?: string | null;
    visit?: string | null;
}

export type ScoreAutofill = Record<string, ScoreAutofillValue | undefined>;

export type ScoreAutofillValue = {
    value: number | string;
    at: string | null;
    source: "vital" | "lab" | "patient";
    label: string;
    unit?: string;
    windowHours?: number;
    stale?: boolean;
    original?: string;
    status?: string;
};

export interface NursingEntry {
    recordType: string;
    recordId: string;
    title: string;
    summary: string;
    authorName?: string;
    at: string;
    clarifications: Clarification[];
}

export interface Clarification {
    id: string;
    text: string;
    authorName?: string;
    authorRole?: string;
    signedAt: string;
}

import {n, VITAL_RANGES, UNMEASURED_REASONS, UNMEASURED_FIELDS} from "../vitals/model";
export interface ConsultVitals {
  sbp: string; dbp: string; hr: string; rr: string; temp: string; spo2: string; o2: "air" | "oxygen" | null; o2Flow: string;
  acvpu: "A" | "C" | "V" | "P" | "U" | null; pain: number | null; glucose: string; weight: string; height: string;
  /** Values of parameters an organisation added, by parameter key. */
  extra?: Record<string, string>;
  /** When the set was measured, as a local date-time ("YYYY-MM-DDTHH:mm"); empty means now. */
  measuredAt?: string;
}
export const EMPTY_CONSULT_VITALS: ConsultVitals = { sbp: "", dbp: "", hr: "", rr: "", temp: "", spo2: "", o2: null, o2Flow: "", acvpu: null, pain: null, glucose: "", weight: "", height: "", extra: {} };

/** A vital-sign parameter from the organisation's parameters (/api/vital-parameters). Low limits mean below, high limits at or above. */

export type VitalScreen = "intake" | "triage" | "consultation" | "inpatient";
/** Parameters whose values are fields of ConsultVitals; any other key is kept in ConsultVitals.extra. */
export const BUILT_IN_KEYS = ["bp", "hr", "rr", "temp", "spo2", "glucose", "pain", "weight", "height"];

const base = { screens: ["intake", "triage", "consultation", "inpatient"], status: "active" as const, version: 1 };
/**
 * Used only when the organisation's parameters cannot be loaded, so vitals can still be recorded; it
 * mirrors the API's starter set (vital-parameters.json), which the server validates against.
 */
export const FALLBACK_PARAMETERS: VitalParameter[] = [
  { ...base, key: "bp", type: "pair", code: "85354-9", display: "Blood pressure", label: "BP", unit: "mm[Hg]", unitDisplay: "mmHg", decimals: 0, min: 40, max: 300, min2: 20, max2: 200, normalLow: 90, normalHigh: 139, normalLow2: 60, normalHigh2: 89, warnLow: 90, warnHigh: 160, alertHigh: 180, order: 10, tile: true, news2: true },
  { ...base, key: "hr", type: "number", code: "8867-4", display: "Heart rate", label: "Heart rate", unit: "/min", unitDisplay: "/min", decimals: 0, min: 20, max: 250, normalLow: 60, normalHigh: 100, warnLow: 50, warnHigh: 111, order: 20, tile: true, news2: true },
  { ...base, key: "rr", type: "number", code: "9279-1", display: "Respiratory rate", label: "Resp. rate", unit: "/min", unitDisplay: "/min", decimals: 0, min: 0, max: 80, normalLow: 12, normalHigh: 20, warnLow: 10, warnHigh: 23, order: 30, tile: true, news2: true },
  { ...base, key: "temp", type: "number", code: "8310-5", display: "Body temperature", label: "Temperature", unit: "Cel", unitDisplay: "°C", decimals: 1, min: 30, max: 44, normalLow: 36.1, normalHigh: 37.2, warnLow: 35.5, warnHigh: 38, order: 40, tile: true, news2: true },
  { ...base, key: "spo2", type: "number", code: "59408-5", display: "Oxygen saturation", label: "SpO₂", unit: "%", unitDisplay: "%", decimals: 0, min: 50, max: 100, normalLow: 96, normalHigh: 100, warnLow: 94, alertLow: 92, order: 50, tile: true, news2: true },
  { ...base, key: "glucose", type: "number", code: "2339-0", display: "Glucose (point of care)", label: "Glucose", unit: "mmol/L", unitDisplay: "mmol/L", decimals: 1, min: 0.5, max: 60, normalLow: 4, normalHigh: 7.8, order: 60, tile: false, news2: false },
  { ...base, key: "pain", type: "scale", code: "72514-3", display: "Pain score (NRS)", label: "Pain", unit: "{score}", unitDisplay: "/10", decimals: 0, min: 0, max: 10, warnHigh: 7, order: 70, tile: true, news2: false },
  { ...base, key: "weight", type: "number", code: "29463-7", display: "Body weight", label: "Weight", unit: "kg", unitDisplay: "kg", decimals: 1, min: 0.3, max: 400, order: 80, tile: true, news2: false },
  { ...base, key: "height", type: "number", code: "8302-2", display: "Body height", label: "Height", unit: "cm", unitDisplay: "cm", decimals: 1, min: 20, max: 250, order: 90, tile: false, news2: false },
];

/** NEWS2's coded inputs saved as observations: LOINC inhaled oxygen flow rate and level of consciousness. */
export const OXYGEN_CODE = "3151-8", ACVPU_CODE = "80288-4";
export const ACVPU_TEXT: Record<string, string> = { A: "Alert", C: "New confusion", V: "Responds to voice", P: "Responds to pain", U: "Unresponsive" };

/** "below" low limits and "at or above" high limits: alert raises an abnormal review, warn is shown in amber. */
export function vitalLevel(p: VitalParameter, value: number | undefined | null): "" | "warn" | "alert" {
  if (value === undefined || value === null || !Number.isFinite(value)) return "";
  if ((p.alertLow != null && value < p.alertLow) || (p.alertHigh != null && value >= p.alertHigh)) return "alert";
  if ((p.warnLow != null && value < p.warnLow) || (p.warnHigh != null && value >= p.warnHigh)) return "warn";
  return "";
}
export const normalRange = (p: VitalParameter) =>
  p.normalLow != null && p.normalHigh != null ? `${p.normalLow}–${p.normalHigh}${p.type === "pair" && p.normalLow2 != null && p.normalHigh2 != null ? `/${p.normalLow2}–${p.normalHigh2}` : ""}`
    : p.normalLow != null ? `≥ ${p.normalLow}` : p.normalHigh != null ? `≤ ${p.normalHigh}` : "";

// Supported input ranges mirror the API; these are not clinical normal ranges.

const unmeasuredFields = (parameters?: VitalParameter[]) => parameters ? parameters.filter((p) => p.status === "active").map((p) => p.key) : UNMEASURED_FIELDS;
const extras = (parameters?: VitalParameter[]) => (parameters ?? []).filter((p) => p.status === "active" && !BUILT_IN_KEYS.includes(p.key));

/** The allowed input range for a built-in field: the parameters's when loaded, otherwise the defaults above. */
function rangeOf(key: keyof typeof VITAL_RANGES, parameters?: VitalParameter[]): { label: string; min: number; max: number; unit: string } {
  const spec = VITAL_RANGES[key];
  const p = parameters?.find((x) => x.key === (key === "sbp" || key === "dbp" ? "bp" : key));
  if (!p) return spec;
  return key === "dbp" ? { ...spec, min: p.min2 ?? spec.min, max: p.max2 ?? spec.max, unit: p.unitDisplay }
    : { ...spec, min: p.min, max: p.max, unit: p.unitDisplay };
}

export function consultWithoutUnmeasured(v: ConsultVitals, reasons: Record<string, string>): ConsultVitals {
  const clean = { ...v };
  if (reasons.bp) { clean.sbp = ""; clean.dbp = ""; }
  for (const key of ["hr", "rr", "temp", "spo2"] as const) if (reasons[key]) clean[key] = "";
  for (const key of ["glucose", "weight", "height"] as const) if (reasons[key]) clean[key] = "";
  if (reasons.pain) clean.pain = null;
  clean.extra = Object.fromEntries(Object.entries(v.extra ?? {}).filter(([k]) => !reasons[k]));
  if (clean.o2 !== "oxygen") clean.o2Flow = "";
  return clean;
}

export function consultMeasurementErrors(v: ConsultVitals, reasons: Record<string, string> = {}, parameters?: VitalParameter[]) {
  const clean = consultWithoutUnmeasured(v, reasons);
  const errors: Partial<Record<keyof ConsultVitals | "bp" | "notMeasured", string>> = {};
  for (const key of Object.keys(VITAL_RANGES) as (keyof typeof VITAL_RANGES)[]) {
    const spec = rangeOf(key, parameters), value = n(clean[key]);
    if (value !== undefined && (!Number.isFinite(value) || value < spec.min || value > spec.max))
      errors[key] = `${spec.label}: enter a number from ${spec.min} to ${spec.max} ${spec.unit}.`;
  }
  for (const p of extras(parameters)) {
    const value = n(clean.extra?.[p.key] ?? "");
    if (value !== undefined && (!Number.isFinite(value) || value < p.min || value > p.max))
      (errors as Record<string, string>)[p.key] = `${p.display}: enter a number from ${p.min} to ${p.max} ${p.unitDisplay}.`;
  }
  if (!reasons.bp) {
    if (!!clean.sbp.trim() !== !!clean.dbp.trim()) errors.bp = "Blood pressure: enter both systolic and diastolic values.";
    else if (!errors.sbp && !errors.dbp && clean.sbp.trim() && n(clean.sbp)! <= n(clean.dbp)!)
      errors.bp = "Blood pressure: systolic must be greater than diastolic. Check both values.";
  }
  if (v.pain !== null && (!Number.isInteger(v.pain) || v.pain < 0 || v.pain > 10))
    errors.pain = "Pain score: enter a whole number from 0 to 10.";
  for (const [key, reason] of Object.entries(reasons))
    if (!unmeasuredFields(parameters).includes(key) || !UNMEASURED_REASONS.includes(reason))
      errors.notMeasured = "Choose a supported reason for each unmeasured vital.";
  return errors;
}

export function consultVitalsErrors(v: ConsultVitals, reasons: Record<string, string>, parameters?: VitalParameter[]) {
  const errors = Object.values(consultMeasurementErrors(v, reasons, parameters));
  for (const key of ["hr", "rr", "temp", "spo2"] as const)
    if (!v[key].trim() && !reasons[key]) errors.push(`Record ${VITAL_RANGES[key].label.toLowerCase()} or a reason it wasn't measured.`);
  if ((!v.sbp.trim() || !v.dbp.trim()) && !reasons.bp) errors.push("Record blood pressure or a reason it wasn't measured.");
  if (!v.o2) errors.push("Say whether the patient is on room air or oxygen.");
  if (!v.acvpu) errors.push("Record level of consciousness (ACVPU).");
  return errors;
}
export const consultVitalsComplete = (v: ConsultVitals, reasons: Record<string, string>, parameters?: VitalParameter[]) => consultVitalsErrors(v, reasons, parameters).length === 0;

export function consultVitalsPayload(v: ConsultVitals, reasons: Record<string, string>, parameters?: VitalParameter[]) {
  const clean = consultWithoutUnmeasured(v, reasons);
  return { sbp: n(clean.sbp) ?? null, dbp: n(clean.dbp) ?? null, hr: n(clean.hr) ?? null,
    rr: n(clean.rr) ?? null, temp: n(clean.temp) ?? null, spo2: n(clean.spo2) ?? null,
    o2: clean.o2 ?? undefined, o2Flow: n(clean.o2Flow) ?? null, acvpu: clean.acvpu ?? undefined,
    glucose: n(clean.glucose) ?? null, pain: clean.pain, weight: n(clean.weight) ?? null,
    height: n(clean.height) ?? null, notMeasured: { ...reasons },
    ...(v.measuredAt ? { measuredAt: new Date(v.measuredAt).toISOString() } : {}),
    ...Object.fromEntries(extras(parameters).map((p) => [p.key, n(clean.extra?.[p.key] ?? "") ?? null])) };
}

export function consultBmiPreview(v: ConsultVitals, parameters?: VitalParameter[]) {
  const errors = consultMeasurementErrors(v, {}, parameters);
  const weight = n(v.weight), height = n(v.height);
  if (errors.weight || errors.height || weight === undefined || height === undefined) return null;
  return Math.round(weight / (height / 100) ** 2 * 10) / 10;
}

export interface VitalParameterCatalogue extends VitalSettings { items: VitalParameter[] }
export const parameterByCode = (code: string, parameters: VitalParameter[] = FALLBACK_PARAMETERS) => parameters.find(p => p.code === code);
export const parameterByKey = (key: string, parameters: VitalParameter[] = FALLBACK_PARAMETERS) => parameters.find(p => p.key === key);
export type ConsultVitalsPayload = ReturnType<typeof consultVitalsPayload>;

/** Version/reason fields are transmitted unchanged; server validation remains authoritative. */
export interface VersionReason { version: number; reason: string }
export interface DetailedNewAllergy {
  group: string; substance: string; allergenCode?: string; type: string; reactions: string[]; reactionOther: string;
  severity: string; criticality: string; onset: string; informant: string; route: string; note: string;
  reactionId?: string; reactionVersion?: number;
}
export type AllergyBatchInput = Omit<DetailedNewAllergy, "substance" | "allergenCode" | "group" | "reactionId" | "reactionVersion"> & {items: AllergenPick[]};
export type AllergyPatch = Partial<DetailedNewAllergy> & VersionReason & {clinicalStatus?: string; verification?: string; resolution?: string};
export interface AllergyVerification { verification: string; version: number }
export type {AllergyReviewOutcome} from "../forms/intake-model";
export type ObservationCorrection = VersionReason & (
  {value: number; value2?: number; valueCode?: never; valueDisplay?: never} |
  {value?: number | null; value2?: never; valueCode: string; valueDisplay?: string}
);
export interface PatientEncounterContext { patientId?: string; encounterId?: string }
export interface PainAssessmentInput extends PainInput {
  details?: {sites?: PainSite[]; character?: string[]; onset?: string; started?: string; duration?: string; pattern?: string;
    aggravatingFactors?: string[]; relievingFactors?: string[]; aggravating?: string; relieving?: string; function?: string; sleep?: string; note?: string};
  goal?: number;
}
export interface PainSaveResult { alert?: string | null }
export interface ScreeningReviewInput { action: "reviewed" | "reassessed"; answers: Record<string, string>; note: string; statusVersion: number }
export interface ReproductiveStatusUpdate {
  version: number; encounterId?: string; reason?: string; pregnancy?: "pregnant" | "possibly" | "not-pregnant" | "unknown";
  breastfeeding?: "yes" | "no" | "unknown"; lmp?: string; edd?: string; note?: string;
}
export interface ReportedMedicationInput { drugCode?: string; display: string; dose?: string; status: string; encounterId: string; externalFacility?: string }
export interface MedicationPatch extends VersionReason { display?: string; dose?: string; status?: string }
export interface MedicationHistoryInput {
  drugCode?: string; display: string; dose: string; status: string; origin: string; facility?: string;
  started: string; stopped: string; approximate: boolean; stopReason: string; source: string; note: string; encounterId: string;
}
export interface InvestigationHistoryQuery { kind: HistoryKind; scope: MedHistoryScope; encounterId: string }
export interface ExternalResultInput {
  kind: "lab" | "imaging"; test: string; performed: string; facility: string; value: string; unit: string;
  flag: string; summary: string; source: string; note: string; encounterId: string;
}
export interface ProcedureHistoryInput { procedure: string; performed: string; note: string; facility?: string }
export type ProcedureHistoryPatch = {version: number} & (
  {verification: "confirmed"; reason?: string} |
  (Partial<ProcedureHistoryInput> & {verification?: "unconfirmed" | "confirmed" | "refuted"; reason: string})
);
export interface NewCondition { code: string; verification: string; onset?: string; severity?: string }
export interface ConditionPatch {
  version: number; reason?: string;
  clinicalStatus?: string; verification?: string; severity?: string; onset?: string; abatement?: string; note?: string;
}
export interface ScoreSaveInput { patientId?: string; encounterId?: string; inputs: Record<string, unknown> }
export interface SavedScore { id: string; total: number | null; band?: string }
export interface ClarificationInput { recordType: string; recordId: string; text: string }
