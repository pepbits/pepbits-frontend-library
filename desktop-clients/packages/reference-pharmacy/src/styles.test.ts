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
const SCOPED = /^(?:\[data-reduced-motion="true"\] )?(?::where\(\.reference-pharmacy\)|\.reference-pharmacy)(?![\w-])/;

describe("generated scoped styles", () => {
  it("contains the Phial design: its bespoke classes and its Tailwind 4 utilities", () => {
    for (const selector of [".reference-pharmacy .num", ".reference-pharmacy .scroll-y", ".reference-pharmacy .chain-rule", ".reference-pharmacy .anim-pop", ".reference-pharmacy .bg-cobalt"]) expect(selectors, selector).toContain(selector);
    expect(rules.length).toBeGreaterThan(300);
  });

  it("scopes every selector; html/body/:root become the scope and nothing is document-wide", () => {
    expect(selectors.filter((s) => !SCOPED.test(s))).toEqual([]);
    expect(selectors.filter((s) => /^(html|body|:root|\*)/.test(s))).toEqual([]);
    expect(css).toContain(".reference-pharmacy :focus-visible");
    expect(css).toContain(".reference-pharmacy ::selection");
  });

  it("has no global at-rules and drops the source's document-wide print block", () => {
    const at = new Set<string>(); root.walkAtRules((r) => { at.add(r.name); });
    for (const forbidden of ["page", "property", "layer", "import", "font-face", "charset"]) expect(at.has(forbidden), forbidden).toBe(false);
    const printed: string[] = []; root.walkAtRules("media", (m) => { if (/print/.test(m.params)) printed.push(m.params); });
    expect(printed).toEqual([]);
    expect(css).not.toContain("print-area");
    expect(css).not.toMatch(/url\(\s*["']?https?:|fonts\.googleapis|\.next/);
  });

  it("keeps preflight at zero specificity so host and shared component classes win ties", () => {
    const preflight = selectors.filter((s) => s.startsWith(":where(.reference-pharmacy)"));
    expect(preflight.length).toBeGreaterThan(10);
    expect(preflight.some((s) => s.includes(":where(button)"))).toBe(true);
    expect(selectors.every((s) => !/:where\([^)]*::/.test(s))).toBe(true);
  });

  it("prefixes keyframes and animations", () => {
    const names: string[] = []; root.walkAtRules(/keyframes$/, (r) => { names.push(r.params); });
    expect(names).toEqual(expect.arrayContaining(["pharmacy-pop-in", "pharmacy-slide-in-right", "pharmacy-pulse-dot"]));
    expect(names.filter((n) => !n.startsWith("pharmacy-"))).toEqual([]);
    root.walkDecls(/^(animation(-name)?|--animate-.*)$/, (d) => { if (d.value !== "none" && !d.important && !d.value.startsWith("var(--animate-")) expect(d.value).toMatch(/pharmacy-/); });
  });

  it("follows the host font scale, radius, font and theme tokens, with the source colours as fallback", () => {
    const sizes: string[] = []; const radii: string[] = [];
    root.walkDecls("font-size", (d) => { sizes.push(d.value); });
    root.walkDecls(/^--text-(?!.*line-height)/, (d) => { sizes.push(d.value); });
    root.walkDecls(/^(--radius-|border(-(top|bottom)-(left|right))?-radius$)/, (d) => { radii.push(d.value); });
    expect(sizes.filter((v) => /^-?[\d.]+(rem|px)$/.test(v))).toEqual([]);
    expect(radii.filter((v) => /[\d.]+(rem|px)/.test(v) && !v.includes("var(--radius") && !/9999px|infinity|^0/.test(v))).toEqual([]);
    expect(css).toContain("var(--font-ui");
    expect(css).toContain("--canvas:var(--bg,#eef1f6)");
    expect(css).toContain("--ink:var(--text,#172036)");
    expect(css).toContain("--cobalt:var(--primary,#2a4bd7)");
  });

  it("never redefines the host's own --surface or --danger tokens inside the module", () => {
    const hostOwned: string[] = [];
    root.walkDecls(/^--(surface|surface-2|surface-3|danger)$/, (d) => { hostOwned.push(`${(d.parent as Rule).selector} ${d.prop}`); });
    expect(hostOwned).toEqual([]);
  });

  it("switches to the source's dark palette under dark host themes and honours reduced motion and the overlay scope", () => {
    expect(css).toContain('.reference-pharmacy[data-theme="midnight"]');
    expect(css).toMatch(/\[data-theme="nord"\]\{[^}]*--ok-wash:#11301f/);
    expect(css).toContain('[data-reduced-motion="true"] .reference-pharmacy *');
    expect(css).toContain(".reference-pharmacy[data-overlay]");
    expect(css).toContain(".reference-pharmacy table{--fs-scale:var(--fs-result, 1)}");
  });

  it("matches what scripts/pharmacy/styles.mjs generates from the retained source design", () => {
    const out = execFileSync(process.execPath, ["scripts/pharmacy/styles.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("styles.css is current");
  }, 60_000);
});
