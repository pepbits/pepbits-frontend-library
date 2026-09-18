import type { PatientFilters, PatientMetadata } from "@pepbits/erp-config";
export const extraQueryFields = ["email", "preferredName", "middleName", "localName", "address", "city", "region", "postalCode", "bloodGroup", "language", "maritalStatus", "occupation", "birthDateFrom", "birthDateTo", "registrationState", "verificationStatus", "insuranceMember", "insurancePolicy"] as const;
export const queryFields = [
  ...extraQueryFields,
  "q",
  "mrn",
  "firstName",
  "lastName",
  "identity",
  "mobile",
  "identityType",
  "nationality",
  "country",
  "gender",
  "birthDate",
  "status",
] as const;
export type QueryField = (typeof queryFields)[number];
export const queryLabel = (key: string) =>
  `template.clinical.${({ q: "searchAnywhere", mrn: "mrnUhid", identity: "nationalIdentifier", country: "residingCountry", identityType: "idType" } as Record<string, string>)[key] ?? key}`;
export function normalizeQuery(filters: PatientFilters): PatientFilters {
  return Object.fromEntries(
    [...queryFields, "mobileCode"]
      .map((key) => [
        key,
        String(filters[key as keyof PatientFilters] ?? "").trim(),
      ])
      .filter(([, v]) => v),
  );
}
export function querySignature(filters: PatientFilters): string {
  const f = normalizeQuery(filters);
  return [
    ...queryFields.map((k) => String(f[k] ?? "").toLocaleLowerCase()),
    f.mobile ? (f.mobileCode ?? "") : "",
  ].join("\u001f");
}
export function queryOptions(metadata: PatientMetadata, key: string) {
  if (metadata.searchOptions?.[key]) return metadata.searchOptions[key];
  const collection = (
    {
      identityType: ["identifiers", "identityType"],
      country: ["addresses", "country"],
      mobileCode: ["contacts", "countryCode"],
    } as Record<string, string[]>
  )[key];
  return (
    (collection
      ? metadata.collections
          .find((c) => c.id === collection[0])
          ?.fields.find((f) => f.id === collection[1])
      : metadata.sections.flatMap((s) => s.fields).find((f) => f.id === key)
    )?.options ?? []
  );
}
