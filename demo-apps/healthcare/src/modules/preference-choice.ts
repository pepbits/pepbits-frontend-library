import type {PreferenceKey, PreferencePolicy, UserPreferences} from '@pepbits/preferences';

/** Port boundary for product screens. Accepted values always come from the one host. */
export interface PreferenceHost {
  preferences: UserPreferences;
  preferencePolicy?: PreferencePolicy;
  preferencesAvailable?: boolean;
  onPreferenceChange?: <K extends PreferenceKey>(key: K, value: UserPreferences[K]) => void;
}
export function usePreferenceChoice<K extends PreferenceKey>(host: PreferenceHost, key: K) {
  const rule = host.preferencePolicy?.rules[key];
  const value = (rule?.locked ? rule.value : host.preferences[key]) as UserPreferences[K];
  const locked = host.preferencesAvailable === false || rule?.locked === true || !host.onPreferenceChange;
  return [value, (next: UserPreferences[K]) => {
    if (!locked && (!rule?.allowedValues || rule.allowedValues.includes(next))) host.onPreferenceChange?.(key, next);
  }, locked] as const;
}
