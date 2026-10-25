import { readFileSync } from "node:fs";
import { createClinicalDocumentStore } from "./clinical-document-store.ts";
import { parseCsv } from "./clinical-template-csv.ts";
import {
  blankComprehensive,
  validateComprehensive,
  type ComprehensiveConfiguration,
  type ComprehensiveValues,
} from "../desktop-clients/packages/erp-config/src/comprehensive-consultation.ts";
const directory = new URL(
  "./config/comprehensive-consultation/",
  import.meta.url,
);
const config = JSON.parse(
  readFileSync(new URL("form.json", directory), "utf8"),
) as ComprehensiveConfiguration;
const [header, ...rows] = parseCsv(
  readFileSync(new URL("services.csv", directory), "utf8"),
);
config.services = rows.map((row) =>
  Object.fromEntries(header.map((key, i) => [key, row[i]])),
) as ComprehensiveConfiguration["services"];
export function createComprehensiveConsultationStore(
  file: string,
  overview: Parameters<typeof createClinicalDocumentStore>[2],
) {
  return createClinicalDocumentStore<
    ComprehensiveValues,
    ComprehensiveConfiguration
  >(
    file,
    {
      prefix: "template.comprehensive.",
      idPrefix: "CC-",
      version: config.version,
      config,
      blank: blankComprehensive,
      validate: validateComprehensive,
      sanitize: (values) =>
        Object.fromEntries(
          Object.keys(blankComprehensive()).map((key) => [
            key,
            structuredClone(values[key as keyof ComprehensiveValues]),
          ]),
        ) as unknown as ComprehensiveValues,
    },
    overview,
  );
}
