import {editablePreferenceOverrides, effectivePreferences, parsePreferencePolicy, type UserPreferences, type PreferencePolicy} from '@pepbits/preferences';
import {readJson, type Request} from './http';

export interface PreferenceSnapshot {
  preferences: Partial<UserPreferences>;
  overrides: Partial<UserPreferences>;
  policy: PreferencePolicy;
  userRevision: number;
  canManage: boolean;
}
export async function loadPreferences(request: Request): Promise<PreferenceSnapshot> {
  const value = await readJson<PreferenceSnapshot>(await request('/preferences'));
  return {...value, policy: parsePreferencePolicy(value.policy)};
}
export async function savePreferences(request: Request, snapshot: PreferenceSnapshot, patch: Partial<UserPreferences>) {
  const preferences = editablePreferenceOverrides(effectivePreferences({...snapshot.overrides, ...patch}, snapshot.policy), snapshot.policy);
  const response = await request('/preferences', {method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({preferences, policyRevision: snapshot.policy.revision, userRevision: snapshot.userRevision})});
  const next = await readJson<PreferenceSnapshot>(response);
  return {...next, policy: parsePreferencePolicy(next.policy)};
}
