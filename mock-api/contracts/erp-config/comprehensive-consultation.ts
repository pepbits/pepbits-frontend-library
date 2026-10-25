import {
  blankConsultation,
  validateConsultation,
  type ConsultationValues,
  type ConsultationConfiguration,
} from "./clinical-consultation.ts";
export type OrderKind = "medication" | "lab" | "imaging" | "procedure";
export interface ConsultationDiagnosis {
  id: string;
  system: string;
  code: string;
  description: string;
  primary: boolean;
}
export interface ConsultationOrder {
  id: string;
  kind: OrderKind;
  serviceId: string;
  serviceCode: string;
  codeSystem: string;
  diagnosisId: string;
  priority: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions: string;
  specimen: string;
  collection: string;
  laterality: string;
  contrast: string;
  indication: string;
  allergyChecked: boolean;
  allergyNote: string;
}
export interface ScoreEntry {
  id: string;
  instrument: string;
  measuredAt: string;
  inputs: Record<string, string>;
  notes: string;
}
export interface ComprehensiveValues extends ConsultationValues {
  specialty: string;
  context: string;
  specialtyNotes: Record<string, string>;
  diagnoses: ConsultationDiagnosis[];
  orders: ConsultationOrder[];
  scores: ScoreEntry[];
  em: {
    problems: string;
    data: string;
    risk: string;
    minutes: string;
    rationale: string;
    finalCode: string;
  };
  profile: string;
  reportingNotes: string;
  attested: boolean;
}
export interface ComprehensiveConfiguration extends ConsultationConfiguration {
  version: string;
  effectiveFrom: string;
  specialties: Array<{
    value: string;
    label: string;
    fields: Array<{ id: string; label: string }>;
  }>;
  contexts: Array<{ value: string; label: string }>;
  codeSystems: Array<{ value: string; label: string }>;
  services: Array<{
    id: string;
    kind: OrderKind;
    label: string;
    code: string;
    system: string;
  }>;
  serviceCodeSystems: Array<{ value: string; label: string }>;
  priorities: Array<{ value: string; label: string }>;
  profiles: Array<{ value: string; label: string; integrations: string[] }>;
  scoreInstruments: Array<{
    id: string;
    label: string;
    mode: "sum" | "recorded";
    version: string;
    fields: Array<{
      id: string;
      label: string;
      min: number;
      max: number;
      notTestable?: boolean;
    }>;
  }>;
  emRules: {
    version: string;
    new: Array<{ code: string; min: number; max: number }>;
    established: Array<{ code: string; min: number; max: number }>;
  };
}
export const COMPREHENSIVE_PREFIX = "template.comprehensive.";
export function blankComprehensive(): ComprehensiveValues {
  return {
    ...blankConsultation(),
    specialty: "",
    context: "",
    specialtyNotes: {},
    diagnoses: [],
    orders: [],
    scores: [],
    em: {
      problems: "",
      data: "",
      risk: "",
      minutes: "",
      rationale: "",
      finalCode: "",
    },
    profile: "",
    reportingNotes: "",
    attested: false,
  };
}
const text = (v: unknown, max = 2000): v is string =>
  typeof v === "string" && v.length <= max;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function scoreTotal(
  entry: ScoreEntry,
  config: ComprehensiveConfiguration,
): number | null {
  const instrument = config.scoreInstruments.find(
    (s) => s.id === entry.instrument,
  );
  if (!instrument) return null;
  const numbers = instrument.fields.map((f) => {
    const v = entry.inputs[f.id];
    return /^\d+$/.test(v ?? "") && Number(v) >= f.min && Number(v) <= f.max
      ? Number(v)
      : null;
  });
  return numbers.some((v) => v === null)
    ? null
    : numbers.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}
