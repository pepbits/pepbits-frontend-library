"use client";
import {PreferenceControl} from "./policy-controls";
import {PreferencePolicyAdmin} from "./policy-admin";
import { CardGrid } from "@pepbits/ops-ui";
import { LocalizedText } from "@pepbits/ops-ui";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing, CheckCircle2, Clock3, Coins, Download, Languages, MonitorCog, PanelLeft,
  PanelTop, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, Table2, Upload,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FilePicker, RangeInput, SearchInput, Select, Tabs, Toggle, cn } from "@pepbits/ops-ui";
import {
  DEFAULT_PREFERENCES, LANGUAGE_OPTIONS, THEME_OPTIONS, changedPreferenceCount,
  preferenceOverrides, sanitizePreferences, policyDefaults, editablePreferenceOverrides,
} from "@pepbits/erp-config";
import type {
  BillingLayout, ClockZone, ColumnLayoutScope, CurrencyCode, CurrencyDisplay, DateFormat, Density,
  DocsPosition, ExportFormat, FontFamily, FormNavigation, HeaderTheme, HeaderTone, LandingPage, LanguageKey, NegativeStyle, NumberLocale, OpenRecordsIn,
  PreviewMode, ResultView, SearchMode, SidebarExpandOn, SidebarPlacement, SidebarTheme, SidebarTone, TimeFormat, ToastPosition,
  ToastStyle, UserPreferences,
} from "@pepbits/erp-config";
import { TOUR_REVEAL_EVENT, useERP, useProduct, useShellHost } from "@pepbits/erp-shell";

/* Currency is fixed at the tenant's AED for now, so the picker is hidden rather
   than deleted: the preference, its default and the formatter path all stay, so
   flipping this back to true is the whole re-enable. */
const SHOW_CURRENCY_PICKER = false;

type PrefTab = "own" | "behaviour" | "sidebar" | "page" | "notification" | "language" | "general" | "policy";

/** Which tab each tour anchor lives on. */
const TOUR_TABS: Record<string, PrefTab> = {
  "prefs-layout": "behaviour",
  "prefs-sidebar": "sidebar",
  "prefs-theme": "page",
  "prefs-type": "page",
  "prefs-toast": "notification",
  "prefs-lang": "language",
};

const PREF_TABS: Array<{ id: PrefTab; label: string; icon: React.ReactNode }> = [
  {id:"own",label:"preference.ownSettings",icon:<Settings2 className="size-3.5"/>},
  { id: "behaviour",    label: "Behaviour",    icon: <MonitorCog className="size-3.5" /> },
  { id: "sidebar",      label: "Shell",        icon: <PanelLeft className="size-3.5" /> },
  { id: "page",         label: "Page",         icon: <Sparkles className="size-3.5" /> },
  { id: "notification", label: "Notification", icon: <BellRing className="size-3.5" /> },
  { id: "language",     label: "Language & help", icon: <Languages className="size-3.5" /> },
  { id: "general",      label: "General",      icon: <Settings2 className="size-3.5" /> },
];

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function ChoiceGroup<T extends string>({ value, options, onChange }: {
  value: T;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)} className={cn(
          "focus-ring rounded-xl border p-3 text-left transition",
          value === option.value
            ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
        )}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[length:calc(11px*var(--fs-scale))] font-extrabold">{<LocalizedText message={option.label} />}</span>
            {value === option.value ? <CheckCircle2 className="size-4 text-[var(--primary)]" /> : null}
          </div>
          {option.description ? <p className="mt-1 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{<LocalizedText message={option.description} />}</p> : null}
        </button>
      ))}
    </div>
  );
}

/* Vantage's row shape: a small muted label, the control, an optional hint
   beneath. Used by the Layout section so it reads like the page it was copied
   from rather than like the card grid used elsewhere here. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{<LocalizedText message={label} />}</span>
      {children}
      {hint ? <span className="text-[length:calc(9px*var(--fs-scale))] leading-snug text-[var(--text-muted)]">{<LocalizedText message={hint} />}</span> : null}
    </div>
  );
}

/* A segmented control for two or three short options. role="radiogroup", not
   the Tabs component: these are settings, and a screen reader announcing "tab"
   for "Left | Right" would be wrong. */
function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button key={option.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(option.value)}
            className={cn("focus-ring h-8 flex-1 whitespace-nowrap rounded-lg px-2 text-[length:calc(10.5px*var(--fs-scale))] font-bold transition",
              active ? "bg-[var(--primary-fill)] text-white shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]")}>
            {<LocalizedText message={option.label} />}
          </button>
        );
      })}
    </div>
  );
}

/* Each theme card is rendered INSIDE that theme: data-theme on the card makes
   the CSS variables resolve to its palette, so the preview is the real tokens
   rather than three hand-picked swatches that could drift from them. */
