"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Role, Staff } from "../../shared/types";
import { parseProviderSession, type ProviderSession, type TeleconsultSettings } from "../../shared/contract";
import { qs } from "../../shared/client";
import { ProviderRoleProvider, useSessionClient } from "./api";

interface Session {
  /** Server-validated mode currently in use. */
  role: Role;
  /** Modes the server granted to this account; only these are offered by the chooser. */
  roles: Role[];
  /** Ask for another granted mode. The server re-validates; an ungranted request is ignored. */
  setRole: (r: Role) => void;
  user?: Staff;
  staff: Staff[];
  canRegister: boolean;
  /** Effective branch policy from the server (visit modes, slot durations, recording, simulation). */
  settings: TeleconsultSettings;
  apiError?: string;
}

const Ctx = createContext<Session | null>(null);

/**
 * Loads GET /api/session. The effective role, granted roles, staff user and registration right all come
 * from the server -- there is no browser-stored identity or role.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useSessionClient();
  const [requested, setRequested] = useState<Role>();
  const [session, setSession] = useState<ProviderSession>();
  const [error, setError] = useState<string>();
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const controller = new AbortController();
    client.get<unknown>(`/api/session${qs({ role: requested })}`, { signal: controller.signal })
      .then((raw) => {
        if (n !== seq.current) return;
        setSession(parseProviderSession(raw));
        setError(undefined);
      })
      .catch((e) => {
        if (n !== seq.current || (e as Error).name === "AbortError") return;
        setError((e as Error).message);
        // A refused mode must not stay selected: fall back to whatever the server last granted.
        setRequested(undefined);
      });
    return () => { seq.current++; controller.abort(); };
  }, [client, requested]);

  const setRole = useCallback((role: Role) => { if (session?.roles.includes(role)) setRequested(role); }, [session]);
  const value = useMemo<Session | null>(() => session ? {
    role: session.role, roles: session.roles, setRole, user: session.user, staff: session.staff, canRegister: session.canRegister, settings: session.settings, apiError: error,
  } : null, [session, setRole, error]);

  if (!value) {
    return error
      ? <p role="alert" className="m-4 rounded-md border border-alarm-100 bg-alarm-50 p-3 text-sm text-alarm-600">{error}</p>
      : <p role="status" className="p-6 text-sm text-ink-400"><LocalizedText message={"Loading Teleconsult…"} /></p>;
  }
  return <Ctx.Provider value={value}><ProviderRoleProvider value={value.role}>{children}</ProviderRoleProvider></Ctx.Provider>;
}

export function useSession() {
  const session = useContext(Ctx);
  if (!session) throw new Error("useSession requires the Teleconsult provider session");
  return session;
}
