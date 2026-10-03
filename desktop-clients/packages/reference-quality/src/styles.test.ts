import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "styles.css"), "utf8");
const root = postcss.parse(css);
const rules: Rule[] = [];
root.walkRules((rule) => { if (!(rule.parent as AtRule | undefined)?.name?.endsWith("keyframes")) rules.push(rule); });
const selectors = rules.flatMap((rule) => rule.selectors);
/** The repository parity gate accepts exactly these shapes. */
const SCOPED = /^(?:\[data-reduced-motion="true"\] )?(?::where\(\.reference-quality\)|\.reference-quality)(?![\w-])/;

describe("generated scoped styles", () => {
  it("contains the source design and its Tailwind 4 utilities", () => {
    expect(selectors).toContain(".reference-quality .data-table th");
    expect(selectors.some((s) => s.startsWith(".reference-quality .bg-primary"))).toBe(true);
    expect(css).toContain("--color-primary: #0e6b5c");
    expect(rules.length).toBeGreaterThan(300);
  });

  it("scopes every selector; html/body/:root become the scope and nothing is document-wide", () => {
    expect(selectors.filter((s) => !SCOPED.test(s))).toEqual([]);
    expect(selectors.filter((s) => /^(html|body|:root|\*)/.test(s))).toEqual([]);
    expect(css).toContain(".reference-quality :focus-visible");
    expect(css).toContain(".reference-quality ::selection");
  });

  it("has no global at-rules: no @page, @property, @layer, @import or @font-face", () => {
    const at = new Set<string>(); root.walkAtRules((r) => { at.add(r.name); });
    for (const forbidden of ["page", "property", "layer", "import", "font-face", "charset"]) expect(at.has(forbidden)).toBe(false);
    expect(css).not.toMatch(/url\(\s*["']?https?:/);
    expect(css).not.toMatch(/\.next|fonts\.googleapis/);
  });

  it("keeps preflight at zero specificity so host and shared component classes win ties", () => {
    const preflight = selectors.filter((s) => s.startsWith(":where(.reference-quality)"));
    expect(preflight.length).toBeGreaterThan(10);
    expect(preflight.some((s) => s.includes(":where(button)"))).toBe(true);
    expect(selectors.every((s) => !/:where\([^)]*::/.test(s))).toBe(true);
  });

  it("scopes print rules and drops the document-wide page box", () => {
    const printRules: string[] = [];
    root.walkAtRules("media", (m) => { if (m.params === "print") m.walkRules((r) => { printRules.push(...r.selectors); }); });
    expect(printRules).toContain(".reference-quality .no-print");
    expect(printRules.every((s) => SCOPED.test(s))).toBe(true);
  });

  it("prefixes keyframes and animations", () => {
    const names: string[] = []; root.walkAtRules(/keyframes$/, (r) => { names.push(r.params); });
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names.filter((n) => !n.startsWith("quality-"))).toEqual([]);
    root.walkDecls(/^(animation(-name)?|--animate-.*)$/, (d) => { if (d.value !== "none" && !d.important && !d.value.startsWith("var(--animate-")) expect(d.value).toMatch(/quality-/); });
  });

  it("reads the host font scale, radius, font and theme tokens, with source colors as fallback", () => {
    const sizes: string[] = []; const radii: string[] = [];
    root.walkDecls("font-size", (d) => { sizes.push(d.value); });
    root.walkDecls(/^--text-(?!.*line-height)/, (d) => { sizes.push(d.value); });
    root.walkDecls(/^(--radius-|border(-(top|bottom)-(left|right))?-radius$)/, (d) => { radii.push(d.value); });
    expect(sizes.filter((v) => /^-?[\d.]+(rem|px)$/.test(v))).toEqual([]);
    expect(radii.filter((v) => /[\d.]+(rem|px)/.test(v) && !v.includes("var(--radius") && !/9999px|infinity|^0/.test(v))).toEqual([]);
    expect(css).toContain("var(--font-ui");
    expect(css).toContain("--color-surface:var(--bg,#f4f7f6)");
    expect(css).toContain("--color-panel:var(--surface,#ffffff)");
    expect(css).toContain("--color-ink:var(--text,#102a34)");
    expect(css).toContain("--color-line:var(--border,#dde5e3)");
    expect(css).toContain("--color-primary: #0e6b5c"); // status hues keep the source palette
  });

  it("re-derives soft tints for dark host themes and honours density, reduced motion and the overlay scope", () => {
    expect(css).toContain('.reference-quality[data-theme="midnight"]');
    expect(css).toContain("--color-ok-soft:color-mix(");
    expect(css).toContain('[data-reduced-motion="true"] .reference-quality *');
    expect(css).toContain(".reference-quality[data-overlay]");
    expect(css).toContain(".reference-quality table{--fs-scale:var(--fs-result, 1)}");
  });

  it("matches what scripts/quality/styles.mjs generates from the retained source design", () => {
    const out = execFileSync(process.execPath, ["scripts/quality/styles.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("styles.css is current");
  }, 60_000);
});
