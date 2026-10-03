"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { referenceScopeKey, useReferenceHost, type ReferenceScope } from "@pepbits/reference-host";
import { createMedbandClient, isAbort, toApiError, type MedbandClient } from "./api";
import type { AdmissionAction, AdmissionRequestBody, Bootstrap, CurrentUser, EncounterRequest, PatientBody } from "./api-types";
import { createMaster, MasterProvider, useMaster, type Counter, type Master } from "./master";
import type {
  AdmissionRequest, AppState, Case, CaseStatus, Changes, Encounter, EncounterStatus, Episode, EpisodeKind, EpisodeStatus, Patient,
} from "./types";
import { SourceButton } from "../components/controls";

/** The counter is a workstation setting, so it is remembered in this browser only, per authenticated scope. */
const COUNTER_KEY = "medband.counter";
export const counterStorageKey = (scope: ReferenceScope) => `${COUNTER_KEY}:${referenceScopeKey(scope)}`;

/** The saved counter if the backend still lists it, otherwise the first counter the backend returned. Never a made-up id. */
export function pickCounter(counters: Counter[], saved: string | null | undefined) {
  return counters.some((c) => c.id === saved) ? (saved as string) : counters[0]?.id ?? "";
}

export interface StoreApi extends AppState {
  counterId: string;
  setCounterId: (id: string) => void;
  /** The identity the backend resolved for this session. Read only: nothing in the page chooses who acts. */
  currentUser?: CurrentUser;
  hostManagedIdentity: boolean;
  demo: Bootstrap["demo"];
  registerPatient: (p: PatientBody) => Promise<Patient>;
  updatePatient: (id: string, patch: Partial<PatientBody>) => Promise<void>;
  createEpisode: (e: { patientId: string; title: string; kind: EpisodeKind; departmentId: string; practitionerId?: string }) => Promise<Episode>;
  setEpisodeStatus: (id: string, status: EpisodeStatus) => Promise<void>;
  setCaseStatus: (id: string, status: CaseStatus) => Promise<void>;
  createEncounter: (e: Omit<EncounterRequest, "counterId">) => Promise<{ encounter: Encounter; kase: Case; episode: Episode }>;
  setEncounterStatus: (id: string, status: EncounterStatus) => Promise<void>;
  createAdmissionRequest: (r: AdmissionRequestBody) => Promise<AdmissionRequest>;
  admissionAction: (id: string, action: AdmissionAction) => Promise<void>;
  patientById: (id?: string) => Patient | undefined;
  episodeById: (id?: string) => Episode | undefined;
  caseById: (id?: string) => Case | undefined;
  encounterById: (id?: string) => Encounter | undefined;
  requestById: (id?: string) => AdmissionRequest | undefined;
}

const StoreContext = createContext<StoreApi | null>(null);
const ClientContext = createContext<MedbandClient | null>(null);

/** Inserts or replaces records by id, newest first. */
export function mergeList<T extends { id: string }>(list: T[], incoming?: T[]) {
  if (!incoming?.length) return list;
  const byId = new Map(incoming.map((x) => [x.id, x]));
  const kept = list.map((x) => byId.get(x.id) ?? x);
  const fresh = incoming.filter((x) => !list.some((y) => y.id === x.id));
  return [...fresh, ...kept];
}

export function mergeChanges(s: AppState, c: Changes): AppState {
  return {
    patients: mergeList(s.patients, c.patients),
    episodes: mergeList(s.episodes, c.episodes),
    cases: mergeList(s.cases, c.cases),
    encounters: mergeList(s.encounters, c.encounters),
    admissionRequests: mergeList(s.admissionRequests, c.admissionRequests),
  };
}

interface Loaded { state: AppState; master: Master; currentUser?: CurrentUser; hostManagedIdentity: boolean; demo: Bootstrap["demo"] }

/**
 * Loads GET /bootstrap through the host transport and serves the source store API. It lives inside one authenticated scope
 * (the module remounts it under `referenceScopeKey(host.scope)`), so records, masters and the counter choice of an earlier
 * tenant, branch or user cannot reach the next. Every request carries an AbortSignal that is aborted on unmount, and a response
 * that arrives after that is discarded.
 */
