#!/usr/bin/env node
/* Generates the scoped utility section of src/school.module.css.

   The Scholaris source defined Tailwind theme colours (bg-brand, text-muted, border-line …) in its own globals.css.
   This package may not import Tailwind or change the host theme, so every such class used in src/ is emitted here as
   plain CSS scoped under the module root and bound to host preference tokens. Standard utilities (flex, gap-2 …)
   are compiled by the host's Tailwind build (it must @source this package). Font-size and radius utilities are
   re-bound to --fs-scale and --radius so the font-scale and corner-radius preferences reach source markup.

   Usage: node scripts/generate-token-css.mjs [--check] */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "src", "school.module.css");
const START = "/* @generated:start — node scripts/generate-token-css.mjs */";
const END = "/* @generated:end */";

const COLORS = ["brand-fg", "rail-muted", "rail-hover", "rail-fg", "canvas", "surface", "subtle", "line", "fg", "muted", "faint", "brand", "rail", "ok", "warn", "bad", "info"];
/* Solid backgrounds and text use the host's contrast-checked fill/ink tokens; tints mix the accent. */
const SOLID_BG = { brand: "var(--brand-fill)", ok: "var(--ok-fill)", bad: "var(--bad-fill)" };
const INK = { brand: "var(--brand-ink)", ok: "var(--ok-ink)", warn: "var(--warn-ink)", bad: "var(--bad-ink)", info: "var(--info-ink)" };
const PREFIX = {
  bg: ["background-color"], text: ["color"], border: ["border-color"], "border-t": ["border-top-color"], "border-b": ["border-bottom-color"],
  "border-l": ["border-left-color"], "border-r": ["border-right-color"], "border-x": ["border-left-color", "border-right-color"],
  "border-y": ["border-top-color", "border-bottom-color"], ring: ["--tw-ring-color"], "ring-offset": ["--tw-ring-offset-color"],
  divide: ["border-color"], fill: ["fill"], stroke: ["stroke"], outline: ["outline-color"], accent: ["accent-color"], caret: ["caret-color"],
  decoration: ["text-decoration-color"], shadow: ["--tw-shadow-color"],
};
const SIZES = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30 };
/* Source radii at the 14px default radius: sm 2px, (none) 4px, md 6px, lg 8px, xl 12px. */
const RADII = { "rounded-sm": 0.15, rounded: 0.3, "rounded-md": 0.45, "rounded-lg": 0.6, "rounded-xl": 0.85, "rounded-2xl": 1.15 };
const MEDIA = { sm: "40rem", md: "48rem", lg: "64rem", xl: "80rem", "2xl": "96rem" };
const PSEUDO = { hover: ":hover", focus: ":focus", "focus-visible": ":focus-visible", "focus-within": ":focus-within", active: ":active", disabled: ":disabled", first: ":first-child", last: ":last-child", odd: ":nth-child(odd)", even: ":nth-child(even)", empty: ":empty" };

