/* `import type`, not `import { type ... }`. Both satisfy TypeScript, but only
   the former is erased outright — the latter leaves an import statement that
   Node still has to resolve, and extensionless specifiers are a bundler
   convention Node does not share. This module has no runtime dependency on
   gates.ts, and saying so keeps it directly runnable by the verify script. */
import type { Gate, GateState } from "./gates.ts";

/**
 * The runtime half of the control plane: gates 2-7, owned by administrators and
 * served by the policy service.
 *
 * Shaped as four maps rather than one flat `Partial<Record<Gate, GateState>>`
 * because three of these gates are per-thing, not per-tenant: the module gate
 * differs by module, the page gate by page, the use-case gate by use case. A
 * flat record could hold only one of each and the distinction would be lost.
 *
 * `gatesForPage` collapses this into the flat shape `resolveAi` wants, for one
 * page. That collapse is the only place the mapping lives.
 */
export interface AiPolicy {
  /** Derived from the session by the server. Never accepted from a client. */
  tenantId: string;
  /** Gates that apply to everything: platform, tenant, application. */
  global: Partial<Record<Gate, GateState>>;
  /** Keyed by ModuleKey. */
  modules: Record<string, GateState>;
  /** Keyed by page id. */
  pages: Record<string, GateState>;
  /** Keyed by use-case id, so one can be disabled everywhere at once. */
  useCases: Record<string, GateState>;
}

export interface PageAiInput {
  pageId: string;
  module: string;
  /** Gate 1: the page's build-time block, or undefined if it has none. */
  build?: { enabled: boolean; useCases: string[] };
}

/**
 * Collapse a policy plus a page plus the user's own preference into the flat
 * gate map `resolveAi` consumes.
 *
 * The use-case gate is the intersection of every per-use-case entry that is
 * switched off: an administrator disabling `record.explain` platform-wide must
 * remove it from every page that offers it, not just from a list somewhere.
 * Expressing that as a narrowing set keeps `resolveAi` unchanged.
 */
export function gatesForPage(
  policy: AiPolicy | null,
  page: PageAiInput,
  userEnabled: boolean,
): Partial<Record<Gate, GateState>> {
  const gates: Partial<Record<Gate, GateState>> = {};

  /* Gate 1. Absent OR explicitly disabled means the assistant never renders
     here, and no runtime configuration can turn it on -- it is the one gate an
     administrator cannot reach.

     This tested PRESENCE, not `enabled`, which was harmless while the type
     admitted only `true`: writing a block was the only way to say yes, so
     "there is a block" and "it is enabled" were the same statement. They stopped
     being the same when PAGE_REGISTRY grew a per-kind default and a page needed
     a way to opt OUT. A `{ enabled: false }` block would have read as enabled --
     the loudest possible way of saying no, ignored. */
  gates.build = page.build?.enabled ? { allowed: true, useCases: page.build.useCases } : { allowed: false };

  if (policy) {
    for (const gate of ["platform", "tenant", "application"] as const) {
      const state = policy.global[gate];
      if (state) gates[gate] = state;
    }
    const module = policy.modules[page.module];
    if (module) gates.module = module;
    const pageState = policy.pages[page.pageId];
    if (pageState) gates.page = pageState;

    /* Only DISABLED use cases are expressed here, as the complement of the
       build set. An entry that allows something cannot widen anything, because
       gatesForPage never adds an id the build gate did not already name. */
    const offIds = Object.entries(policy.useCases)
      .filter(([, state]) => state.allowed === false)
      .map(([id]) => id);
    if (offIds.length && page.build) {
      gates.useCase = { useCases: page.build.useCases.filter((id) => !offIds.includes(id)) };
    }
  }

  /* Gate 8. A preference can only turn AI off; it never names a set, because a
     narrowing gate that establishes one is an escalation -- see NARROWING_ONLY. */
  gates.user = { allowed: userEnabled };
  return gates;
}
