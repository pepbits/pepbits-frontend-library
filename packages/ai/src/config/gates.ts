/**
 * Who may use AI, where, and for what.
 *
 * Eight gates, evaluated in order, first denial decides. See
 * docs/superpowers/specs/2026-09-03-contextual-ai-assistant-design.md §4.
 *
 * This module is deliberately dependency-free and side-effect-free: it is the
 * one place the access rules live, it runs identically on the client and the
 * server, and the server copy is the enforcement point. The client copy exists
 * only so the shell knows what to render.
 */

/** In evaluation order. The first gate that denies decides. */
export const GATES = [
  "build",
  "platform",
  "tenant",
  "application",
  "module",
  "page",
  "useCase",
  "user",
] as const;

export type Gate = (typeof GATES)[number];

/**
 * Gates that may only NARROW the surviving use-case set.
 *
 * Without this asymmetry, "enable at user level" is a route around a tenant
 * policy: a user could name a use case an administrator had removed and have it
 * intersected back in. For a capability that reads clinical records that is not
 * a defensible default, so narrowing is enforced structurally rather than left
 * to the caller to respect.
 *
 * A `role` gate sat here until it was removed from scope. It was specified
 * against an authorization layer this application does not have, so it would
 * have checked nothing while appearing to gate AI -- which is worse than its
 * absence, because the absence is at least visible. Re-add it here, not just to
 * GATES, if authorization is ever built.
 */
export const NARROWING_ONLY: ReadonlySet<Gate> = new Set<Gate>(["user"]);

export interface GateState {
  /** `undefined` means this gate expresses no opinion, and it passes. */
  allowed?: boolean;
  /**
   * Use-case ids this gate permits. Absent means "no restriction from here".
   * A gate never adds to the set — see `resolveAi`.
   */
  useCases?: string[];
}

export interface AiAccess {
  allowed: boolean;
  /**
   * The gate that decided. Rendered in the UI, written to the audit, and shown
   * in the admin console, so all three give the same answer to "why is this
   * off". A bare boolean cannot answer that question.
   */
  decidedBy: Gate;
  reason: string;
  /** Intersection across every gate that expressed an opinion. */
  useCases: string[];
}

/**
 * Resolve access for a page, optionally for one requested use case.
 *
 * DENY WINS. Evaluated in `GATES` order, stopping at the first gate whose
 * `allowed` is false. There is no `force-enable`: a tenant that disables AI
 * cannot be overridden by a module, a role or a user.
 *
 * The use-case set is the INTERSECTION of every gate that named one. Because
 * intersection can only remove members, a gate can never widen the set — the
 * `NARROWING_ONLY` guard below is belt and braces for the two gates where a
 * future refactor to a union would be an actual privilege escalation rather
 * than a bug.
 */
export function resolveAi(
  states: Partial<Record<Gate, GateState>>,
  requested?: string,
): AiAccess {
  let useCases: string[] | null = null;

  for (const gate of GATES) {
    const state = states[gate];
    if (!state) continue;

    if (state.allowed === false) {
      return {
        allowed: false,
        decidedBy: gate,
        reason: `Disabled at ${gate} level.`,
        useCases: [],
      };
    }

    if (state.useCases) {
      if (useCases === null) {
        /* The first gate to name a set establishes it. A narrowing-only gate
           must not be that gate: if role is the only one that speaks, it would
           be defining the set rather than reducing one, which is the same
           escalation by another route. */
        useCases = NARROWING_ONLY.has(gate) ? [] : [...state.useCases];
      } else {
        useCases = useCases.filter((id) => state.useCases!.includes(id));
      }
    }
  }

  const resolved = useCases ?? [];

  if (resolved.length === 0) {
    return {
      allowed: false,
      decidedBy: "useCase",
      reason: "No use case is enabled for this page.",
      useCases: [],
    };
  }

  if (requested && !resolved.includes(requested)) {
    return {
      allowed: false,
      decidedBy: "useCase",
      reason: `"${requested}" is not enabled here.`,
      useCases: resolved,
    };
  }

  return { allowed: true, decidedBy: "user", reason: "Allowed.", useCases: resolved };
}
