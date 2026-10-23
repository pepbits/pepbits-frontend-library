"use client";
import { createContext, useContext } from "react";
import type { Branch, CategoryDef, Meta, PageDef, ResourceDef, User } from "../../lib/types";

/** What the pages read from the source's AppProvider. There is no actor switch: the signed-in host user is the actor. */
export interface RcmState {
  meta: Meta;
  /** The signed-in host user (server-mapped). Used only to show which decisions the user may take; the server enforces independence. */
  actor: User;
  /** Source scope filter: a branch code or `ALL:<currency>`. A filter inside the host-authorized branches, never authority. */
  scope: string;
  setScope: (scope: string) => void;
  /** Currency, label and branch list of the current scope filter. */
  scopeInfo: { label: string; long: string; currency: string; branches: string[] };
  /** Count awaiting a second person per page key (`GET /pending`). */
  pending: Record<string, number>;
  /** Refetches every mounted read (pending badges, lists, dashboards) after a mutation. */
  refreshPending: () => void;
  resource: (key: string) => ResourceDef | undefined;
  category: (key: string) => CategoryDef | undefined;
  pageFor: (path: string) => { page: PageDef; category: CategoryDef } | undefined;
  /** A directory row for a history, approval or audit actor id. */
  user: (id: number | null | undefined) => User | undefined;
  branches: Branch[];
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  /** False while `GET /pending` cannot be reached. */
  online: boolean;
}

export const RcmContext = createContext<RcmState | null>(null);

export function useApp(): RcmState {
  const v = useContext(RcmContext);
  if (!v) throw new Error("useApp must be used inside the RCM shell");
  return v;
}
