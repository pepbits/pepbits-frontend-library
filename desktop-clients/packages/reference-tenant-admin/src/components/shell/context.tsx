"use client";
import { createContext, useContext } from "react";
import type { CategoryDef, Meta, ResourceDef, User } from "../../lib/types";

/** What the pages read from the source's AppProvider. There is no actor switch: the signed-in host user is the actor. */
export interface TenantAdminState {
  meta: Meta;
  /** The signed-in host user (server-mapped). Used only to show which decisions the user may take; the server enforces independence. */
  actor: User;
  /** Count of changes awaiting approval per resource key (`GET /pending`). */
  pending: Record<string, number>;
  /** True once `GET /pending` has answered at least once (before that `pending` is empty, not zero). */
  pendingReady: boolean;
  /** Refetches `GET /pending` (and every other mounted read) after a mutation. */
  refreshPending: () => void;
  resource: (key: string) => ResourceDef | undefined;
  category: (key: string) => CategoryDef | undefined;
  /** A directory row for a history, approval or audit actor id. */
  user: (id: number | null | undefined) => User | undefined;
  openPalette: () => void;
  /** False while `GET /pending` cannot be reached. */
  online: boolean;
}

export const TenantAdminContext = createContext<TenantAdminState | null>(null);

export function useApp(): TenantAdminState {
  const v = useContext(TenantAdminContext);
  if (!v) throw new Error("useApp must be used inside the Tenant Admin shell");
  return v;
}
