"use client";

import type {AiRequest} from "./client";
import type { AiConfig, AiConfigPatch, AiCredentialStatus, AiUsage } from "@pepbits/ai/config";

/**
 * The administration surface, from the client's side.
 *
 * Every function here is typed so that a provider secret cannot arrive: the
 * return type of `fetchAiConfig` carries `credential: AiCredentialStatus`, and
 * there is no TypeScript shape in this module through which a value could come
 * back. If a future server started returning one, the client would not have a
 * field to put it in.
 */

export interface AiAdminResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  /** The server's own message, shown to the administrator verbatim. These
      refusals explain WHY something is unavailable — "no vault", "no
      authorization layer" — and paraphrasing them loses the reason. */
  error?: string;
  detail?: string;
}

export function createAiAdmin(authedFetch: AiRequest) {
async function request<T>(path: string, init?: RequestInit): Promise<AiAdminResult<T>> {
  let response: Response;
  try {
    response = await authedFetch(path, init);
  } catch {
    return { ok: false, status: 0, error: "Could not reach the API." };
  }
  if (response.status === 204) return { ok: true, status: 204 };
  let body: unknown = undefined;
  try {
    body = await response.json();
  } catch {
    // A body-less error is still an error; fall through with what we have.
  }
  if (!response.ok) {
    const problem = (body ?? {}) as { error?: string; detail?: string };
    return { ok: false, status: response.status, error: problem.error, detail: problem.detail };
  }
  return { ok: true, status: response.status, data: body as T };
}

function fetchAiConfig(): Promise<AiAdminResult<AiConfig>> {
  return request<AiConfig>("/ai/config");
}

/**
 * `AiConfigPatch` omits `credential` by construction, so this cannot carry a
 * secret even by accident. The server rejects one anyway — two independent
 * guards, because this is the path an administrator uses every day and the one
 * a convenience change is most likely to touch.
 */
function saveAiConfig(patch: AiConfigPatch): Promise<AiAdminResult<never>> {
  return request<never>("/ai/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/**
 * Write-only. There is no `getAiCredential`, and there should never be one:
 * `fetchAiConfig().credential` is the status, which is what an administrator
 * needs to see.
 */
function setAiCredential(secret: string): Promise<AiAdminResult<never>> {
  return request<never>("/ai/config/credential", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  });
}

function clearAiCredential(): Promise<AiAdminResult<never>> {
  return request<never>("/ai/config/credential", { method: "DELETE" });
}

/**
 * Ask the service to try the stored credential against the provider.
 *
 * Returns the STATUS, like everything else here. A key that no longer works is
 * something an administrator has to be able to discover without reading it back
 * to compare by eye — that is what `lastError` on the status is for.
 */
function verifyAiCredential(): Promise<AiAdminResult<AiCredentialStatus>> {
  return request<AiCredentialStatus>("/ai/config/credential/verify", { method: "POST" });
}

/** Spend and headroom. See AiUsage for why this is not part of the config. */
function fetchAiUsage(): Promise<AiAdminResult<AiUsage>> {
  return request<AiUsage>("/ai/usage");
}

/**
 * A credential for a scoped provider — speech, today.
 *
 * Same endpoint, same write-only contract, same status shape. A second store
 * for speech keys would drift from this one, and it would be the copy with the
 * weaker rules.
 */
function setAiScopedCredential(scope: string, secret: string): Promise<AiAdminResult<never>> {
  return request<never>("/ai/config/credential", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, secret }),
  });
}

return {fetchAiConfig, saveAiConfig, setAiCredential, clearAiCredential, verifyAiCredential, fetchAiUsage, setAiScopedCredential};
}
