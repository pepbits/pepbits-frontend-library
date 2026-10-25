/**
 * Which filters may appear in a URL, and which may not.
 *
 * The classification is a property of WHAT a filter is, held once in the
 * registry, so no screen can decide that its patient name is fine in a query
 * string just this once. Same shape as the AI gates: a rule enforced in one
 * place rather than remembered in twenty.
 *
 * The reason it is an allowlist and not a denylist: a filter nobody classified
 * is the one most likely to be new and least likely to have been thought about,
 * so the default has to be "hold it back". A denylist defaults new fields into
 * the URL, which is the wrong way round for the only mistake that matters.
 *
 * What "outside the URL" is protecting against, once past TLS:
 *
 *   nginx access log · API gateway log · APM traces · OpenTelemetry spans
 *   ELK/OpenSearch · cloud provider logs · browser history · Referer headers
 *
 * None of those are the application, all of them see the request line, and most
 * of them keep it for months. HTTPS protects the wire and nothing after the
 * terminator.
 */

export const CLASSIFICATIONS = [
  /** Status, branch, department, date range, sort, pagination. */
  "operational",
  /** Patient name, MRN, DOB — anything identifying a person receiving care. */
  "phi",
  /** Phone, email, Emirates ID, member id. */
  "pii",
  /** Diagnosis, medication, procedure. Identifying or not, it is clinical. */
  "clinical",
  /** Tokens, keys, anything that authenticates. */
  "credential",
  /** Declared nowhere. Treated as sensitive on purpose. */
  "unclassified",
] as const;

/* Named for what it classifies -- data -- rather than for the first policy
   that read it. Filters are one of two consumers; see data-classification. */
export type DataClassification = (typeof CLASSIFICATIONS)[number];

export interface FilterDefinition {
  key: string;
  label: string;
  type: "text" | "select" | "date";
  options?: string[];
  /** Display labels only; option values remain stable in filters and saved views. */
  optionLabels?: Record<string, string>;
  /** Required in practice: an absent one resolves to "unclassified", which is not url-safe. */
  classification?: DataClassification;
}

export type FilterValues = Record<string, string>;

/**
 * The single rule.
 *
 * Written as an explicit equality rather than a list of exclusions, so adding a
 * classification to the union cannot accidentally add it to the allowlist.
 */
export function isUrlSafe(definition: Pick<FilterDefinition, "classification">): boolean {
  return definition.classification === "operational";
}

export function classificationOf(definitions: FilterDefinition[], key: string): DataClassification {
  return definitions.find((definition) => definition.key === key)?.classification ?? "unclassified";
}

const usable = (value: string | null | undefined): value is string => typeof value === "string" && value.trim() !== "";

/**
 * The url-safe half, as query parameters.
 *
 * Sorted, because a URL that reorders itself between renders looks like it
 * changed and anything watching it re-runs. Empty values are dropped rather
 * than written blank: `?mrn=` still tells a log that someone searched by MRN,
 * and the same reasoning applies to a status nobody set.
 */
export function toQuery(definitions: FilterDefinition[], values: FilterValues): URLSearchParams {
  const query = new URLSearchParams();
  for (const definition of [...definitions].sort((a, b) => a.key.localeCompare(b.key))) {
    if (!isUrlSafe(definition)) continue;
    const value = values[definition.key];
    if (usable(value)) query.set(definition.key, value.trim());
  }
  return query;
}

/**
 * Read filters back out of a URL.
 *
 * Guarded the same way writing is, because a URL is user input: someone can
 * type `?mrn=AV204581` by hand, and accepting it would populate a PHI filter
 * from a string that has already passed through every log on the way in.
 */
export function fromQuery(definitions: FilterDefinition[], query: URLSearchParams): FilterValues {
  const values: FilterValues = {};
  for (const definition of definitions) {
    if (!isUrlSafe(definition)) continue;
    const value = query.get(definition.key);
    if (usable(value)) values[definition.key] = value;
  }
  return values;
}

/** The two halves: one for the address bar, one for a POST body held in memory. */
export function partitionFilters(definitions: FilterDefinition[], values: FilterValues): {
  urlSafe: FilterValues;
  sensitive: FilterValues;
  sensitiveKeys: string[];
} {
  const urlSafe: FilterValues = {};
  const sensitive: FilterValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (!usable(value)) continue;
    const target = isUrlSafe({ classification: classificationOf(definitions, key) }) ? urlSafe : sensitive;
    target[key] = value;
  }
  return { urlSafe, sensitive, sensitiveKeys: Object.keys(sensitive) };
}

/**
 * What may be remembered on the device.
 *
 * The same allowlist, because localStorage is not a safer place than a URL —
 * it is unencrypted, it survives logout, and it outlives the session that was
 * authorised to see the value. §17.7 asks for the minimum to be kept there,
 * and a patient name typed into a search box is not the minimum.
 */
export function storableFilters(definitions: FilterDefinition[], values: FilterValues): FilterValues {
  return partitionFilters(definitions, values).urlSafe;
}
