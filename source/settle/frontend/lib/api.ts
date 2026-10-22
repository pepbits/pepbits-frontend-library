'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { reasons?: string[]; [k: string]: unknown };
  constructor(status: number, message: string, code: string, details?: ApiError['details']) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const USER_KEY = 'settle.userId';

export function currentUserId(): number {
  if (typeof window === 'undefined') return 1;
  try {
    return Number(window.localStorage.getItem(USER_KEY)) || 1;
  } catch {
    return 1;
  }
}
export function setCurrentUserId(id: number) {
  try { window.localStorage.setItem(USER_KEY, String(id)); } catch { /* storage unavailable */ }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function api<T = unknown>(path: string, opts: { method?: Method; body?: unknown; signal?: AbortSignal } = {}): Promise<{ data: T; status: number }> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method || 'GET',
      headers: { 'content-type': 'application/json', 'x-user-id': String(currentUserId()) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: 'no-store',
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the billing server. Check that the API is running on port 4000.', 'offline');
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string; details?: ApiError['details'] } })?.error;
    throw new ApiError(res.status, err?.message || `Request failed (${res.status})`, err?.code || 'error', err?.details);
  }
  return { data: json as T, status: res.status };
}

/* ---------------------------------------------------------------------------
   Global revalidation: any successful mutation bumps the version and every
   mounted useApi() refetches quietly — screens never show stale money.
--------------------------------------------------------------------------- */
let version = 0;
const listeners = new Set<() => void>();
export function revalidateAll() {
  version += 1;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getVersion = () => version;

export function useApi<T>(path: string | null) {
  const v = useSyncExternalStore(subscribe, getVersion, () => 0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const lastPath = useRef<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    const ctrl = new AbortController();
    const pathChanged = lastPath.current !== path;
    lastPath.current = path;
    if (pathChanged) setLoading(true);
    api<T>(path, { signal: ctrl.signal })
      .then((r) => { setData(r.data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [path, v, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Wraps a mutation: tracks pending state and revalidates all queries afterwards. */
export function useMutation() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async <T,>(path: string, method: Method, body?: unknown): Promise<{ data: T; status: number }> => {
    setPending(true);
    try {
      const r = await api<T>(path, { method, body });
      revalidateAll();
      return r;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending };
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}
