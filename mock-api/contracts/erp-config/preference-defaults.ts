import { BRANCHES } from "./navigation.ts";
import type { UserPreferences } from "./types.ts";

/* The defaults live here rather than inside ERPProvider so that the validator
   below can share them, and so the shape has one home. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "nexora",
  formNavigation: "rail",
  resultView: "table",
  previewMode: "right-drawer",
  sidebarPlacement: "left",
  sidebarPinned: false,
  density: "comfortable",
  pageSize: 20,
  fontFamily: "inter",
  fontSizeBase: 13,
  fontSizeForm: 13,
  fontSizeResult: 13,
  toastPosition: "top-right",
  toastDuration: 3500,
  toastStyle: "solid",
  helperEnabled: true,
  documentationEnabled: true,
  reducedMotion: false,
  language: "en",
  billingLayout: "workspace",
  globalSearchMode: "smart",
  rememberFilters: true,
  openRecordsInTabs: true,
  showKeyboardHints: true,
  /* Off. Tabs stay the default arrangement for everyone who does not ask. */
  floatingWindows: false,
  openRecordsIn: "new-tab",
  dateFormat: "iso",
  numberLocale: "en-US",
  currencyCode: "AED",
  decimalPlaces: 0,
  columnLayoutScope: "browser",
  sidebarExpandOn: "hover",
  /* ON by default. It is an accessibility affordance, and defaulting one of
     those to off means the people who need it are the ones who have to go and
     find a setting. It costs a mouse user nothing: focus only lands in the rail
     by keyboard. */
  sidebarFocusExpand: true,
  keyboardShortcuts: true,
  loadingSkeletons: true,
  sidebarTone: "contrast",
  sidebarTheme: "match",
  headerTone: "surface",
  headerTheme: "match",
  maxVisibleToasts: 3,
  timeFormat: "24h",
  currencyDisplay: "symbol",
  negativeStyle: "minus",
  cornerRadius: 14,
  landingPage: "module-dashboard",
  defaultModule: "",
  stickyTableHeader: true,
  zebraStripes: false,
  wrapCellText: false,
  confirmBulkActions: true,
  exportFormat: "csv",
  clockSeconds: true,
  clockZone: "browser",
  docsPosition: "right",
};

/** The legal values for every enumerated key. A key absent here is validated
    by the typeof of its default instead (booleans and numbers). */
/** One list, so the theme picker, the sidebar picker and the validator cannot
    disagree about which themes exist. */
const THEME_IDS = ["nexora", "midnight", "emerald", "sand", "rose", "slate", "contrast", "indigo", "lagoon", "sunset", "graphite", "plum", "nord", "solarized"] as const;

export const PREFERENCE_OPTIONS: Partial<Record<keyof UserPreferences, ReadonlyArray<unknown>>> = {
  theme: THEME_IDS,
  formNavigation: ["rail", "tabs", "wizard"],
  resultView: ["table", "cards"],
  previewMode: ["inline", "center-card", "center-modal", "left-drawer", "right-drawer"],
  sidebarPlacement: ["left", "right"],
  density: ["compact", "comfortable", "spacious"],
  pageSize: [10, 20, 50, 100],
  fontFamily: ["inter", "plex", "source-sans", "nunito", "manrope", "system", "georgia", "plex-mono"],
  toastPosition: ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"],
  toastDuration: [2000, 3500, 5000, 8000],
  toastStyle: ["solid", "light"],
  language: ["en", "ar", "hi", "ml"],
  billingLayout: ["workspace", "vertical", "split"],
  globalSearchMode: ["contains", "starts-with", "smart"],
  openRecordsIn: ["new-tab", "same-tab"],
  dateFormat: ["iso", "dmy", "mdy", "medium"],
  numberLocale: ["en-US", "de-DE", "fr-FR", "en-IN"],
  currencyCode: ["AED", "USD", "EUR", "INR", "GBP"],
  decimalPlaces: [0, 2, 3],
  columnLayoutScope: ["browser", "account"],
  sidebarExpandOn: ["hover", "click"],
  sidebarTone: ["surface", "light", "contrast"],
  sidebarTheme: ["match", ...THEME_IDS],
  headerTone: ["surface", "light", "contrast"],
  headerTheme: ["match", ...THEME_IDS],
  maxVisibleToasts: [1, 3, 5],
  timeFormat: ["12h", "24h"],
  currencyDisplay: ["symbol", "code", "none"],
  negativeStyle: ["minus", "parentheses"],
  landingPage: ["last-visited", "module-dashboard"],
  exportFormat: ["csv", "xlsx"],
  clockZone: ["browser", "branch"],
  docsPosition: ["left", "right"],
};

