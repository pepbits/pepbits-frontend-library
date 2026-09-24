import type {PageTemplateDefinition} from "./page-templates";
import type { LucideIcon } from "lucide-react";

/** Product hosts may register their own stable module codes without changing the
 * shared shell's ERP demonstration catalogue. */
export type ModuleKey = "hr" | "finance" | "payroll" | "sales" | "supply" | "healthcare" | "pharmacy" | "library" | (string & {});
export type ThemeKey = "nexora" | "midnight" | "emerald" | "sand" | "rose" | "slate" | "contrast"
  | "indigo" | "lagoon" | "sunset" | "graphite" | "plum" | "nord" | "solarized";
export type FormNavigation = "rail" | "tabs" | "wizard";
export type ResultView = "table" | "cards";
export type PreviewMode = "inline" | "center-card" | "center-modal" | "left-drawer" | "right-drawer";
export type SidebarPlacement = "left" | "right";
export type Density = "compact" | "comfortable" | "spacious";
export type ToastPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export type BillingLayout = "workspace" | "vertical" | "split";
export type LanguageKey = "en" | "ar" | "hi" | "ml";
export type PageKind = "template" | "dashboard" | "worklist" | "form" | "billing" | "reports" | "preferences" | "spreadsheet" | "library" | "ai-admin" | "inbox" | "consultation";
export type FieldType = "text" | "email" | "phone" | "number" | "date" | "select" | "multiselect" | "textarea" | "toggle";
export type OpenRecordsIn = "new-tab" | "same-tab";
export type DateFormat = "iso" | "dmy" | "mdy" | "medium";
/** A BCP-47 tag, used directly by Intl -- the grouping and decimal separator
    come from the locale rather than from a bespoke enum we would have to map. */
export type NumberLocale = "en-US" | "de-DE" | "fr-FR" | "en-IN";
export type CurrencyCode = "AED" | "USD" | "EUR" | "INR" | "GBP";
export type ColumnLayoutScope = "browser" | "account";
export type SidebarExpandOn = "hover" | "click";
/** How a piece of shell chrome -- the sidebar rail or the header bar -- is
    coloured relative to the page.
    "surface"  the page's own surface, as cards use
    "light"    a light chrome whatever the page theme -- the only way to get one
               on midnight, graphite, plum or nord
    "contrast" a deep chrome whatever the page theme */
export type ChromeTone = "surface" | "light" | "contrast";
/** Which theme supplies a chrome element's palette. "match" follows the page. */
export type ChromePalette = "match" | ThemeKey;

/* Named per surface so the preference keys read for themselves, but one shape:
   the header and the sidebar offer exactly the same choice. */
export type SidebarTone = ChromeTone;
export type SidebarTheme = ChromePalette;
export type HeaderTone = ChromeTone;
export type HeaderTheme = ChromePalette;
export type TimeFormat = "12h" | "24h";
export type CurrencyDisplay = "symbol" | "code" | "none";
/** How a negative amount reads. "parentheses" is the accounting convention. */
export type NegativeStyle = "minus" | "parentheses";
export type ToastStyle = "solid" | "light";
export type SearchMode = "contains" | "starts-with" | "smart";
export type LandingPage = "last-visited" | "module-dashboard";
export type ExportFormat = "csv" | "xlsx";
export type ClockZone = "browser" | "branch";
/** Which edge the documentation drawer slides in from. Vantage's equivalent is
    top/bottom for an in-page panel; ours is a drawer, so the axis is left/right. */
export type DocsPosition = "left" | "right";
/** Ids, not family names: the stack each maps to lives in one place (the
    provider), and "georgia" is a stable key where "Georgia (serif)" is a label. */
export type FontFamily = "inter" | "plex" | "source-sans" | "nunito" | "manrope" | "system" | "georgia" | "plex-mono";

