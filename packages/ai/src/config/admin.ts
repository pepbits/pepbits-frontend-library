/**
 * The administration surface: what an administrator configures, as opposed to
 * what the shell asks on every page.
 *
 * Kept separate from AiPolicy on purpose. The shell asks "may I, and for what"
 * for every user on every page; an administrator asks "what is configured" once,
 * from one screen. Serving both from one endpoint would put provider names,
 * endpoints and rate limits into every page load for every user.
 */

/**
 * What `GET` returns in place of a provider token.
 *
 * Constraint 8: credentials are WRITE-ONLY. There is deliberately no field here
 * that could carry the value — not truncated, not encrypted, not behind a flag.
 * This shape is the whole contract, so a future "just add the key for the admin
 * screen" has to change a type that says, in its own name, that it is a status.
 *
 * `hint` is the last four characters, which distinguishes two keys without
 * disclosing either. `fingerprint` is a SHA-256 prefix, for matching against a
 * vault record.
 */
export interface AiCredentialStatus {
  configured: boolean;
  hint: string | null;
  fingerprint: string | null;
  setBy: string | null;
  setAt: string | null;
  rotatedAt: string | null;
  /** Written by the service after a provider call, so a bad key is diagnosable
      without anyone reading it back. */
  lastVerifiedAt: string | null;
  lastError: string | null;
}

export interface AiConfig {
  tenantId: string;
  provider: { id: string; label: string; endpoint: string };
  model: { id: string; label: string; contextWindow: number };
  limits: { requestsPerMinute: number; tokensPerDay: number; maxContextFields: number };
  /** Prompt IDS and metadata. Prompt TEXT is never returned: it is resolved
      server-side at dispatch, so a client cannot read, replay or edit it. */
  prompts: Array<{ id: string; useCaseId: string; version: number; updatedAt: string }>;
  retention: { class: "standard" | "elevated"; days: number };
  dataSharing: { providerTrainsOnContent: boolean; region: string };
  credential: AiCredentialStatus;
  /** Transcription providers in priority order. Optional: a tenant that does
      not transcribe has no speech block rather than an empty one. */
  speech?: {
    providers: Array<{
      id: string; label: string; model: string; streaming: boolean; priority: number;
      languages: string[]; enabled: boolean; credential?: AiCredentialStatus;
    }>;
    maxSessionMinutes: number;
    retainAudio: boolean;
  };
}

/**
 * The subset an administrator may write.
 *
 * `credential` is absent BY CONSTRUCTION, not by convention. The common edit —
 * change a model, raise a limit — cannot carry a secret in its body even by
 * accident, which is what makes the separate credential endpoint worth having:
 * only one path handles secrets, so only one path needs the extra
 * re-authentication, rate limiting and audit treatment.
 */
export type AiConfigPatch = Partial<Omit<AiConfig, "tenantId" | "credential" | "prompts">>;

/**
 * What has actually been spent, as opposed to what is allowed.
 *
 * Separate from `AiConfig` because it is not configuration: it changes on every
 * request, and folding it into the config response would make a settings read
 * look cacheable when it is not.
 *
 * `limitsAreDefaults` exists so an administrator can tell "20 because someone
 * chose 20" from "20 because nothing is configured and the server refused to
 * treat that as unlimited". Those look identical in the numbers alone.
 */
export interface AiUsage {
  tenantId: string;
  /** UTC. A budget that rolled at local midnight would change meaning with the
      machine's timezone. */
  day: string;
  requestsLastMinute: number;
  requestsPerMinute: number;
  tokensUsedToday: number;
  tokensPerDay: number;
  limitsAreDefaults: boolean;
}
