import { describe, expect, test } from "vitest";
import { DATA_CLASSIFICATIONS } from "../test/catalog";
import { redactField } from "../test/runtime";

/**
 * Redaction is the only thing standing between a record on screen and a third
 * party's server. These assert the MASKS: that what comes back cannot be read
 * back to the original, and that a field nobody classified is not silently
 * mangled.
 */

describe("redactField", () => {
  test("leaves an ordinary field exactly as it was", () => {
    expect(redactField("status", "Overdue")).toEqual({ value: "Overdue", redacted: false });
  });

  /* The panel prints `redacted` as a badge. A mask applied without the flag
     would show the user a masked value with nothing saying why. */
  test("a masked field says it was masked", () => {
    expect(redactField("email", "aisha@example.com").redacted).toBe(true);
  });

  test("an email keeps its domain and loses its local part", () => {
    const { value } = redactField("email", "aisha.rahman@example.invalid");
    expect(value).toMatch(/@example\.invalid$/);
    expect(value).not.toContain("rahman");
    /* The first letter survives so a user can tell two of their own addresses
       apart in the panel. Anything more would be a partial disclosure. */
    expect(value.startsWith("a")).toBe(true);
  });

  test("a phone keeps four digits, so a user can recognise it, and no more", () => {
    const { value } = redactField("phone", "+971 50 123 4567");
    expect(value.endsWith("4567")).toBe(true);
    expect(value).not.toContain("971");
    expect(value).not.toContain("50 123");
  });

  /* A date of birth is not truncated: the last four characters of a date are a
     year, and a year plus a ward plus a diagnosis is a person. */
  test("a date of birth is removed entirely rather than truncated", () => {
    const { value } = redactField("dob", "1984-03-11");
    expect(value).not.toMatch(/\d/);
    expect(value).not.toContain("1984");
  });

  test("an Emirates ID and a passport are removed entirely", () => {
    expect(redactField("emiratesId", "784-1984-1234567-1").value).not.toMatch(/\d/);
    expect(redactField("passportNumber", "N1234567").value).not.toMatch(/\d/);
  });

  test("a medical record number keeps only its tail", () => {
    const { value } = redactField("mrn", "AV204581");
    expect(value.endsWith("4581")).toBe(true);
    expect(value).not.toContain("AV20");
  });

  /* The tail mask reveals the last four characters. On a value of four or
     fewer that is the whole thing, so the short case has to be special. */
  test("a value too short to mask is replaced, not returned", () => {
    expect(redactField("mrn", "12").value).not.toContain("12");
    expect(redactField("mrn", "1234").value).not.toContain("1234");
  });

  test("matching is by key and ignores case", () => {
    expect(redactField("Email", "a@b.com").redacted).toBe(true);
    expect(redactField("MRN", "AV204581").redacted).toBe(true);
    expect(redactField("customerPhone", "+971501234567").redacted).toBe(true);
  });

  /* Rules match on the key, never on the value. A customer whose name reads
     like an account number keeps their name, which is the whole reason the
     matcher is name-based. */
  test("a value that looks sensitive under an ordinary key is untouched", () => {
    expect(redactField("reference", "784-1984-1234567-1")).toEqual({
      value: "784-1984-1234567-1",
      redacted: false,
    });
  });

  test("an account, card or IBAN keeps only its tail", () => {
    expect(redactField("iban", "AE070331234567890123456").value).toMatch(/3456$/);
    expect(redactField("cardNumber", "4111111111111111").value).toMatch(/1111$/);
    expect(redactField("accountNumber", "00012345678").value).toMatch(/5678$/);
  });

  test("an empty value is not turned into mask characters", () => {
    /* Assembly drops empty fields before this is reached; if that ever stops
       being true, a field of bullets appearing on the panel out of nowhere is
       worse than an omitted one. */
    expect(redactField("status", "")).toEqual({ value: "", redacted: false });
  });
});

/* Separate from the "keeps its tail" tests above, which assert WHICH characters
   survive. This asserts HOW MANY, because those pass just as well against a
   mask that reveals six -- the earlier version of this file did, and a mask
   that quietly widens is the failure nobody would see. */
describe("the tail mask", () => {
  test("reveals exactly four characters and hides the rest", () => {
    const raw = "AE070331234567890123456";
    const revealed = redactField("iban", raw).value.replace(/^•+/, "");
    expect(revealed).toBe(raw.slice(-4));
    expect(revealed).toHaveLength(4);
  });

  test("does not reveal how long the original was", () => {
    /* Padding is capped at eight, so a 40-character account number and a
       12-character one mask to the same width. Length is not much of a leak on
       its own, but it is free to remove. */
    const short = redactField("accountNumber", "0001234567890").value;
    const long = redactField("accountNumber", `000${"1".repeat(40)}7890`).value;
    expect(long).toHaveLength(short.length);
  });
});

/**
 * The registry decides WHETHER a field is masked; the shape rules above decide
 * HOW. Before this, the two lists were independent and had drifted: the policy
 * classified `subjectName` as PHI and nothing in this file matched it, so a
 * subject's name reached the provider in full.
 */
describe("against the classification registry", () => {
  const sensitive = Object.entries(DATA_CLASSIFICATIONS)
    .filter(([, classification]) => classification === "phi" || classification === "pii" || classification === "credential")
    .map(([key]) => key);

  test("there is something to check", () => {
    expect(sensitive.length).toBeGreaterThan(10);
  });

  test.each(sensitive)("%s is masked, because the registry says it identifies someone", (key) => {
    const { value, redacted } = redactField(key, "Aisha Rahman 784-1984-1234567-1");
    expect(redacted).toBe(true);
    expect(value).not.toContain("Aisha");
    expect(value).not.toContain("1984");
  });

  const operational = Object.entries(DATA_CLASSIFICATIONS)
    .filter(([, classification]) => classification === "operational")
    .map(([key]) => key);

  test.each(operational)("%s is left alone, because it identifies nobody", (key) => {
    expect(redactField(key, "Overdue")).toEqual({ value: "Overdue", redacted: false });
  });

  /* Clinical content is NOT masked. The use case that reads a diagnosis exists
     to reason about the diagnosis; a masked one makes the feature pointless
     while protecting nobody, since the person it belongs to is already masked.
     It is governed by the clinical gate and its named-record confirmation
     instead -- and it still may not be written to a URL. */
  const clinical = Object.entries(DATA_CLASSIFICATIONS)
    .filter(([, classification]) => classification === "clinical")
    .map(([key]) => key);

  test.each(clinical)("%s stays legible, because the answer depends on it", (key) => {
    expect(redactField(key, "Community-acquired pneumonia")).toEqual({
      value: "Community-acquired pneumonia",
      redacted: false,
    });
  });

  test("the registry wins over a shape that happens to match", () => {
    /* `policy` is in the shape list because an insurance policy number is one.
       If a key were ever classified operational and still matched a shape, the
       classification is the decision and the shape is the guess. */
    expect(redactField("status", "policy")).toEqual({ value: "policy", redacted: false });
  });

  test("a key the registry has never heard of still meets the shape rules", () => {
    /* The registry cannot list every field on every future page, so an
       unclassified key is matched by name shape rather than waved through. */
    expect(redactField("beneficiaryIban", "AE070331234567890123456").redacted).toBe(true);
    expect(redactField("guardianPassport", "N1234567").redacted).toBe(true);
    expect(redactField("secondaryEmail", "a@b.com").redacted).toBe(true);
  });
});
