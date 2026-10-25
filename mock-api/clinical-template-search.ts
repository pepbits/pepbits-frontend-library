import type {
  PatientFilters,
  PatientRecord,
} from "../desktop-clients/packages/erp-config/src/clinical-templates.ts";
const text = (v: unknown) =>
  typeof v === "string" ? v.trim().toLocaleLowerCase() : "";
const words = (v: string) => v.match(/[\p{L}\p{N}]+/gu) ?? [];
/** Demo equivalent of the registry's whole-word, quoted-phrase and exclusion search. */
export function searchMatch(
  record: PatientRecord,
  filters: PatientFilters,
): { matches: boolean; matchedIn: string[] } {
  const groups: Record<string, string> = {
    record: [
      record.mrn,
      record.internalCode,
      ...Object.values(record.values).filter((v) => typeof v === "string"),
    ].join(" "),
    ...Object.fromEntries(
      ["addresses", "contacts", "identifiers", "names"].map((key) => [
        key,
        (record.collections[key] ?? [])
          .flatMap((row) =>
            Object.entries(row)
              .filter(([k]) => k !== "id")
              .map(([, v]) => v),
          )
          .join(" "),
      ]),
    ),
  };
  const normalized = Object.fromEntries(
    Object.entries(groups).map(([k, v]) => [
      k,
      ` ${words(text(v)).join(" ")} `,
    ]),
  );
  const terms = [...text(filters.q).matchAll(/(-?)(?:"([^"]+)"|([^\s"]+))/gu)]
    .map((m) => ({
      exclude: m[1] === "-",
      value: words(m[2] ?? m[3]).join(" "),
    }))
    .filter((t) => t.value);
  if (text(filters.q) && !terms.length)
    return { matches: false, matchedIn: [] };
  const matchedIn = new Set<string>();
  for (const term of terms) {
    const found = Object.entries(normalized)
      .filter(([, v]) => v.includes(` ${term.value} `))
      .map(([k]) => k);
    if (term.exclude ? found.length > 0 : found.length === 0)
      return { matches: false, matchedIn: [] };
    if (!term.exclude) found.forEach((k) => matchedIn.add(k));
  }
  const identifiers = record.collections.identifiers ?? [];
  const matches = Object.entries(filters).every(([key, value]) => {
    const query = text(value);
    if (
      !query ||
      ["q", "page", "pageSize", "sort", "direction", "mobileCode"].includes(key)
    )
      return true;
    if (key === "identity" || key === "identityType")
      return identifiers.some(
        (row) =>
          (!text(filters.identity) ||
            text(row.value).includes(text(filters.identity))) &&
          (!text(filters.identityType) ||
            text(row.identityType) === text(filters.identityType)),
      );
    if (key === "country")
      return (record.collections.addresses ?? []).some(
        (row) => text(row.country) === query,
      );
    if (key === "mobile") {
      const digits = (v: string) => v.replace(/\D/g, "");
      if (!digits(query)) return false;
      const phones = (record.collections.contacts ?? [])
        .filter((r) => ["mobile", "phone"].includes(r.contactType))
        .map((r) => [r.countryCode, r.value].filter(Boolean).join(" "));
      phones.push(String(record.values.mobile ?? ""));
      return phones.some(
        (phone) =>
          digits(phone).includes(digits(query)) &&
          (!text(filters.mobileCode) ||
            digits(phone).startsWith(digits(text(filters.mobileCode)))),
      );
    }
    const actual =
      key === "mrn"
        ? [record.mrn, record.internalCode, record.values.uhid].join(" ")
        : text(record.values[key]);
    return ["gender", "nationality", "status", "birthDate"].includes(key)
      ? actual === query
      : text(actual).includes(query);
  });
  return { matches, matchedIn: [...matchedIn].filter((k) => k !== "record") };
}
