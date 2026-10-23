import ts from "typescript";
import {runInNewContext} from "node:vm";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const copy = JSON.parse(readFileSync(resolve(__dirname, "./rcm-copy.json"), "utf8")) as Record<string, string>;

describe("rcm-copy.json", () => {
  it("maps English literals to unique stable keys outside the canonical catalogs", () => {
    const keys = Object.values(copy);
    expect(Object.keys(copy).length).toBeGreaterThan(200);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^ui\.(reference\.rcm\.copy\.)?[a-z0-9.]+\.[0-9a-f]{8}$/.test(k))).toBe(true);
  });

  it("covers the copy a reader meets on every page and keeps the placeholders translators must preserve", () => {
    for (const text of ["Jump anywhere", "Today’s queues", "Age profile", "Ready for your decision", "Billed against collected", "Open work", "Page {value0} of {value1}", "Select an {value0} to work on it", "Independent decision: recorded against your name as the second person.", "Tax invoice", "Live monitor", "Good morning, {value0}", "All {value0} branches"]) expect(copy[text], text).toBeTruthy();
    expect(Object.keys(copy).filter((m) => /\{value\d+\}/.test(m)).length).toBeGreaterThan(40);
  });

  it("carries the API registry display labels (pages, statuses, fields, actions, branches) from the generated backend registry, and no record data", async () => {
    const source=readFileSync(resolve(process.cwd(), '../../dummy-api/rcm-source', 'src', 'registry.ts'),'utf8');
    const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const context={exports:{} as {RESOURCES:unknown[];CATEGORIES:unknown[]}};runInNewContext(output,context);
    const {RESOURCES,CATEGORIES}=context.exports;
    expect(RESOURCES).toHaveLength(36);
    const keys = new Set(readFileSync(resolve(__dirname, "lib/metadata-localization.ts"), "utf8").match(/DEFINITION_TEXT_KEYS=\[([^\]]*)\]/)![1]!.match(/[A-Za-z]+/g));
    const labels: string[] = [];
    const walk = (v: unknown, k = ""): void => { if (Array.isArray(v)) v.forEach((x) => walk(x)); else if (v && typeof v === "object") Object.entries(v).forEach(([a, b]) => walk(b, a)); else if (typeof v === "string" && keys.has(k) && /[A-Za-z]{2,}/.test(v)) labels.push(v); };
    walk(RESOURCES); walk(CATEGORIES);
    expect(labels.length).toBeGreaterThan(500);
    expect(labels.filter((l) => !copy[l])).toEqual([]);
    for (const l of ["Front office", "Mark verified", "Needs verification"]) expect(copy[l], l).toMatch(/^ui\.(reference\.rcm\.copy\.)?[a-z0-9.]+\.[0-9a-f]{8}$/);
  });

  it("holds no sign-in, actor switching, localhost or storage-engine wording from the source", () => {
    expect(Object.keys(copy).join("\n")).not.toMatch(/Demo sign-in|Switch person|Switch people|npm run dev|port 4100|localhost|SQLite/i);
  });

  it("is current with the sources", () => {
    for(const language of ['en','ar','hi','ml']) {const catalog=JSON.parse(readFileSync(resolve(process.cwd(), '../../dummy-api/config/localization/shared/'+language+'.json'),'utf8')).messages;for(const [literal,key] of Object.entries(copy)){expect(catalog[key],literal).toBeTruthy();expect([...catalog[key].matchAll(/\{value\d+\}/g)].map(m=>m[0]!).sort()).toEqual([...literal.matchAll(/\{value\d+\}/g)].map(m=>m[0]!).sort());}}
  }, 60_000);
});
