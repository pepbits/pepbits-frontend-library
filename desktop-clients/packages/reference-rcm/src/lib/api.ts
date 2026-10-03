"use client";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useReferenceHost } from "@pepbits/reference-host";

/** Namespace the host transport maps these paths onto (the host adds the /api prefix, the namespace, credentials and scope headers). */
export const RCM_NAMESPACE = "/reference-modules/rcm";
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
/** The source's own scope header (`ALL:SAR`, `RUH-CENTRAL`, ...). The server treats it as a filter inside the host-authorized branches, never as authority. */
export const SCOPE_HEADER = "x-rcm-scope";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** The source's error shape: `{ error: { code, message, fieldErrors } }` becomes status/code/message/fieldErrors. Codes stay the server's (STALE_VERSION, VALIDATION...). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RcmTransport {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}
export interface CallOptions {
  signal?: AbortSignal;
  /** Source scope filter sent as `x-rcm-scope`. */
  scope?: string;
  /** Key for this attempt. An identical earlier mutation whose outcome was lost (network, 503...) keeps its own key and wins over this one. */
  operationKey?: string;
}

type Failure = Error & { status?: number; details?: { error?: unknown } | null };
const isAbort = (error: unknown) => (error as { name?: string } | null)?.name === "AbortError";

/** Maps a host transport failure onto the source's ApiError(status, code, message, fieldErrors). */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const e = error as Failure;
  const status = typeof e?.status === "number" ? e.status : 0;
  if (!status) return new ApiError(0, "OFFLINE", "The Workspace service can't be reached.");
  const body = e.details?.error;
  const nested = body && typeof body === "object" ? (body as { code?: unknown; message?: unknown; fieldErrors?: unknown }) : {};
  const code = typeof nested.code === "string" ? nested.code : "ERROR";
  const message = typeof nested.message === "string" ? nested.message : status >= 500 ? "The server could not complete the request." : "The request could not be completed.";
  const fieldErrors = nested.fieldErrors && typeof nested.fieldErrors === "object" ? (nested.fieldErrors as Record<string, string>) : undefined;
  return new ApiError(status, code, message, fieldErrors);
}

export const newOperationKey = () => crypto.randomUUID();

/** Outcomes where the server may have applied the mutation but the answer never arrived: the retry must replay the same key. */
const AMBIGUOUS_STATUS = new Set([0, 408, 502, 503, 504]);

/** The source `api` helper bound to one host transport. No actor header, no token store, no /api fetch: the host session authenticates. */
export function createRcmClient(transport: RcmTransport) {
  // Owned by this client (one per authenticated scope): method + path + scope + payload -> key of an attempt whose outcome is unknown.
  const pending = new Map<string, string>();

  async function call<T>(method: string, path: string, body?: unknown, opts: CallOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.scope) headers[SCOPE_HEADER] = opts.scope;
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const mutating = MUTATING.has(method);
    const signature = mutating ? JSON.stringify([method, path, opts.scope ?? null, payload ?? null]) : "";
    if (mutating) headers[IDEMPOTENCY_HEADER] = pending.get(signature) ?? opts.operationKey ?? newOperationKey();
    try {
      const result = await transport.request<T>(path, {
        method,
        headers: Object.keys(headers).length ? headers : undefined,
        body: payload,
        signal: opts.signal,
      });
      if (mutating) pending.delete(signature);
      return result;
    } catch (error) {
      if (isAbort(error)) {
        if (mutating) pending.set(signature, headers[IDEMPOTENCY_HEADER]);
        throw error;
      }
      const apiError = toApiError(error);
      if (mutating) {
        if (AMBIGUOUS_STATUS.has(apiError.status)) pending.set(signature, headers[IDEMPOTENCY_HEADER]);
        else pending.delete(signature);
      }
      throw apiError;
    }
  }
  return {
    get: <T,>(p: string, o?: CallOptions) => call<T>("GET", p, undefined, o),
    post: <T,>(p: string, b?: unknown, o?: CallOptions) => call<T>("POST", p, b ?? {}, o),
    put: <T,>(p: string, b?: unknown, o?: CallOptions) => call<T>("PUT", p, b ?? {}, o),
    delete: <T,>(p: string, o?: CallOptions) => call<T>("DELETE", p, undefined, o),
  };
}
export type RcmClient = ReturnType<typeof createRcmClient>;