export function MedbandProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const host = useReferenceHost();
  const hostRef = useRef(host);
  hostRef.current = host;
  const client = useMemo(() => createMedbandClient({ request: (path, init) => hostRef.current.request(path, init) }), []);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counterId, setCounter] = useState("");
  const alive = useRef(true);
  const controllers = useRef(new Set<AbortController>());

  useEffect(() => {
    alive.current = true;
    const pending = controllers.current;
    return () => {
      alive.current = false;
      pending.forEach((c) => c.abort());
      pending.clear();
    };
  }, []);

  /** Runs one request under a controller that unmount aborts; the result is dropped once the provider is gone. */
  const track = useCallback(async <T,>(run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const result = await run(controller.signal);
      if (!alive.current) throw new DOMException("The MedBand workspace was closed", "AbortError");
      return result;
    } finally {
      controllers.current.delete(controller);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const boot = await track((signal) => client.bootstrap({ signal }));
      const master = createMaster(boot.master);
      let saved: string | null = null;
      try { saved = window.localStorage.getItem(counterStorageKey(hostRef.current.scope)); } catch { /* storage blocked: first counter */ }
      setCounter(pickCounter(master.COUNTERS, saved));
      setLoaded({ state: boot.data, master, currentUser: boot.currentUser, hostManagedIdentity: boot.hostManagedIdentity === true, demo: boot.demo });
    } catch (e) {
      if (isAbort(e) || !alive.current) return;
      setError(toApiError(e).message);
    }
  }, [client, track]);

  useEffect(() => { void load(); }, [load]);

  const apply = useCallback((c: Changes) => {
    setLoaded((s) => s && { ...s, state: mergeChanges(s.state, c) });
  }, []);

  const setCounterId = useCallback((id: string) => {
    setCounter(id);
    try { window.localStorage.setItem(counterStorageKey(hostRef.current.scope), id); } catch { /* ignore */ }
  }, []);

  const store = useMemo<StoreApi | null>(() => {
    if (!loaded) return null;
    const { state } = loaded;
    const write = async <T extends Changes>(run: (signal: AbortSignal) => Promise<T>) => {
      const r = await track(run);
      apply(r);
      return r;
    };
    return {
      ...state,
      counterId,
      setCounterId,
      currentUser: loaded.currentUser,
      hostManagedIdentity: loaded.hostManagedIdentity,
      demo: loaded.demo,
      registerPatient: async (p) => {
        const r = await write((signal) => client.registerPatient(p, { signal }));
        return r.patients!.find((x) => x.id === r.patientId)!;
      },
      updatePatient: async (id, patch) => void (await write((signal) => client.updatePatient(id, patch, { signal }))),
      createEpisode: async (e) => (await write((signal) => client.createEpisode(e, { signal }))).episodes![0],
      setEpisodeStatus: async (id, status) => void (await write((signal) => client.setEpisodeStatus(id, status, { signal }))),
      setCaseStatus: async (id, status) => void (await write((signal) => client.setCaseStatus(id, status, undefined, { signal }))),
      createEncounter: async (e) => {
        const r = await write((signal) => client.createEncounter({ ...e, counterId }, { signal }));
        const encounter = r.encounters!.find((x) => x.id === r.encounterId)!;
        return { encounter, kase: r.cases!.find((c) => c.id === encounter.caseId)!, episode: r.episodes!.find((x) => x.id === encounter.episodeId)! };
      },
      setEncounterStatus: async (id, status) => void (await write((signal) => client.setEncounterStatus(id, status, counterId, { signal }))),
      createAdmissionRequest: async (body) => {
        const r = await write((signal) => client.createAdmissionRequest(body, { signal }));
        return r.admissionRequests!.find((x) => x.id === r.requestId)!;
      },
      admissionAction: async (id, action) => void (await write((signal) => client.admissionAction(id, action, { signal }))),
      patientById: (id) => state.patients.find((p) => p.id === id),
      episodeById: (id) => state.episodes.find((e) => e.id === id),
      caseById: (id) => state.cases.find((c) => c.id === id),
      encounterById: (id) => state.encounters.find((e) => e.id === id),
      requestById: (id) => state.admissionRequests.find((r) => r.id === id),
    };
  }, [loaded, counterId, setCounterId, apply, client, track]);

  if (error) {
    return (
      <div role="alert" className="grid min-h-[40vh] place-items-center bg-canvas p-6" data-medband-state="error">
        <div className="max-w-sm rounded-2xl bg-paper p-6 text-center shadow-lift">
          <p className="text-[15px] font-semibold"><LocalizedText message="MedBand could not load" /></p>
          <p className="mt-1 text-[13.5px] text-ink-soft"><LocalizedText message={error} /></p>
          <SourceButton onClick={() => void load()} className="mt-4 h-10 rounded-lg bg-scrub-700 px-4 text-sm font-medium text-white hover:bg-scrub-800"><LocalizedText message="Try again" /></SourceButton>
        </div>
      </div>
    );
  }
  if (!store || !loaded) return <>{fallback ?? null}</>;
  return (
    <ClientContext.Provider value={client}>
      <MasterProvider master={loaded.master}>
        <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
      </MasterProvider>
    </ClientContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <MedbandProvider>");
  return ctx;
}

/** The source `api` object, bound to the authenticated host transport of this scope. */
export function useMedbandApi(): MedbandClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error("useMedbandApi must be used inside <MedbandProvider>");
  return client;
}

/** The counter this workstation is signed in to, from the scope's own master data. */
export function useCounter() {
  const { counterId } = useStore();
  return useMaster().counter(counterId);
}
