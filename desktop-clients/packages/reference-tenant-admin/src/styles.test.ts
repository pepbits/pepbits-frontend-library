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
const SCOPED = /^(?:\[data-reduced-motion="true"\] )?(?::where\(\.reference-tenant-admin\)|\.reference-tenant-admin)(?![\w-])/;

describe("generated scoped styles", () => {
  it("contains the Tenant Admin design: its component classes and its Tailwind 3 palette utilities", () => {
    for (const selector of [".reference-tenant-admin .btn-primary", ".reference-tenant-admin .input", ".reference-tenant-admin .panel", ".reference-tenant-admin .kbd", ".reference-tenant-admin .bg-spruce-900", ".reference-tenant-admin .text-saffron-700", ".reference-tenant-admin .bg-madder-600"]) expect(selectors, selector).toContain(selector);
    expect(rules.length).toBeGreaterThan(300);
    expect(css).toContain("rgb(14 47 44 / var(--tw-bg-opacity, 1))");
  });

  it("scopes every selector; html/body/:root become the scope and nothing is document-wide", () => {
    expect(selectors.filter((s) => !SCOPED.test(s))).toEqual([]);
    expect(selectors.filter((s) => /^(html|body|:root|\*)/.test(s))).toEqual([]);
    expect(css).toContain(".reference-tenant-admin :focus-visible");
    expect(css).toContain(".reference-tenant-admin ::selection");
  });

  it("has no global at-rules, no remote fonts and no document-wide print or page rules", () => {
    const at = new Set<string>(); root.walkAtRules((r) => { at.add(r.name); });
    for (const forbidden of ["page", "property", "layer", "import", "font-face", "charset", "tailwind"]) expect(at.has(forbidden), forbidden).toBe(false);
    expect(css).not.toMatch(/url\(\s*["']?https?:|fonts\.googleapis|\.next/);
  });

  it("keeps preflight at zero specificity so host and shared component classes win ties", () => {
    const preflight = selectors.filter((s) => s.startsWith(":where(.reference-tenant-admin)"));
    expect(preflight.length).toBeGreaterThan(10);
    expect(preflight.some((s) => s.includes(":where(button)"))).toBe(true);
    expect(selectors.every((s) => !/:where\([^)]*::/.test(s))).toBe(true);
  });

  it("namespaces keyframes and animations", () => {
    const names: string[] = []; root.walkAtRules(/keyframes$/, (r) => { names.push(r.params); });
    expect(names).toEqual(expect.arrayContaining(["tenant-admin-fade-in", "tenant-admin-toast-in", "tenant-admin-spin", "tenant-admin-pulse"]));
    expect(names.filter((n) => !n.startsWith("tenant-admin-"))).toEqual([]);
    root.walkDecls(/^animation(-name)?$/, (d) => { if (d.value !== "none" && !d.important) expect(d.value).toMatch(/tenant-admin-/); });
  });

  it("follows the host font scale, radius and font, and routes the source neutrals through variables", () => {
    const sizes: string[] = []; const radii: string[] = [];
    root.walkDecls("font-size", (d) => { sizes.push(d.value); });
    root.walkDecls(/^border(-(top|bottom)-(left|right))?-radius$/, (d) => { radii.push(d.value); });
    expect(sizes.filter((v) => /^-?[\d.]+(rem|px)$/.test(v))).toEqual([]);
    expect(radii.filter((v) => /[\d.]+(rem|px)/.test(v) && !v.includes("var(--radius") && !/9999px|^0/.test(v))).toEqual([]);
    expect(css).toContain("var(--font-ui");
    expect(css).not.toMatch(/Public Sans|Bricolage/);
    expect(css).toContain("--ta-canvas:#ECF0EE");
    expect(css).toContain("color-mix(in srgb, var(--ta-surface)");
    expect(css).toContain(".reference-tenant-admin table{--fs-scale:var(--fs-result, 1)}");
  });

  it("applies the host tokens under dark host themes and honours reduced motion and the overlay scope", () => {
    expect(css).toContain('.reference-tenant-admin[data-theme="midnight"]');
    expect(css).toMatch(/\[data-theme="nord"\]\{[^}]*--ta-surface:var\(--surface/);
    expect(css).toContain('[data-reduced-motion="true"] .reference-tenant-admin *');
    expect(css).toContain(".reference-tenant-admin[data-overlay]");
  });

  it("matches what scripts/tenant-admin/styles.mjs generates from the retained source design", () => {
    const out = execFileSync(process.execPath, ["scripts/tenant-admin/styles.mjs", "--check"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
    expect(out).toContain("styles.css is current");
  }, 60_000);
});
