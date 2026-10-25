import { encounterType } from "./encounter-config";
import { department } from "./master-data";
import type { Encounter } from "./types";
import { daysBetween } from "./utils";

export type FollowUpState = "none" | "free" | "chargeable" | "not-applicable";

export interface FollowUpResult {
  state: FollowUpState;
  parent?: Encounter;
  daysSince?: number;
  windowDays: number;
  freeAllowed: number;
  used: number;
  sameDoctor: boolean;
  /** Earlier consultations a user may link manually, newest first. */
  candidates: Encounter[];
  message: string;
}

/** The follow-up window runs from discharge for admissions, otherwise from the visit date. */
const anchorDate = (e: Encounter) => new Date(e.end && (e.type === "IP" || e.type === "DAY_CARE") ? e.end : e.start);

/**
 * Derives whether a new visit is a follow-up.
 * Rule: the patient had an index consultation in the same department within that
 * department's follow-up window. Free visits are counted per index consultation;
 * once used up, the follow-up is still linked but becomes chargeable.
 */
export function deriveFollowUp(
  encounters: Encounter[],
  args: { patientId?: string; departmentId?: string; practitionerId?: string; at: Date; excludeId?: string },
): FollowUpResult {
  const dept = department(args.departmentId);
  const base: FollowUpResult = {
    state: "none",
    windowDays: dept?.followUpDays ?? 0,
    freeAllowed: dept?.freeFollowUps ?? 0,
    used: 0,
    sameDoctor: false,
    candidates: [],
    message: "",
  };
  if (!args.patientId || !dept) return { ...base, message: "Choose a patient and department to check for follow-ups." };
  if (!dept.consults || dept.followUpDays === 0)
    return { ...base, state: "not-applicable", message: `${dept.name} does not run follow-up visits.` };

  const patientEncounters = encounters.filter(
    (e) => e.patientId === args.patientId && e.status !== "Cancelled" && e.id !== args.excludeId,
  );

  const candidates = patientEncounters
    .filter((e) => encounterType(e.type).isConsultation && e.departmentId === dept.id)
    .filter((e) => {
      const d = daysBetween(anchorDate(e), args.at);
      return d >= 0 && d <= dept.followUpDays;
    })
    .sort((a, b) => anchorDate(b).getTime() - anchorDate(a).getTime());

  const parent = candidates[0];
  if (!parent) {
    return {
      ...base,
      message: `No ${dept.name} consultation in the last ${dept.followUpDays} days, so this is a new visit.`,
    };
  }

  const used = patientEncounters.filter((e) => e.type === "FOLLOW_UP" && e.parentEncounterId === parent.id).length;
  const daysSince = daysBetween(anchorDate(parent), args.at);
  const sameDoctor = !args.practitionerId || args.practitionerId === parent.practitionerId;
  const chargeable = used >= dept.freeFollowUps;
  const left = Math.max(dept.freeFollowUps - used, 0);

  return {
    state: chargeable ? "chargeable" : "free",
    parent,
    daysSince,
    windowDays: dept.followUpDays,
    freeAllowed: dept.freeFollowUps,
    used,
    sameDoctor,
    candidates,
    message: chargeable
      ? `Within the ${dept.followUpDays}-day window, but all ${dept.freeFollowUps} free follow-ups are used. Bill as a paid follow-up.`
      : `${left} of ${dept.freeFollowUps} free follow-up${dept.freeFollowUps === 1 ? "" : "s"} left. Window closes in ${dept.followUpDays - daysSince} days.`,
  };
}

/** Index visits whose free follow-up window closes soon, for the worklist. */
export function followUpsDue(encounters: Encounter[], now: Date, horizonDays = 3) {
  return encounters
    .filter((e) => e.status !== "Cancelled" && encounterType(e.type).isConsultation)
    .map((e) => {
      const dept = department(e.departmentId);
      if (!dept || !dept.followUpDays || !dept.freeFollowUps) return null;
      const since = daysBetween(anchorDate(e), now);
      const left = dept.followUpDays - since;
      const used = encounters.filter((x) => x.parentEncounterId === e.id && x.status !== "Cancelled").length;
      if (since < 1 || left < 0 || left > horizonDays || used >= dept.freeFollowUps) return null;
      return { encounter: e, daysLeft: left, freeLeft: dept.freeFollowUps - used };
    })
    .filter((x): x is { encounter: Encounter; daysLeft: number; freeLeft: number } => !!x)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
