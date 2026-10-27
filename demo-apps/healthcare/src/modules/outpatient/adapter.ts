"use client";
import type {ClinicalActor, ClinicalDataPort, QueueRow} from '@pepbits/clinical';
import type {Request} from '../../adapters/http';

/** Where the demo API serves the synthetic AllyVora clinical workspace (`mock-api/allyvora-clinical-store.mjs`). */
export const CLINICAL_API_PREFIX = '/allyvora-clinical';

/** A failed call: the server's message, plus `problems` when it lists validation failures. */
export class ClinicalApiError extends Error {
  constructor(public status: number, message: string, public problems?: string[]) { super(message); }
}

/**
 * The clinical data port over the AllyVora clinical workspace API, sent through the demo's signed-in
 * request client (bearer token and product header) under `/allyvora-clinical`. Paths and payloads
 * are the source workspace's, so a host with the real API only changes the prefix.
 */
export function allyVoraClinicalPort(request: Request, prefix = CLINICAL_API_PREFIX) {
  async function call<T>(path: string, {json, method, signal}: {json?: unknown; method?: string; signal?: AbortSignal} = {}): Promise<T> {
    let response: Response;
    try {
      response = await request(prefix + path, {method: method ?? (json === undefined ? 'GET' : 'POST'), signal,
        headers: json === undefined ? undefined : {'Content-Type': 'application/json'}, body: json === undefined ? undefined : JSON.stringify(json)});
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      throw new ClinicalApiError(0, 'Can’t reach the clinical service. Check your connection and try again.');
    }
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new ClinicalApiError(response.status, String(body.error ?? `Request failed (${response.status}).`), Array.isArray(body.problems) ? body.problems.map(String) : undefined);
    return body as T;
  }
  const port: ClinicalDataPort = {
    listEncounters: (encounterClass, signal) => call<QueueRow[]>(`/encounters?class=${encodeURIComponent(encounterClass)}`, {signal}),
    loadEncounter: (id, signal) => call(`/encounters/${encodeURIComponent(id)}`, {signal}),
    setEncounterStatus: async (id, status) => { await call(`/encounters/${encodeURIComponent(id)}/status`, {method: 'PATCH', json: {status}}); },
    saveIntake: (id, payload) => call(`/encounters/${encodeURIComponent(id)}/intake`, {json: payload}),
    searchCatalog: (catalog, query, signal) => call<{items: never[]}>(`/catalog/${catalog}?q=${encodeURIComponent(query)}&limit=10`, {signal}).then(r => r.items),
    calculateScore: (method, inputs, signal) => call(`/scores/${method}/calculate`, {json: {inputs}, signal}),
    previewEsi: (inputs, signal) => call('/encounters/esi/preview', {json: inputs, signal}),
    addAllergy: (patientId, allergy) => call(`/patients/${encodeURIComponent(patientId)}/allergies`, {json: allergy}),
  };
  /** The signed-in clinician, or null when the clinical workspace is unavailable. */
  const loadActor = () => call<ClinicalActor>('/auth/me').then(me => ({role: me.role, permissions: me.permissions ?? []})).catch(() => null);
  return {port, loadActor};
}
