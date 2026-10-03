import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const copy = JSON.parse(readFileSync(resolve(__dirname, "../pharmacy-copy.json"), "utf8")) as Record<string, string>;

describe("pharmacy-copy.json", () => {
  it("maps English literals to unique stable keys outside the canonical catalogs", () => {
    const keys = Object.values(copy);
    expect(Object.keys(copy).length).toBeGreaterThan(500);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^ui\.(reference\.pharmacy\.copy\.)?[a-z0-9.]+\.[0-9a-f]{8}$/.test(k))).toBe(true);
    expect(keys.filter((k) => k.startsWith("ui.reference.pharmacy.copy.")).length).toBeGreaterThan(keys.length / 2);
  });

  it("covers the copy a reader meets on every page and keeps the placeholders translators must preserve", () => {
    for (const text of ["Command center", "Rx workbench", "Counter sale", "Customer orders", "Prior authorizations", "Remittance & payments", "Demonstration data", "Prescriptions in the pharmacy now", "Part supplied", "Packed"]) expect(copy[text], text).toBeTruthy();
    const withValues = Object.keys(copy).filter((m) => /\{value\d+\}/.test(m));
    expect(withValues.length).toBeGreaterThan(100);
    expect(withValues.every((m) => !/\{value\d+\}\{value\d+\}/.test(m))).toBe(true);
  });

  it("holds no sign-in, user switching or localhost wording from the source", () => {
    const text = Object.keys(copy).join("\n");
    expect(text).not.toMatch(/Switch user|demo sign-in|port 4000|localhost/i);
  });

  it("is current with the sources", () => {
    const out = execFileSync(process.execPath, ["scripts/pharmacy/copy.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("is current");
  }, 60_000);
});
