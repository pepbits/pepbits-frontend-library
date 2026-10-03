import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "styles.css"), "utf8");
const root = postcss.parse(css);
const rules: Rule[] = [];
root.walkRules((rule) => { if (!(rule.parent as AtRule | undefined)?.name?.endsWith("keyframes")) rules.push(rule); });
const selectors = rules.flatMap((rule) => rule.selectors);
/** The repository parity gate accepts only these two shapes. */
const SCOPED = /^(?:\[data-reduced-motion="true"\] )?\.teleconsult-(?:provider|patient)(?![\w-])/;

describe("generated scoped styles", () => {
  it("contains both source designs", () => {
    expect(selectors.some((s) => s.startsWith(".teleconsult-provider .bg-pulse-500"))).toBe(true);
    expect(selectors.some((s) => s.startsWith(".teleconsult-patient .bg-forest"))).toBe(true);
    expect(rules.length).toBeGreaterThan(500);
  });

  it("scopes every selector to a Teleconsult root, never a global element, :root or the document", () => {
    const leaked = selectors.filter((s) => !SCOPED.test(s));
    expect(leaked).toEqual([]);
    expect(selectors.filter((s) => /^(html|body|:root)\b/.test(s))).toEqual([]);
  });

  it("keeps preflight element selectors at zero extra weight so host and shared component classes win ties", () => {
    const preflight = selectors.filter((s) => /^\.teleconsult-(?:provider|patient) :where\(/.test(s));
    expect(preflight.length).toBeGreaterThan(20);
    expect(preflight).toContain(".teleconsult-provider :where(button)");
    expect(selectors.find((s) => s.startsWith(".teleconsult-provider .bg-pulse-500"))).toBeDefined();
    // Pseudo-elements cannot sit inside :where(); they stay plain scoped selectors.
    expect(selectors.every((s) => !/:where\([^)]*::/.test(s))).toBe(true);
  });

  it("prefixes every keyframe and animation so host animations cannot collide", () => {
    const names: string[] = [];
    root.walkAtRules(/keyframes$/, (rule) => { names.push(rule.params); });
    expect(names.length).toBeGreaterThanOrEqual(8);
    expect(names.filter((name) => !/^tc-(provider|patient)-/.test(name))).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
    root.walkDecls(/^animation(-name)?$/, (decl) => { if (!/^none$/.test(decl.value.trim()) && !decl.important) expect(decl.value).toMatch(/tc-(provider|patient)-/); });
  });

  it("reads the host font, font scale and radius instead of fixed values", () => {
    const sizes: string[] = [];
    const radii: string[] = [];
    root.walkDecls("font-size", (decl) => { sizes.push(decl.value); });
    root.walkDecls(/^border(-(top|bottom)-(left|right))?-radius$/, (decl) => { radii.push(decl.value); });
    const bare = sizes.filter((v) => !v.includes("--fs-scale") && v !== "inherit" && v !== "100%");
    expect(bare.filter((v) => /^-?[\d.]+(rem|px)$/.test(v))).toEqual([]);
    const fixedRadii = radii.filter((v) => /[\d.]+(rem|px)/.test(v) && !v.includes("var(--radius") && !/9999px|^0/.test(v));
    expect(fixedRadii).toEqual([]);
    expect(css).toContain("var(--font-ui");
  });

  it("follows host themes for provider neutrals and keeps the patient design as an isolated palette", () => {
    expect(css).toMatch(/\.teleconsult-provider \.text-ink \{[^}]*var\(--text\)/);
    expect(css).toMatch(/\.teleconsult-provider \.bg-canvas \{[^}]*var\(--bg\)/);
    expect(css).toMatch(/\.teleconsult-provider\.teleconsult-provider \.bg-white \{\s*background-color: var\(--surface\)/);
    expect(css).toMatch(/\.teleconsult-patient\.teleconsult-patient \.bg-white \{[^}]*rgb\(255 255 255/);
    expect(css).not.toMatch(/\.teleconsult-patient \.text-ink \{[^}]*var\(--text\)/);
  });

  it("honours reduced motion and density from the host and loads nothing external", () => {
    expect(css).toContain('[data-reduced-motion="true"] .teleconsult-provider *');
    expect(css).toContain('[data-reduced-motion="true"] .teleconsult-patient *');
    expect(css).toContain('.teleconsult-provider[data-density="compact"]');
    expect(css).not.toMatch(/@import|@font-face|url\(\s*["']?https?:/);
    expect(css).not.toMatch(/\.next|fonts\.googleapis/);
  });

  it("keeps the patient phone column a transform context so its fixed bars stay inside it", () => {
    expect(css).toMatch(/\.teleconsult-patient \.tc-phone\{[^}]*transform:translateZ\(0\)/);
  });

  it("bounds the whole patient module by the height the host leaves, not by a fixed phone height", () => {
    expect(css).toMatch(/\.teleconsult-patient\{[^}]*min-height:0;flex:1 1 0;height:auto/);
    const phone = /\.teleconsult-patient \.tc-phone\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(phone).toMatch(/flex:1 1 0/);
    expect(phone).toMatch(/min-height:0/);
    expect(phone).not.toMatch(/(?<!-)height:/);
    expect(phone).not.toMatch(/min\(calc\(100dvh/);
  });

  it("keeps the phone itself still and puts the page in an inner scroller, so fixed bottom navigation stays in view", () => {
    const phone = /\.teleconsult-patient \.tc-phone\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(phone).toMatch(/overflow:hidden/);
    expect(phone).not.toMatch(/overflow-y:auto/);
    expect(css).toMatch(/\.teleconsult-patient \.tc-phone-scroll\{[^}]*flex:1 1 0;[^}]*min-height:0;[^}]*overflow-y:auto/);
  });
});
