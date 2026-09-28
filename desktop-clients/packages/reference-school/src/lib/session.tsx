"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useReferenceHost } from "@pepbits/reference-host";
import { useSchoolApi } from "./api";
import type { SchoolUser, SessionPayload } from "./contract";
import type { Role } from "./types";

export const SCHOOL_ROLES: readonly Role[] = ["admin", "teacher", "accountant", "librarian", "parent", "student"];

export { schoolRoleForHost as schoolRoleFor } from "@pepbits/erp-config";
import { schoolRoleForHost as schoolRoleFor } from "@pepbits/erp-config";

/** Portals the authenticated host scope allows, in a fixed priority order. */
export function trustedSchoolRoles(hostRoles: readonly string[]): Role[] {
  const found = new Set(hostRoles.map(schoolRoleFor).filter((r): r is Role => r !== null));
  return SCHOOL_ROLES.filter((r) => found.has(r));
}

interface SessionCtx {
  role: Role;
  user: SchoolUser;
  /** Student ids linked to a parent; [] for other roles. */
  children: string[];
  /** Portals the authenticated scope grants (priority order). The module renders no chooser; a host may pass ?role=. */
  trustedRoles: Role[];
  activeChild: string | null;
  setActiveChild: (id: string) => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export type SessionState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready"; value: SessionCtx };

/** Resolves the portal from host scope roles and the identity from GET /session. No local storage, no demo users. */
export function useSessionState(requestedRole: string | null): SessionState {
  const host = useReferenceHost();
  const api = useSchoolApi();
  const roleKey = host.scope.roles.join("\u0000");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trustedRoles = useMemo(() => trustedSchoolRoles(host.scope.roles), [roleKey]);
  /* Derived, not stored: the portal is the host's ?role= hint when the scope grants it, otherwise the highest-priority
     granted role. Nothing in the module can select a role the authenticated scope does not hold. */
  const role: Role | null = requestedRole && trustedRoles.includes(requestedRole as Role) ? (requestedRole as Role) : trustedRoles[0] ?? null;
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [activeChild, setActiveChild] = useState<string | null>(null);

  useEffect(() => {
    setPayload(null); setError(null); setActiveChild(null);
    if (!role) return;
    let alive = true;
    api.get<{ data: SessionPayload }>(`/session?role=${encodeURIComponent(role)}`)
      .then(({ data }) => {
        if (!alive) return;
        if (!data || data.role !== role || !trustedRoles.includes(data.role) || !data.user?.id) {
          setError("The school session did not match the signed-in role.");
          return;
        }
        setPayload({ ...data, children: Array.isArray(data.children) ? data.children : [] });
      })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [api, role, trustedRoles, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);

  return useMemo<SessionState>(() => {
    if (!role) return { status: "denied" };
    if (error) return { status: "error", message: error, retry };
    if (!payload) return { status: "loading" };
    const child = payload.role === "parent" ? (activeChild && payload.children.includes(activeChild) ? activeChild : payload.children[0] ?? null) : null;
    return {
      status: "ready",
      value: { role: payload.role, user: payload.user, children: payload.children, trustedRoles, activeChild: child, setActiveChild },
    };
  }, [role, error, payload, activeChild, trustedRoles, retry]);
}

export function SessionProvider({ value, children }: { value: SessionCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** For pages rendered inside the module, where a verified session is guaranteed. */
export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession must be used inside the school module");
  return c;
}
