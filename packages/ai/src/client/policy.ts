"use client";

import type {AiRequest} from "./client";
import type { AiPolicy } from "@pepbits/ai/config";

/**
 * The runtime gates, fetched once per session and cached.
 *
 * Cached in a client-instance promise rather than component state: every allowed
 * page asks the same question, and a fetch per page mount would put the policy
 * on the critical path of every navigation.
 *
 * A failure resolves to `null`, not to a denial. The deny-on-missing-policy
 * decision belongs to the SERVER, which returns platform:{allowed:false} for an
 * unknown tenant. A client that failed closed on a network blip would make the
 * assistant vanish intermittently, which teaches people to distrust the gating
 * rather than the network — and it would not be a security gain, because the
 * client resolver decides what to RENDER and the server re-checks at dispatch.
 */
export function createAiPolicyClient(authedFetch: AiRequest) {
let generation = 0;
let inflight: Promise<AiPolicy | null> | null = null;
let cached: AiPolicy | null = null;
let owner: string | null = null;

function fetchAiPolicy(userId: string): Promise<AiPolicy | null> {
  /* Keyed by user, so signing in as someone else cannot inherit the previous
     account's policy out of a shared client cache. */
  if (owner !== userId) {
    generation++;
    owner = userId;
    cached = null;
    inflight = null;
  }
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    const requestGeneration = generation;
    inflight = (async () => {
      try {
        const response = await authedFetch("/ai/policy");
        if (!response.ok) return null;
        const result = (await response.json()) as AiPolicy;
        if (generation !== requestGeneration) return null;
        cached = result;
        return result;
      } catch {
        return null;
      } finally {
        if (generation === requestGeneration) inflight = null;
      }
    })();
  }
  return inflight;
}

/** Drops the cache. Called on sign-out, and after an administrator saves. */
function resetAiPolicy(): void {
  generation++;
  cached = null;
  inflight = null;
  owner = null;
}

return {fetchAiPolicy, resetAiPolicy};
}
