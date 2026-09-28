"use client";
/*
 * Typed adapter replacing lumen-reports src/components/ui/api.ts.
 *
 * The source called fetch() directly with cookies. Here every call goes through the authenticated host:
 *   JSON  -> host.request(path, { method, headers, body: JSON.stringify(body) })
 *   files -> host.fetch(path, init) then a Blob download (no token or credential in any URL).
 * Paths keep the source's original /api/... form; the host namespaces them to /reference-modules/reports.
 * One client per module instance, provided through context. There is no global request adapter.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { referenceScopeKey, useReferenceHost, useReferenceRouter, type ReferenceHost } from '@pepbits/reference-host';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

interface ErrorBody { error?: string; code?: string; details?: unknown }
function asBody(value: unknown): ErrorBody | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') { try { return JSON.parse(value) as ErrorBody; } catch { return { error: value }; } }
  return typeof value === 'object' ? (value as ErrorBody) : undefined;
}

/** Normalises whatever host.request rejects with into the source's ApiError(status, message, code, details). */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const e = (error ?? {}) as { status?: number; statusCode?: number; code?: unknown; body?: unknown; data?: unknown; details?: unknown; message?: string; response?: { status?: number } };
  const body = asBody(e.body) ?? asBody(e.data) ?? (e.details && typeof e.details === 'object' && ('error' in e.details || 'code' in e.details) ? asBody(e.details) : undefined);
  const status = e.status ?? e.statusCode ?? e.response?.status ?? 0;
  const code = body?.code ?? (typeof e.code === 'string' && !/^E[A-Z_]+$/.test(e.code) ? e.code : undefined);
  const message = body?.error ?? (e.message && e.message.length ? e.message : `Request failed (${status}).`);
  return new ApiError(status, message, code, body?.details ?? (body ? undefined : e.details));
}

export interface ApiOptions { method?: string; body?: unknown; signal?: AbortSignal }

export interface ReportsClient {
  api<T>(path: string, opts?: ApiOptions): Promise<T>;
  /** Requests a file through host.fetch and saves it through the browser. */
  download(path: string, body?: unknown, fallbackName?: string): Promise<void>;
  canDownload: boolean;
}

export function createReportsClient(host: Pick<ReferenceHost, 'request' | 'fetch'>): ReportsClient {
  return {
    canDownload: typeof host.fetch === 'function',
    async api<T>(path: string, opts: ApiOptions = {}) {
      const hasBody = opts.body !== undefined;
      try {
        return await host.request<T>(path, {
          method: opts.method ?? (hasBody ? 'POST' : 'GET'),
          headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
          body: hasBody ? JSON.stringify(opts.body) : undefined,
          cache: 'no-store',
          signal: opts.signal,
        });
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') throw e;
        throw toApiError(e);
      }
    },
    async download(path: string, body?: unknown, fallbackName = 'report') {
      if (!host.fetch) throw new ApiError(0, 'Downloads are not available in this host.', 'DOWNLOAD_UNAVAILABLE');
      const res = await host.fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
      if (!res.ok) {
        let data: ErrorBody = {};
        try { data = (await res.json()) as ErrorBody; } catch { /* not json */ }
        throw new ApiError(res.status, data.error ?? `Download failed (${res.status}).`, data.code);
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
  };
}

const ClientContext = createContext<ReportsClient | null>(null);
const RefreshContext = createContext<{ version: number; refresh: () => void }>({ version: 0, refresh: () => {} });

export function ReportsClientProvider({ children }: { children: React.ReactNode }) {
  const host = useReferenceHost();
  const latest = useRef(host); latest.current = host;
  const scopeKey = referenceScopeKey(host.scope);
  const downloadsAvailable = typeof host.fetch === 'function';
  const client = useMemo(() => createReportsClient({
    request: <T,>(path: string, init?: RequestInit) => latest.current.request<T>(path, init),
    fetch: downloadsAvailable ? (path: string, init?: RequestInit) => latest.current.fetch!(path, init) : undefined,
  }), [scopeKey, downloadsAvailable]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const refreshValue = useMemo(() => ({ version, refresh }), [version, refresh]);
  return <ClientContext.Provider value={client}><RefreshContext.Provider value={refreshValue}>{children}</RefreshContext.Provider></ClientContext.Provider>;
}

export function useReportsClient(): ReportsClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('Reference Reports components must render inside ReferenceReportsModule.');
  return client;
}

/** next/navigation's router shape over the shared host navigation; refresh() reloads module page data. */
export function useModuleRouter() {
  const router = useReferenceRouter();
  const { refresh } = useContext(RefreshContext);
  return useMemo(() => ({ push: router.push, replace: router.replace, back: router.back, refresh }), [router, refresh]);
}

export interface PageState<T> { data: T | null; error: ApiError | null; loading: boolean; reload: () => void }

/**
 * Client replacement for a Next server-component loader. Latest request wins: an older response,
 * or one arriving after unmount or a scope change, is ignored and its request aborted.
 */
export function usePageData<T>(path: string | null): PageState<T> {
  const client = useReportsClient();
  const { version } = useContext(RefreshContext);
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean; key: string | null }>({ data: null, error: null, loading: !!path, key: null });
  const [local, setLocal] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (!path) return;
    const id = ++seq.current;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null, data: s.key === path ? s.data : null, key: path }));
    client.api<T>(path, { signal: controller.signal }).then(
      (data) => { if (id === seq.current) setState({ data, error: null, loading: false, key: path }); },
      (e) => { if (id === seq.current && (e as { name?: string })?.name !== 'AbortError') setState({ data: null, error: toApiError(e), loading: false, key: path }); },
    );
    return () => { controller.abort(); };
  }, [client, path, version, local]);
  const reload = useCallback(() => setLocal((n) => n + 1), []);
  return { data: state.key === path ? state.data : null, error: state.key === path ? state.error : null, loading: state.loading || state.key !== path, reload };
}
