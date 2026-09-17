"use client";
import {useShellHost} from "./shell-host";

import {SessionLock} from "./session-lock";
import { LocalizationProvider } from "@pepbits/ops-ui";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PREFERENCES, LANGUAGE_OPTIONS, LANGUAGE_LOCALES, MODULES, PAGE_REGISTRY,
  createFormatters, preferenceOverrides, sanitizePreferences, translate, loadFallbackLanguage,
  EMPTY_PREFERENCE_POLICY, validPreference, parsePreferencePolicy, policyDefaults, editablePreferenceOverrides, effectivePreferences,
  type PreferencePolicy,
  SHORTCUTS,
  SIDEBAR_SEARCH_EVENT,
  matchesShortcut,
  shortcutAvailable,
} from "@pepbits/erp-config";
import type { Formatters, ModuleKey, ToastItem, UserPreferences } from "@pepbits/erp-config";
import { useNavigation } from "@pepbits/platform-ports";
import { authedFetch, useSession } from "@pepbits/auth";
import { useProduct, useProductLanguageLoader, useProductPreferenceRequest } from "./product-context";
import { useOptionalWorkspace } from "@pepbits/workspace-core";


/* Every family here is loaded by the shells (Google Fonts in web's layout.tsx
   and desktop's index.html), so the picker changes what you see. Before this
   the list offered Inter and Manrope with neither loaded -- the choice did
   nothing on any machine that lacked them locally, which is most machines. */
const FONT_MAP: Record<string, string> = {
  inter: "Inter, ui-sans-serif, system-ui, sans-serif",
  plex: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  "source-sans": "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
  nunito: "'Nunito Sans', ui-sans-serif, system-ui, sans-serif",
  manrope: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  "plex-mono": "'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
};

/* 13px is the reference: the design as drawn. Each scale is the chosen px over
   that, applied by calc() at every text class -- see tokens.css for why the
   multiplication happens at the element and not here. */
const TYPE_REFERENCE_PX = 13;

/** Table/card row padding, as a variable so density has ONE definition. */
const ROW_PADDING = { compact: "6px", comfortable: "10px", spacious: "14px" };

