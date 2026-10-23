import type { WorkspaceLimits, WorkspacePresentation } from "./types.ts";

/**
 * Where a workspace rule can come from, outermost first.
 *
 * The same shape as the AI control plane's gates, and for the same reason: a
 * setting that can be widened at any level is not a policy, it is a suggestion.
 * Each level may only remove what an earlier one allowed.
 */
export const WORKSPACE_POLICY_LEVELS = ["platform", "shell", "module", "page", "role", "user"] as const;
export type WorkspacePolicyLevel = (typeof WORKSPACE_POLICY_LEVELS)[number];

/**
 * Levels that may narrow but never establish.
 *
 * If a user preference were allowed to be the first thing that names a set, it
 * would be defining what is permitted rather than choosing within it -- the
 * same escalation as widening, reached by leaving every other level silent.
 */
const NARROWING_ONLY = new Set<WorkspacePolicyLevel>(["role", "user"]);

export interface WorkspacePolicyRule {
  modes?: WorkspacePresentation[];
  limits?: Partial<WorkspaceLimits>;
  allowDetach?: boolean;
  allowDuplicate?: boolean;
}

export interface ResolvedWorkspacePolicy {
  modes: WorkspacePresentation[];
  limits: WorkspaceLimits;
  allowDetach: boolean;
  allowDuplicate: boolean;
  /** For each mode that was removed, the level that removed it. */
  deniedBy: Partial<Record<WorkspacePresentation, WorkspacePolicyLevel>>;
}

/**
 * Limits are a resource guard, not a permission, so an unconfigured limit is a
 * sane number rather than zero. Modes go the other way: unconfigured means
 * nothing is permitted, because a workspace nobody has configured must not
 * quietly allow detached windows on a tablet on the grounds that no file said
 * otherwise.
 */
export const DEFAULT_LIMITS: WorkspaceLimits = {
  maxOpenDocuments: 12,
  maxActiveDocuments: 2,
  maxSplitPanes: 2,
  maxDetachedWindows: 4,
  /* No cap by default. Suspending is a decision a shell makes about its own
     device and screens, and inventing one here would change the behaviour of
     every workspace that never asked for it. */
  maxWarmDocuments: Number.POSITIVE_INFINITY,
};

export function resolveWorkspacePolicy(rules: Partial<Record<WorkspacePolicyLevel, WorkspacePolicyRule>>): ResolvedWorkspacePolicy {
  let modes: WorkspacePresentation[] | null = null;
  const deniedBy: Partial<Record<WorkspacePresentation, WorkspacePolicyLevel>> = {};
  const limits: WorkspaceLimits = { ...DEFAULT_LIMITS };
  const spokenLimits = new Set<keyof WorkspaceLimits>();
  let allowDetach = false;
  let allowDuplicate = false;
  let detachSpoken = false;
  let duplicateSpoken = false;

  for (const level of WORKSPACE_POLICY_LEVELS) {
    const rule = rules[level];
    if (!rule) continue;

    if (rule.modes) {
      if (modes === null) {
        modes = NARROWING_ONLY.has(level) ? [] : [...rule.modes];
      } else {
        for (const mode of modes) {
          if (!rule.modes.includes(mode)) deniedBy[mode] = level;
        }
        modes = modes.filter((mode) => rule.modes!.includes(mode));
      }
    }

    if (rule.limits) {
      for (const [key, value] of Object.entries(rule.limits) as Array<[keyof WorkspaceLimits, number | undefined]>) {
        if (typeof value !== "number") continue;
        /* The first level entitled to establish sets the value outright; every
           level after it may only lower. Taking Math.min from the start would
           make DEFAULT_LIMITS a ceiling no configuration could exceed -- a
           platform asking for twenty open documents would get twelve, with
           nothing anywhere saying why. The defaults are a fallback for the
           unconfigured case, not a policy.

           A narrowing-only level never establishes, so a user preference can
           lower the cap below the default but never raise it past one. */
        if (!spokenLimits.has(key) && !NARROWING_ONLY.has(level)) {
          limits[key] = value;
          spokenLimits.add(key);
        } else {
          limits[key] = Math.min(limits[key], value);
        }
      }
    }

    /* Deny wins, but "nobody said" is not a deny -- the first level to speak
       sets the value and any later false pins it off for good. */
    if (rule.allowDetach !== undefined) { allowDetach = detachSpoken ? allowDetach && rule.allowDetach : rule.allowDetach; detachSpoken = true; }
    if (rule.allowDuplicate !== undefined) { allowDuplicate = duplicateSpoken ? allowDuplicate && rule.allowDuplicate : rule.allowDuplicate; duplicateSpoken = true; }
  }

  return { modes: modes ?? [], limits, allowDetach, allowDuplicate, deniedBy };
}
