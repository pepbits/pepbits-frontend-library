"use client";
import type {ClinicalActor, ClinicalDataPort, QueueRow} from '@pepbits/clinical';
import {ApiError, api} from '../registration/front-desk/lib';

/**
 * The clinical data port over the AllyVora clinical workspace API, through the same client and
 * origin as the front desk pages (`NEXT_PUBLIC_ALLYVORA_FRONT_DESK_API_URL`, default `/api`), so the
 * session cookie and CSRF token are shared. Paths and payloads are the source workspace's.
 */
export function allyVoraClinicalPort(): ClinicalDataPort {
  const withProblems = <T,>(promise: Promise<T>) => promise.catch((error: unknown) => {
    if (error instanceof ApiError && Array.isArray(error.body.problems)) throw Object.assign(error, {problems: error.body.problems.map(String)});
    throw error;
  });
  return {
    listEncounters: (encounterClass, signal) => api<QueueRow[]>(`/encounters?class=${encodeURIComponent(encounterClass)}`, {signal}),
    loadEncounter: (id, signal) => api(`/encounters/${encodeURIComponent(id)}`, {signal}),
    setEncounterStatus: async (id, status) => { await api(`/encounters/${encodeURIComponent(id)}/status`, {method: 'PATCH', json: {status}}); },
    saveIntake: (id, payload) => withProblems(api(`/encounters/${encodeURIComponent(id)}/intake`, {json: payload})),
    searchCatalog: (catalog, query, signal) => api<{items: never[]}>(`/catalog/${catalog}?q=${encodeURIComponent(query)}&limit=10`, {signal}).then(r => r.items),
    calculateScore: (method, inputs, signal) => api(`/scores/${method}/calculate`, {json: {inputs}, signal}),
    previewEsi: (inputs, signal) => api('/encounters/esi/preview', {json: inputs, signal}),
    addAllergy: (patientId, allergy) => withProblems(api(`/patients/${encodeURIComponent(patientId)}/allergies`, {json: allergy})),
  };
}

/** The signed-in clinician (`GET /auth/me`), or null when the workspace session is unavailable. */
export const loadActor = () => api<ClinicalActor>('/auth/me').then(me => ({role: me.role, permissions: me.permissions ?? []})).catch(() => null);