export interface UserPreferences {
  theme: ThemeKey;
  formNavigation: FormNavigation;
  resultView: ResultView;
  previewMode: PreviewMode;
  sidebarPlacement: SidebarPlacement;
  sidebarPinned: boolean;
  density: Density;
  pageSize: 10 | 20 | 50 | 100;
  fontFamily: FontFamily;
  /* Three INDEPENDENT type scales, in px against a 13px reference (13 = the
     design as drawn). Someone who wants dense result tables and readable form
     fields can have both; one scale for everything forces a compromise. */
  fontSizeBase: number;
  fontSizeForm: number;
  fontSizeResult: number;
  toastPosition: ToastPosition;
  toastDuration: 2000 | 3500 | 5000 | 8000;
  /** Replaces the old `toastTone`, which no code ever read. Solid fills the
      toast with its tone; light keeps the surface and tints only the icon. */
  toastStyle: ToastStyle;
  helperEnabled: boolean;
  documentationEnabled: boolean;
  reducedMotion: boolean;
  language: LanguageKey;
  billingLayout: BillingLayout;
  globalSearchMode: SearchMode;
  rememberFilters: boolean;
  openRecordsInTabs: boolean;
  showKeyboardHints: boolean;

  /**
   * Desktop only, and off unless asked for.
   *
   * Arranges open records as floating windows with a taskbar instead of tabs.
   * The framework document marks the whole idea optional — "only if user
   * research proves real value" — and AllyVORA's own implementation has zero
   * live call sites, so this ships as something a user turns on rather than
   * something everyone is moved to.
   */
  floatingWindows: boolean;

  /* --- added 2026-09-03 ---------------------------------------------------
     Every key below is optional in storage, not in the type: overridesOf()
     persists only what differs from DEFAULT_PREFERENCES, so an account saved
     before these existed simply has no entry and picks up the new default. */

  /** Web only. `openRecordsInTabs` governs desktop MDI tabs; this governs
      whether a worklist View/Edit/New replaces the page or opens a browser
      tab. They are separate because the shells own tabs differently. */
  openRecordsIn: OpenRecordsIn;
  dateFormat: DateFormat;
  numberLocale: NumberLocale;
  currencyCode: CurrencyCode;
  decimalPlaces: 0 | 2 | 3;
  /** Where worklist column visibility and sort are kept. "browser" is the
      historical localStorage behaviour; "account" follows the user. */
  columnLayoutScope: ColumnLayoutScope;
  /** "always expanded" is deliberately absent -- sidebarPinned already is it,
      and two preferences for one state is how they drift apart. */
  sidebarExpandOn: SidebarExpandOn;
  /** Whether keyboard focus inside the rail expands it, the way hover does.

      A separate preference rather than part of sidebarExpandOn, because it is
      not a third way of choosing between hover and click -- it applies to
      BOTH. Someone who has set the rail to click still tabs through it, and
      folding this into that enum would have forced them to give up the click
      behaviour to get keyboard access. */
  sidebarFocusExpand: boolean;
  /** Whether keyboard shortcuts are bound at all. Off unbinds the listener
      rather than ignoring events inside it, so a page that fights for a key can
      have it back. */
  keyboardShortcuts: boolean;
  /** Show shaped placeholders while a page loads, instead of nothing. */
  loadingSkeletons: boolean;
  sidebarTone: SidebarTone;
  sidebarTheme: SidebarTheme;
  headerTone: HeaderTone;
  headerTheme: HeaderTheme;
  maxVisibleToasts: 1 | 3 | 5;
  timeFormat: TimeFormat;
  currencyDisplay: CurrencyDisplay;
  negativeStyle: NegativeStyle;

  /* --- added 2026-09-03, second pass ------------------------------------- */

  /** Drives --radius, 0-20px. 0 squares every corner in the app at once. */
  cornerRadius: number;
  /** Where "/" lands. "last-visited" restores the page you closed on. */
  landingPage: LandingPage;
  defaultModule: string;

  stickyTableHeader: boolean;
  zebraStripes: boolean;
  /** Off truncates a long cell to one line; on lets it wrap. */
  wrapCellText: boolean;
  confirmBulkActions: boolean;
  exportFormat: ExportFormat;

