import type {Codesets, PainInput, PainScale, PainSite, PainAssessmentInput} from "../models/consult-records";
export const displayCode = (codes: Codesets | null, system: string, code: string) => codes?.[system]?.find(c => c.code === code)?.display ?? code;
export const siteKey = (s: Pick<PainSite, "part" | "side" | "aspect">) => `${s.part}|${s.side}|${s.aspect}`;
export function siteLabel(codes: Codesets | null, s: Pick<PainSite, "part" | "side" | "aspect">) {
  return [displayCode(codes, "body-side", s.side), displayCode(codes, "body-part", s.part), s.aspect ? `(${displayCode(codes, "body-aspect", s.aspect)})` : ""].filter(Boolean).join(" ");
}
export const emptySite = (part: string, side: string, aspect = "", extra: Partial<PainSite> = {}): PainSite => ({part, side, aspect, score: null, characters: [], pattern: "", radiating: false, radiatesTo: "", note: "", ...extra});
export const bandFor = (scale: PainScale, score: number) => score <= scale.bands.none ? "none" : score <= scale.bands.mild ? "mild" : score <= scale.bands.moderate ? "moderate" : "severe";
export function painTotal(scale: PainScale | undefined, value: PainInput): number | undefined {
  if (!scale) return undefined;
  if (!scale.items.length) return value.score;
  if (!scale.items.every(item => item.options.some(option => option.score === value.items[item.key]))) return undefined;
  return scale.items.reduce((sum, item) => sum + value.items[item.key]!, 0);
}
export function painErrors(scale: PainScale | undefined, input: PainInput, sites: PainSite[], goal: string) {
  const total = painTotal(scale, input), errors: string[] = [];
  if (!scale || total === undefined || !Number.isFinite(total) || total < scale.min || total > scale.max || (!scale.items.length && !scale.choices.includes(total))) errors.push("Complete the pain scale before saving.");
  if (scale && !scale.items.length && sites.length > 1 && total !== undefined && sites.some(s => s.score != null && s.score > total)) errors.push("The overall score is lower than the worst site. Raise the overall score.");
  if (scale && goal.trim() && (!Number.isFinite(Number(goal)) || Number(goal) < scale.min || Number(goal) > scale.max)) errors.push("The pain goal must be within the selected scale.");
  return errors;
}
export function painPayload(value: PainInput, scale: PainScale, sites: PainSite[], details: PainAssessmentInput["details"], goal: string): PainAssessmentInput {
  return {...value, details: {...details, sites: sites.map(({label: _label, ...site}) => ({...site, score: scale.items.length ? null : sites.length > 1 ? site.score ?? null : value.score ?? null}))}, ...(goal.trim() ? {goal: Number(goal)} : {})};
}

/** Historic details are extensible JSON. Read only the known site fields rather than trusting a cast. */
export function painSitesOf(details?: Record<string, unknown>): Pick<PainSite, "part" | "side" | "aspect" | "score">[] {
  if (!Array.isArray(details?.sites)) return [];
  return details.sites.flatMap((site: unknown) => {
    if (!site || typeof site !== "object") return [];
    const s = site as Record<string, unknown>;
    return typeof s.part === "string" && typeof s.side === "string" && typeof s.aspect === "string"
      ? [{part: s.part, side: s.side, aspect: s.aspect, score: typeof s.score === "number" && Number.isFinite(s.score) ? s.score : null}] : [];
  });
}
