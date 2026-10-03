import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const copy = JSON.parse(readFileSync(resolve(__dirname, "../medband-copy.json"), "utf8")) as Record<string, string>;

describe("medband-copy.json", () => {
  it("maps English literals to unique stable keys outside the canonical catalogs", () => {
    const keys = Object.values(copy);
    expect(Object.keys(copy).length).toBeGreaterThan(500);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^ui\.(reference\.medband\.copy\.)?[a-z0-9.]+\.[0-9a-f]{8}$/.test(k))).toBe(true);
    expect(keys.filter((k) => k.startsWith("ui.reference.medband.copy.")).length).toBeGreaterThan(keys.length / 2);
  });

  it("covers the copy a reader meets on every page and keeps the placeholders translators must preserve", () => {
    for (const text of ["Who is at the desk?", "Find patient", "Register patient", "Emergency quick registration", "Each counter opens only the visit types it serves.", "Ready to admit", "Pending clearance", "Episodes of care", "In progress", "Outpatient", "Collect deposit", "Demonstration data", "Quick search"]) expect(copy[text], text).toBeTruthy();
    const withValues = Object.keys(copy).filter((m) => /\{value\d+\}/.test(m));
    expect(withValues.length).toBeGreaterThan(60);
    expect(withValues.every((m) => !/\{value\d+\}\{value\d+\}/.test(m))).toBe(true);
  });

  it("keeps one message per plural form, so the noun is never glued on in code", () => {
    for (const text of ["{value0} open episode", "{value0} open episodes", "{value0} thing left", "{value0} things left", "{value0} encounter", "{value0} encounters"]) expect(copy[text], text).toBeTruthy();
  });

  it("holds no reset, sign-in or invented-link wording from the source", () => {
    const text = Object.keys(copy).join("\n");
    expect(text).not.toMatch(/Reset demo data|Resetting|Reset the database|Create link|localhost/i);
  });

  it("is current with the sources", () => {
    const out = execFileSync(process.execPath, ["scripts/medband/copy.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("is current");
  }, 60_000);
});