  clockSeconds: boolean;
  /** "branch" shows the selected branch's local time, not the browser's --
      the point of a clock in a shell used across Dubai and Kochi. */
  clockZone: ClockZone;
  docsPosition: DocsPosition;
}

export interface MenuItem {
  labelKey?: string;
  id: string;
  label: string;
  icon?: LucideIcon;
  pageId?: string;
  badge?: string;
  children?: MenuItem[];
}

export interface MenuSection {
  labelKey?: string;
  id: string;
  label: string;
  items: MenuItem[];
}

export interface ModuleDefinition {
  labelKey?: string;
  shortLabelKey?: string;
  id: ModuleKey;
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  icon: LucideIcon;
  navigation: MenuSection[];
}

/** Gate 1. The build-time decision, and the only gate a tenant administrator
    cannot turn back on. See the AI assistant spec §4.1.

    `enabled` was once the literal `true`, because absent meant off and the only
    reason to write a block was to turn the assistant ON. Since PAGE_REGISTRY
    grew a per-kind default, absent means ON, and that type left a page with no
    way to opt out at all -- the type forbade the one value that now mattered.
    It is a boolean because `{ enabled: false }` has to be expressible. */
export interface PageAiConfig {
  enabled: boolean;
  /** Ids from @pepbits/ai-config's USE_CASES. Held as strings so erp-config
      stays free of an ai-config dependency: the arrow runs ai-config ->
      erp-config, never back. Validity is checked at load by the AI layer. */
  useCases: string[];
}

export interface PageDefinition {
  templateId?: string;
  templateDefinition?: PageTemplateDefinition;
  titleKey?: string;
  subtitleKey?: string;
  id: string;
  title: string;
  subtitle: string;
  kind: PageKind;
  module: ModuleKey | "shared";
  entity?: string;
  icon?: LucideIcon;
  ai?: PageAiConfig;
}

export interface FormOption {
  label: string;
  value: string;
}

export interface FormFieldSchema {
  labelKey?: string;
  helpKey?: string;
  placeholderKey?: string;
  visibleWhen?: { field: string; equals: string | number | boolean };
  requiredWhen?: { field: string; equals: string | number | boolean };
  optionsByField?: { field: string; values: Record<string, FormOption[]> };
  min?: number;
  max?: number;
  notBefore?: string;
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: FormOption[];
  colSpan?: 1 | 2;
  help?: string;
  prefix?: string;
  suffix?: string;
  defaultValue?: string | number | boolean | string[];
}

export interface FormSectionSchema {
  titleKey?: string;
  descriptionKey?: string;
  id: string;
  title: string;
  description: string;
  fields: FormFieldSchema[];
}

export interface EntitySchema {
  id: string;
  singular: string;
  plural: string;
  description: string;
  sections: FormSectionSchema[];
}

export interface DataColumn {
  labelKey?: string;
  key: string;
  label: string;
  type?: "text" | "money" | "date" | "status" | "number" | "percent";
  width?: number;
  sortable?: boolean;
  defaultVisible?: boolean;
  /**
   * Whether this value can be corrected in the table.
   *
   * Opt-in per column, because most of them should not be: an id is not a typo
   * to fix in place, and a status usually has a workflow behind it. It is for
   * the small safe changes a form is too much for.
   */
  editable?: boolean;
}

export interface WorklistConfig {
  id: string;
  entity: string;
  title: string;
  description: string;
  basicFilters: Array<{ key: string; label: string; type: "text" | "select" | "date"; options?: string[] }>;
  advancedFilters: Array<{ key: string; label: string; type: "text" | "select" | "date"; options?: string[] }>;
  columns: DataColumn[];
  rows: Array<Record<string, string | number | boolean>>;
  primaryKey: string;
  displayKey: string;
}

export interface WorkspaceTab {
  id: string;
  title: string;
  pageId: string;
  mode?: "view" | "edit" | "new";
  recordId?: string;
  closable?: boolean;
}

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: "success" | "error" | "warning" | "info";
}
