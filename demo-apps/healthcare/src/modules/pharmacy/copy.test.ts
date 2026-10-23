
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const copy = JSON.parse(readFileSync(resolve(__dirname, "./pharmacy-copy.json"), "utf8")) as Record<string, string>;

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

  it("preserves canonical placeholders and explicitly records inherited catalog gaps", () => {
    for(const language of ['en','ar','hi','ml']) {
      const catalog=JSON.parse(readFileSync(resolve(process.cwd(), '../../dummy-api/config/localization/shared/'+language+'.json'),'utf8')).messages;
      expect(Object.entries(copy).filter(([,key])=>!catalog[key]).map(([literal])=>literal)).toEqual(['Configuration', 'Pharmacy, people, appearance']);
      for(const [literal,key] of Object.entries(copy)) {
        if(!catalog[key])continue;
        expect([...catalog[key].matchAll(/\{value\d+\}/g)].map(m=>m[0]).sort(),key).toEqual([...literal.matchAll(/\{value\d+\}/g)].map(m=>m[0]).sort());
      }
    }
  });
});