/** Numeric keys are clamped rather than rejected: a font size of 40 from a
    hand-edited file becomes 16, not the default, because "as big as allowed" is
    closer to what the author meant than "back to normal". */
export const PREFERENCE_RANGES: Partial<Record<keyof UserPreferences, readonly [number, number]>> = {
  fontSizeBase: [11, 16],
  fontSizeForm: [11, 17],
  fontSizeResult: [10, 16],
  cornerRadius: [0, 20],
};

/**
 * Merge stored preferences over the defaults, dropping anything illegal.
 *
 * WHY THIS EXISTS. The previous code did `{...DEFAULT, ...body.preferences}`
 * and trusted the response completely. One bad value -- a theme id removed in a
 * later release, a hand-edited preferences.json, a half-written field -- reached
 * the shell as-is. `theme: "midnite"` sets data-theme to a selector no
 * stylesheet defines, and the app renders with :root's tokens while the
 * preferences page shows nothing selected. Silent, and confusing to diagnose.
 *
 * Unknown keys are dropped rather than merged, so a preference deleted from the
 * app stops travelling in every subsequent save.
 */
export function sanitizePreferences(stored: unknown): UserPreferences {
  const result = { ...DEFAULT_PREFERENCES };
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return result;

  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (!Object.hasOwn(DEFAULT_PREFERENCES, key)) continue;              // unknown key
    const typed = key as keyof UserPreferences;
    if (key === "defaultModule") { if (typeof value === "string" && (value === "" || /^[a-z][a-z0-9-]{0,63}$/.test(value))) result.defaultModule = value; continue; }
    const allowed = PREFERENCE_OPTIONS[typed];
    if (allowed) {
      if (allowed.includes(value)) (result as Record<string, unknown>)[key] = value;
      continue;
    }
    const range = PREFERENCE_RANGES[typed];
    if (range) {
      if (typeof value === "number" && Number.isFinite(value)) {
        (result as Record<string, unknown>)[key] = Math.min(range[1], Math.max(range[0], value));
      }
      continue;
    }
    // No enum, no range: accept only the primitive type the default already is.
    if (typeof value === typeof DEFAULT_PREFERENCES[typed]) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/** Only the keys that differ from the defaults, so stored JSON reads as "what
    this user changed" and a preference added later starts at its new default
    rather than at whatever was frozen into an older full snapshot. */
export function preferenceOverrides(preferences: UserPreferences): Partial<UserPreferences> {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_PREFERENCES) as Array<keyof UserPreferences>) {
    if (preferences[key] !== DEFAULT_PREFERENCES[key]) diff[key] = preferences[key];
  }
  return diff as Partial<UserPreferences>;
}

/** How many settings differ from default -- shown on the preferences page so a
    user can see at a glance that they have customised anything at all. */
export function changedPreferenceCount(preferences: UserPreferences): number {
  return Object.keys(preferenceOverrides(preferences)).length;
}

/* Branch -> IANA zone, so the header clock can show the SELECTED branch's local
   time. Kochi is +5:30 while the three Emirates sites are +4, which is exactly
   the case a single browser-local clock gets wrong. */
export const BRANCH_TIMEZONES: Record<string, string> = {
  hq: "Asia/Dubai",
  dubai: "Asia/Dubai",
  sharjah: "Asia/Dubai",
  india: "Asia/Kolkata",
};

/** Falls back to the browser zone for a branch with no mapping, which is what
    an unmapped new branch should do rather than throwing inside the header. */
export function timezoneForBranch(branch: string): string | undefined {
  return BRANCH_TIMEZONES[branch];
}

/** Re-exported for the preferences page's branch-aware copy. */
export const BRANCH_LABELS = BRANCHES;
