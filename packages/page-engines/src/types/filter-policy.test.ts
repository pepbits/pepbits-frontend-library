import { describe, expect, test } from "vitest";
import {
  CLASSIFICATIONS,
  classificationOf,
  fromQuery,
  isUrlSafe,
  partitionFilters,
  storableFilters,
  toQuery,
  type FilterDefinition,
} from "./filter-policy.ts";

const definitions: FilterDefinition[] = [
  { key: "status", label: "Status", type: "select", classification: "operational" },
  { key: "branch", label: "Branch", type: "select", classification: "operational" },
  { key: "from", label: "From date", type: "date", classification: "operational" },
  { key: "recordName", label: "Record name", type: "text", classification: "phi" },
  { key: "mrn", label: "MRN", type: "text", classification: "phi" },
  { key: "phone", label: "Phone", type: "text", classification: "pii" },
  { key: "apiKey", label: "API key", type: "text", classification: "credential" },
];

describe("classification decides, not the call site", () => {
  /* The allowlist is a property of WHAT the filter is, not of where it is
     used. A screen cannot decide that its personal name is fine in a URL this
     once, which is the whole point of holding it in the registry. */
  test("only operational filters are url-safe", () => {
    expect(isUrlSafe({ classification: "operational" as const })).toBe(true);
    for (const classification of ["phi", "pii", "credential", "clinical"] as const) {
      expect(isUrlSafe({ classification })).toBe(false);
    }
  });

  /* An unclassified filter is treated as sensitive, not as safe. A key someone
     forgot to classify is the one most likely to be new and least likely to
     have been thought about. */
  test("an unknown or missing classification is sensitive", () => {
    expect(isUrlSafe({} as FilterDefinition)).toBe(false);
    expect(classificationOf(definitions, "neverDeclared")).toBe("unclassified");
    expect(isUrlSafe({ classification: "unclassified" as const })).toBe(false);
  });

  test("every classification is either safe or not, with nothing in between", () => {
    for (const classification of CLASSIFICATIONS) {
      expect(typeof isUrlSafe({ classification })).toBe("boolean");
    }
  });
});

describe("toQuery", () => {
  test("carries the operational filters", () => {
    const query = toQuery(definitions, { status: "waiting", branch: "AD01" });
    expect(query.get("status")).toBe("waiting");
    expect(query.get("branch")).toBe("AD01");
  });

  /* The policy in one assertion. Nothing sensitive is serialised — not the
     value, and not the key either: "?mrn=" with an empty value still tells a
     log that someone searched by MRN. */
  test("never serialises a sensitive filter, key or value", () => {
    const query = toQuery(definitions, {
      status: "waiting",
      recordName: "Maya Thomas",
      mrn: "PRIVATE-001",
      phone: "+971 50 742 1840",
      apiKey: "sk-live-abc",
    });
    const serialised = query.toString();
    expect(serialised).toContain("status=waiting");
    for (const leak of ["Maya", "Thomas", "PRIVATE-001", "742", "sk-live", "recordName", "mrn", "phone", "apiKey"]) {
      expect(serialised).not.toContain(leak);
    }
  });

  test("a filter nobody declared is held back too", () => {
    expect(toQuery(definitions, { somethingNew: "value" }).toString()).toBe("");
  });

  test("empty and whitespace values are dropped rather than written blank", () => {
    expect(toQuery(definitions, { status: "", branch: "   " }).toString()).toBe("");
  });

  /* A URL that reorders itself between renders looks like it changed, and
     anything watching it re-runs. Asserted against the SORTED order rather
     than against another call — two calls agreeing proves only that the
     function is deterministic, which it would be while emitting whatever order
     the definitions happened to arrive in. */
  test("parameters come out in a stable, sorted order", () => {
    const shuffled = [definitions[2]!, definitions[0]!, definitions[1]!];
    expect(toQuery(shuffled, { status: "waiting", branch: "AD01", from: "2026-01-01" }).toString())
      .toBe("branch=AD01&from=2026-01-01&status=waiting");
  });
});

describe("fromQuery", () => {
  test("reads back what was written", () => {
    const values = { status: "waiting", branch: "AD01" };
    expect(fromQuery(definitions, toQuery(definitions, values))).toEqual(values);
  });

  /* Reading is guarded as well as writing. A URL is user input: someone can
     type ?mrn=PRIVATE-001 by hand, and accepting it would populate a PHI filter
     from a string that has already been through every log on the way in. */
  test("refuses a sensitive parameter someone put in the URL by hand", () => {
    const hostile = new URLSearchParams("status=waiting&mrn=PRIVATE-001&recordName=Maya");
    expect(fromQuery(definitions, hostile)).toEqual({ status: "waiting" });
  });

  test("ignores parameters that are not filters at all", () => {
    expect(fromQuery(definitions, new URLSearchParams("status=waiting&utm_source=email"))).toEqual({ status: "waiting" });
  });
});

describe("partitionFilters", () => {
  /* The shell has to know which half it is holding: one goes in the URL, the
     other goes in a POST body and stays in memory. */
  test("splits the two halves and names the sensitive keys", () => {
    const { urlSafe, sensitive, sensitiveKeys } = partitionFilters(definitions, {
      status: "waiting",
      recordName: "Maya Thomas",
      mrn: "PRIVATE-001",
    });
    expect(urlSafe).toEqual({ status: "waiting" });
    expect(sensitive).toEqual({ recordName: "Maya Thomas", mrn: "PRIVATE-001" });
    expect(sensitiveKeys.sort()).toEqual(["mrn", "recordName"]);
  });

  test("nothing sensitive means nothing to hold back", () => {
    expect(partitionFilters(definitions, { status: "waiting" }).sensitiveKeys).toEqual([]);
  });
});

describe("storableFilters", () => {
  /* The same allowlist governs localStorage. §17.7 asks for the minimum kept
     there, and a personal name typed into a search box is not the minimum —
     localStorage is unencrypted, survives logout and outlives the session that
     was authorised to see it. */
  test("only operational filters may be remembered on the device", () => {
    expect(storableFilters(definitions, { status: "waiting", recordName: "Maya Thomas", mrn: "PRIVATE-001" }))
      .toEqual({ status: "waiting" });
  });

  test("and a free-text search is never remembered", () => {
    /* It is a text box a user can type anything into, including a name. */
    expect(storableFilters(definitions, { query: "Maya Thomas" })).toEqual({});
  });
});