// ---------------------------------------------------------------------------------------------------------------------
// Scope-keyed data store. One store lives inside one authenticated host scope (the module remounts it when tenant, branch,
// user or role changes), so nothing cached here can reach another scope. Inside it, every entry is also keyed by the source
// scope filter (`ALL:SAR`...), so changing the filter refetches without showing the other filter's numbers. In-flight reads
// are aborted on unmount and when nobody is listening any more, and a response that lost the race is discarded.

interface Snapshot { data: unknown; error: ApiError | undefined; loading: boolean }
const EMPTY: Snapshot = { data: undefined, error: undefined, loading: false };
const DEDUPE_MS = 1500;
const SEP = "\u0001";

interface Entry { snap: Snapshot; at: number; stale: boolean; seq: number; controller: AbortController | null; listeners: Set<() => void>; flight: Promise<void> | null }

export class DataStore {
  private entries = new Map<string, Entry>();
  constructor(private client: RcmClient) {}

  static key(scope: string | null, path: string) { return `${scope ?? ""}${SEP}${path}`; }
  private static split(key: string): [string | undefined, string] { const i = key.indexOf(SEP); return [key.slice(0, i) || undefined, key.slice(i + 1)]; }

  private entry(key: string): Entry {
    let e = this.entries.get(key);
    if (!e) { e = { snap: EMPTY, at: 0, stale: false, seq: 0, controller: null, listeners: new Set(), flight: null }; this.entries.set(key, e); }
    return e;
  }
  private set(e: Entry, patch: Partial<Snapshot>) {
    e.snap = { ...e.snap, ...patch };
    e.listeners.forEach((l) => l());
  }
  snapshot = (key: string | null): Snapshot => (key ? this.entries.get(key)?.snap ?? EMPTY : EMPTY);

  subscribe(key: string, listener: () => void) {
    const e = this.entry(key);
    e.listeners.add(listener);
    return () => {
      e.listeners.delete(listener);
      if (e.listeners.size === 0 && e.controller) {
        e.controller.abort();
        e.controller = null; e.seq++; e.flight = null; e.stale = true;
        e.snap = { ...e.snap, loading: false };
      }
    };
  }

  /** Fetches unless a fresh result is cached (SWR-style dedupe). `force` always refetches. */
  revalidate(key: string, force = false): Promise<void> {
    const e = this.entry(key);
    if (!force && e.flight) return e.flight;
    if (!force && !e.stale && e.snap.data !== undefined && Date.now() - e.at < DEDUPE_MS) return Promise.resolve();
    e.controller?.abort();
    const controller = (e.controller = new AbortController());
    const seq = ++e.seq;
    const [scope, path] = DataStore.split(key);
    this.set(e, { loading: true });
    const flight = this.client.get<unknown>(path, { signal: controller.signal, scope }).then(
      (data) => {
        if (seq !== e.seq) return;
        e.at = Date.now(); e.stale = false;
        this.set(e, { data, error: undefined, loading: false });
      },
      (error) => {
        if (seq !== e.seq || controller.signal.aborted) return;
        this.set(e, { error: toApiError(error), loading: false });
      },
    ).finally(() => { if (seq === e.seq) { e.controller = null; e.flight = null; } });
    e.flight = flight;
    return flight;
  }

  /** Replaces the cached value (server-returned); revalidates afterwards unless told otherwise. */
  async mutate(key: string, data?: unknown, revalidate = true): Promise<unknown> {
    const e = this.entry(key);
    if (data !== undefined) {
      const value = await data;
      e.at = Date.now(); e.stale = false;
      this.set(e, { data: value, error: undefined });
      if (!revalidate) return value;
    }
    await this.revalidate(key, true);
    return e.snap.data;
  }

  /** Every list, KPI and badge shows the effect of a mutation: mounted keys refetch now, unmounted ones on next use. */
  refreshAll(): Promise<void> {
    const pending: Promise<void>[] = [];
    this.entries.forEach((e, key) => {
      if (key.startsWith(SEP)) return; // identity and registry (/meta) do not depend on a mutation
      if (e.listeners.size > 0) pending.push(this.revalidate(key, true)); else e.stale = true;
    });
    return Promise.allSettled(pending).then(() => undefined);
  }

  dispose() {
    this.entries.forEach((e) => { e.controller?.abort(); e.controller = null; e.seq++; e.flight = null; });
    this.entries.clear();
  }
}

interface DataContextValue { client: RcmClient; store: DataStore; scope: string | null; setScope: (scope: string) => void; scopeRef: { current: string | null } }
const DataContext = createContext<DataContextValue | null>(null);