const colorRe = new RegExp(`^(${Object.keys(PREFIX).sort((a, b) => b.length - a.length).join("|")})-(${COLORS.join("|")})(?:/(\\d+|\\[[0-9.]+\\]))?$`);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    /* test-support holds unit-test fixtures and fake hosts, never rendered markup. */
    if (name === "test-support") return [];
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function escape(cls) {
  return cls.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function colorValue(prefix, color, alpha) {
  const base = `var(--${color})`;
  if (alpha !== undefined) {
    const pct = alpha.startsWith("[") ? Number(alpha.slice(1, -1)) * 100 : Number(alpha);
    return `color-mix(in oklab, ${base} ${+pct.toFixed(2)}%, transparent)`;
  }
  if (prefix === "bg" && SOLID_BG[color]) return SOLID_BG[color];
  if (prefix === "text" && INK[color]) return INK[color];
  return base;
}

/** Declarations for a bare utility, or null when this generator does not own it. */
function declarations(utility) {
  const color = colorRe.exec(utility);
  if (color) {
    const [, prefix, name, alpha] = color;
    const value = colorValue(prefix, name, alpha);
    return { decls: PREFIX[prefix].map((p) => `${p}: ${value}`), divide: prefix === "divide" };
  }
  const px = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(utility);
  if (px) return { decls: [`font-size: calc(${px[1]}px * var(--fs-scale))`] };
  const named = /^text-(xs|sm|base|lg|xl|2xl|3xl)$/.exec(utility);
  if (named) return { decls: [`font-size: calc(${SIZES[named[1]]}px * var(--fs-scale))`] };
  if (utility in RADII) return { decls: [`border-radius: calc(var(--radius) * ${RADII[utility]})`] };
  const side = /^(rounded-[tblr])(?:-(sm|md|lg|xl))?$/.exec(utility);
  if (side) {
    const factor = RADII[side[2] ? `rounded-${side[2]}` : "rounded"];
    const corners = { t: ["top-left", "top-right"], b: ["bottom-left", "bottom-right"], l: ["top-left", "bottom-left"], r: ["top-right", "bottom-right"] }[side[1].slice(-1)];
    return { decls: corners.map((c) => `border-${c}-radius: calc(var(--radius) * ${factor})`) };
  }
  return null;
}

function rule(cls) {
  const parts = cls.split(":");
  const utility = parts.pop();
  const own = declarations(utility);
  if (!own) return null;
  let media = null;
  let pseudo = "";
  let group = "";
  for (const v of parts) {
    if (MEDIA[v]) media = `@media (width >= ${MEDIA[v]})`;
    else if (v.startsWith("max-") && MEDIA[v.slice(4)]) media = `@media (width < ${MEDIA[v.slice(4)]})`;
    else if (PSEUDO[v]) pseudo += PSEUDO[v];
    else if (v === "group-hover") group = ":global(.group):hover ";
    else if (v === "placeholder") pseudo += "::placeholder";
    else return { unsupported: cls };
  }
  const target = `${group}:global(.${escape(cls)})${pseudo}${own.divide ? " > :not(:last-child)" : ""}`;
  const body = `.root ${target} { ${own.decls.join("; ")}; }`;
  return { media, body };
}

const tokens = new Set();
for (const file of files(join(root, "src"))) {
  const text = readFileSync(file, "utf8");
  /* Class-looking tokens inside string literals/template text. A false positive only adds an unused rule. */
  for (const m of text.matchAll(/[A-Za-z0-9:\-[\]./_]+/g)) {
    const token = m[0].replace(/^[:.]+|[.]+$/g, "");
    if (token.includes("-") || token.startsWith("rounded")) tokens.add(token);
  }
}

const plain = [];
const media = new Map();
const unsupported = [];
for (const token of [...tokens].sort()) {
  const r = rule(token);
  if (!r) continue;
  if (r.unsupported) { unsupported.push(r.unsupported); continue; }
  if (r.media) media.set(r.media, [...(media.get(r.media) ?? []), r.body]);
  else plain.push(r.body);
}
const order = Object.values(MEDIA).flatMap((w) => [`@media (width < ${w})`, `@media (width >= ${w})`]);
const generated = [
  START,
  ...plain,
  ...[...media.entries()].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([m, rules]) => `${m} {\n${rules.map((r) => `  ${r}`).join("\n")}\n}`),
  END,
].join("\n");

const css = readFileSync(cssPath, "utf8");
const from = css.indexOf(START);
const to = css.indexOf(END);
if (from < 0 || to < 0) throw new Error(`Markers missing in ${cssPath}`);
const next = css.slice(0, from) + generated + css.slice(to + END.length);
if (unsupported.length) console.warn(`Unsupported variants (no rule emitted): ${unsupported.join(", ")}`);
if (process.argv.includes("--check")) {
  if (next !== css) { console.error("school.module.css is out of date; run: node scripts/generate-token-css.mjs"); process.exit(1); }
  console.log(`school.module.css up to date (${plain.length + [...media.values()].flat().length} scoped rules).`);
} else {
  writeFileSync(cssPath, next);
  console.log(`Wrote ${plain.length + [...media.values()].flat().length} scoped rules to src/school.module.css.`);
}
