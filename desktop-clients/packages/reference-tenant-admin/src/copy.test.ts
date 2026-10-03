import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const copy = JSON.parse(readFileSync(resolve(__dirname, "../tenant-admin-copy.json"), "utf8")) as Record<string, string>;

describe("tenant-admin-copy.json", () => {
  it("maps English literals to unique stable keys outside the canonical catalogs", () => {
    const keys = Object.values(copy);
    expect(Object.keys(copy).length).toBeGreaterThan(200);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^ui\.(reference\.tenantadmin\.copy\.)?[a-z0-9.]+\.[0-9a-f]{8}$/.test(k))).toBe(true);
  });

  it("covers the copy a reader meets on every page and keeps the placeholders translators must preserve", () => {
    for (const text of ["Jump to a page", "Awaiting approval", "Activation path", "Approve this version", "Return for changes", "Test route selection", "Ctrl+S saves. Esc closes.", "Showing {value0}–{value1} of {value2}", "Page {value0} of {value1}"]) expect(copy[text], text).toBeTruthy();
    expect(Object.keys(copy).filter((m) => /\{value\d+\}/.test(m)).length).toBeGreaterThan(40);
  });

  it("holds no sign-in, actor switching, localhost or storage-engine wording from the source", () => {
    expect(Object.keys(copy).join("\n")).not.toMatch(/Demo sign-in|Switch people|npm run dev|port 4000|localhost|SQLite/i);
  });

  it("is current with the sources", () => {
    const out = execFileSync(process.execPath, ["scripts/tenant-admin/copy.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("is current");
  }, 60_000);
});
