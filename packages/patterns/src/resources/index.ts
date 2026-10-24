'use client';
import {createContext,createElement,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
export type JsonRequest=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
const ClientContext=createContext<{request:JsonRequest;statePath:string}>(null!);
export function useJsonRequest(){return useContext(ClientContext).request;}
export function useFetch<T>(url: string | null) {
  const api = useJsonRequest();
  const [state, setState] = useState<{ url: string | null; api: unknown; data: T | null }>({ url: null, api: null, data: null });
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<{ url: string | null; api: unknown; message: string } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) { setLoading(false); return; }
    let alive = true; const controller=new AbortController();
    setLoading(true);
    setError(null);
    api<T>(url,{signal:controller.signal})
      .then((d) => { if (alive) setState({ url, api, data: d }); })
      .catch((e: Error) => { if (alive) setError({ url, api, message: e.message }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, [url, tick, api]);
  const current = url !== null && state.url === url && state.api === api;
  const data = current ? state.data : null;
  const setData = useCallback((next: T | null | ((prev: T | null) => T | null)) => {
    setState((prev) => {
      const base = prev.url === url && prev.api === api ? prev.data : null;
      return { url, api, data: typeof next === 'function' ? (next as (p: T | null) => T | null)(base) : next };
    });
  }, [url, api]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const err = error && error.url === url && error.api === api ? error.message : null;
  return { data, loading: url !== null && (loading || (!current && !err)), error: err, reload, setData };
}

interface ScopeStore {
  views: Map<string, unknown>;
  cache: Map<string, Promise<unknown>>;
  /** view-state keys whose server value has been read (or overridden by the user) */
  loaded: Set<string>;
  /** serialized PUT chain and generation per view-state key */
  writes: Map<string, { chain: Promise<unknown>; generation: number }>;
}
const newStore = (): ScopeStore => ({ views: new Map(), cache: new Map(), loaded: new Set(), writes: new Map() });
const ScopeStoreContext = createContext<ScopeStore | null>(null);
export function ResourceScope({scopeKey,request,statePath,children}:{scopeKey:string;request:JsonRequest;statePath:string;children:ReactNode}) {
 const store=useMemo<ScopeStore>(newStore,[scopeKey,request]);
 const scopedRequest=useMemo(()=>((path,init)=>request(path,init)) as JsonRequest,[scopeKey,request]);
 return createElement(ClientContext.Provider,{value:{request:scopedRequest,statePath}},createElement(ScopeStoreContext.Provider,{value:store},children));
}
function useScopeStore(): ScopeStore {
  const store = useContext(ScopeStoreContext);
  const fallback = useRef<ScopeStore | null>(null);
  if (store) return store;
  fallback.current ??= newStore();
  return fallback.current;
}

/** Module-scoped in-memory map (e.g. list ↔ record neighbour ids). */
export function useScopeMemory(): Map<string, unknown> {
  return useScopeStore().views;
}
export const useViewMemory = useScopeMemory;

/* ───────── Scoped API resources ───────── */
export type ResourceStatus = 'loading' | 'ready' | 'error';
/**
 * GET a JSON resource once per scope store (shared by every consumer in the module),
 * with status, error and retry. A null url yields nothing. Data is only returned for the
 * current url and store, so a scope switch never exposes the previous tenant's value.
 */
export function useScopedResource<T>(url: string | null) {
  const store = useScopeStore();
  const api = useJsonRequest();
  const [state, setState] = useState<{ url: string | null; store: ScopeStore | null; data: T | null; error: string | null }>({ url: null, store: null, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    if (!store.cache.has(url)) store.cache.set(url, api<T>(url));
    const pending = store.cache.get(url) as Promise<T>;
    pending
      .then((data) => { if (alive) setState({ url, store, data, error: null }); })
      .catch((e: Error) => { store.cache.delete(url); if (alive) setState({ url, store, data: null, error: e.message || 'Request failed' }); });
    return () => { alive = false; };
  }, [url, store, api, tick]);
  const current = url !== null && state.url === url && state.store === store;
  const retry = useCallback(() => { if (url) store.cache.delete(url); setState((s) => ({ ...s, error: null, url: null })); setTick((t) => t + 1); }, [url, store]);
  const status: ResourceStatus = !current ? 'loading' : state.error ? 'error' : 'ready';
  return { data: current ? state.data : null, status: url ? status : ('ready' as ResourceStatus), error: current ? state.error : null, retry };
}

/* ───────── View state (source localStorage keys) ─────────
 * `persist` stores the value through the account view-state API
 * (GET/PUT /api/view-state; the server scopes it to tenant/app/branch/user/variant).
 * Only a GET happens on mount — never a PUT of the default. A late GET never overwrites a
 * value the user changed meanwhile; PUTs are serialized per key and only the latest
 * write reports status. Failures keep the local value and expose retry. */
export interface StoredStateMeta {
  status: 'idle' | 'loading' | 'saving' | 'error';
  error: string | null;
  retry: () => void;
  persisted: boolean;
}
export function useStoredState<T>(key: string, initial: T, options: { persist?: boolean } = {}) {
  const store = useScopeStore();
  const api = useJsonRequest();
  const persist = Boolean(options.persist);
  const {statePath}=useContext(ClientContext);
  const [value, setValue] = useState<T>(() => (store.views.has(key) ? (store.views.get(key) as T) : initial));
  const [meta, setMeta] = useState<{ status: StoredStateMeta['status']; error: string | null; op: 'load' | 'save' | null }>({ status: 'idle', error: null, op: null });
  const [loadTick, setLoadTick] = useState(0);
  useEffect(() => { setValue(store.views.has(key) ? (store.views.get(key) as T) : initial); }, [key, store]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!persist || store.loaded.has(key)) {
      setMeta((current) => current.status === 'loading' ? { status: 'idle', error: null, op: null } : current);
      return;
    }
    let alive = true;
    setMeta({ status: 'loading', error: null, op: 'load' });
    api<{ key: string; value: unknown }>(`${statePath}?key=${encodeURIComponent(key)}`)
      .then((res) => {
        if (!alive) return; // cancelled effects must not consume hydration for the active reader
        if (store.loaded.has(key)) {
          // Another reader or user update already settled this key. Preserve an active save.
          setMeta((current) => current.status === 'loading' ? { status: 'idle', error: null, op: null } : current);
          return;
        }
        store.loaded.add(key);
        if (res && res.value !== null && res.value !== undefined) { store.views.set(key, res.value); if (alive) setValue(res.value as T); }
        if (alive) setMeta({ status: 'idle', error: null, op: null });
      })
      .catch((e: Error) => { if (alive) setMeta({ status: 'error', error: e.message || 'Could not load saved layout', op: 'load' }); });
    return () => { alive = false; };
  }, [key, persist, store, api, loadTick, statePath]);
  const write = useCallback((v: T) => {
    const entry = store.writes.get(key) ?? { chain: Promise.resolve(), generation: 0 };
    const generation = entry.generation + 1;
    const chain = entry.chain.catch(() => undefined).then(() => api(statePath, { method: 'PUT', body: JSON.stringify({ key, value: v }) }));
    store.writes.set(key, { chain, generation });
    setMeta({ status: 'saving', error: null, op: 'save' });
    chain
      .then(() => { if (store.writes.get(key)?.generation === generation) setMeta({ status: 'idle', error: null, op: null }); })
      .catch((e: Error) => { if (store.writes.get(key)?.generation === generation) setMeta({ status: 'error', error: e.message || 'Could not save', op: 'save' }); });
  }, [key, store, api, statePath]);
  const set = useCallback((v: T) => {
    store.views.set(key, v);
    store.loaded.add(key);
    setValue(v);
    if (persist) write(v);
  }, [key, store, persist, write]);
  const retry = useCallback(() => {
    if (meta.op === 'load') { setLoadTick((t) => t + 1); return; }
    if (meta.op === 'save') write((store.views.has(key) ? store.views.get(key) : value) as T);
  }, [meta.op, write, store, key, value]);
  const info: StoredStateMeta = { status: meta.status, error: meta.error, retry, persisted: persist };
  return [value, set, info] as const;
}

