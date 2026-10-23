import type {ConsultationValues} from '../../domain/clinical-consultation';
export const consultationSections = [
  { id: "history", label: "template.consultation.historySection" },
  { id: "assessment", label: "template.consultation.assessmentSection" },
  { id: "plan", label: "template.consultation.planSection" },
];
export type NoteKey = keyof ConsultationValues;
export const detailPanels: Record<
  string,
  Array<{ id: string; fields: NoteKey[] }>
> = {
  history: [
    { id: "visit", fields: ["clinician", "visitType", "complaint", "history"] },
    {
      id: "background",
      fields: [
        "medicalHistory",
        "surgicalHistory",
        "familyHistory",
        "socialHistory",
      ],
    },
    {
      id: "vitals",
      fields: [
        "measuredAt",
        "systolic",
        "diastolic",
        "pulse",
        "respiratoryRate",
        "oxygenSaturation",
        "temperature",
        "pain",
        "weight",
      ],
    },
    {
      id: "allergies",
      fields: ["allergyDetails", "allergyReaction", "precautions"],
    },
  ],
  assessment: [
    { id: "assessment", fields: ["examination", "diagnosis", "allergyReview"] },
    {
      id: "systems",
      fields: [
        "systemsCardiorespiratory",
        "systemsGastrointestinal",
        "systemsNeurological",
        "systemsOther",
      ],
    },
    { id: "results", fields: ["labResults", "imagingResults"] },
    { id: "procedures", fields: ["procedures", "procedureNotes"] },
  ],
  plan: [
    {
      id: "plan",
      fields: ["treatment", "investigations", "followUp", "safetyAdvice"],
    },
    {
      id: "medicines",
      fields: ["currentMedicines", "prescriptionNotes", "medicationReview"],
    },
    {
      id: "referrals",
      fields: ["referralTo", "referralReason", "referralNotes"],
    },
    {
      id: "education",
      fields: ["education", "consentNotes", "functionalStatus"],
    },
  ],
};
export const fieldSections = Object.fromEntries(
  Object.entries(detailPanels).flatMap(([section, panels]) =>
    panels.flatMap((panel) => panel.fields.map((field) => [field, section])),
  ),
) as Record<NoteKey, string>;
