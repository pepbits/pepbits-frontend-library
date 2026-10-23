"use client";

import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {usePreferences} from "@pepbits/preferences/react";
import type {UserPreferences} from "@pepbits/preferences";
import {NavigationProvider, type NavigationPort} from "@pepbits/platform/navigation";
import {useSession} from "@pepbits/platform";
import {PresentationProvider, presentationFromPreferences} from "@pepbits/components";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {WorkspaceProvider, type Workspace} from "./workspace";
import {productForRole, productModuleForPage, productNavigationTarget, moduleLandingPage, type ProductAccess, type ProductDefinition} from "./products";
import {SHORTCUTS, SIDEBAR_SEARCH_EVENT, matchesShortcut, shortcutAvailable} from "./shortcuts";
import type {ShellNavigation} from "./navigation";
import type {ShellTours} from "./tours";
import {ShellScreenHost} from "./screen-host";
import {ShellAppearance} from "./appearance";
import {SessionLock} from "./session-lock";

export interface ShellChoice {value: string; label: string}
export interface ShellBrand {name: string; accentName?: string; tagline: string}
export interface ToastItem {id: string; title: string; message?: string; type: "success" | "error" | "warning" | "info"}
/** Requests belong to the host's authenticated transport. No endpoint or token store is inferred. */
export interface ShellService {request(path: string, init?: RequestInit): Promise<Response>}
export interface ShellDocumentation extends ShellService {releaseId: string; centerPageId?: string; noticePageIds?: readonly string[]}
export interface ShellMonitoring extends ShellService {
  releaseId: string; platform?: "web" | "native";
  /** Native adapters may acknowledge a delivered allowlisted failure. */
  acknowledgeNativeFailure?: () => Promise<void>;
}
export interface ShellProviderProps {
  navigation: NavigationPort;
  product: ProductDefinition;
  productAccess?: ProductAccess;
  /** Shell-only destinations and quick actions; pages/modules are supplied by product. */
  quickPages?: ShellNavigation["quickPages"];
  preferencesPageId?: string;
  branches: readonly ShellChoice[];
  roles: readonly ShellChoice[];
  brand: ShellBrand;
  branch?: string;
  onBranchChange?: (branch: string) => void;
  timezoneForBranch?: (branch: string) => string | undefined;
  documentation?: ShellDocumentation;
  tours?: ShellTours;
  monitoring?: ShellMonitoring;
  workspace?: Workspace;
  children?: ReactNode;
}
interface ShellState extends Omit<ShellProviderProps, "children" | "productAccess" | "branch"> {
  currentModule: string;
  module: ProductDefinition["modules"][string];
  branch: string;
  setBranch(branch: string): void;
  role: string;
  toasts: ToastItem[];
  toast(toast: Omit<ToastItem, "id">): void;
  dismissToast(id: string): void;
  commandOpen: boolean; setCommandOpen(open: boolean): void;
  helpOpen: boolean; setHelpOpen(open: boolean): void;
  documentationOpen: boolean; setDocumentationOpen(open: boolean): void;
}
const Context = createContext<ShellState | null>(null);

/** This provider owns shell state only. Preferences and localization stay in their existing providers. */
export function ShellProvider(props: ShellProviderProps) {
  const {children, workspace, navigation} = props;
  const content = <NavigationProvider value={navigation}><ShellStateProvider {...props}>{children}</ShellStateProvider></NavigationProvider>;
  return workspace ? <WorkspaceProvider workspace={workspace}>{content}</WorkspaceProvider> : content;
}

