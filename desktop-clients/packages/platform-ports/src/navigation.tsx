"use client";

import React, { createContext, useContext } from "react";

export interface NavigationTarget {
  pageId: string;
  /** Selected catalog view when one page belongs to several modules. */
  moduleId?: string;
  mode?: "view" | "edit" | "new";
  recordId?: string;
  title?: string;
}

export interface NavigationPort {
  /** Where the user is now. Drives the sidebar highlight and the header title. */
  current: NavigationTarget;
  /** Open the target the way this shell opens things by default.
      Web navigates in place; desktop reuses the matching tab, else appends one. */
  open(target: NavigationTarget): void;
  /** Force a new container: a new browser tab on web, an extra MDI tab on desktop. */
  openInNewContext(target: NavigationTarget): void;
  /** A real href, so every navigating row can be an anchor. Desktop returns "#". */
  hrefFor(target: NavigationTarget): string;
}

/** Stable identity for a target. Desktop uses it as a tab id; web uses it to
    compare the current location against a candidate. */
export function targetKey(target: NavigationTarget): string {
  return `${target.moduleId ? target.moduleId + ":" : ""}${target.pageId}:${target.mode ?? "list"}:${target.recordId ?? "root"}`;
}

const NavigationContext = createContext<NavigationPort | null>(null);

export function NavigationProvider({ value, children }: { value: NavigationPort; children: React.ReactNode }) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

/** Throws when unprovided, deliberately. A silent no-provider fallback produces a
    shell that looks correct and navigates nowhere. */
export function useNavigation(): NavigationPort {
  const port = useContext(NavigationContext);
  if (!port) throw new Error("useNavigation must be used within a NavigationProvider");
  return port;
}
