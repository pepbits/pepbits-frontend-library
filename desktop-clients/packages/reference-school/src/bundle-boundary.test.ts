import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/* Everything the public entry ("@pepbits/reference-school") can reach through relative imports. Seeds, question banks
   and generators exist only as fictional unit-test fixtures under test-support; the backend owns real and demo data. */
const src = dirname(fileURLToPath(import.meta.url));
function graph(entry: string) {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:import|export)[^"']*?from\s+["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g)) {
      const spec = m[1] ?? m[2]!;
      if (spec.endsWith(".css")) continue;
      const base = resolve(dirname(file), spec);
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find((f) => { try { return readFileSync(f) && !f.endsWith("/"); } catch { return false; } });
      if (!found) throw new Error(`Unresolved ${spec} from ${file}`);
      visit(found);
    }
  };
  visit(join(src, entry));
  return [...seen].map((f) => f.slice(src.length + 1));
}

describe("main bundle boundary", () => {
  const files = graph("index.ts");
  test("the public module reaches every page but no fixture or test code", () => {
    expect(files).toContain("pages/quiz-player.tsx");
    expect(files).toContain("pages/live-room.tsx");
    expect(files.length).toBeGreaterThan(50);
    expect(files.filter((f) => f.startsWith("test-support/") || f.includes("fixture") || f.includes("test"))).toEqual([]);
  });
  test("no mock data or generator identifiers are present in main code", () => {
    const text = files.map((f) => readFileSync(join(src, f), "utf8")).join("\n");
    for (const banned of ["QUESTION_BANK", "mulberry32", "DEMO_USERS", "seedSchoolFixture", "SCHOOL_PROFILE", "REPLIES", "Northbridge", "Math.random() > 0"]) expect(text).not.toContain(banned);
  });
  test("the package exports no fixture subpath", () => {
    const pkg = JSON.parse(readFileSync(join(src, "..", "package.json"), "utf8")) as { exports: Record<string, string> };
    expect(Object.keys(pkg.exports)).toEqual(["."]);
  });
  test("test fixtures stay self-contained", () => {
    const fx = graph("test-support/fixtures/index.ts");
    expect(fx.some((f) => f.startsWith("pages/") || f.startsWith("ui/"))).toBe(false);
  });
});
