'use client';
/*
 * Source `lib/client.ts` adapted to the hosted contract. Every request goes through the
 * host-provided `request` closure taken from React context; nothing holds a module-global
 * host, request pointer or cache. Payload and query shapes stay source compatible:
 *   GET    /api/dashboard
 *   GET    /api/entities/:entity?q&page&size&sort&dir&filters(JSON)&facet&asOf&period
 *   POST   /api/entities/:entity
 *   GET    /api/entities/:entity/:id[?period]
 *   PUT    /api/entities/:entity/:id[?period]
 *   DELETE /api/entities/:entity/:id
 *   POST   /api/auth/login
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { referenceScopeKey, useReferenceHost, type ReferenceHost } from '@pepbits/reference-host';
import type { Filters, ListResponse, Row } from './types';

export type RequestFn = ReferenceHost['request'];

const withJson = (init?: RequestInit): RequestInit => ({ ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });

/** The host request closure, with the source JSON header convention applied. */
export function useApi(): <T = unknown>(url: string, init?: RequestInit) => Promise<T> {
  const { request } = useReferenceHost();
  return useCallback(<T,>(url: string, init?: RequestInit) => request<T>(url, withJson(init)), [request]);
}

export interface ListParams {
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  filters?: Filters;
  facet?: string;
  asOf?: string;
  period?: string;
}

export function listUrl(entity: string, p: ListParams = {}) {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.page) sp.set('page', String(p.page));
  if (p.size) sp.set('size', String(p.size));
  if (p.sort) { sp.set('sort', p.sort); sp.set('dir', p.dir ?? 'asc'); }
  if (p.filters && Object.keys(p.filters).length) sp.set('filters', JSON.stringify(p.filters));
  if (p.facet) sp.set('facet', p.facet);
  if (p.asOf) sp.set('asOf', p.asOf);
  if (p.period) sp.set('period', p.period);
  return `/api/entities/${entity}?${sp.toString()}`;
}

const periodQuery = (period?: string) => (period ? `?period=${encodeURIComponent(period)}` : '');
const seg = (v: string) => encodeURIComponent(v);