interface ERPContextValue {
  /** Derived from the navigation port, never stored. Two sources of truth for the
      active module was what stranded a foreign home tab in the desktop tab bar. */
  currentModule: ModuleKey;
  module: (typeof MODULES)[ModuleKey];
  preferences: UserPreferences;
  preferencesAvailable: boolean;
  preferencePolicy: PreferencePolicy;
  canManagePreferencePolicy: boolean;
  refreshPreferences: () => Promise<void>;
  preferenceSaveError: string;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  updatePreferences: (next: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  branch: string;
  setBranch: (branch: string) => void;
  /** Read-only now. The role selector was a "view as" control, not
      authorization; with it gone the role is simply the signed-in account's. */
  role: string;
  toasts: ToastItem[];
  toast: (toast: Omit<ToastItem, "id">) => void;
  /** Preference-aware value formatting. Every screen renders money, dates and
      numbers through this, so one preference change reformats all of them. */
  format: Formatters;
  dismissToast: (id: string) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  documentationOpen: boolean;
  setDocumentationOpen: (open: boolean) => void;
  t: (key: string, values?:Record<string,string|number>) => string;
}

const ERPContext = createContext<ERPContextValue | null>(null);

export function dashboardPageId(module: ModuleKey): string {
  return module === "library" ? "library-dashboard" : `${module}-dashboard`;
}

/** The module a page belongs to, with "shared" pages inheriting the fallback so the
    sidebar keeps rendering a real module while Preferences is open. */
export function moduleForPage(pageId: string, fallback: ModuleKey = "finance"): ModuleKey {
  const page = PAGE_REGISTRY[pageId];
  return page && page.module !== "shared" ? page.module : fallback;
}

/** Where the boot-time answer to "skeletons?" is kept. */
export const SKELETON_HINT = "nexora-loading-skeletons";

/** Readable before the provider exists, so the fallback can be chosen. */
export function skeletonsPreferred(): boolean {
  try { return window.localStorage.getItem(SKELETON_HINT) !== "false"; } catch { return true; }
}

export function ERPProvider({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const product = useProduct();
  const preferenceRequest=useProductPreferenceRequest()??authedFetch;
  const loadProductLanguage = useProductLanguageLoader();
  const languageRequest = useRef(0);
  useEffect(() => () => { languageRequest.current++; }, []);
  const navigation = useNavigation();
  const { user } = useSession();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  /* Seeded from the signed-in account rather than hardcoded, but still user-changeable:
     the header selectors are a "view as" control in this prototype, not authorization. */
  const host=useShellHost();
  const [localBranch, setLocalBranch] = useState(user?.branch ?? "hq");
  const branch=host?.branch??localBranch;
  const setBranch=useCallback((value:string)=>{if(host){if(host.branches.some(b=>b.value===value))host.onBranchChange(value);}else setLocalBranch(value);},[host]);
  const [role] = useState(user?.role ?? "enterprise-admin");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  /* Optional: the web shell has no workspace yet, and the same provider runs
     in both. */
  const workspace = useOptionalWorkspace();
  const [helpOpen, setHelpOpen] = useState(false);
  const [documentationOpen, setDocumentationOpen] = useState(false);
  /* Remembered only so a "shared" page (Preferences, Spreadsheet Studio, the Developer
     Library) keeps the sidebar on the module the user came from. */
  const [lastModule, setLastModule] = useState<ModuleKey>(product.defaultModule);

  const activePage = product.pages[navigation.current.pageId];
  const currentModule = activePage && activePage.module !== "shared" ? activePage.module : lastModule;

  useEffect(() => {
    const page = product.pages[navigation.current.pageId];
    if (page && page.module !== "shared") setLastModule(page.module);
  }, [navigation.current.pageId, product]);

  /* Preferences come from the server, keyed by the signed-in user. The shell renders
     `fallback` until they land, so it never paints in one theme and then jumps to
     another — and localStorage holds none of this, because two stores for one setting
     is a reconciliation bug waiting to happen. */
  const [loaded, setLoaded] = useState(false);
  const [preferencesAvailable, setPreferencesAvailable] = useState(false);
  const [preferencesEdited, setPreferencesEdited] = useState(false);
  const [preferencePolicy,setPreferencePolicy]=useState<PreferencePolicy>(EMPTY_PREFERENCE_POLICY);
  const policyRef=useRef(preferencePolicy);policyRef.current=preferencePolicy;
  const [canManagePreferencePolicy,setCanManagePreferencePolicy]=useState(false);
  const [preferenceSaveError,setPreferenceSaveError]=useState("");
  const userRevision=useRef<number|undefined>(undefined);
  const generation=useRef(0);
  const saving=useRef(false);
  const [saveAttempt,setSaveAttempt]=useState(0);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const requestPreferences=useCallback((init?:RequestInit)=>preferenceRequest("/preferences",{...init,headers:{...init?.headers,"X-Product-Id":product.id}}),[product.id,preferenceRequest]);
  const acceptSnapshot=useCallback(async(body:{preferences?:unknown;policy?:unknown;userRevision?:number;canManage?:boolean})=>{
    const policy=body.policy?parsePreferencePolicy(body.policy):EMPTY_PREFERENCE_POLICY;
    if(policy.revision<policyRef.current.revision)return;
    if(policy.revision===policyRef.current.revision && body.userRevision!==undefined && userRevision.current!==undefined && body.userRevision<userRevision.current)return;
    const next=effectivePreferences(sanitizePreferences(body.preferences),policy);
    if(next.defaultModule && !product.modules[next.defaultModule as ModuleKey]) next.defaultModule="";
    const request=++languageRequest.current;
    await (loadProductLanguage?loadProductLanguage(next.language):loadFallbackLanguage(next.language));
    if(!alive.current || request!==languageRequest.current)return;
    policyRef.current=policy;userRevision.current=body.userRevision;
    generation.current++;
    setPreferencesEdited(false);setPreferencePolicy(policy);setCanManagePreferencePolicy(body.canManage===true);
    setPreferences(next);setPreferencesAvailable(true);
  },[loadProductLanguage,product.modules]);
  const refreshPreferences=useCallback(async()=>{
    // Stop pending writes until the current server policy has been loaded.
    generation.current++;setPreferencesEdited(false);setPreferencesAvailable(false);
    try {
      const response=await requestPreferences();if(!response.ok)throw new Error("Could not refresh preferences.");
      await acceptSnapshot(await response.json());setPreferenceSaveError("");
    }catch {if(alive.current)setPreferenceSaveError("Could not refresh preferences.");}
  },[requestPreferences,acceptSnapshot]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await requestPreferences();
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as { preferences?: unknown };
          if (!body || !body.preferences || typeof body.preferences !== "object" || Array.isArray(body.preferences)) {
            throw new Error("Invalid preferences response");
          }
          /* Validated, not spread. A theme id removed in a later release, or a
             hand-edited preferences.json, used to reach the shell verbatim and
             set data-theme to a selector no stylesheet defines. */
          if (!cancelled) {
            await acceptSnapshot(body);
          }
        }
      } catch {
        // API unreachable: fall through to defaults rather than blocking the shell.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Writes are serialized; a later edit waits for the preceding user revision.
  useEffect(() => {
    if (!preferencesAvailable || !preferencesEdited) return;
    const timer=window.setTimeout(async()=>{
      if(saving.current)return;
      saving.current=true;const version=generation.current;
      try {
        const response=await requestPreferences({method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          preferences:editablePreferenceOverrides(preferences,policyRef.current),policyRevision:policyRef.current.revision,userRevision:userRevision.current,
        })});
        if(!response.ok) {
          if([400,403,409].includes(response.status)) {
            await refreshPreferences();
            if(alive.current)setPreferenceSaveError("Preferences changed. The current administrator policy has been applied.");
          }else throw new Error("Could not save preferences. Retry your changes.");
          return;
        }
        const body=await response.json().catch(()=>null);
        if(!alive.current)return;
        if(body?.userRevision!==undefined)userRevision.current=body.userRevision;
        setPreferenceSaveError("");
        if(version===generation.current)setPreferencesEdited(false);
      }catch {if(alive.current)setPreferenceSaveError("Could not save preferences. Retry your changes.");}
      finally {
        saving.current=false;
        if(alive.current && version!==generation.current)setSaveAttempt(value=>value+1);
      }
    },400);
    return()=>window.clearTimeout(timer);
  },[preferencesAvailable,preferencesEdited,preferences,saveAttempt,requestPreferences,refreshPreferences]);

  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState!=="hidden" && !saving.current && !preferencesEdited)void refreshPreferences();};
    window.addEventListener("focus",refresh);
    window.addEventListener("nexora-preference-policy-changed",refresh);
    const timer=window.setInterval(refresh,60000);
    return()=>{window.removeEventListener("focus",refresh);window.removeEventListener("nexora-preference-policy-changed",refresh);window.clearInterval(timer);};
  },[refreshPreferences,preferencesEdited]);

  useEffect(() => {
    if (!preferencesAvailable) return;
    try { window.localStorage.setItem(SKELETON_HINT, String(preferences.loadingSkeletons)); } catch { /* storage unavailable */ }
  }, [preferencesAvailable, preferences.loadingSkeletons]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.reducedMotion = String(preferences.reducedMotion);
    root.style.setProperty("--font-ui", FONT_MAP[preferences.fontFamily] ?? FONT_MAP.inter);
    root.style.setProperty("--fs-shell", String(preferences.fontSizeBase / TYPE_REFERENCE_PX));
    root.style.setProperty("--fs-form", String(preferences.fontSizeForm / TYPE_REFERENCE_PX));
    root.style.setProperty("--fs-result", String(preferences.fontSizeResult / TYPE_REFERENCE_PX));
    /* Written as variables rather than read as props by each component: one
       assignment restyles every card, table row and input at once, and there is
       no ternary to duplicate across DataTable and CardGrid. */
    root.style.setProperty("--radius", `${preferences.cornerRadius}px`);
    root.style.setProperty("--row-py", ROW_PADDING[preferences.density]);
    const language = LANGUAGE_OPTIONS.find((item) => item.value === preferences.language);
    root.lang = preferences.language;
    root.dir = language?.dir ?? "ltr";
  }, [preferences]);

  useEffect(() => {
    window.localStorage.setItem("nexora-module", currentModule);
  }, [currentModule]);

  const updatePreferences = useCallback((next: Partial<UserPreferences>) => {
    if(!preferencesAvailable)return;
    const blocked=Object.entries(next).filter(([key,value])=>policyRef.current.rules[key as keyof UserPreferences]?.locked && preferences[key as keyof UserPreferences]!==value);
    if(blocked.length)setToasts(previous=>[...previous,{id:`policy-${Date.now()}`,title:"Managed by your administrator",message:"Locked preferences were not changed.",type:"info" as const}].slice(-preferences.maxVisibleToasts));
    const allowed=Object.fromEntries(Object.entries(next).filter(([key,value])=>validPreference(key,value)&&!policyRef.current.rules[key as keyof UserPreferences]?.locked&&(!policyRef.current.rules[key as keyof UserPreferences]?.allowedValues||policyRef.current.rules[key as keyof UserPreferences]!.allowedValues!.includes(value))));
    if(!Object.keys(allowed).length)return;
    generation.current++;
    const {language, ...otherPreferences} = allowed as Partial<UserPreferences>;
    // An unrelated preference edit must neither cancel a language request nor
    // be overwritten when its catalog eventually arrives.
    if (Object.keys(otherPreferences).length) {
      setPreferencesEdited(true);
      setPreferences(previous => ({...previous, ...otherPreferences}));
    }
    if (!language) return;
    const request = ++languageRequest.current;
    const apply = () => {
      if (request !== languageRequest.current || policyRef.current.rules.language?.locked) return;
      setPreferencesEdited(true);
      setPreferences(previous => ({...previous, language}));
    };
    if (language !== preferences.language) {
      const load = loadProductLanguage ? loadProductLanguage(language) : loadFallbackLanguage(language);
      void load.then(apply).catch(() => {
        if (request !== languageRequest.current) return;
        setToasts(previous => [...previous, {id: `language-${request}`, title: "Could not load language", message: "Your current language was kept. Please try again.", type: "error" as const}].slice(-preferences.maxVisibleToasts));
      });
    } else apply();
  }, [loadProductLanguage, preferences, preferencesAvailable]);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    updatePreferences({[key]: value});
  }, [updatePreferences]);

  const resetPreferences = useCallback(() => { updatePreferences(policyDefaults(policyRef.current)); }, [updatePreferences]);

  const toast = useCallback((nextToast: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    /* Trimmed on ADD, not at render: keeping the overflow in state and showing
       only the last N leaves invisible toasts holding live dismiss timers, and
       a bulk action would then drip them back one at a time as those fire. */
    setToasts((previous) => [...previous, { ...nextToast, id }].slice(-preferences.maxVisibleToasts));
    window.setTimeout(() => setToasts((previous) => previous.filter((item) => item.id !== id)), preferences.toastDuration);
  }, [preferences.maxVisibleToasts, preferences.toastDuration]);

  const dismissToast = useCallback((id: string) => setToasts((previous) => previous.filter((item) => item.id !== id)), []);

  useEffect(() => {
    /* OFF UNBINDS, rather than binding and then ignoring. Someone who turns
       shortcuts off usually wants a key back — for a screen reader, the browser,
       an IME — and a listener that swallows the event before deciding not to act
       has still taken it. */
    if (!preferences.keyboardShortcuts) return undefined;

    const actions: Record<string, () => void> = {
      command: () => setCommandOpen(true),
      preferences: () => navigation.open({ pageId: "preferences" }),
      dashboard: () => navigation.open({ pageId: `${currentModule}-dashboard` }),
      search: () => window.dispatchEvent(new CustomEvent(SIDEBAR_SEARCH_EVENT)),
      newRecord: () => navigation.openInNewContext({ pageId: navigation.current.pageId, mode: "new" }),
      pinSidebar: () => updatePreference("sidebarPinned", !preferences.sidebarPinned),
      help: () => setHelpOpen(true),
      split: () => { workspace?.splitWithPrevious("right"); },
      exitSplit: () => { workspace?.exitSplit(); },
    };

    const onKey = (event: KeyboardEvent) => {
      /* Holding a shortcut used to append one tab per OS key-repeat event. */
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      /* getAttribute is called through `?.` as well as target. An event
         dispatched at `window` rather than at an element -- by an assistive
         tool, an extension, a test -- has a target with no getAttribute, and a
         throw here leaves the handler dead: every shortcut in the shell stops
         working, silently, because the listener never reaches the loop. */
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA"
        || target?.getAttribute?.("contenteditable") === "true";

      /* One loop over the registry, so a shortcut cannot exist in the help panel
         and not in the binding, or the other way round. */
      for (const shortcut of SHORTCUTS) {
        if (!matchesShortcut(shortcut, event)) continue;
        /* The same predicate the help panel uses, so a key listed there always
           does something and a key that does nothing is never listed. */
        if (!shortcutAvailable(shortcut, { workspace: workspace !== null })) continue;
        if (typing && !shortcut.whileTyping) continue;
        const run = actions[shortcut.id];
        if (!run) continue;
        event.preventDefault();
        run();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentModule, navigation, preferences.keyboardShortcuts, preferences.sidebarPinned, updatePreference, workspace]);

  const t = useCallback((key: string,values?:Record<string,string|number>) => translate(preferences.language, key,values,product.translations), [preferences.language,product.translations]);
  const localization=useMemo(()=>({language:preferences.language,direction:(preferences.language==='ar'?'rtl':'ltr') as 'rtl'|'ltr',t,dateTime:(value:string|Date)=>{
    const date=new Date(value);return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat(LANGUAGE_LOCALES[preferences.language],{dateStyle:'medium',timeStyle:'short'}).format(date);
  }}),[preferences.language,t]);

  const format = useMemo(() => createFormatters(preferences), [
    preferences.currencyCode, preferences.numberLocale, preferences.dateFormat, preferences.decimalPlaces,
    preferences.timeFormat, preferences.currencyDisplay, preferences.negativeStyle, preferences.language,
  ]);

  const value = useMemo<ERPContextValue>(() => ({
    currentModule,
    module: product.modules[currentModule] ?? product.modules[product.defaultModule]!,
    preferences,
    preferencesAvailable,
    preferencePolicy,canManagePreferencePolicy,refreshPreferences,preferenceSaveError,
    updatePreference,
    updatePreferences,
    resetPreferences,
    branch,
    setBranch,
    role,
    toasts,
    toast,
    dismissToast,
    format,
    commandOpen,
    setCommandOpen,
    helpOpen,
    setHelpOpen,
    documentationOpen,
    setDocumentationOpen,
    t,
  }), [preferencePolicy,canManagePreferencePolicy,refreshPreferences,preferenceSaveError,product, branch, setBranch, commandOpen, currentModule, dismissToast, documentationOpen, format, helpOpen, preferences, preferencesAvailable, resetPreferences, role, t, toast, toasts, updatePreference, updatePreferences]);

  if (!loaded) return <>{fallback}</>;

  return <ERPContext.Provider value={value}><LocalizationProvider value={localization}><SessionLock>{children}</SessionLock></LocalizationProvider></ERPContext.Provider>;
}

export function useERP() {
  const context = useContext(ERPContext);
  if (!context) throw new Error("useERP must be used within ERPProvider");
  return context;
}
