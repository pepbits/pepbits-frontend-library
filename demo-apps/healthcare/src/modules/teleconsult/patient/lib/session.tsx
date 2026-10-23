"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Patient } from "../../shared/types";
import { parsePatientSession, type PatientSession, type TeleconsultSettings } from "../../shared/contract";
import { qs } from "../../shared/client";
import { PatientIdProvider, useSessionClient } from "./api";

interface Ctx {
  /** The beneficiary this session acts for, as granted by the server. Undefined until one is chosen. */
  patient?: Patient;
  /** Everyone the server lets this account act for (one person for a patient account). */
  patients: Patient[];
  canRegister: boolean;
  /** Effective branch policy from the server. Undefined until the session loads; there is no default policy. */
  settings?: TeleconsultSettings;
  ready: boolean;
  error?: string;
  /** Choose a granted person. The server validates the choice; a refused id rejects and changes nothing. */
  signIn: (id: string) => Promise<void>;
  /** Stop acting for the current person (only meaningful when the account may act for several). */
  signOut: () => void;
  refresh: () => Promise<void>;
}
const SessionCtx = createContext<Ctx | null>(null);

/**
 * Loads GET /api/session. Identity is never stored in the browser: no localStorage id, and a list of
 * people comes from the server session, not from a patient search. A dedicated patient account arrives
 * already bound to its own record.
 */
export function PatientSessionProvider({ children }: { children: ReactNode }) {
  const client = useSessionClient();
  const [session, setSession] = useState<PatientSession>();
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState<string>();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const seq = useRef(0);

  const load = useCallback(async (patientId?: string, signal?: AbortSignal) => parsePatientSession(await client.get<unknown>(`/api/session${qs({ patientId })}`, { signal })), [client]);

  useEffect(() => {
    const controller = new AbortController();
    const n = ++seq.current;
    load(undefined, controller.signal)
      .then((loaded) => { if (n !== seq.current) return; setSession(loaded); setSelected(loaded.patient?.id); setError(undefined); })
      .catch((e) => { if (n === seq.current && (e as Error).name !== "AbortError") setError((e as Error).message); });
    return () => { seq.current++; controller.abort(); };
  }, [load]);

  const signIn = useCallback(async (id: string) => {
    const loaded = await load(id);
    if (loaded.patient?.id !== id) throw new Error("This account cannot act for that person");
    seq.current++;
    setSession(loaded);
    setSelected(id);
    setError(undefined);
  }, [load]);

  const signOut = useCallback(() => { setSelected(undefined); setSession((s) => (s ? { ...s, patient: undefined } : s)); }, []);

  const refresh = useCallback(async () => {
    const id = selectedRef.current;
    if (!id) return;
    try { const loaded = await load(id); if (selectedRef.current === id) setSession(loaded); } catch { /* keep what is shown; the next action reports the failure */ }
  }, [load]);

  const value = useMemo<Ctx>(() => ({
    patient: selected ? session?.patient : undefined,
    patients: session?.patients ?? [],
    canRegister: session?.canRegister ?? false,
    settings: session?.settings,
    ready: !!session || !!error,
    error,
    signIn, signOut, refresh,
  }), [session, selected, error, signIn, signOut, refresh]);

  return <SessionCtx.Provider value={value}><PatientIdProvider value={selected}>{children}</PatientIdProvider></SessionCtx.Provider>;
}

export function usePatient() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("usePatient requires the Teleconsult patient session");
  return ctx;
}
