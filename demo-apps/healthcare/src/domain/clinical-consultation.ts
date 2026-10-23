import type {
  ClinicalDocument,
  ClinicalDocumentView,
  ClinicalDocumentSave,
} from "./clinical-document";
export const CONSULTATION_CORE_FIELDS = [
  "clinician",
  "visitType",
  "complaint",
  "history",
  "examination",
  "diagnosis",
  "treatment",
  "investigations",
  "followUp",
  "safetyAdvice",
  "allergyReview",
] as const;
export const CONSULTATION_EXTRA_FIELDS = [
  "medicalHistory",
  "surgicalHistory",
  "familyHistory",
  "socialHistory",
  "allergyDetails",
  "allergyReaction",
  "precautions",
  "systemsCardiorespiratory",
  "systemsGastrointestinal",
  "systemsNeurological",
  "systemsOther",
  "labResults",
  "imagingResults",
  "procedures",
  "procedureNotes",
  "currentMedicines",
  "prescriptionNotes",
  "medicationReview",
  "referralTo",
  "referralReason",
  "referralNotes",
  "education",
  "consentNotes",
  "functionalStatus",
  "measuredAt",
  "systolic",
  "diastolic",
  "pulse",
  "respiratoryRate",
  "oxygenSaturation",
  "temperature",
  "pain",
  "weight",
] as const;
export const CONSULTATION_FIELDS = [
  ...CONSULTATION_CORE_FIELDS,
  ...CONSULTATION_EXTRA_FIELDS,
] as const;
export type ConsultationValues = Record<
  (typeof CONSULTATION_FIELDS)[number],
  string
>;
export interface ConsultationConfiguration {
  clinicians: Array<{ value: string; label: string }>;
  visitTypes: Array<{ value: string; label: string }>;
  vitals: Array<{
    id: (typeof CONSULTATION_EXTRA_FIELDS)[number];
    label: string;
    unit: string;
    step: string;
    max?: number;
  }>;
}
export type ConsultationRecord = ClinicalDocument<ConsultationValues>;
export type ConsultationView = ClinicalDocumentView<
  ConsultationValues,
  ConsultationConfiguration
>;
export type ConsultationSave = ClinicalDocumentSave<ConsultationValues>;
export function blankConsultation(): ConsultationValues {
  return Object.fromEntries(
    CONSULTATION_FIELDS.map((k) => [k, ""]),
  ) as ConsultationValues;
}
export function validateConsultation(
  values: ConsultationValues,
  config: ConsultationConfiguration,
  complete: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {},
    invalid = "template.consultation.invalid";
  for (const key of CONSULTATION_CORE_FIELDS)
    if (typeof values?.[key] !== "string" || values[key].length > 2000)
      errors[key] = invalid;
  for (const key of CONSULTATION_EXTRA_FIELDS)
    if (
      values?.[key] !== undefined &&
      (typeof values[key] !== "string" || values[key].length > 2000)
    )
      errors[key] = invalid;
  if (Object.keys(errors).length) return errors;
  if (
    values.clinician &&
    !config.clinicians.some((c) => c.value === values.clinician)
  )
    errors.clinician = invalid;
  if (
    values.visitType &&
    !config.visitTypes.some((c) => c.value === values.visitType)
  )
    errors.visitType = invalid;
  if (
    values.allergyReview &&
    !["reviewed", "unavailable"].includes(values.allergyReview)
  )
    errors.allergyReview = invalid;
  for (const field of config.vitals) {
    const value = values[field.id];
    if (
      value &&
      (!/^\d+(\.\d{1,2})?$/.test(value) ||
        !Number.isFinite(Number(value)) ||
        (field.max !== undefined && Number(value) > field.max))
    )
      errors[field.id] = invalid;
  }
  if (values.measuredAt && !Number.isFinite(Date.parse(values.measuredAt)))
    errors.measuredAt = invalid;
  if (complete)
    for (const key of [
      "clinician",
      "visitType",
      "complaint",
      "examination",
      "diagnosis",
      "treatment",
      "followUp",
      "allergyReview",
    ] as const)
      if (!values[key].trim()) errors[key] = "template.consultation.required";
  return errors;
}

/** Optional expanded fields are filled only when absent; old notes remain readable. */
export function normalizeConsultation(
  values: ConsultationValues,
): ConsultationValues {
  return Object.fromEntries(
    CONSULTATION_FIELDS.map((key) => [
      key,
      values[key] === undefined &&
      (CONSULTATION_EXTRA_FIELDS as readonly string[]).includes(key)
        ? ""
        : values[key],
    ]),
  ) as ConsultationValues;
}
