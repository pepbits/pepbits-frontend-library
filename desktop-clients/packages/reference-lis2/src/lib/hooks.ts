'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {Paged} from './api';

/** Loads a paginated list and reloads when filters change. */
export function useList<T = any>(path: string | null, filters: Record<string, any>, deps: any[] = []) {
 const {get}=useDiagnosticClient();

  const [data, setData] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify(filters);
  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const r = await get<Paged<T>>(path, filters);
      if (n === seq.current) { setData(r); setError(null); }
    } catch (e: any) {
      if (n === seq.current) setError(e.message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

/** Loads a single resource. */
export function useResource<T = any>(path: string | null, deps: any[] = []) {
 const {get}=useDiagnosticClient();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    setLoading(true);
    try { setData(await get<T>(path)); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

/** Filter state with page reset whenever a filter other than page changes. */
export function useFilters<T extends Record<string, any>>(initial: T) {
  const [f, setF] = useState<T & { page: number }>({ page: 1, ...initial });
  const set = useCallback((patch: Partial<T & { page: number }>) => setF((cur) => ({ ...cur, ...patch, page: 'page' in patch ? (patch.page as number) : 1 })), []);
  return [f, set] as const;
}

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ms) return;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
