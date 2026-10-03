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
const SCOPED = /^(?:\[data-reduced-motion="true"\] )?(?::where\(\.reference-rcm\)|\.reference-rcm)(?![\w-])/;

describe("generated scoped styles", () => {
  it("contains the RCM design: its component classes and its Tailwind 3 palette utilities, with the source hex values", () => {
    for (const selector of [".reference-rcm.reference-rcm .btn-primary", ".reference-rcm.reference-rcm .btn-approve", ".reference-rcm.reference-rcm .input", ".reference-rcm.reference-rcm .panel", ".reference-rcm.reference-rcm .kbd", ".reference-rcm.reference-rcm .bg-harbor-900", ".reference-rcm.reference-rcm .text-saffron-700", ".reference-rcm.reference-rcm .bg-madder-600", ".reference-rcm.reference-rcm .bg-signal-50"]) expect(selectors, selector).toContain(selector);
    expect(rules.length).toBeGreaterThan(300);
    expect(css).toContain("rgb(16 36 62 / var(--tw-bg-opacity, 1))");
    expect(css).toContain("--rc-canvas:#EDF0F4");
    expect(css).toContain("--rc-line:#D6DCE4");
  });

  it("scopes every selector; html/body/:root become the scope and nothing is document-wide", () => {
    expect(selectors.filter((s) => !SCOPED.test(s))).toEqual([]);
    expect(selectors.filter((s) => /^(html|body|:root|\*)/.test(s))).toEqual([]);
    expect(css).toContain(".reference-rcm.reference-rcm :focus-visible");
    expect(css).toContain(".reference-rcm.reference-rcm ::selection");
  });

  it("has no global at-rules, no remote fonts and no document-wide print or page rules", () => {
    const at = new Set<string>(); root.walkAtRules((r) => { at.add(r.name); });
    for (const forbidden of ["page", "property", "layer", "import", "font-face", "charset", "tailwind"]) expect(at.has(forbidden), forbidden).toBe(false);
    expect(css).not.toMatch(/url\(\s*["']?https?:|fonts\.googleapis|\.next/);
  });

  it("keeps preflight at zero specificity so host and shared component classes win ties", () => {
    expect(selectors.filter((s) => /^\.reference-rcm \./.test(s) && !/\[data-|^\.reference-rcm (input|select|textarea|table)/.test(s))).toEqual([]);
    const preflight = selectors.filter((s) => s.startsWith(":where(.reference-rcm)"));
    expect(preflight.length).toBeGreaterThan(10);
    expect(preflight.some((s) => s.includes(":where(button)"))).toBe(true);
    expect(selectors.every((s) => !/:where\([^)]*::/.test(s))).toBe(true);
  });

  it("namespaces keyframes and animations", () => {
    const names: string[] = []; root.walkAtRules(/keyframes$/, (r) => { names.push(r.params); });
    expect(names).toEqual(expect.arrayContaining(["rcm-drawer-in", "rcm-fade-in", "rcm-toast-in", "rcm-pulse-soft", "rcm-spin"]));
    expect(names.filter((n) => !n.startsWith("rcm-"))).toEqual([]);
    root.walkDecls(/^animation(-name)?$/, (d) => { if (d.value !== "none" && !d.important) expect(d.value).toMatch(/rcm-/); });
  });

  it("follows the host font scale, radius and font, and keeps the source palette as the default look", () => {
    const sizes: string[] = []; const radii: string[] = [];
    root.walkDecls("font-size", (d) => { sizes.push(d.value); });
    root.walkDecls(/^border(-(top|bottom)-(left|right))?-radius$/, (d) => { radii.push(d.value); });
    expect(sizes.filter((v) => /^-?[\d.]+(rem|px)$/.test(v))).toEqual([]);
    expect(radii.filter((v) => /[\d.]+(rem|px)/.test(v) && !v.includes("var(--radius") && !/9999px|^0/.test(v))).toEqual([]);
    // original families are the default; the host font only under an explicit non-default font preference
    expect(css).toMatch(/\.font-display \{[^}]*Bricolage Grotesque/);
    expect(css).toMatch(/\.reference-rcm \{[^}]*font-family: "Public Sans"/);
    expect(css).toContain('.reference-rcm.reference-rcm[data-rcm-font="host"]');
    expect(css).not.toMatch(/fonts\.googleapis/);
    // the brand colours are never routed through host tokens
    expect(css).toMatch(/\.reference-rcm\.reference-rcm \.bg-signal-500 \{[^}]*rgb\(34 166 179/);
    expect(css).toMatch(/\.reference-rcm\.reference-rcm \.text-jade-700 \{[^}]*rgb\(22 96 74/);
    expect(css).not.toMatch(/\.reference-rcm\.reference-rcm \.bg-signal-500 \{[^}]*var\(--rc-/);
  });

  it("routes the source neutrals through variables that equal the source values under light themes and follow the host under dark themes", () => {
    expect(css).toContain("color-mix(in srgb, var(--rc-surface)");
    expect(css).toContain(".reference-rcm table{--fs-scale:var(--fs-result, 1)}");
    for (const theme of ["midnight", "graphite", "plum", "nord"]) expect(css).toContain(`.reference-rcm[data-theme="${theme}"]`);
    expect(css).toMatch(/\[data-theme="nord"\]\{[^}]*--rc-surface:var\(--surface/);
    expect(css).toContain(".reference-rcm[data-overlay]");
    expect(css).toContain("rgb(255 255 255 / 0.2)");
  });

  it("hands the original cell geometry back to the cells while table preferences are at their defaults, and leaves non-default density/wrapping to the host", () => {
    expect(css).toContain('[data-rcm-table="reference"] table[data-managed-table="true"] > :is(thead, tbody, tfoot) > tr > :is(th, td)');
    expect(css).toContain("--rcm-cell-pt");
    expect(css).toMatch(/\.reference-rcm\.reference-rcm \.py-2 \{[^}]*--rcm-cell-pt: 0\.5rem/);
    expect(css).not.toMatch(/data-density="(compact|spacious)"/);
    expect(css).toContain('[data-reduced-motion="true"] .reference-rcm *');
  });

  it("matches what scripts/rcm/styles.mjs generates from the retained source design", () => {
    const out = execFileSync(process.execPath, ["scripts/rcm/styles.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("styles.css is current");
  }, 60_000);
});
