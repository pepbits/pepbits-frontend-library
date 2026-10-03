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
const SCOPED = /^(?:\[data-reduced-motion="true"\] )?(?::where\(\.reference-medband\)|\.reference-medband)(?![\w-])/;

describe("generated scoped styles", () => {
  it("contains the MedBand design: its bespoke classes and its Tailwind 4 utilities", () => {
    for (const selector of [".reference-medband.reference-medband .scroll-thin", ".reference-medband.reference-medband .barcode", ".reference-medband.reference-medband .animate-rise", ".reference-medband.reference-medband .bg-scrub-700", ".reference-medband.reference-medband .bg-band", ".reference-medband.reference-medband .shadow-lift"]) expect(selectors, selector).toContain(selector);
    expect(rules.length).toBeGreaterThan(300);
  });

  it("scopes every selector; html/body/:root become the scope and nothing is document-wide", () => {
    expect(selectors.filter((s) => !SCOPED.test(s))).toEqual([]);
    expect(selectors.filter((s) => /^(html|body|:root|\*)/.test(s))).toEqual([]);
    expect(css).toContain(".reference-medband.reference-medband :focus-visible");
    expect(css).toContain(".reference-medband.reference-medband ::selection");
    expect(css).not.toMatch(/height:\s*100%[^}]*\}\s*\.reference-medband\s*\{[^}]*body/);
  });

  it("has no global at-rules and no OS-only reduced-motion media block (the host preference decides)", () => {
    const at = new Set<string>(); root.walkAtRules((r) => { at.add(r.name); });
    for (const forbidden of ["page", "property", "layer", "import", "font-face", "charset"]) expect(at.has(forbidden), forbidden).toBe(false);
    const media: string[] = []; root.walkAtRules("media", (m) => { media.push(m.params); });
    expect(media.filter((m) => /prefers-reduced-motion|print/.test(m))).toEqual([]);
    expect(css).not.toMatch(/url\(\s*["']?https?:|fonts\.googleapis|\.next/);
  });

  it("keeps preflight at zero specificity so host and shared component classes win ties", () => {
    const preflight = selectors.filter((s) => s.startsWith(":where(.reference-medband)"));
    expect(preflight.length).toBeGreaterThan(10);
    expect(preflight.some((s) => s.includes(":where(button)"))).toBe(true);
    expect(selectors.every((s) => !/:where\([^)]*::/.test(s))).toBe(true);
  });

  it("prefixes keyframes and animations", () => {
    const names: string[] = []; root.walkAtRules(/keyframes$/, (r) => { names.push(r.params); });
    expect(names).toEqual(expect.arrayContaining(["medband-rise", "medband-fade", "medband-slide-in"]));
    expect(names.filter((n) => !n.startsWith("medband-"))).toEqual([]);
    root.walkDecls(/^(animation(-name)?|--animate-.*)$/, (d) => { if (d.value !== "none" && !d.important && !d.value.startsWith("var(--animate-")) expect(d.value).toMatch(/medband-/); });
  });

  it("follows the host font scale, radius and font tokens", () => {
    const sizes: string[] = []; const radii: string[] = [];
    root.walkDecls("font-size", (d) => { sizes.push(d.value); });
    root.walkDecls(/^--text-(?!.*line-height)/, (d) => { sizes.push(d.value); });
    root.walkDecls(/^(--radius-|border(-(top|bottom)-(left|right))?-radius$)/, (d) => { radii.push(d.value); });
    expect(sizes.filter((v) => /^-?[\d.]+(rem|px)$/.test(v))).toEqual([]);
    // rectangular corners follow --radius; the wristband's full pill (999px) and rounded-full are shapes, not corners
    expect(radii.filter((v) => /[\d.]+(rem|px)/.test(v) && !v.includes("var(--radius") && !/^(999|9999)px|infinity|^0/.test(v))).toEqual([]);
    expect(css).toContain("var(--font-ui");
    expect(css).toContain("--fs-scale:var(--fs-shell, 1)");
  });

  it("keeps the exact source palette and fonts by default and re-expresses them on the host tokens only under the host opt-ins", () => {
    // default: literal source values (teal scrub family, ink, canvas, wristband yellow) and the source font stack
    const scope = rules.find((r) => r.selector === ".reference-medband" && r.some((n) => n.type === "decl" && n.prop === "--color-scrub-500"))!;
    const own = (rule: Rule) => Object.fromEntries(rule.nodes.filter((n) => n.type === "decl").map((n) => [(n as postcss.Declaration).prop, (n as postcss.Declaration).value]));
    expect(own(scope)).toMatchObject({ "--color-ink": "#15232b", "--color-canvas": "#e9eeec", "--color-paper": "#ffffff", "--color-line": "#d5dedb", "--color-scrub-500": "#1f7a8c", "--color-scrub-700": "#0e4c58", "--color-scrub-900": "#082a31", "--color-band": "#f2c230" });
    expect(own(scope)["--font-sans"]).toBe('"Public Sans Variable", "Segoe UI", system-ui, -apple-system, sans-serif');
    expect(own(scope)["--font-mono"]).toMatch(/Liberation Mono/);
    // host opt-ins
    const host = rules.find((r) => r.selector === '.reference-medband[data-medband-palette="host"]')!;
    expect(own(host)).toMatchObject({ "--color-ink": "var(--text,#15232b)", "--color-canvas": "var(--bg,#e9eeec)", "--color-paper": "var(--surface,#ffffff)", "--color-line": "var(--border,#d5dedb)", "--color-scrub-500": "var(--primary,#1f7a8c)" });
    expect(own(host)["--color-band"]).toBeUndefined();
    const font = rules.find((r) => r.selector === '.reference-medband[data-medband-font="host"]')!;
    expect(own(font)["--font-sans"]).toContain("var(--font-ui");
    // nothing but the host palette block may name a host colour token
    const leaking = rules.filter((r) => r !== host && r.nodes.some((n) => n.type === "decl" && /var\(--(primary|bg|surface|text|border)[,)]/.test(n.value)));
    expect(leaking.map((r) => r.selector)).toEqual([]);
  });

  it("orders the flattened cascade layers as the original does: base, then utilities (the base focus radius must not beat rounded-*)", () => {
    const at = (selector: string) => rules.findIndex((r) => r.selector === selector);
    expect(at(".reference-medband.reference-medband :focus-visible")).toBeGreaterThan(-1);
    expect(at(".reference-medband.reference-medband :focus-visible")).toBeLessThan(at(".reference-medband.reference-medband .rounded-lg"));
    expect(at(".reference-medband.reference-medband .scroll-thin")).toBeLessThan(at(".reference-medband.reference-medband .rounded-lg"));
  });

  it("gives utilities double scope specificity so shared host rules (.library-preferences .rounded-* / .text-*) cannot flatten the source geometry", () => {
    expect(selectors.filter((s) => /\.rounded-(lg|xl|2xl|md)$/.test(s)).sort()).toEqual([".reference-medband.reference-medband .rounded-2xl", ".reference-medband.reference-medband .rounded-lg", ".reference-medband.reference-medband .rounded-md", ".reference-medband.reference-medband .rounded-xl"]);
  });

  it("honours the host reduced-motion preference and the overlay scope, and sizes tables from the result scale", () => {
    expect(css).toContain('[data-reduced-motion="true"] .reference-medband *');
    expect(css).toContain(".reference-medband[data-overlay]");
    expect(css).toContain(".reference-medband table{--fs-scale:var(--fs-result, 1);");
    expect(css).toContain(".reference-medband input,.reference-medband select,.reference-medband textarea{--fs-scale:var(--fs-form, 1)}");
  });

  it("matches what scripts/medband/styles.mjs generates from the retained source design", () => {
    const out = execFileSync(process.execPath, ["scripts/medband/styles.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("styles.css is current");
  }, 60_000);

  it("the retained source design is the original MedBand stylesheet", () => {
    const design = readFileSync(resolve(__dirname, "../../../scripts/medband/source-design/globals.css"), "utf8");
    expect(design).toContain("--color-scrub-700: #0e4c58;");
    expect(design).toContain("@keyframes slide-in");
  });
});
