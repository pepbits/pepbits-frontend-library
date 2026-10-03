import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = resolve(__dirname);
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const runtime = walk(src).filter((f) => /\.tsx?$/.test(f) && !/\.test\.|\/test-utils\./.test(f));
/** Code without comments: the rules below are about what runs, and comments may name what was removed. */
const read = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}])\/\/[^\n]*/g, "$1");

describe("what the frontend must not carry from the source", () => {
  it("has no seed record ids: counters, departments, practitioners and the rest come from the backend", () => {
    const hits = runtime.flatMap((f) => [...read(f).matchAll(/["'`](ctr|dep|pr|pk|pay|net|plan|tpa|ward|doc|pat|enc|ep|case)-[a-z0-9-]+["'`]/g)].map((m) => `${f.slice(src.length + 1)}: ${m[0]}`));
    expect(hits).toEqual([]);
  });

  it("names no demonstration patient, hospital data or fixed currency", () => {
    const text = runtime.map(read).join("\n");
    for (const forbidden of [/\bJames\b|\bDaniel\b|\bEmma\b|\bAisha\b|\bRahul\b/, /meet\.example\.health/, /Intl\.NumberFormat\([^)]*USD/, /currency:\s*["']USD["']/, /resetDemo|admin\/reset|Reset demo/i, /["'`](x-actor-id|authorization)["'`]/i]) expect(text, String(forbidden)).not.toMatch(forbidden);
  });

  it("never touches next/*, an iframe, document-wide storage other than the scoped counter, or module-level master registries", () => {
    const text = runtime.map(read).join("\n");
    expect(text).not.toMatch(/from "next\/|<iframe|\bsetMasterData\b|export const (PAYERS|TPAS|NETWORKS|PLANS|DEPARTMENTS|PRACTITIONERS|WARDS|COMPLAINTS|COUNTERS)\b/);
    const storage = runtime.filter((f) => /localStorage|sessionStorage/.test(read(f))).map((f) => f.slice(src.length + 1));
    expect(storage).toEqual(["lib/store.tsx"]);
  });

  it("builds every request through the host transport: no fetch, XMLHttpRequest or absolute URL in the runtime", () => {
    const text = runtime.map(read).join("\n");
    expect(text).not.toMatch(/\bfetch\(|XMLHttpRequest|new WebSocket|["'`]https?:\/\/(?!www\.w3\.org|["'`])/);
    expect(runtime.filter((f) => /\.request[<(]|host\.request/.test(read(f))).map((f) => f.slice(src.length + 1)).sort()).toEqual(["lib/api.ts", "lib/store.tsx"]);
  });

  it("converts every route link to the module-relative resolver: no hand-built record paths", () => {
    const hits = runtime.filter((f) => !/(routes|lib\/api)\.ts$/.test(f)).flatMap((f) => [...read(f).matchAll(/`\/(patients|encounters|admissions|episodes)[^`]*`/g)].map((m) => `${f.slice(src.length + 1)}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
});
