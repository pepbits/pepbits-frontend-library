import { readFileSync } from "node:fs";
import { createClinicalDocumentStore } from "./clinical-document-store.ts";
import {
  normalizeConsultation,
  blankConsultation,
  validateConsultation,
  type ConsultationValues,
  type ConsultationConfiguration,
} from "../desktop-clients/packages/erp-config/src/clinical-consultation.ts";
const config = JSON.parse(
  readFileSync(
    new URL("./config/clinical-consultation/form.json", import.meta.url),
    "utf8",
  ),
) as ConsultationConfiguration;
export function createClinicalConsultationStore(
  file: string,
  overview: Parameters<typeof createClinicalDocumentStore>[2],
) {
  const store = createClinicalDocumentStore(
    file,
    {
      prefix: "template.consultation.",
      idPrefix: "CON-",
      config,
      blank: blankConsultation,
      validate: validateConsultation,
      sanitize: (values, previous) =>
        normalizeConsultation({ ...previous, ...values }),
    },
    overview,
  );
  return {
    handle(...args: Parameters<typeof store.handle>) {
      const result = store.handle(...args);
      if (result.status !== 200) return result;
      const body =
        result.body as import("../desktop-clients/packages/erp-config/src/clinical-consultation.ts").ConsultationView;
      if (Array.isArray(body.assessments))
        return {
          ...result,
          body: {
            ...body,
            assessments: body.assessments.map((record) => ({
              ...record,
              values: normalizeConsultation(record.values),
            })),
          },
        };
      const record =
        result.body as import("../desktop-clients/packages/erp-config/src/clinical-consultation.ts").ConsultationRecord;
      return {
        ...result,
        body: { ...record, values: normalizeConsultation(record.values) },
      };
    },
  };
}