function ShellStateProvider(props: ShellProviderProps) {
  const {user, expired} = useSession();
  const {preferences, update} = usePreferences();
  const {navigation, workspace, children} = props;
  const product = useMemo(() => productForRole({...props.product, access: props.productAccess ?? props.product.access}, user?.role), [props.product, props.productAccess, user?.role]);
  const [lastModule, setLastModule] = useState(product.defaultModule);
  const candidate = product.pages[navigation.current.pageId]?.module === "shared" && !navigation.current.moduleId
    ? lastModule : productModuleForPage(product, navigation.current.pageId, navigation.current.moduleId ?? lastModule) ?? lastModule;
  const currentModule = product.modules[candidate] ? candidate : product.defaultModule;
  useEffect(() => {if (product.pages[navigation.current.pageId]?.module !== "shared") setLastModule(currentModule);}, [navigation.current.pageId, currentModule, product]);
  const branch = props.branch ?? user?.branch ?? "";
  const setBranch = useCallback((value: string) => {if (props.branches.some(item => item.value === value)) props.onBranchChange?.(value);}, [props.branches, props.onBranchChange]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => {for (const timer of timers.current) clearTimeout(timer); timers.current.clear();}, []);
  useEffect(() => {setToasts(previous => previous.slice(-preferences.maxVisibleToasts));}, [preferences.maxVisibleToasts]);
  const toast = useCallback((next: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    /* Trim on ADD: overflow must not reappear when visible messages expire. */
    setToasts(previous => [...previous, {...next, id}].slice(-preferences.maxVisibleToasts));
    const timer = setTimeout(() => {timers.current.delete(timer); setToasts(previous => previous.filter(item => item.id !== id));}, preferences.toastDuration);
    timers.current.add(timer);
  }, [preferences.maxVisibleToasts, preferences.toastDuration]);
  const dismissToast = useCallback((id: string) => setToasts(previous => previous.filter(item => item.id !== id)), []);
  const [commandOpen, setCommandOpen] = useState(false), [helpOpen, setHelpOpen] = useState(false), [documentationOpen, setDocumentationOpen] = useState(false);
  useEffect(() => {
    /* OFF UNBINDS: disabled shortcuts must return keys to assistive tools and the browser. */
    if (!preferences.keyboardShortcuts || expired) return;
    const actions: Record<string, (() => void) | undefined> = {
      command: () => setCommandOpen(true),
      preferences: props.preferencesPageId ? () => navigation.open({pageId: props.preferencesPageId!}) : undefined,
      dashboard: () => {const pageId = moduleLandingPage(product, currentModule); if (pageId) navigation.open(productNavigationTarget(product, pageId, currentModule));},
      search: () => window.dispatchEvent(new CustomEvent(SIDEBAR_SEARCH_EVENT)),
      newRecord: () => navigation.openInNewContext({...navigation.current, mode: "new", recordId: undefined}),
      pinSidebar: () => {void update({sidebarPinned: !preferences.sidebarPinned});},
      help: preferences.helperEnabled ? () => setHelpOpen(true) : undefined,
      split: () => {workspace?.splitWithPrevious("right");}, exitSplit: () => {workspace?.exitSplit();},
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.getAttribute?.("contenteditable") === "true";
      for (const shortcut of SHORTCUTS) {
        if (!matchesShortcut(shortcut, event) || !shortcutAvailable(shortcut, {workspace: !!workspace}) || typing && !shortcut.whileTyping) continue;
        const run = actions[shortcut.id]; if (!run) continue;
        event.preventDefault(); run(); return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentModule, navigation, preferences.keyboardShortcuts, preferences.sidebarPinned, preferences.helperEnabled, update, workspace, product, props.preferencesPageId, expired]);
  const identity = JSON.stringify([user?.tenantId, user?.id, user?.role, user?.branch]);
  const previousIdentity = useRef(identity);
  useEffect(() => {
    if (previousIdentity.current !== identity) {
      workspace?.logout(); setToasts([]); setCommandOpen(false); setHelpOpen(false); setDocumentationOpen(false);
      previousIdentity.current = identity;
    }
  }, [identity, workspace]);
  const value: ShellState = {...props, product, currentModule, module: product.modules[currentModule], branch, setBranch, role: user?.role ?? "", toasts, toast, dismissToast,
    commandOpen, setCommandOpen, helpOpen, setHelpOpen, documentationOpen, setDocumentationOpen};
  return <Context.Provider value={value}><PresentationProvider value={presentationFromPreferences(preferences)}><ShellScreenHost><ShellAppearance /><SessionLock>{children}</SessionLock></ShellScreenHost></PresentationProvider></Context.Provider>;
}

export function useShell() {
  const context = useContext(Context);
  if (!context) throw new Error("useShell requires a ShellProvider.");
  return context;
}

/** Compatibility-shaped adapter for copied chrome; no store, fetch or localization context. */
export function useERP() {
  const shell = useShell(), settings = usePreferences(), {t} = useLocalization(), format = useFormatters();
  const updatePreference = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => settings.update({[key]: value}), [settings.update]);
  return {...shell, preferences: settings.preferences, updatePreference, updatePreferences: settings.update, isPreferenceLocked: settings.isLocked, format, t};
}