/**
 * Binds the client, the store and the source scope filter to the mounted host. Mount it inside the authenticated-scope boundary
 * (keyed by `referenceScopeKey(host.scope)`); the latest `host.request` is read through a ref so a host that re-creates it each
 * render does not restart every request. The scope filter is module state: it is not persisted and it grants nothing.
 */
export function RcmDataProvider({ children, initialScope = null }: { children: ReactNode; initialScope?: string | null }) {
  const host = useReferenceHost();
  const ref = useRef(host);
  ref.current = host;
  const [scope, setScopeState] = useState<string | null>(initialScope);
  const scopeRef = useRef<string | null>(scope);
  scopeRef.current = scope;
  const setScope = useCallback((next: string) => { scopeRef.current = next; setScopeState(next); }, []);
  const base = useMemo(() => {
    const client = createRcmClient({ request: (path, init) => ref.current.request(path, init) });
    return { client, store: new DataStore(client) };
  }, []);
  useEffect(() => () => base.store.dispose(), [base]);
  const value = useMemo<DataContextValue>(() => ({ ...base, scope, setScope, scopeRef }), [base, scope, setScope]);
  return createElement(DataContext.Provider, { value }, children);
}

function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("RCM data hooks must be used inside RcmDataProvider");
  return ctx;
}

/** The source `api` object (get/post/put), bound to the authenticated host transport. Every call carries the current source scope filter. */
export function useApiClient(): RcmClient {
  const { client, scopeRef } = useData();
  return useMemo<RcmClient>(() => ({
    get: (p, o) => client.get(p, { scope: scopeRef.current ?? undefined, ...o }),
    post: (p, b, o) => client.post(p, b, { scope: scopeRef.current ?? undefined, ...o }),
    put: (p, b, o) => client.put(p, b, { scope: scopeRef.current ?? undefined, ...o }),
    delete: (p, o) => client.delete(p, { scope: scopeRef.current ?? undefined, ...o }),
  }), [client, scopeRef]);
}
/** The source scope filter (`ALL:SAR` or a branch code) and its setter. */
export function useScopeFilter() {
  const { scope, setScope } = useData();
  return { scope, setScope };
}
/** The source `refreshPending()` + list reload: refresh every mounted read after a mutation so counts, KPIs and badges stay true everywhere. */
export function useRefreshAll() {
  const { store } = useData();
  return useCallback(() => store.refreshAll(), [store]);
}

export interface ApiConfig {
  refreshInterval?: number; revalidateOnFocus?: boolean; keepPreviousData?: boolean;
  /** Reads that do not depend on the scope filter (`/meta`). */
  unscoped?: boolean;
}

/** Scope-keyed replacement for the source's hand-rolled loaders: `{ data, error, isLoading, isValidating, mutate }`. Pass null to skip. */
export function useApi<T>(path: string | null, config: ApiConfig = {}) {
  const { store, scope } = useData();
  const { refreshInterval, revalidateOnFocus = false, keepPreviousData = false, unscoped } = config;
  const key = path ? DataStore.key(unscoped ? null : scope, path) : null;
  const subscribe = useCallback((listener: () => void) => (key ? store.subscribe(key, listener) : () => {}), [store, key]);
  const getSnapshot = useCallback(() => store.snapshot(key), [store, key]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const last = useRef<unknown>(undefined);
  if (snap.data !== undefined) last.current = snap.data;

  useEffect(() => { if (key) void store.revalidate(key); }, [store, key]);
  useEffect(() => {
    if (!key || !refreshInterval) return;
    const timer = setInterval(() => { if (typeof document === "undefined" || !document.hidden) void store.revalidate(key, true); }, refreshInterval);
    return () => clearInterval(timer);
  }, [store, key, refreshInterval]);
  useEffect(() => {
    if (!key || !revalidateOnFocus) return;
    const onFocus = () => void store.revalidate(key);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [store, key, revalidateOnFocus]);

  const mutate = useCallback(async (data?: T | Promise<T>, options?: { revalidate?: boolean }) => {
    if (!key) return undefined;
    return (await store.mutate(key, data, options?.revalidate ?? true)) as T | undefined;
  }, [store, key]);

  const data = (snap.data !== undefined ? snap.data : keepPreviousData ? last.current : undefined) as T | undefined;
  return { data, error: snap.error, isLoading: !!key && snap.loading && snap.data === undefined, isValidating: !!key && snap.loading, mutate };
}