export function emComparison(
  v: ComprehensiveValues,
  c: ComprehensiveConfiguration,
) {
  const levels = [v.em.problems, v.em.data, v.em.risk];
  const level = levels.every((s) => /^[0-3]$/.test(s))
    ? levels.map(Number).sort((a, b) => a - b)[1]
    : null;
  const rules =
    v.visitType === "new"
      ? c.emRules.new
      : v.visitType === "review"
        ? c.emRules.established
        : [];
  const minutes = /^\d+$/.test(v.em.minutes) ? Number(v.em.minutes) : null;
  return {
    level,
    mdm: level === null ? "" : (rules[level]?.code ?? ""),
    time:
      minutes === null
        ? ""
        : (rules.find((r) => minutes >= r.min && minutes <= r.max)?.code ?? ""),
  };
}
export function validateComprehensive(
  v: ComprehensiveValues,
  c: ComprehensiveConfiguration,
  complete: boolean,
): Record<string, string> {
  const errors = validateConsultation(v, c, complete),
    invalid = COMPREHENSIVE_PREFIX + "invalid",
    required = COMPREHENSIVE_PREFIX + "required";
  if (!object(v)) return { form: invalid };
  if (
    !Array.isArray(v.diagnoses) ||
    !Array.isArray(v.orders) ||
    !Array.isArray(v.scores)
  )
    return { ...errors, form: invalid };
  for (const field of ["specialty", "context", "profile"] as const) {
    const options =
      field === "specialty"
        ? c.specialties
        : field === "context"
          ? c.contexts
          : c.profiles;
    if (
      !text(v[field], 100) ||
      (v[field] && !options.some((o) => o.value === v[field]))
    )
      errors[field] = invalid;
    else if (complete && !v[field]) errors[field] = required;
  }
  const fieldIds = new Set(
    c.specialties.flatMap((s) => s.fields.map((f) => f.id)),
  );
  if (
    !object(v.specialtyNotes) ||
    Object.entries(v.specialtyNotes).some(
      ([k, val]) => !fieldIds.has(k) || !text(val),
    )
  )
    errors.specialtyNotes = invalid;
  if (!text(v.reportingNotes) || typeof v.attested !== "boolean")
    errors.attested = invalid;
  else if (complete && !v.attested) errors.attested = required;
  if (!Array.isArray(v.diagnoses) || v.diagnoses.length > 30)
    errors.diagnoses = invalid;
  else {
    const ids = new Set<string>(),
      codes = new Set<string>();
    for (const d of v.diagnoses) {
      if (
        !object(d) ||
        !text(d.id, 100) ||
        !d.id ||
        ids.has(d.id) ||
        !c.codeSystems.some((s) => s.value === d.system) ||
        !text(d.code, 80) ||
        !d.code.trim() ||
        !text(d.description, 500) ||
        !d.description.trim() ||
        typeof d.primary !== "boolean"
      ) {
        errors.diagnoses = invalid;
        continue;
      }
      const key = d.system + "|" + d.code.trim().toUpperCase();
      if (codes.has(key)) errors.diagnoses = invalid;
      codes.add(key);
      ids.add(d.id);
    }
    if (
      v.diagnoses.length &&
      v.diagnoses.filter((d) => d?.primary).length !== 1
    )
      errors.diagnoses = invalid;
    if (complete && !v.diagnoses.length) errors.diagnoses = required;
  }
  if (errors.diagnoses) return errors;
  if (!Array.isArray(v.orders) || v.orders.length > 60) errors.orders = invalid;
  else {
    const ids = new Set<string>();
    for (const o of v.orders) {
      if (!object(o)) {
        errors.orders = invalid;
        continue;
      }
      const service = c.services.find(
        (s) => s.id === o.serviceId && s.kind === o.kind,
      );
      if (
        !service ||
        !text(o.serviceCode, 80) ||
        !o.serviceCode.trim() ||
        !c.serviceCodeSystems.some((s) => s.value === o.codeSystem) ||
        !text(o.id, 100) ||
        !o.id ||
        ids.has(o.id) ||
        !c.priorities.some((p) => p.value === o.priority) ||
        !v.diagnoses?.some?.((d) => d.id === o.diagnosisId)
      )
        errors.orders = invalid;
      ids.add(o.id);
      for (const field of [
        "dose",
        "route",
        "frequency",
        "duration",
        "timing",
        "instructions",
        "specimen",
        "collection",
        "laterality",
        "contrast",
        "indication",
        "allergyNote",
      ] as const)
        if (!text(o[field])) errors.orders = invalid;
      if (typeof o.allergyChecked !== "boolean") errors.orders = invalid;
      if (complete) {
        const fields =
          o.kind === "medication"
            ? ["dose", "route", "frequency", "duration", "indication"]
            : o.kind === "lab"
              ? ["specimen", "collection", "indication"]
              : ["indication"];
        if (
          fields.some(
            (f) =>
              !text(o[f as keyof ConsultationOrder]) ||
              !String(o[f as keyof ConsultationOrder]).trim(),
          )
        )
          errors.orders = required;
        if (
          o.kind === "medication" &&
          (!o.allergyChecked || v.allergyReview !== "reviewed")
        )
          errors.orders = COMPREHENSIVE_PREFIX + "allergyRequired";
      }
    }
  }
  if (!Array.isArray(v.scores) || v.scores.length > 30) errors.scores = invalid;
  else {
    const ids = new Set<string>();
    for (const s of v.scores) {
      if (!object(s)) {
        errors.scores = invalid;
        continue;
      }
      const instrument = c.scoreInstruments.find((i) => i.id === s.instrument);
      if (
        !instrument ||
        !text(s.id, 100) ||
        !s.id ||
        ids.has(s.id) ||
        !object(s.inputs) ||
        !text(s.notes) ||
        !text(s.measuredAt, 60) ||
        (s.measuredAt && !Number.isFinite(Date.parse(s.measuredAt)))
      ) {
        errors.scores = invalid;
        continue;
      }
      ids.add(s.id);
      for (const [key, value] of Object.entries(s.inputs)) {
        const f = instrument.fields.find((f) => f.id === key);
        if (
          !text(value, 10) ||
          !f ||
          (!((f.notTestable && value === "NT") || value === "") &&
            (!/^\d+$/.test(value) ||
              Number(value) < f.min ||
              Number(value) > f.max))
        )
          errors.scores = invalid;
      }
      if (
        complete &&
        (!s.measuredAt ||
          instrument.fields.some((f) => !s.inputs[f.id]) ||
          (instrument.mode === "recorded" && !s.notes.trim()))
      )
        errors.scores = required;
    }
  }
  if (
    !object(v.em) ||
    ["problems", "data", "risk", "minutes", "rationale", "finalCode"].some(
      (k) => !text(v.em[k as keyof typeof v.em]),
    )
  )
    errors.em = invalid;
  else {
    if (
      ["problems", "data", "risk"].some(
        (k) => v.em[k as "data"] && !/^[0-3]$/.test(v.em[k as "data"]),
      )
    )
      errors.em = invalid;
    if (
      v.em.minutes &&
      (!/^\d+$/.test(v.em.minutes) || Number(v.em.minutes) > 1440)
    )
      errors.em = invalid;
    if (complete && Object.values(v.em).some(Boolean) && !v.em.rationale.trim())
      errors.em = required;
  }
  return errors;
}
