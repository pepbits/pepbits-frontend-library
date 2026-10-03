"use client";
import { createContext, useContext } from "react";
import type { Meta, User } from "../../lib/types";

export type { Meta, User };
export interface ShellApi {
  meta?: Meta;
  /** The signed-in host user. Identity is the host session's; there is no way to act as someone else from the page. */
  user?: User;
  /** Kept for source call sites. The host session decides who acts, so this never changes the signed-in user. */
  setUserId: (id: string) => void;
  openPalette: () => void;
  openNewRx: () => void;
  theme: "light" | "dark";
  /** Switches between a light and a dark host theme through the host preference path; a no-op while the tenant locks the theme. */
  toggleTheme: () => void;
  /** False when the tenant policy locks the theme (or the host cannot persist preferences): controls must be disabled. */
  canChangeTheme: boolean;
}
export const ShellContext = createContext<ShellApi>({
  setUserId: () => {}, openPalette: () => {}, openNewRx: () => {}, theme: "light", toggleTheme: () => {}, canChangeTheme: false,
});
export const useShell = () => useContext(ShellContext);

/** Source actors that are not people in the directory. */
const SYSTEM_ACTORS: Record<string, string> = { payer: "Payer", system: "eRx gateway", "erx-gateway": "eRx gateway" };

/** Resolve an actor id from history or ledger rows to a person's name (directory first, then the known system actors). */
export function useUserName() {
  const { meta } = useShell();
  return (id?: string | null) => {
    if (!id) return "—";
    const u = meta?.users.find((x) => x.id === id) ?? (meta?.currentUser?.id === id ? meta.currentUser : undefined);
    if (u) return u.name;
    return SYSTEM_ACTORS[id] ?? id;
  };
}
