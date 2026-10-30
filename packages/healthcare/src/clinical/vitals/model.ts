/* Vital-sign entry model, copied unchanged from the AllyVora clinical workspace (lib/vitals.ts).
   Values are kept as typed strings until saving, so a half-typed number is never lost. */

export interface Vitals {
  sbp: string; dbp: string; hr: string; rr: string; temp: string; spo2: string; o2: "air" | "oxygen" | null; o2Flow: string;
  acvpu: "A" | "C" | "V" | "P" | "U" | null; pain: number | null; glucose: string; weight: string; height: string;
}
export const EMPTY_VITALS: Vitals = {sbp: "", dbp: "", hr: "", rr: "", temp: "", spo2: "", o2: null, o2Flow: "", acvpu: null, pain: null, glucose: "", weight: "", height: ""};
export const n = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Reasons a vital sign was not measured, keyed by "bp", "hr", "rr", "temp" or "spo2". */
export type NotMeasured = Record<string, string>;

// Supported input ranges mirror the API; these are not clinical normal ranges.
export const VITAL_RANGES = {
  sbp: {label: "Systolic blood pressure", min: 40, max: 300, unit: "mmHg"},
  dbp: {label: "Diastolic blood pressure", min: 20, max: 200, unit: "mmHg"},
  hr: {label: "Heart rate", min: 20, max: 250, unit: "/min"},
  rr: {label: "Respiratory rate", min: 0, max: 80, unit: "/min"},
  temp: {label: "Temperature", min: 30, max: 44, unit: "°C"},
  spo2: {label: "SpO₂", min: 50, max: 100, unit: "%"},
  glucose: {label: "Glucose", min: 0.5, max: 60, unit: "mmol/L"},
  weight: {label: "Weight", min: 0.3, max: 400, unit: "kg"},
  height: {label: "Height", min: 20, max: 250, unit: "cm"},
  o2Flow: {label: "Oxygen flow", min: 0, max: 60, unit: "L/min"},
} as const;
export const UNMEASURED_REASONS = ["refused", "unable", "device-failure", "not-indicated"];
export const UNMEASURED_FIELDS = ["bp", "hr", "rr", "temp", "spo2"];

export function withoutUnmeasured(v: Vitals, reasons: NotMeasured): Vitals {
  const clean = {...v};
  if (reasons.bp) { clean.sbp = ""; clean.dbp = ""; }
  for (const key of ["hr", "rr", "temp", "spo2"] as const) if (reasons[key]) clean[key] = "";
  if (clean.o2 !== "oxygen") clean.o2Flow = "";
  return clean;
}

export function measurementErrors(v: Vitals, reasons: NotMeasured = {}) {
  const clean = withoutUnmeasured(v, reasons);
  const errors: Partial<Record<keyof Vitals | "bp" | "notMeasured", string>> = {};
  for (const key of Object.keys(VITAL_RANGES) as (keyof typeof VITAL_RANGES)[]) {
    const spec = VITAL_RANGES[key], value = n(clean[key]);
    if (value !== undefined && (!Number.isFinite(value) || value < spec.min || value > spec.max))
      errors[key] = `${spec.label}: enter a number from ${spec.min} to ${spec.max} ${spec.unit}.`;
  }
  if (!reasons.bp) {
    if (!!clean.sbp.trim() !== !!clean.dbp.trim()) errors.bp = "Blood pressure: enter both systolic and diastolic values.";
    else if (!errors.sbp && !errors.dbp && clean.sbp.trim() && n(clean.sbp)! <= n(clean.dbp)!)
      errors.bp = "Blood pressure: systolic must be greater than diastolic. Check both values.";
  }
  if (v.pain !== null && (!Number.isInteger(v.pain) || v.pain < 0 || v.pain > 10))
    errors.pain = "Pain score: enter a whole number from 0 to 10.";
  for (const [key, reason] of Object.entries(reasons))
    if (!UNMEASURED_FIELDS.includes(key) || !UNMEASURED_REASONS.includes(reason))
      errors.notMeasured = "Choose a supported reason for each unmeasured vital.";
  return errors;
}

export function vitalsErrors(v: Vitals, reasons: NotMeasured) {
  const errors = Object.values(measurementErrors(v, reasons));
  for (const key of ["hr", "rr", "temp", "spo2"] as const)
    if (!v[key].trim() && !reasons[key]) errors.push(`Record ${VITAL_RANGES[key].label.toLowerCase()} or a reason it wasn't measured.`);
  if ((!v.sbp.trim() || !v.dbp.trim()) && !reasons.bp) errors.push("Record blood pressure or a reason it wasn't measured.");
  if (!v.o2) errors.push("Say whether the patient is on room air or oxygen.");
  if (!v.acvpu) errors.push("Record level of consciousness (ACVPU).");
  return errors;
}
export const vitalsComplete = (v: Vitals, reasons: NotMeasured) => vitalsErrors(v, reasons).length === 0;

export function vitalsPayload(v: Vitals, reasons: NotMeasured) {
  const clean = withoutUnmeasured(v, reasons);
  return {sbp: n(clean.sbp) ?? null, dbp: n(clean.dbp) ?? null, hr: n(clean.hr) ?? null,
    rr: n(clean.rr) ?? null, temp: n(clean.temp) ?? null, spo2: n(clean.spo2) ?? null,
    o2: clean.o2 ?? undefined, o2Flow: n(clean.o2Flow) ?? null, acvpu: clean.acvpu ?? undefined,
    glucose: n(clean.glucose) ?? null, pain: clean.pain, weight: n(clean.weight) ?? null,
    height: n(clean.height) ?? null, notMeasured: {...reasons}};
}
export type VitalsPayload = ReturnType<typeof vitalsPayload>;

export function bmiPreview(v: Vitals) {
  const errors = measurementErrors(v);
  const weight = n(v.weight), height = n(v.height);
  if (errors.weight || errors.height || weight === undefined || height === undefined) return null;
  return Math.round(weight / (height / 100) ** 2 * 10) / 10;
}

/** The NEWS2 inputs (scale 1) taken from the entered vitals. */
export function news2Inputs(v: Vitals, reasons: NotMeasured) {
  const p = vitalsPayload(v, reasons);
  return {rr: p.rr, spo2: p.spo2, air: p.o2, sbp: p.sbp, hr: p.hr, acvpu: p.acvpu, temp: p.temp, scale: "1"};
}
