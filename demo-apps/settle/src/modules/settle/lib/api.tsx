'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {ResourceScope, useFetch, type JsonRequest} from '@pepbits/patterns/resources';
import {SettleApiError, type SettleMethod} from '../../../adapters/settle';
import {useSettleRuntime} from '../host';

export {SettleApiError as ApiError};
type Method = SettleMethod;

/* ---------------------------------------------------------------------------
   Global revalidation, scoped to one Settle host: any successful mutation bumps
   the version and every mounted useApi() refetches quietly — current balances refresh
   without discarding mounted editors. A changed desk user/tenant gets a fresh store.
--------------------------------------------------------------------------- */
interface Store {version: number; listeners: Set<() => void>}
const StoreContext = createContext<Store | null>(null);
export function SettleDataProvider({children}: {children: React.ReactNode}) {
  const {scopeKey, transport} = useSettleRuntime();
  const store = useMemo<Store>(() => ({version: 0, listeners: new Set()}), [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const request = useCallback<JsonRequest>(async <T,>(path: string, init?: RequestInit) => {
    return (await transport<T>(path, {signal: init?.signal ?? undefined})).data;
  }, [transport]);
  // Settle has no persisted view-state endpoint; this scope uses only the shared read lifecycle.
  // Remount desk editors on identity changes so neither loaded rights nor drafts cross users.
  return <StoreContext.Provider value={store}><ResourceScope key={scopeKey} scopeKey={scopeKey} request={request} statePath="/view-state">{children}</ResourceScope></StoreContext.Provider>;
}
function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Settle data provider is missing');
  return store;
}
export function useRevalidateAll() {
  const store = useStore();
  return useCallback(() => {store.version += 1; store.listeners.forEach(listener => listener());}, [store]);
}

/** Raw call against the configured Settle transport. */
export function useSettleApi() {
  const {transport} = useSettleRuntime();
  return useCallback(<T = unknown,>(path: string, opts: {method?: Method; body?: unknown; signal?: AbortSignal} = {}) => transport<T>(path, opts), [transport]);
}

export function useApi<T>(path: string | null) {
  const store = useStore();
  const subscribe = useCallback((listener: () => void) => {store.listeners.add(listener); return () => {store.listeners.delete(listener);};}, [store]);
  const v = useSyncExternalStore(subscribe, () => store.version, () => 0);
  const resource = useFetch<T>(path);
  const previousVersion = useRef(v);
  useEffect(() => {
    if (previousVersion.current !== v) {previousVersion.current = v; resource.reload();}
  }, [v, resource.reload]);
  // Shared resources fence stale paths/identities and abort obsolete reads. Keep the source's
  // quiet refresh after a write, so mounted payment/deposit dialogs retain their state.
  return {...resource, loading: resource.loading && resource.data === null,
    error: useMemo(() => resource.error ? {message: resource.error} : null, [resource.error])};
}

/** Wraps a mutation: tracks pending state and revalidates all queries afterwards. */
export function useMutation() {
  const [pending, setPending] = useState(false);
  const api = useSettleApi();
  const revalidateAll = useRevalidateAll();
  const run = useCallback(async <T,>(path: string, method: Method, body?: unknown): Promise<{data: T; status: number}> => {
    setPending(true);
    try {
      const r = await api<T>(path, {method, body});
      revalidateAll();
      return r;
    } finally {
      setPending(false);
    }
  }, [api, revalidateAll]);
  return {run, pending};
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t);}, [value, ms]);
  return v;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}
