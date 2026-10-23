'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient, ApiError } from './api';

export function useApi<T>(path: string | null) {
  const api = useApiClient();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) { setData(null); setLoading(false); return; }
    const ac = new AbortController();
    let live = true;
    setLoading(true);
    api<T>(path, { signal: ac.signal })
      .then((d) => { if(live) {setData(d); setError(null);} })
      .catch((e) => { if (live && e?.name !== 'AbortError') setError(e instanceof ApiError ? e : new ApiError(String(e), 0)); })
      .finally(() => { if (live && !ac.signal.aborted) setLoading(false); });
    return () => {live=false;ac.abort();};
  }, [api, path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Calls fn every `ms` while `active` is true. */
export function useInterval(fn: () => void, ms: number, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms, active]);
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOutside(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOutside]);
  return ref;
}

