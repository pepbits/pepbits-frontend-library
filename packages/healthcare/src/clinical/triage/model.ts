import type {VitalsPayload} from "../vitals/model";

/** Emergency Severity Index level, 1 (most urgent) to 5. */
export type EsiLevel = 1 | 2 | 3 | 4 | 5;
export const ESI_LEVELS: EsiLevel[] = [1, 2, 3, 4, 5];

/** Expected resources at decision C: none, one, or two or more. */
export type EsiResources = 0 | 1 | 2;

/** The nurse's answers to the ESI decision points; `null` is not yet answered. */
export interface EsiDecisions {
  lifeSaving: boolean | null;
  highRisk: boolean | null;
  confusedLethargic: boolean | null;
  severePain: boolean | null;
  resources: EsiResources | null;
}
export const EMPTY_ESI: EsiDecisions = {lifeSaving: null, highRisk: null, confusedLethargic: null, severePain: null, resources: null};

/** A changed level needs a reason; an empty level keeps the calculated one. */
export interface EsiOverride { level: EsiLevel | null; reason: string }
export const NO_OVERRIDE: EsiOverride = {level: null, reason: ""};

/** Everything the triage section holds before saving. */
export interface TriageValue { decisions: EsiDecisions; override: EsiOverride; area: string }
export const EMPTY_TRIAGE: TriageValue = {decisions: EMPTY_ESI, override: NO_OVERRIDE, area: ""};

/** `POST /encounters/esi/preview`: the calculated level (null until enough is answered), the steps taken and the danger-zone flag. */
export interface EsiPreview { level: EsiLevel | null; steps: string[]; dangerZone: boolean }

/** Areas a triaged patient can be sent to. */
export const EMERGENCY_AREAS = ["Resuscitation", "Majors", "Minors", "Paediatrics", "Fast track"] as const;

/** The B questions, shown once decision A is answered No. */
export const ESI_B_QUESTIONS: {key: "highRisk" | "confusedLethargic" | "severePain"; label: string}[] = [
  {key: "highRisk", label: "High-risk situation?"},
  {key: "confusedLethargic", label: "New confusion, lethargy or disorientation?"},
  {key: "severePain", label: "Severe pain or distress (7/10 or more)?"},
];

/** Decision B applies once A is No. */
export const esiAsksB = (d: EsiDecisions) => d.lifeSaving === false;
/** Decision C (resources) applies once every A and B answer is No. */
export const esiAsksC = (d: EsiDecisions) => esiAsksB(d) && ESI_B_QUESTIONS.every(q => d[q.key] === false);

/**
 * Changing an earlier answer clears the answers below it that no longer apply, so a hidden
 * decision is never sent.
 */
export function withEsiAnswer<K extends keyof EsiDecisions>(d: EsiDecisions, key: K, value: EsiDecisions[K]): EsiDecisions {
  const next = {...d, [key]: value};
  if (!esiAsksB(next)) for (const q of ESI_B_QUESTIONS) next[q.key] = null;
  if (!esiAsksC(next)) next.resources = null;
  return next;
}

/**
 * The preview request body, as the AllyVora workspace sends it: answered decisions, age in years
 * and the heart rate, respiratory rate and SpO₂ used for the danger-zone check. Unanswered and
 * unmeasured values are left out.
 */
export function esiInputs(d: EsiDecisions, ageYears: number | undefined, vitals: Pick<VitalsPayload, "hr" | "rr" | "spo2">): Record<string, unknown> {
  const all: Record<string, unknown> = {...d, ageYears, hr: vitals.hr, rr: vitals.rr, spo2: vitals.spo2};
  return Object.fromEntries(Object.entries(all).filter(([, value]) => value !== null && value !== undefined));
}

/** The level that will be saved: the override when one is chosen, otherwise the calculated level. */
export const finalEsiLevel = (calculated: EsiLevel | null | undefined, override: EsiOverride): EsiLevel | null => override.level ?? calculated ?? null;

/** Triage problems to fix before saving, after the intake problems. */
export function triageProblems(value: TriageValue, calculated: EsiLevel | null | undefined): string[] {
  const problems: string[] = [];
  if (!finalEsiLevel(calculated, value.override)) problems.push("Complete the triage decision points.");
  if (value.override.level && !value.override.reason.trim()) problems.push("Give a reason for changing the calculated triage level.");
  return problems;
}

/** The `esi` and `disposition` parts of the intake payload. */
export interface TriagePayload {
  esi: {lifeSaving?: boolean; highRisk?: boolean; confusedLethargic?: boolean; severePain?: boolean; resources?: EsiResources; overrideLevel?: EsiLevel; overrideReason?: string};
  disposition?: {area: string};
}

export function triagePayload(value: TriageValue): TriagePayload {
  const {decisions: d, override, area} = value;
  return {
    esi: {lifeSaving: d.lifeSaving ?? undefined, highRisk: d.highRisk ?? undefined, confusedLethargic: d.confusedLethargic ?? undefined, severePain: d.severePain ?? undefined,
      resources: d.resources ?? undefined, overrideLevel: override.level ?? undefined, overrideReason: override.reason || undefined},
    disposition: area ? {area} : undefined,
  };
}
