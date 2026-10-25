import { readFileSync } from "node:fs";
import { createClinicalDocumentStore } from "./clinical-document-store.ts";
import {
  TRIAGE_VITALS,
  validateTriage,
  type TriageValues,
  type TriageConfiguration,
} from "../desktop-clients/packages/erp-config/src/clinical-triage.ts";
const config = JSON.parse(
  readFileSync(
    new URL("./config/clinical-triage/form.json", import.meta.url),
    "utf8",
  ),
) as TriageConfiguration;
const blank = (): TriageValues => ({
  complaint: "",
  onset: "",
  priority: "",
  allergyStatus: "",
  allergies: "",
  precautions: "",
  destination: "",
  handoff: "",
  missingReason: "",
  measuredAt: new Date().toISOString(),
  vitals: Object.fromEntries(
    TRIAGE_VITALS.map((k) => [k, ""]),
  ) as TriageValues["vitals"],
});
export function createClinicalTriageStore(
  file: string,
  overview: Parameters<typeof createClinicalDocumentStore>[2],
) {
  return createClinicalDocumentStore(
    file,
    {
      prefix: "template.triage.",
      idPrefix: "TRI-",
      config,
      blank,
      validate: validateTriage,
      sanitize: (values) =>
        ({
          ...Object.fromEntries(
            Object.keys(blank())
              .filter((k) => k !== "vitals")
              .map((k) => [k, values[k as keyof TriageValues]]),
          ),
          vitals: Object.fromEntries(
            TRIAGE_VITALS.map((k) => [k, values.vitals[k]]),
          ),
        }) as TriageValues,
    },
    overview,
  );
}
