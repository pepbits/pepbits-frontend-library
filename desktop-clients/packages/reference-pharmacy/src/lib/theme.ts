import type { ThemeKey } from "@pepbits/erp-config";
import type { ReferenceHost } from "@pepbits/reference-host";

/** Host themes with a dark canvas; every other host theme reads as the source's light palette. */
export const DARK_THEMES: readonly ThemeKey[] = ["midnight", "graphite", "plum", "nord"];
const LIGHT_CHOICES: readonly ThemeKey[] = ["nexora", "emerald", "sand", "rose", "slate", "indigo", "lagoon", "sunset", "solarized", "contrast"];
export const isDarkTheme = (theme: ThemeKey) => DARK_THEMES.includes(theme);

/**
 * What the source's light/dark switch may do on this host: the opposite-polarity theme to move to, and whether the tenant
 * policy and the host allow persisting it. A locked theme, a restricted allowed list with no theme of the other polarity,
 * a host that cannot save preferences, or a missing change handler all disable the control.
 */
export function planThemeToggle(host: Pick<ReferenceHost, "preferences" | "preferenceHost">): { theme: "light" | "dark"; canChange: boolean; target: ThemeKey | null } {
  const current = host.preferences.theme;
  const dark = isDarkTheme(current);
  const ph = host.preferenceHost;
  const rule = ph?.preferencePolicy?.rules.theme;
  const pool = dark ? LIGHT_CHOICES : DARK_THEMES;
  const target = pool.find((t) => !rule?.allowedValues || (rule.allowedValues as ThemeKey[]).includes(t)) ?? null;
  const canChange = !!ph?.onPreferenceChange && ph.preferencesAvailable !== false && !rule?.locked && target !== null;
  return { theme: dark ? "dark" : "light", canChange, target: canChange ? target : null };
}
