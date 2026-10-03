import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const copy = JSON.parse(readFileSync(resolve(__dirname, "../quality-copy.json"), "utf8")) as Record<string, string>;

describe("quality-copy.json", () => {
  it("maps English literals to unique stable quality.* keys outside the canonical catalogs", () => {
    const keys = Object.values(copy);
    expect(Object.keys(copy).length).toBeGreaterThan(400);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^quality\.[a-z0-9.]+\.[0-9a-f]{8}$/.test(k))).toBe(true);
  });

  it("keeps placeholders the translator must preserve", () => {
    expect(copy["Prepared {value0} to replace this submission."]).toBeTruthy();
    expect(copy["Managed by the host sign-in"]).toBeTruthy();
    expect(copy["Dashboard"]).toBeTruthy();
  });

  it("is current with the sources", () => {
    const out = execFileSync(process.execPath, ["scripts/quality/copy.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("is current");
  }, 60_000);
});
