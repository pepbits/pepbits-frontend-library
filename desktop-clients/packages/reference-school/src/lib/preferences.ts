"use client";

import type { PreferenceKey, UserPreferences } from "@pepbits/erp-config";
import { useReferenceHost } from "@pepbits/reference-host";

/** One presentation preference, edited only through the host's central update path (PREF-02/03).
    Locked, unavailable or disallowed values are reported and the change handler refuses them. */
export function usePreferenceControl<K extends PreferenceKey>(key: K) {
  const host = useReferenceHost();
  const ph = host.preferenceHost;
  const rule = ph?.preferencePolicy?.rules[key];
  const available = !!ph?.onPreferenceChange && ph.preferencesAvailable !== false;
  const locked = !!rule?.locked;
  const allows = (value: UserPreferences[K]) => !rule?.allowedValues || rule.allowedValues.includes(value);
  return {
    value: host.preferences[key],
    editable: available && !locked,
    allows,
    reason: locked ? "Managed by your administrator" : !available ? "Managed by the host application" : undefined,
    set: (value: UserPreferences[K]) => { if (available && !locked && allows(value)) ph!.onPreferenceChange!(key, value); },
  };
}

const DARK_THEMES = new Set<UserPreferences["theme"]>(["midnight", "graphite", "plum", "nord"]);
export const isDarkTheme = (theme: UserPreferences["theme"]) => DARK_THEMES.has(theme);
