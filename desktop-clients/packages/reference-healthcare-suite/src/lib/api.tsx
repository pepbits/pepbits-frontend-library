'use client';
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useReferenceHost, referenceScopeKey } from '@pepbits/reference-host';
import type { Option } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); this.name = 'ApiError'; }
}
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface Options { method?: Method; body?: unknown; signal?: AbortSignal; operationId?:string }
export type ApiClient = <T = any>(path: string, opts?: Options) => Promise<T>;
interface Runtime { api: ApiClient; cache: Map<string, Promise<Option[]>>; facilityId: string; scopeKey: string }
const Context = createContext<Runtime | null>(null);
// The injected host transport owns /reference-modules/healthcare-suite.
export const API_BASE = '/api';
/** Each mounted authenticated host owns its transport and lookups. No global session/cache. */
export function ApiProvider({ facilityId = '', canWrite = true, canWriteRcm = false, children }: { facilityId?: string; canWrite?:boolean; canWriteRcm?:boolean; children: ReactNode }) {
  const host = useReferenceHost();
  const scopeKey = referenceScopeKey(host.scope);
  const latestHost=useRef(host);latestHost.current=host;
  const operationKeys = useMemo(() => new Map<string,string>(), [scopeKey]);
  const cache = useMemo(() => new Map<string, Promise<Option[]>>(), [scopeKey, facilityId]);
  const api = useCallback<ApiClient>(async (path, opts = {}) => {
    const readOnlyQuote=path==='/rcm/commands' && opts.body!==null && typeof opts.body==='object' && (opts.body as Record<string,unknown>).kind==='quote-price';
    if (opts.method && opts.method !== 'GET' && !canWrite && !(path === '/rcm/commands' && canWriteRcm) && !readOnlyQuote) throw new ApiError('Healthcare Suite is read-only for your role.',403);
    if (!path.startsWith('/') || path.startsWith('//')) throw new ApiError('Invalid Healthcare Suite API path', 400);
    const fingerprint = opts.method === 'POST' && !opts.operationId ? JSON.stringify([facilityId, path, opts.body ?? null]) : null;
    if (fingerprint && !operationKeys.has(fingerprint)) operationKeys.set(fingerprint, crypto.randomUUID());
    const headers: Record<string,string> = {};
    if (opts.operationId) headers['Idempotency-Key'] = opts.operationId;
    if (fingerprint) headers['Idempotency-Key'] = operationKeys.get(fingerprint)!;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (facilityId) headers['X-Reference-Facility'] = facilityId;
    const init: RequestInit = { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: opts.signal };
    try {
      const host=latestHost.current;
      if (host.fetch) {
        const response = await host.fetch(`${API_BASE}${path}`, init);
        const raw = await response.text();
        let data: any;
        try { data = raw ? JSON.parse(raw) : null; } catch { throw new ApiError('The Healthcare Suite service returned an invalid response.', response.status); }
        if (!response.ok) throw new ApiError(Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? (typeof data?.error==='string'?data.error:data?.error?.message) ?? `Request failed (${response.status})`, response.status, data?.fields ?? {});
        if (fingerprint) operationKeys.delete(fingerprint);
        return data;
      }
      const data = await host.request(`${API_BASE}${path}`, init);
      if (fingerprint) operationKeys.delete(fingerprint);
      return data;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError' || error instanceof ApiError) throw error;
      const failure = error as { message?: string; status?: number; fields?: Record<string,string>; details?:{message?:string|string[];error?:string;fields?:Record<string,string>} };
      const details=failure.details;
      const message=Array.isArray(details?.message)?details.message.join(', '):details?.message??details?.error??failure.message??'The Healthcare Suite service is unavailable. Try again.';
      throw new ApiError(message, failure.status ?? 0, details?.fields ?? failure.fields ?? {});
    }
  }, [facilityId, scopeKey, operationKeys, canWrite, canWriteRcm]);
  const value = useMemo(() => ({api, cache, facilityId, scopeKey}), [api, cache, facilityId, scopeKey, operationKeys, canWrite, canWriteRcm]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApiRuntime() { const runtime = useContext(Context); if (!runtime) throw new Error('Healthcare Suite requires its host API provider'); return runtime; }
export const useApiClient = () => useApiRuntime().api;
export const qs = (values: Record<string,unknown>) => { const p = new URLSearchParams(); Object.entries(values).forEach(([k,v]) => {if (v !== undefined && v !== null && v !== '') p.set(k,String(v));}); return p.size ? `?${p}` : ''; };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong';
