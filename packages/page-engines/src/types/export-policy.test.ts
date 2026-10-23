import { describe, expect, test } from "vitest";
import type { DataColumn } from "./page";
import { exportAudit, reviewExport } from "./export-policy.ts";

/**
 * The third policy over the one registry.
 *
 * The URL policy asks "may this be written to a query string"; the egress
 * policy asks "must this be masked before a provider sees it". This one asks
 * "may this be written to a FILE", and the answer differs from both because a
 * file is the one destination the application cannot take back: no retention,
 * no revocation, and no audit after it has been emailed on.
 */

const column = (key: string, label = key): DataColumn => ({ key, label, classification:({id:"operational",status:"operational",subject:"phi",owner:"pii",detail:"clinical",token:"credential",apiKey:"credential"} as Record<string,import("./filter-policy").DataClassification>)[key] });

const columns = [
  column("id", "Item code"),
  column("status", "Status"),
  column("subject", "Private reference"),
  column("owner", "Owner"),
  column("detail", "Detail"),
  column("token", "Token"),
];

describe("reviewExport", () => {
  test("carries the operational columns without comment", () => {
    const review = reviewExport([column("id"), column("status")]);
    expect(review.carried.map((item) => item.key)).toEqual(["id", "status"]);
    expect(review.declared).toEqual([]);
    expect(review.withheld).toEqual([]);
    expect(review.silent).toBe(true);
  });

  /* A key nobody classified is not written to a file. Same default as the URL
     policy and for the same reason: an unclassified column is the one most
     likely to be new and least likely to have been thought about, and a file is
     a worse place to find out. verify:export-safety fails on it, so the drop is
     a decision rather than a surprise. */
  test("withholds a column nobody classified", () => {
    const review = reviewExport([column("id"), column("somethingNew")]);
    expect(review.carried.map((item) => item.key)).toEqual(["id"]);
    expect(review.withheld.map((item) => item.key)).toEqual(["somethingNew"]);
    expect(review.silent).toBe(false);
  });

  /* A credential in a spreadsheet is never legitimate, whoever is asking. */
  test("withholds a credential outright", () => {
    const review = reviewExport([column("id"), column("token"), column("apiKey")]);
    expect(review.carried.map((item) => item.key)).toEqual(["id"]);
    expect(review.withheld.map((item) => item.classification)).toEqual(["credential", "credential"]);
    /* Refused, not declared: there is no confirmation that makes it all right. */
    expect(review.declared).toEqual([]);
  });

  /**
   * PHI, PII and clinical content ARE written. Stripping them would make the
   * feature pointless — a ward list with the names removed is not a ward list —
   * and the user exporting is already authorised to read what is on screen. The
   * control is that they are told, and that it is recorded.
   */
  test("carries what identifies someone, and says so", () => {
    const review = reviewExport(columns);
    expect(review.carried.map((item) => item.key)).toEqual(["id", "status", "subject", "owner", "detail"]);
    expect(review.declared.map((item) => item.key)).toEqual(["subject", "owner", "detail"]);
    expect(review.silent).toBe(false);
  });

  test("names each declared column by its label and its class", () => {
    const review = reviewExport(columns);
    expect(review.declared).toContainEqual({ key: "subject", label: "Private reference", classification: "phi" });
    expect(review.declared).toContainEqual({ key: "owner", label: "Owner", classification: "pii" });
    expect(review.declared).toContainEqual({ key: "detail", label: "Detail", classification: "clinical" });
  });

  test("keeps the order the table was showing", () => {
    const review = reviewExport([column("subject"), column("id"), column("detail")]);
    expect(review.carried.map((item) => item.key)).toEqual(["subject", "id", "detail"]);
  });

  test("an empty table is a silent export of nothing", () => {
    expect(reviewExport([])).toEqual({ carried: [], declared: [], withheld: [], silent: true });
  });

  /* One withheld column is enough to stop it being silent, even with nothing
     declared: the user is about to save a file that is missing a column they
     can see on screen, and finding that out afterwards is worse. */
  test("is not silent when anything was withheld", () => {
    expect(reviewExport([column("id"), column("mysteryColumn")]).silent).toBe(false);
  });
});

/**
 * The audit line, by KEY.
 *
 * Same rule as the search log: "someone exported the prescription queue with
 * the Private reference column" is what a review needs; the Private references themselves are what it must
 * not keep. An audit record that copies the file defeats the audit.
 */
describe("exportAudit", () => {
  const review = reviewExport(columns);

  test("records what was exported, and from where", () => {
    const audit = exportAudit("record-queue", review, 96);
    expect(audit.pageId).toBe("record-queue");
    expect(audit.rows).toBe(96);
    expect(audit.columns).toEqual(["id", "status", "subject", "owner", "detail"]);
  });

  /* A file and a printed sheet are both documents and both leave, so both are
     recorded — but they are not the same event, and a review that could not
     tell them apart would be looking for a file that never existed. */
  test("says how it left, and assumes a file when nobody says", () => {
    expect(exportAudit("record-queue", review, 96).via).toBe("file");
    expect(exportAudit("record-queue", review, 96, "print").via).toBe("print");
  });

  test("names the sensitive columns by key and class", () => {
    expect(exportAudit("record-queue", review, 96).declared).toEqual([
      { key: "subject", classification: "phi" },
      { key: "owner", classification: "pii" },
      { key: "detail", classification: "clinical" },
    ]);
  });

  test("records what was held back, so a missing column is explained later", () => {
    expect(exportAudit("record-queue", review, 96).withheld).toEqual(["token"]);
  });

  test("carries no value from any row", () => {
    const audit = exportAudit("record-queue", review, 96);
    /* There is nowhere in the shape for one, which is the point: the audit is
       built from the COLUMNS and never sees a row. */
    expect(JSON.stringify(audit)).not.toMatch(/PRIVATE-001|Record A|Record B/);
    expect(Object.keys(audit).sort()).toEqual(["columns", "declared", "pageId", "rows", "via", "withheld"]);
  });
});
