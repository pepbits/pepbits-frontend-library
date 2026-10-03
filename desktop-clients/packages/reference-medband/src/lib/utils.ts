import { clsx, type ClassValue } from "clsx";
import type { Coverage, Patient } from "./types";

/**
 * The source's `cx` is `twMerge(join)`: a later Tailwind utility removes an earlier one of the same group and variants
 * (h-10 then h-8 gives h-8), and a later shorthand removes the earlier longhands it sets (p-4 drops px-2; size-4 drops h-8). tailwind-merge
 * is not a dependency of this package, so this is a faithful resolver for the utilities the design uses. Unknown classes are
 * never removed (as in twMerge). Keep the groups apart that twMerge keeps apart: `ring-1` (width) and `ring-scrub-500` (colour),
 * `shadow-sm` (size) and `shadow-lift` (a colour-like name to twMerge), `text-[13px]` and `text-ink`, `font-semibold` and `font-mono`, `gap-4` and `gap-y-2`.
 * `cx.test.ts` replays every `cx(...)` call of the original source through the real tailwind-merge when it is installed.
 */
const SIDES = ["t", "r", "b", "l"];
const T = String.raw`(?:xs|sm|base|lg|xl|[2-9]xl)`;
const NUM = String.raw`(?:\d[\d.]*|px|\[[^\]]+\]|auto|full|screen|min|max|fit|svh|lvh|dvh|\d+/\d+)`;
/** [group, test on the utility without variants/negative/important]; first match wins. */
const GROUPS: Array<[string, RegExp]> = [
  ["display", /^(block|inline-block|inline|flex|inline-flex|table|inline-table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row-group|table-row|flow-root|grid|inline-grid|contents|list-item|hidden)$/],
  ["position", /^(static|fixed|absolute|relative|sticky)$/],
  ["inset-x", /^inset-x-/], ["inset-y", /^inset-y-/], ["inset", /^inset-/],
  ["top", /^top-/], ["right", /^right-/], ["bottom", /^bottom-/], ["left", /^left-/], ["z", /^z-/], ["scroll-m", /^scroll-m-/], ["scroll-mt", /^scroll-mt-/],
  ["overflow-x", /^overflow-x-/], ["overflow-y", /^overflow-y-/], ["overflow", /^overflow-(auto|hidden|clip|visible|scroll)$/], ["line-clamp", /^line-clamp-/],
  ["size", /^size-/], ["w", /^w-/], ["h", /^h-/], ["min-w", /^min-w-/], ["max-w", /^max-w-/], ["min-h", /^min-h-/], ["max-h", /^max-h-/],
  ["px", /^px-/], ["py", /^py-/], ["pt", /^pt-/], ["pr", /^pr-/], ["pb", /^pb-/], ["pl", /^pl-/], ["p", /^p-/],
  ["mx", /^mx-/], ["my", /^my-/], ["mt", /^mt-/], ["mr", /^mr-/], ["mb", /^mb-/], ["ml", /^ml-/], ["m", /^m-/],
  ["space-x", /^space-x-/], ["space-y", /^space-y-/], ["gap-x", /^gap-x-/], ["gap-y", /^gap-y-/], ["gap", /^gap-/],
  ["flex-direction", /^flex-(row|row-reverse|col|col-reverse)$/], ["flex-wrap", /^flex-(wrap|wrap-reverse|nowrap)$/], ["flex", /^flex-(1|auto|initial|none|\[.+\])$/],
  ["basis", /^basis-/], ["grow", /^grow(-|$)/], ["shrink", /^shrink(-|$)/], ["grid-cols", /^grid-cols-/], ["grid-rows", /^grid-rows-/], ["col-span", /^col-(span|start|end)-/], ["row-span", /^row-(span|start|end)-/],
  ["items", /^items-/], ["justify", /^justify-/], ["content", /^content-/], ["self", /^self-/], ["place-items", /^place-items-/],
  ["rounded-tl", /^rounded-tl(-|$)/], ["rounded-tr", /^rounded-tr(-|$)/], ["rounded-br", /^rounded-br(-|$)/], ["rounded-bl", /^rounded-bl(-|$)/],
  ["rounded-t", /^rounded-t(-|$)/], ["rounded-r", /^rounded-r(-|$)/], ["rounded-b", /^rounded-b(-|$)/], ["rounded-l", /^rounded-l(-|$)/], ["rounded", /^rounded(-|$)/],
  ["border-style", /^border-(solid|dashed|dotted|double|hidden|none)$/],
  ["border-w-x", /^border-x(-(0|2|4|8|\[\d[\d.]*px\]))?$/], ["border-w-y", /^border-y(-(0|2|4|8|\[\d[\d.]*px\]))?$/],
  ...SIDES.map((x): [string, RegExp] => [`border-w-${x}`, new RegExp(`^border-${x}(-(0|2|4|8|\\[\\d[\\d.]*px\\]))?$`)]),
  ["border-w", /^border(-(0|2|4|8|\[\d[\d.]*px\]))?$/],
  ["border-color-x", /^border-x-/], ["border-color-y", /^border-y-/], ...SIDES.map((x): [string, RegExp] => [`border-color-${x}`, new RegExp(`^border-${x}-`)]),
  ["border-color", /^border-/],
  ["divide-y", /^divide-y(-|$)/], ["divide-x", /^divide-x(-|$)/], ["divide-color", /^divide-(?!x|y)/],
  ["font-size", new RegExp(String.raw`^text-(?:${T}|\[(?:length:)?\d[\d.]*(?:px|rem|em|%)?\])$`)],
  ["text-alignment", /^text-(left|center|right|justify|start|end)$/], ["text-wrap", /^text-(wrap|nowrap|balance|pretty)$/],
  ["text-overflow", /^(truncate|text-ellipsis|text-clip)$/], ["text-color", /^text-/],
  ["font-weight", /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\d+)$/], ["font-family", /^font-/],
  ["leading", /^leading-/], ["tracking", /^tracking-/], ["whitespace", /^whitespace-/], ["break", /^break-/],
  ["font-style", /^(italic|not-italic)$/], ["text-decoration", /^(underline|overline|line-through|no-underline)$/], ["text-transform", /^(uppercase|lowercase|capitalize|normal-case)$/],
  ["bg-size", /^bg-(auto|cover|contain|\[length:.+\])$/], ["bg-repeat", /^bg-(repeat|no-repeat|repeat-x|repeat-y)$/], ["bg-position", /^bg-(center|top|bottom|left|right|\[position:)/], ["bg-image", /^bg-(none|gradient-|linear-|\[url)/], ["bg-color", /^bg-/],
  ["shadow", /^shadow(-(sm|md|lg|xl|2xl|inner|none|\[\d.*\]))?$/], ["shadow-color", /^shadow-/],
  ["ring-inset", /^ring-inset$/], ["ring-offset-w", /^ring-offset-(0|1|2|4|8|\[\d[\d.]*px\])$/], ["ring-offset-color", /^ring-offset-/], ["ring-w", /^ring(-(0|1|2|4|8|\[\d[\d.]*px\]))?$/], ["ring-color", /^ring-/],
  ["opacity", /^opacity-/], ["transition", /^transition(-|$)/], ["duration", /^duration-/], ["ease", /^ease-/], ["delay", /^delay-/], ["animate", /^animate-(none|spin|ping|pulse|bounce)$/], ["hyphens", /^hyphens-/], ["appearance", /^appearance-/], ["decoration-color", /^decoration-(?!solid|double|dotted|dashed|wavy|auto|from-font|\d)/],
  ["cursor", /^cursor-/], ["select", /^select-/], ["pointer-events", /^pointer-events-/], ["resize", /^resize(-|$)/], ["outline-style", /^outline(-(none|dashed|dotted|double))?$/], ["outline-color", /^outline-/],
  ["translate-x", /^translate-x-/], ["translate-y", /^translate-y-/], ["scale", /^scale-/], ["rotate", /^rotate-/],
  ["backdrop-blur", /^backdrop-blur(-|$)/], ["blur", /^blur(-|$)/], ["sr", /^(sr-only|not-sr-only)$/],
  ["object-fit", /^object-(contain|cover|fill|none|scale-down)$/], ["aspect", /^aspect-/], ["order", /^order-/],
];
/** A later group removes these earlier ones (what a shorthand sets). */
const CONFLICTS: Record<string, string[]> = {
  inset: ["inset-x", "inset-y", "top", "right", "bottom", "left"], "inset-x": ["right", "left"], "inset-y": ["top", "bottom"],
  overflow: ["overflow-x", "overflow-y"], "line-clamp": ["overflow", "display"], size: ["w", "h"],
  p: ["px", "py", "pt", "pr", "pb", "pl"], px: ["pr", "pl"], py: ["pt", "pb"], m: ["mx", "my", "mt", "mr", "mb", "ml"], mx: ["mr", "ml"], my: ["mt", "mb"],
  gap: ["gap-x", "gap-y"], rounded: ["rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
  "rounded-t": ["rounded-tl", "rounded-tr"], "rounded-r": ["rounded-tr", "rounded-br"], "rounded-b": ["rounded-br", "rounded-bl"], "rounded-l": ["rounded-tl", "rounded-bl"],
  "border-w": ["border-w-x", "border-w-y", "border-w-t", "border-w-r", "border-w-b", "border-w-l"], "border-w-x": ["border-w-r", "border-w-l"], "border-w-y": ["border-w-t", "border-w-b"],
  "border-color": ["border-color-x", "border-color-y", "border-color-t", "border-color-r", "border-color-b", "border-color-l"], "border-color-x": ["border-color-r", "border-color-l"], "border-color-y": ["border-color-t", "border-color-b"],
  "font-size": ["leading"], flex: ["basis", "grow", "shrink"],
};
/** Splits `hover:md:-mt-2!` into variants, the important flag and the bare utility; a colon inside [] is not a variant separator. */
function parse(cls: string) {
  const parts: string[] = []; let depth = 0, last = 0;
  for (let i = 0; i < cls.length; i++) { const ch = cls[i]; if (ch === "[") depth++; else if (ch === "]") depth--; else if (ch === ":" && depth === 0) { parts.push(cls.slice(last, i)); last = i + 1; } }
  let base = cls.slice(last), important = false;
  if (base.startsWith("!")) { important = true; base = base.slice(1); } else if (base.endsWith("!")) { important = true; base = base.slice(0, -1); }
  return { variants: parts.sort().join(":") + (important ? "!" : ""), base: base.replace(/^-(?=[a-z])/, "") };
}
const groupOf = (base: string): string | null => { for (const [group, re] of GROUPS) if (re.test(base)) return group; return null; };
export const cx = (...parts: ClassValue[]) => {
  const tokens = clsx(parts).split(/\s+/).filter(Boolean);
  const taken = new Set<string>();
  const kept: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const { variants, base } = parse(tokens[i]);
    const group = groupOf(base);
    if (group === null) { kept.push(tokens[i]); continue; }
    const id = `${variants}|${group}`;
    if (taken.has(id)) continue;
    taken.add(id);
    for (const c of CONFLICTS[group] ?? []) taken.add(`${variants}|${c}`);
    kept.push(tokens[i]);
  }
  return kept.reverse().join(" ");
};

/** A client-chosen id for a record the backend validates but does not issue (a new coverage row in the editor). */
export const uid = (prefix = "id") => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const fullName = (p: Pick<Patient, "firstName" | "middleName" | "lastName">) =>
  [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");

export const initials = (p: Pick<Patient, "firstName" | "lastName">) =>
  `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();

/** Whole years, or whole months under two. Arithmetic only: the displayed form (with units) is useMedbandFormat().ageOf. */
export function ageParts(dob: string, at = new Date()): { unit: "y" | "m"; value: number } | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let years = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) years--;
  if (years >= 2) return { unit: "y", value: years };
  const months = (at.getFullYear() - d.getFullYear()) * 12 + m - (at.getDate() < d.getDate() ? 1 : 0);
  return { unit: "m", value: Math.max(months, 0) };
}

/** Native date/time inputs keep their machine-value contract (yyyy-mm-dd, yyyy-mm-ddThh:mm). Display goes through the host formatter. */
export const toDateInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const toDateTimeInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${toDateInput(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const daysBetween = (a: Date, b: Date) =>
  Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export const coverageActive = (c: Coverage, at = new Date()) => {
  const d = toDateInput(at);
  return c.validFrom <= d && d <= c.validTo;
};

export const normalize = (s: string) => s.toLowerCase().replace(/[\s\-()+]/g, "");