function ThemeCard({ id, name, description, active, onSelect }: { id: string; name: string; description: string; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={cn("focus-ring group w-full overflow-hidden rounded-xl border text-left transition", active ? "border-[var(--primary)] ring-2 ring-[var(--primary-soft)]" : "border-[var(--border)] hover:border-[var(--border-strong)]")}>
      <div data-theme={id} className="flex h-20 gap-1.5 p-2" style={{ background: "var(--bg)" }}>
        <div className="w-4 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="mx-auto mt-1.5 size-2 rounded-sm" style={{ background: "var(--primary)" }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="h-3 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
          <div className="flex flex-1 flex-col justify-between rounded-md p-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="h-1.5 w-2/3 rounded-full" style={{ background: "var(--text-muted)", opacity: .55 }} />
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-7 rounded-md" style={{ background: "var(--primary)" }} />
              <div className="h-2.5 w-4 rounded-md" style={{ background: "var(--accent)" }} />
              <div className="ml-auto h-2 w-5 rounded-full" style={{ background: "var(--success)", opacity: .8 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0"><div className="truncate text-[length:calc(10.5px*var(--fs-scale))] font-extrabold">{name}</div><div className="truncate text-[length:calc(8.5px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message={description} /></div></div>
        {active ? <CheckCircle2 className="size-4 shrink-0 text-[var(--primary)]" /> : null}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

/* Each section declares its tab, the keys it owns (for its own Reset button and
   the changed-count badge), and search keywords. Hidden rather than unmounted
   when another tab is active: every control is context-driven so nothing is
   lost either way, but mounted sections stay reachable by the browser's find. */
function PreferenceSection({ title, subtitle, icon, tab, keys, keywords, activeTab, query, tour, children }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tab: PrefTab;
  keys: Array<keyof UserPreferences>;
  keywords: string;
  activeTab: PrefTab;
  query: string;
  /** data-tour anchor, so the guided tour can spotlight this section. */
  tour?: string;
  children: React.ReactNode;
}) {
  const { preferences, updatePreferences, preferencePolicy } = useERP();
  const changed = keys.filter((key) => preferences[key] !== policyDefaults(preferencePolicy)[key]).length;
  /* A search overrides the tab: when you type, every matching section shows
     wherever it lives, which is the whole point of searching. */
  const searching = query.trim().length > 0;
  const matches = !searching || `${title} ${subtitle} ${keywords}`.toLowerCase().includes(query.trim().toLowerCase());
  const visible = searching ? matches : tab === activeTab;
  const resetSection = () => {
    const patch: Partial<UserPreferences> = {};
    for (const key of keys) (patch as Record<string, unknown>)[key] = policyDefaults(preferencePolicy)[key];
    updatePreferences(patch);
  };
  return (
    <Card className="min-w-0" hidden={!visible} data-tour={tour}>
      <CardHeader>
        <CardTitle title={title} subtitle={subtitle} action={
          <span className="flex items-center gap-2">
            {changed ? <Badge tone="brand">{changed}{" "}<LocalizedText message="ui.changed.d67e2e94" /></Badge> : null}
            {changed ? <Button size="xs" variant="ghost" leftIcon={<RotateCcw className="size-3" />} onClick={resetSection}><LocalizedText message="ui.reset.daee7606" /></Button> : null}
            <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">{icon}</span>
          </span>
        } />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PreferencesPage({ showTabPreferences = true }: { showTabPreferences?: boolean }) {
  const product=useProduct();
  const host=useShellHost();
  const { preferences, updatePreference, updatePreferences, resetPreferences, toast, branch, t, preferencePolicy, preferencesAvailable, canManagePreferencePolicy, preferenceSaveError, refreshPreferences } = useERP();
  const set = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    if (!preferencesAvailable || preferencePolicy.rules[key]?.locked) return;
    const allowed=preferencePolicy.rules[key]?.allowedValues;if(allowed&&!allowed.includes(value))return;
    updatePreference(key, value);
  };
  /* Navigation state, not a setting: which tab you last had open should not
     sync across devices. Same for the search box. */
  const [activeTab, setActiveTab] = useState<PrefTab>("behaviour");
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const changed = useMemo(() => Object.keys(editablePreferenceOverrides(preferences,preferencePolicy)).length, [preferences,preferencePolicy]);

  /* The guided tour names a section; if it lives on another tab, switch there
     first or the spotlight would have nothing to measure. The map is the same
     one the sections declare with their `tour` prop. */
  useEffect(() => {
    const onReveal = (event: Event) => {
      const target = (event as CustomEvent<{ target: string }>).detail?.target;
      const owner = TOUR_TABS[target];
      if (owner) { setActiveTab(owner); setQuery(""); }
    };
    window.addEventListener(TOUR_REVEAL_EVENT, onReveal);
    return () => window.removeEventListener(TOUR_REVEAL_EVENT, onReveal);
  }, []);

  /* Export writes only the overrides -- the same shape the server stores -- so
     a file made today still imports cleanly after new preferences are added. */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(editablePreferenceOverrides(preferences,preferencePolicy), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexora-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const importJson = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Invalid preferences file");
      /* Through the same validator the server response goes through: an
         imported file is user-authored and can carry anything. */
      const next = sanitizePreferences({...policyDefaults(preferencePolicy),...(parsed && typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{})});
      updatePreferences(next);
      toast({ title: "Preferences imported", message: `${changedPreferenceCount(next)} settings differ from the defaults.`, type: "success" });
    } catch {
      toast({ title: "Import failed", message: "That file is not a preferences export.", type: "error" });
    }
  };

  const common = { activeTab, query };
  const branchLabel = host?.branches.find(item=>item.value===branch)?.label ?? (branch === "india" ? "Kochi" : branch === "hq" ? "Abu Dhabi" : branch.charAt(0).toUpperCase() + branch.slice(1));

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* ---- header ---------------------------------------------------- */}
      <Card className="flex shrink-0 flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-[var(--primary)]" /><h2 className="text-[length:calc(13px*var(--fs-scale))] font-black"><LocalizedText message="ui.my.preferences.164a6ee1" /></h2>{changed ? <Badge tone="brand">{changed}{" "}<LocalizedText message="ui.changed.d67e2e94" /></Badge> : <Badge tone="neutral"><LocalizedText message="ui.all.defaults.10313df3" /></Badge>}</div>
          <p className="mt-1 text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.saved.to.your.account.and.applied.everywhere.the.moment.810675e5" /></p>
        </div>
        <SearchInput
          className="ml-auto min-w-[220px] flex-1 lg:max-w-xs"
          aria-label="Search settings"
          placeholder="Search settings…"
          value={query}
          onChange={setQuery}
        />
        <div className="flex flex-wrap gap-2">
          <FilePicker accept="application/json,.json" icon={<Upload className="size-3.5" />} label="Import" onFile={(file) => void importJson(file)} />
          <Button variant="secondary" leftIcon={<Download className="size-3.5" />} onClick={exportJson}><LocalizedText message="ui.export.36648955" /></Button>
          <Button variant="ghost" leftIcon={<RotateCcw className="size-3.5" />} onClick={() => { resetPreferences(); toast({ title: "Defaults restored", message: "Every preference is back to its default.", type: "info" }); }}><LocalizedText message="ui.restore.defaults.602f8e63" /></Button>
        </div>
      </Card>

      {preferenceSaveError?<div role="alert"><LocalizedText message={preferenceSaveError} /><Button onClick={()=>void refreshPreferences()}><LocalizedText message="Reload preferences" /></Button></div>:null}
      <CardGrid className="min-h-0 min-w-0 grid-cols-1 flex-1 gap-3 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* ---- rail ------------------------------------------------------ */}
        <Card className="nex-scrollbar p-1.5 lg:h-full lg:overflow-y-auto">
          <Tabs orientation="vertical" variant="pills" items={canManagePreferencePolicy?[...PREF_TABS,{id:"policy",label:"Preference policies",icon:<Settings2 className="size-3.5" />}]:PREF_TABS} value={activeTab} onChange={(value) => { setActiveTab(value as PrefTab); setQuery(""); }} />
          {query.trim() ? <p className="px-2.5 pt-3 text-[length:calc(8.5px*var(--fs-scale))] font-semibold text-[var(--text-muted)]"><LocalizedText message="ui.showing.every.section.matching.f4d5fda7" />{query.trim()}<LocalizedText message="ui.clear.the.search.to.go.back.to.tabs.abb33ccd" /></p> : null}
        </Card>

        {/* ---- sections -------------------------------------------------- */}
        <CardGrid className="nex-scrollbar min-w-0 grid-cols-1 content-start gap-3 lg:h-full lg:overflow-y-auto lg:pe-1">

          {activeTab==="policy"&&canManagePreferencePolicy?<PreferencePolicyAdmin />:null}
          {/* ================= BEHAVIOUR ================= */}
          {/* Row for row, Vantage's Layout group -- same labels, same hints. */}
          <PreferenceSection {...common} tab="own" title="preference.label.defaultModule" subtitle="preference.defaultModule.help" icon={<MonitorCog className="size-4"/>} keys={["defaultModule"]} keywords="own default module startup home">
            <PreferenceControl preferenceKey="defaultModule"><Select label="preference.label.defaultModule" placeholder="" value={preferences.defaultModule} options={[{value:"",label:"Use application default"},...Object.values(product.modules).filter(module=>!!module).map(module=>({value:module!.id,label:module!.labelKey??module!.label}))]} onChange={event=>set("defaultModule",event.target.value)}/></PreferenceControl>
          </PreferenceSection>
          <PreferenceSection {...common} tab="behaviour" tour="prefs-layout" title="Layout" subtitle="Honoured by every module and page." icon={<PanelLeft className="size-4" />}
            keys={["formNavigation", "resultView", "previewMode", "pageSize"]} keywords="layout record form style rail tabs wizard worklist result view table cards quick view preview inline card modal panel rows per page size">
            <div className="grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))" }}>
              <PreferenceControl preferenceKey="formNavigation"><Select label="Record form style" hint="preferences.recordLayout.help" value={preferences.formNavigation} onChange={(event) => set("formNavigation", event.target.value as FormNavigation)} options={[{ value: "rail", label: "Rail" }, { value: "tabs", label: "Tabs" }, { value: "wizard", label: "Wizard" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="resultView"><Row label="Worklist result view">
                <Segmented<ResultView> label="Worklist result view" value={preferences.resultView} onChange={(value) => set("resultView", value)} options={[{ value: "table", label: "Table" }, { value: "cards", label: "Card grid" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="previewMode"><Row label="Quick view style" hint="Shown when clicking a result row">
                <Select aria-label="ui.quick.view.style.c03cba44" value={preferences.previewMode} onChange={(event) => set("previewMode", event.target.value as PreviewMode)} options={[{ label: "template.clinical.inline", value: "inline" }, { label: "Centered record card", value: "center-card" }, { label: "Center modal", value: "center-modal" }, { label: "Left side panel", value: "left-drawer" }, { label: "Right side panel", value: "right-drawer" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="pageSize"><Row label="Default rows per page">
                <Select aria-label="ui.default.rows.per.page.c972be79" value={String(preferences.pageSize)} onChange={(event) => set("pageSize", Number(event.target.value) as 10 | 20 | 50 | 100)} options={[{ label: "10", value: "10" }, { label: "20", value: "20" }, { label: "50", value: "50" }, { label: "100", value: "100" }]} />
              </Row></PreferenceControl>
            </div>
          </PreferenceSection>

          {/* Every sidebar setting in one place. They were spread across
              "Layout" and "Navigation and workspace", so changing how the rail
              behaves meant two sections on one tab. */}
          <PreferenceSection {...common} tab="sidebar" tour="prefs-sidebar" title="Sidebar" subtitle="Placement, how it opens, and the palette the rail uses." icon={<PanelLeft className="size-4" />}
            keys={["sidebarPlacement", "sidebarExpandOn", "sidebarPinned", "sidebarTone", "sidebarTheme", "sidebarFocusExpand"]} keywords="sidebar rail navigation position left right rtl pinned fixed hover click expand tone light dark deep contrast theme palette solarized colour color">
            <div className="grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))" }}>
              <PreferenceControl preferenceKey="sidebarPlacement"><Row label="Position" hint="Right also suits right-to-left languages">
                <Segmented<SidebarPlacement> label="Sidebar position" value={preferences.sidebarPlacement} onChange={(value) => set("sidebarPlacement", value)} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="sidebarExpandOn"><Row label="Expands on" hint="Click opens it from the logo instead">
                <Segmented<SidebarExpandOn> label="Sidebar expands on" value={preferences.sidebarExpandOn} onChange={(value) => set("sidebarExpandOn", value)} options={[{ value: "hover", label: "Hover" }, { value: "click", label: "Click" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="keyboardShortcuts"><Row label="Keyboard shortcuts" hint="Off unbinds them entirely, so the keys go back to the browser">
                <Segmented<"on" | "off"> label="Keyboard shortcuts" value={preferences.keyboardShortcuts ? "on" : "off"} onChange={(value) => set("keyboardShortcuts", value === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="loadingSkeletons"><Row label="Loading placeholders" hint="Shaped grey blocks while a page arrives, instead of the old page sitting there">
                <Segmented<"on" | "off"> label="Loading placeholders" value={preferences.loadingSkeletons ? "on" : "off"} onChange={(value) => set("loadingSkeletons", value === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="sidebarFocusExpand"><Row label="Opens on keyboard focus" hint="Tabbing into the rail expands it, as hovering does">
                <Segmented<"on" | "off"> label="Sidebar opens on keyboard focus" value={preferences.sidebarFocusExpand ? "on" : "off"} onChange={(value) => set("sidebarFocusExpand", value === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="sidebarPinned"><Row label="Pinned open" hint="Pinned, it pushes the page instead of floating over it">
                <Segmented<"on" | "off"> label="Sidebar pinned open" value={preferences.sidebarPinned ? "on" : "off"} onChange={(value) => set("sidebarPinned", value === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="sidebarTone"><Row label="Rail tone" hint="Light and Deep hold whatever the page theme is">
                <Segmented<SidebarTone> label="Sidebar tone" value={preferences.sidebarTone} onChange={(value) => set("sidebarTone", value)} options={[{ value: "surface", label: "Match" }, { value: "light", label: "Light" }, { value: "contrast", label: "Deep" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="sidebarTheme"><Row label="Rail theme" hint="Independent of the page theme — Solarized rail on a Nexora page, say">
                <Select aria-label="ui.sidebar.theme.f7427d59" value={preferences.sidebarTheme} onChange={(event) => set("sidebarTheme", event.target.value as SidebarTheme)} options={[
                  { label: "Match the page theme", value: "match" },
                  ...THEME_OPTIONS.map((theme) => ({ label: theme.name, value: theme.id })),
                ]} />
              </Row></PreferenceControl>
            </div>
          </PreferenceSection>

          {/* The header takes the same two choices as the rail, from the same
              seeds and the same helper -- so a deep rail and a deep bar agree
              without either being told about the other. */}
          <PreferenceSection {...common} tab="sidebar" title="Header" subtitle="The top bar takes the same palette choices as the rail." icon={<PanelTop className="size-4" />}
            keys={["headerTone", "headerTheme"]} keywords="header top bar tone light dark deep contrast theme palette colour color chrome">
            <div className="grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))" }}>
              <PreferenceControl preferenceKey="headerTone"><Row label="Bar tone" hint="Light and Deep hold whatever the page theme is">
                <Segmented<HeaderTone> label="Header tone" value={preferences.headerTone} onChange={(value) => set("headerTone", value)} options={[{ value: "surface", label: "Match" }, { value: "light", label: "Light" }, { value: "contrast", label: "Deep" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="headerTheme"><Row label="Bar theme" hint="Independent of the page theme, as the rail's is">
                <Select aria-label="ui.header.theme.994e2001" value={preferences.headerTheme} onChange={(event) => set("headerTheme", event.target.value as HeaderTheme)} options={[
                  { label: "Match the page theme", value: "match" },
                  ...THEME_OPTIONS.map((theme) => ({ label: theme.name, value: theme.id })),
                ]} />
              </Row></PreferenceControl>
            </div>
          </PreferenceSection>

          <PreferenceSection {...common} tab="behaviour" title="Start-up and records" subtitle="Where you land, and how records open." icon={<MonitorCog className="size-4" />}
            keys={["openRecordsInTabs", "landingPage", "floatingWindows"]} keywords="landing home start page module dashboard last visited records tabs workspace floating windows mdi taskbar">
            <div className="grid gap-2 md:grid-cols-2">
              {showTabPreferences
                ? <PreferenceControl preferenceKey="openRecordsInTabs"><Toggle label="ui.open.records.in.tabs.b10f3af8" description="ui.each.record.gets.its.own.workspace.tab.off.reuses.the.ma.79a0f2f4" checked={preferences.openRecordsInTabs} onChange={(value) => set("openRecordsInTabs", value)} /></PreferenceControl>
                : <PreferenceControl preferenceKey="landingPage"><Select label="ui.start.on.b6089ce4" value={preferences.landingPage} onChange={(event) => set("landingPage", event.target.value as LandingPage)} options={[{ label: "The current module's dashboard", value: "module-dashboard" }, { label: "The page I last had open", value: "last-visited" }]} /></PreferenceControl>}
                {/* Desktop only, and off by default. The framework marks the
                    whole idea optional, so it is offered rather than imposed. */}
                {showTabPreferences
                  ? <PreferenceControl preferenceKey="floatingWindows"><Toggle label="ui.floating.windows.4f5a6c7b" description="ui.arrange.open.records.as.movable.windows.with.a.taskbar.i.dd2f78aa" checked={preferences.floatingWindows} onChange={(value) => set("floatingWindows", value)} /></PreferenceControl>
                  : null}
            </div>
          </PreferenceSection>

          <PreferenceSection {...common} tab="behaviour" title="Lists and record previews" subtitle="Worklists, searching, filtering, previews and exports." icon={<Table2 className="size-4" />}
            keys={["openRecordsIn", "columnLayoutScope", "rememberFilters", "globalSearchMode", "confirmBulkActions", "exportFormat"]} keywords="open records new tab in place search matching filters remember export csv xlsx excel bulk archive confirm columns layout">
            <div>
              <PreferenceControl preferenceKey="openRecordsIn"><ChoiceGroup<OpenRecordsIn> value={preferences.openRecordsIn} onChange={(value) => set("openRecordsIn", value)} options={[{ value: "new-tab", label: "Open records in a new tab", description: "View, Edit and New each get their own container." }, { value: "same-tab", label: "Open records in place", description: "Navigate within the current page instead." }]} /></PreferenceControl>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <PreferenceControl preferenceKey="globalSearchMode"><Select label="ui.search.matching.311a26c4" value={preferences.globalSearchMode} onChange={(event) => set("globalSearchMode", event.target.value as SearchMode)} options={[{ label: "Smart — every word, anywhere in the row", value: "smart" }, { label: "Contains — the phrase, in any cell", value: "contains" }, { label: "Starts with — a cell begins with it", value: "starts-with" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="columnLayoutScope"><Select label="ui.column.layout.is.saved.9e9984dd" value={preferences.columnLayoutScope} onChange={(event) => set("columnLayoutScope", event.target.value as ColumnLayoutScope)} options={[{ label: "For this browser only", value: "browser" }, { label: "To my account", value: "account" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="exportFormat"><Select label="ui.export.format.df339cb8" value={preferences.exportFormat} onChange={(event) => set("exportFormat", event.target.value as ExportFormat)} options={[{ label: "CSV — opens anywhere", value: "csv" }, { label: "Excel workbook (.xlsx)", value: "xlsx" }]} /></PreferenceControl>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <PreferenceControl preferenceKey="rememberFilters"><Toggle label="ui.remember.filters.and.search.e050a77f" description="ui.each.worklist.reopens.with.the.filters.you.left.on.it.b8266e48" checked={preferences.rememberFilters} onChange={(value) => set("rememberFilters", value)} /></PreferenceControl>
              <PreferenceControl preferenceKey="confirmBulkActions"><Toggle label="ui.confirm.bulk.actions.5c64ae13" description="ui.ask.before.archiving.selected.records.36e82503" checked={preferences.confirmBulkActions} onChange={(value) => set("confirmBulkActions", value)} /></PreferenceControl>
            </div>
          </PreferenceSection>

          <PreferenceSection {...common} tab="behaviour" title="Tables" subtitle="How the data table reads at twelve columns and a hundred rows." icon={<Table2 className="size-4" />}
            keys={["stickyTableHeader", "zebraStripes", "wrapCellText"]} keywords="table header sticky zebra stripes wrap truncate rows">
            <div className="grid gap-2 md:grid-cols-3">
              <PreferenceControl preferenceKey="stickyTableHeader"><Toggle label="ui.sticky.header.71a03535" description="ui.column.names.stay.visible.while.you.scroll.4b34c24d" checked={preferences.stickyTableHeader} onChange={(value) => set("stickyTableHeader", value)} /></PreferenceControl>
              <PreferenceControl preferenceKey="zebraStripes"><Toggle label="ui.zebra.stripes.ad73773d" description="ui.alternate.rows.are.tinted.2acedabc" checked={preferences.zebraStripes} onChange={(value) => set("zebraStripes", value)} /></PreferenceControl>
              <PreferenceControl preferenceKey="wrapCellText"><Toggle label="ui.wrap.long.text.0815b2b6" description="ui.off.truncates.a.long.cell.to.one.line.dfad076c" checked={preferences.wrapCellText} onChange={(value) => set("wrapCellText", value)} /></PreferenceControl>
            </div>
          </PreferenceSection>

          <PreferenceSection {...common} tab="behaviour" title="Billing" subtitle="The tax invoice workspace." icon={<MonitorCog className="size-4" />}
            keys={["billingLayout"]} keywords="billing invoice layout workspace split vertical">
            <div><PreferenceControl preferenceKey="billingLayout"><Select label="ui.billing.workspace.layout.54522c95" value={preferences.billingLayout} onChange={(event) => set("billingLayout", event.target.value as BillingLayout)} options={[{ label: "Workspace tabs", value: "workspace" }, { label: "Vertical sections", value: "vertical" }, { label: "Split header and lines", value: "split" }]} /></PreferenceControl></div>
          </PreferenceSection>

          {/* ================= PAGE ================= */}
          <PreferenceSection {...common} tab="page" tour="prefs-theme" title="Theme" subtitle={t("{count} palettes. Each card is drawn with that theme's real tokens.",{count:THEME_OPTIONS.length})} icon={<Sparkles className="size-4" />}
            keys={["theme"]} keywords="theme dark light colour color palette midnight nord plum graphite">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {THEME_OPTIONS.map((theme) => <PreferenceControl key={theme.id} preferenceKey="theme"><ThemeCard id={theme.id} name={theme.name} description={theme.description} active={preferences.theme === theme.id} onSelect={() => set("theme", theme.id)} /></PreferenceControl>)}
            </div>
          </PreferenceSection>

          <PreferenceSection {...common} tab="page" tour="prefs-type" title="Typography" subtitle="Fonts and sizes for the shell, forms and result lists." icon={<Languages className="size-4" />}
            keys={["fontFamily", "fontSizeBase", "fontSizeForm", "fontSizeResult"]} keywords="font family size typography plex inter manrope nunito source sans georgia serif mono base form result table">
            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              <PreferenceControl preferenceKey="fontFamily"><Select label="ui.font.family.119ef3fa" value={preferences.fontFamily} onChange={(event) => set("fontFamily", event.target.value as FontFamily)} options={[
                { label: "Inter (default)", value: "inter" }, { label: "IBM Plex Sans", value: "plex" }, { label: "Source Sans 3", value: "source-sans" }, { label: "Nunito Sans", value: "nunito" },
                { label: "Manrope", value: "manrope" }, { label: "System UI", value: "system" }, { label: "Georgia (serif)", value: "georgia" }, { label: "IBM Plex Mono", value: "plex-mono" },
              ]} /></PreferenceControl>
              <PreferenceControl preferenceKey="fontSizeBase"><RangeInput label="Base font size" hint="Header, sidebar, cards and everything not listed below." value={preferences.fontSizeBase} min={11} max={16} step={0.5} unit="px" onChange={(value) => set("fontSizeBase", value)} /></PreferenceControl>
              <PreferenceControl preferenceKey="fontSizeForm"><RangeInput label="Form field size" hint="Record forms: labels, inputs and section text." value={preferences.fontSizeForm} min={11} max={17} step={0.5} unit="px" onChange={(value) => set("fontSizeForm", value)} /></PreferenceControl>
              <PreferenceControl preferenceKey="fontSizeResult"><RangeInput label="Result / table size" hint="Worklist tables and card grids." value={preferences.fontSizeResult} min={10} max={16} step={0.5} unit="px" onChange={(value) => set("fontSizeResult", value)} /></PreferenceControl>
            </div>
            <p className="mt-3 text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.13px.is.the.design.as.drawn.each.size.scales.its.area.in.21713684" /></p>
          </PreferenceSection>

          <PreferenceSection {...common} tab="page" title="preferences.spacing.title" subtitle="preferences.spacing.help" icon={<SlidersHorizontal className="size-4" />}
            keys={["density", "cornerRadius"]} keywords="patient record appearance spacing density compact comfortable spacious corners radius rounded square">
            <div className="grid gap-4 md:grid-cols-2">
              <PreferenceControl preferenceKey="density"><Select label="ui.density.77a283d6" hint="ui.row.padding.in.tables.and.cards.0a0a1e81" value={preferences.density} onChange={(event) => set("density", event.target.value as Density)} options={[{ label: "Compact", value: "compact" }, { label: "Comfortable", value: "comfortable" }, { label: "Spacious", value: "spacious" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="cornerRadius"><RangeInput label="Corner radius" hint="0 squares every corner in the app." value={preferences.cornerRadius} min={0} max={20} step={1} unit="px" onChange={(value) => set("cornerRadius", value)} /></PreferenceControl>
            </div>
          </PreferenceSection>

          {/* ================= NOTIFICATION ================= */}
          <PreferenceSection {...common} tab="notification" tour="prefs-toast" title="Toasts" subtitle="Where they appear, how long they stay, and how they look. Try one below." icon={<BellRing className="size-4" />}
            keys={["toastPosition", "toastDuration", "maxVisibleToasts", "toastStyle"]} keywords="toast notification position duration solid light style preview">
            <div className="grid gap-4 md:grid-cols-2">
              <PreferenceControl preferenceKey="toastPosition"><Select label="ui.position.6d031af1" value={preferences.toastPosition} onChange={(event) => set("toastPosition", event.target.value as ToastPosition)} options={[
                { label: "Top left", value: "top-left" }, { label: "Top center", value: "top-center" }, { label: "Top right", value: "top-right" }, { label: "Bottom left", value: "bottom-left" }, { label: "Bottom center", value: "bottom-center" }, { label: "Bottom right", value: "bottom-right" },
              ]} /></PreferenceControl>
              <PreferenceControl preferenceKey="toastDuration"><Select label="ui.duration.4fc52a3c" value={String(preferences.toastDuration)} onChange={(event) => set("toastDuration", Number(event.target.value) as 2000 | 3500 | 5000 | 8000)} options={[{ label: "2 seconds", value: "2000" }, { label: "3.5 seconds", value: "3500" }, { label: "5 seconds", value: "5000" }, { label: "8 seconds", value: "8000" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="maxVisibleToasts"><Select label="ui.on.screen.at.once.9b5e8539" value={String(preferences.maxVisibleToasts)} onChange={(event) => set("maxVisibleToasts", Number(event.target.value) as 1 | 3 | 5)} options={[{ label: "1 — newest only", value: "1" }, { label: "3", value: "3" }, { label: "5", value: "5" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="toastStyle"><Select label="ui.style.7e744141" value={preferences.toastStyle} onChange={(event) => set("toastStyle", event.target.value as ToastStyle)} options={[{ label: "Solid — filled with its colour", value: "solid" }, { label: "Light — tinted icon on a surface", value: "light" }]} /></PreferenceControl>
            </div>
            {/* A settings page that demonstrates its own settings: fire one with the
                position, duration and style above without leaving the page. */}
            <Card shadow="none" tone="muted" radius="xl" className="mt-4 flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="text-[length:calc(10px*var(--fs-scale))] font-extrabold"><LocalizedText message="ui.preview.324b134f" /></span>
              <span className="text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.fires.a.sample.using.the.settings.above.33ab8430" /></span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <Button size="xs" variant="success" onClick={() => toast({ title: "Customer saved", message: "CUS-1042 updated successfully.", type: "success" })}><LocalizedText message="ui.success.c88a0b90" /></Button>
                <Button size="xs" variant="secondary" onClick={() => toast({ title: "Credit limit", message: "Exceeded by AED 12,400 on this order.", type: "warning" })}><LocalizedText message="ui.warning.e981ddae" /></Button>
                <Button size="xs" variant="danger" onClick={() => toast({ title: "Posting failed", message: "Period 2026-P08 is locked.", type: "error" })}><LocalizedText message="ui.error.54a0e8c1" /></Button>
                <Button size="xs" variant="ghost" onClick={() => toast({ title: "Bank feed", message: "2,486 transactions imported.", type: "info" })}><LocalizedText message="ui.info.170322a3" /></Button>
              </div>
            </Card>
          </PreferenceSection>

          {/* ================= GENERAL ================= */}
          <PreferenceSection {...common} tab="general" title="Numbers, currency and dates" subtitle="Applied wherever a value is rendered: worklists, cards, previews, reports and billing." icon={<Coins className="size-4" />}
            keys={["currencyCode", "currencyDisplay", "numberLocale", "dateFormat", "decimalPlaces", "timeFormat", "negativeStyle"]} keywords="number currency dirham aed money decimal thousands lakh date time 12 24 hour negative parentheses accounting format locale">
            <div className="grid gap-4 md:grid-cols-2">
              {SHOW_CURRENCY_PICKER ? <PreferenceControl preferenceKey="currencyCode"><Select label="ui.currency.3ac1a9ec" value={preferences.currencyCode} onChange={(event) => set("currencyCode", event.target.value as CurrencyCode)} options={[{ label: "AED — UAE dirham", value: "AED" }, { label: "USD — US dollar", value: "USD" }, { label: "EUR — Euro", value: "EUR" }, { label: "INR — Indian rupee", value: "INR" }, { label: "GBP — Pound sterling", value: "GBP" }]} /></PreferenceControl> : null}
              <PreferenceControl preferenceKey="currencyDisplay"><Select label="ui.currency.shown.as.ab804fb4" value={preferences.currencyDisplay} onChange={(event) => set("currencyDisplay", event.target.value as CurrencyDisplay)} options={[{ label: "Symbol — د.إ1,200", value: "symbol" }, { label: "Code — AED 1,200", value: "code" }, { label: "Number only — 1,200", value: "none" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="numberLocale"><Select label="ui.number.format.457421f8" value={preferences.numberLocale} onChange={(event) => set("numberLocale", event.target.value as NumberLocale)} options={[{ label: "1,234,567.89", value: "en-US" }, { label: "1.234.567,89", value: "de-DE" }, { label: "1 234 567,89", value: "fr-FR" }, { label: "12,34,567.89 — lakh/crore", value: "en-IN" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="decimalPlaces"><Select label="ui.decimal.places.004a3408" value={String(preferences.decimalPlaces)} onChange={(event) => set("decimalPlaces", Number(event.target.value) as 0 | 2 | 3)} options={[{ label: "None — 1,200", value: "0" }, { label: "Two — 1,200.00", value: "2" }, { label: "Three — 1,200.000", value: "3" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="negativeStyle"><Select label="ui.negative.amounts.cd1dd5f2" value={preferences.negativeStyle} onChange={(event) => set("negativeStyle", event.target.value as NegativeStyle)} options={[{ label: "Minus sign — -1,200", value: "minus" }, { label: "Parentheses — (1,200)", value: "parentheses" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="dateFormat"><Select label="ui.date.format.43123f5c" value={preferences.dateFormat} onChange={(event) => set("dateFormat", event.target.value as DateFormat)} options={[{ label: "2026-09-03 — ISO", value: "iso" }, { label: "03/09/2026 — day first", value: "dmy" }, { label: "09/03/2026 — month first", value: "mdy" }, { label: "03 Sep 2026", value: "medium" }]} /></PreferenceControl>
              <PreferenceControl preferenceKey="timeFormat"><Select label="ui.time.format.80d7dcf2" value={preferences.timeFormat} onChange={(event) => set("timeFormat", event.target.value as TimeFormat)} options={[{ label: "24-hour — 14:30", value: "24h" }, { label: "12-hour — 2:30 PM", value: "12h" }]} /></PreferenceControl>
            </div>
          </PreferenceSection>

          <PreferenceSection {...common} tab="general" title="Clock" subtitle="The clock in the header." icon={<Clock3 className="size-4" />}
            keys={["clockSeconds", "clockZone"]} keywords="clock time seconds timezone zone branch dubai kochi header">
            <div className="grid gap-4 md:grid-cols-2">
              <PreferenceControl preferenceKey="clockZone"><Select label="ui.time.zone.b9fe1464" value={preferences.clockZone} onChange={(event) => set("clockZone", event.target.value as ClockZone)} options={[{ label: "This device", value: "browser" }, { label: `Selected branch — ${branchLabel}`, value: "branch" }]} /></PreferenceControl>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <PreferenceControl preferenceKey="clockSeconds"><Toggle label="ui.show.seconds.f516b99a" description="ui.off.ticks.once.a.minute.instead.of.every.second.e07c67a4" checked={preferences.clockSeconds} onChange={(value) => set("clockSeconds", value)} /></PreferenceControl>
            </div>
          </PreferenceSection>

          {/* ================= LANGUAGE & HELP ================= */}
          {/* Row for row, Vantage's "Language & help" group. "Animations" is the
              inverse of reducedMotion -- one stored key, presented the way the
              copied page presents it. Documentation position is left/right
              rather than Vantage's top/bottom because ours is a side drawer. */}
          <PreferenceSection {...common} tab="language" tour="prefs-lang" title="Language & help" subtitle="Applies to menus, actions and messages." icon={<Languages className="size-4" />}
            keys={["language", "helperEnabled", "documentationEnabled", "docsPosition", "reducedMotion", "showKeyboardHints"]} keywords="language arabic hindi malayalam english rtl help assistant tours documentation docs panel position left right animations motion keyboard shortcuts hints">
            <div className="grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))" }}>
              <PreferenceControl preferenceKey="language"><Row label="Language" hint="Arabic switches the whole layout to right-to-left">
                <Select aria-label="ui.language.a4fe6526" value={preferences.language} onChange={(event) => set("language", event.target.value as LanguageKey)} options={LANGUAGE_OPTIONS.map((item) => ({ label: `${item.native} — ${item.label}`, value: item.value }))} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="helperEnabled"><Row label="Help assistant button" hint="Guided tours and shortcuts, bottom corner">
                <Segmented<"on" | "off"> label="Help assistant button" value={preferences.helperEnabled ? "on" : "off"} onChange={(value) => set("helperEnabled", value === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="documentationEnabled"><Row label="Documentation panel on pages">
                <Segmented<"on" | "off"> label="Documentation panel on pages" value={preferences.documentationEnabled ? "on" : "off"} onChange={(value) => set("documentationEnabled", value === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="docsPosition"><Row label="Documentation position" hint="Which side the panel slides in from">
                <Segmented<DocsPosition> label="Documentation position" value={preferences.docsPosition} onChange={(value) => set("docsPosition", value)} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="reducedMotion"><Row label="Animations" hint="Off minimises every transition and motion effect">
                <Segmented<"on" | "off"> label="Animations" value={preferences.reducedMotion ? "off" : "on"} onChange={(value) => set("reducedMotion", value === "off")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
              <PreferenceControl preferenceKey="showKeyboardHints"><Row label="Keyboard shortcut hints" hint="Show discoverable key combinations">
                <Segmented<"on" | "off"> label="Keyboard shortcut hints" value={preferences.showKeyboardHints ? "on" : "off"} onChange={(value) => set("showKeyboardHints", value === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
              </Row></PreferenceControl>
            </div>
          </PreferenceSection>

        </CardGrid>
      </CardGrid>
    </div>
  );
}