/** Entity API bound to one host request closure. */
export function createEntityApi(request: RequestFn) {
  const api = <T,>(url: string, init?: RequestInit) => request<T>(url, withJson(init));
  return {
    list: (entity: string, p?: ListParams) => api<ListResponse>(listUrl(entity, p)),
    get: (entity: string, id: string, period?: string) => api<Row>(`/api/entities/${seg(entity)}/${seg(id)}${periodQuery(period)}`),
    create: (entity: string, body: Partial<Row>) => api<Row>(`/api/entities/${seg(entity)}`, { method: 'POST', body: JSON.stringify(body) }),
    update: (entity: string, id: string, body: Partial<Row>, period?: string) => api<Row>(`/api/entities/${seg(entity)}/${seg(id)}${periodQuery(period)}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (entity: string, id: string) => api<{ deleted: string }>(`/api/entities/${seg(entity)}/${seg(id)}`, { method: 'DELETE' }),
  };
}
export type EntityApi = ReturnType<typeof createEntityApi>;

/** Replaces the source `entityApi` singleton: one API per host request closure. */
export function useEntityApi(): EntityApi {
  const { request } = useReferenceHost();
  return useMemo(() => createEntityApi(request), [request]);
}

/**
 * Fetch any JSON endpoint with loading / error state and a reload handle.
 * Data is tagged with the URL and request closure that produced it and is only returned
 * while both still match, so a changed URL, a null URL or a different host never shows
 * the previous response (not even for one render) and late responses are discarded.
 */
export function useFetch<T>(url: string | null) {
  const api = useApi();
  const [state, setState] = useState<{ url: string | null; api: unknown; data: T | null }>({ url: null, api: null, data: null });
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<{ url: string | null; api: unknown; message: string } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    api<T>(url)
      .then((d) => { if (alive) setState({ url, api, data: d }); })
      .catch((e: Error) => { if (alive) setError({ url, api, message: e.message }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
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

export function useList(entity: string, params: ListParams, enabled = true) {
  return useFetch<ListResponse>(enabled ? listUrl(entity, params) : null);
}

export function useDebounce<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOutside, active]);
  return ref;
}

/* ───────── Module-scoped state ─────────
 * One store per mounted module and effective host scope (tenant/application/branch/user/
 * roles/moduleId). It holds reference-dropdown results, API resources (lookups, company
 * profile, record support) and page view state. It is replaced when the scope changes;
 * the module also remounts its subtree on that key. */
interface ScopeStore {
  views: Map<string, unknown>;
  refs: Map<string, Promise<string[]>>;
  cache: Map<string, Promise<unknown>>;
  /** view-state keys whose server value has been read (or overridden by the user) */
  loaded: Set<string>;
  /** serialized PUT chain and generation per view-state key */
  writes: Map<string, { chain: Promise<unknown>; generation: number }>;
}
const newStore = (): ScopeStore => ({ views: new Map(), refs: new Map(), cache: new Map(), loaded: new Set(), writes: new Map() });
const ScopeStoreContext = createContext<ScopeStore | null>(null);
export function ReferenceScopeStore({ children }: { children: ReactNode }) {
  const { scope } = useReferenceHost();
  const key = referenceScopeKey(scope);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new scope must get a new store
  const store = useMemo<ScopeStore>(newStore, [key]);
  return createElement(ScopeStoreContext.Provider, { value: store }, children);
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

/* ───────── list ↔ record memory for previous / next (ERP2 record routes) ───────── */
export function rememberIds(memory: Map<string, unknown>, slug: string, ids: string[]) {
  memory.set(`keystone.ids.${slug}`, ids);
}
export function useNeighbours(slug: string, id?: string) {
  const memory = useScopeMemory();
  const ids = (memory.get(`keystone.ids.${slug}`) as string[] | undefined) ?? [];
  const index = id ? ids.indexOf(id) : -1;
  return { index, total: ids.length, prev: index > 0 ? ids[index - 1] : null, next: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null };
}

/* ───────── Scoped API resources ───────── */
export type ResourceStatus = 'loading' | 'ready' | 'error';
/**
 * GET a JSON resource once per scope store (shared by every consumer in the module),
 * with status, error and retry. A null url yields nothing. Data is only returned for the
 * current url and store, so a scope switch never exposes the previous tenant's value.
 */
export function useScopedResource<T>(url: string | null) {
  const store = useScopeStore();
  const api = useApi();
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
  const api = useApi();
  const persist = Boolean(options.persist);
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
    api<{ key: string; value: unknown }>(`/api/view-state?key=${encodeURIComponent(key)}`)
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
  }, [key, persist, store, api, loadTick]);
  const write = useCallback((v: T) => {
    const entry = store.writes.get(key) ?? { chain: Promise.resolve(), generation: 0 };
    const generation = entry.generation + 1;
    const chain = entry.chain.catch(() => undefined).then(() => api(`/api/view-state`, { method: 'PUT', body: JSON.stringify({ key, value: v }) }));
    store.writes.set(key, { chain, generation });
    setMeta({ status: 'saving', error: null, op: 'save' });
    chain
      .then(() => { if (store.writes.get(key)?.generation === generation) setMeta({ status: 'idle', error: null, op: null }); })
      .catch((e: Error) => { if (store.writes.get(key)?.generation === generation) setMeta({ status: 'error', error: e.message || 'Could not save', op: 'save' }); });
  }, [key, store, api]);
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

/** Display names of another entity for dropdowns and lookups, cached per host scope. */
export function useRefOptions(entity?: string) {
  const store = useScopeStore();
  const api = useEntityApi();
  const [opts, setOpts] = useState<{ store: ScopeStore; entity?: string; values: string[] }>({ store, entity, values: [] });
  useEffect(() => {
    if (!entity) return;
    if (!store.refs.has(entity)) {
      store.refs.set(entity, api.list(entity, { size: 1000 }).then((d) => d.rows.map((r) => String(r.name ?? r.code ?? r.id))));
    }
    let alive = true;
    store.refs.get(entity)!.then((values) => { if (alive) setOpts({ store, entity, values }); }).catch(() => store.refs.delete(entity));
    return () => { alive = false; };
  }, [entity, store, api]);
  // Never return options that belong to another scope store or entity.
  return opts.store === store && opts.entity === entity ? opts.values : EMPTY;
}
const EMPTY: string[] = [];
