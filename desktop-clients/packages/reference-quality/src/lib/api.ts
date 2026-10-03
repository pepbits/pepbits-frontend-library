"use client";
import { useMemo, useRef } from "react";
import { referenceScopeKey, useReferenceHost } from "@pepbits/reference-host";

/** Namespace the host transport maps these paths onto (the host adds the /api prefix and credentials). */
export const QUALITY_NAMESPACE = "/reference-modules/quality";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

export interface QualityTransport {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  fetch?: (path: string, init?: RequestInit) => Promise<Response>;
}

type Failure = Error & { status?: number; details?: { error?: unknown; message?: unknown } | null };

/** Maps a host transport failure onto the source's ApiError(status, code, message). */
function toApiError(error: unknown): ApiError {
  const e = error as Failure;
  if (e instanceof ApiError) return e;
  const status = typeof e?.status === "number" ? e.status : 0;
  if (!status) return new ApiError(0, "network", "Cannot reach the AllyVora Quality service.");
  const fallback = status >= 500 ? "The server could not complete the request." : "The request could not be completed.";
  const code = typeof e.details?.error === "string" ? e.details.error : "error";
  const message = typeof e.details?.message === "string" ? e.details.message : fallback;
  return new ApiError(status, code, message);
}

/** The source `api()` and `download()` bound to one host transport. No token store: the host session authenticates. */
export function createQualityClient(transport: QualityTransport) {
  /**
   * Every mutation (POST/PUT/PATCH/DELETE) carries an Idempotency-Key. A fresh UUID per call by default; pass the same
   * `operationKey` to an explicit retry of one operation so the server can recognise the replay.
   */
  async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal; operationKey?: string } = {}): Promise<T> {
    const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (MUTATING.has(method.toUpperCase())) headers[IDEMPOTENCY_HEADER] = opts.operationKey ?? crypto.randomUUID();
    try {
      return await transport.request<T>(withQuery(path, opts.query), {
        method,
        headers: Object.keys(headers).length ? headers : undefined,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });
    } catch (error) {
      throw toApiError(error);
    }
  }

  /** Saves a server-generated file (CSV export) through the authenticated host fetch. */
  async function download(path: string, query?: Query) {
    if (!transport.fetch) throw new ApiError(0, "unavailable", "Downloads are not available in this host.");
    let res: Response;
    try { res = await transport.fetch(withQuery(path, query)); }
    catch (error) { throw toApiError(error); }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, data?.error ?? "error", data?.message ?? "The export failed.");
    }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return { api, download };
}
export type QualityClient = ReturnType<typeof createQualityClient>;

/**
 * Client bound to the mounted host. It is keyed by the authenticated scope, so a tenant, branch, user or role change
 * yields a new client; the latest host.request/fetch is read through a ref so a host that re-creates them each render
 * does not restart every request.
 */
export function useQualityApi(): QualityClient {
  const host = useReferenceHost();
  const ref = useRef(host);
  ref.current = host;
  const scope = referenceScopeKey(host.scope);
  return useMemo(() => createQualityClient({
    request: (path, init) => ref.current.request(path, init),
    fetch: (path, init) => ref.current.fetch ? ref.current.fetch(path, init) : Promise.reject(new Error("Authenticated fetch is required")),
  }), [scope]);
}
