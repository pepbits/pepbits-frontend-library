"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { referenceScopeKey, useReferenceHost } from "@pepbits/reference-host";

/** Source paths ("/students", "/stats?role=…") are sent as host.request("/api" + path); the host namespaces them. */
export const SCHOOL_API_PREFIX = "/api";

export class ApiError extends Error {}

export interface SchoolApi {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
  del: <T>(path: string) => Promise<T>;
  /** Changes whenever tenant/application/branch/user/roles change, so callers can drop data from another scope. */
  scopeKey: string;
}

function message(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof (error as { error: unknown }).error === "string") return (error as { error: string }).error;
  return "Request failed";
}

/** The only transport in the module. Bound to the current host, never stored at module scope. */
export function useSchoolApi(): SchoolApi {
  const host = useReferenceHost();
  const scopeKey = referenceScopeKey(host.scope);
  /* Stable per scope: a host re-render that passes a new request function (or new preferences) must not look like a
     new client, or sessions and page data would reload and unsaved drafts would be lost. Calls use the latest one. */
  const request = useRef(host.request);
  request.current = host.request;
  return useMemo(() => {
    const call = async <T,>(path: string, init?: RequestInit): Promise<T> => {
      try {
        return await request.current<T>(`${SCHOOL_API_PREFIX}${path}`, init);
      } catch (error) {
        throw new ApiError(message(error));
      }
    };
    const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return {
      get: <T,>(path: string) => call<T>(path),
      post: <T,>(path: string, body: unknown) => call<T>(path, json("POST", body)),
      patch: <T,>(path: string, body: unknown) => call<T>(path, json("PATCH", body)),
      del: <T,>(path: string) => call<T>(path, { method: "DELETE" }),
      scopeKey,
    };
  }, [scopeKey]);
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
}

/** Tiny SWR-style hook: fetches `path`, exposes data/loading/error and a reload. Pass null to skip.
    Data from a previous host scope is cleared before the new scope's request starts. */
export function useApi<T>(path: string | null) {
  const api = useSchoolApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  const latest = useRef(path);
  latest.current = path;
  const scope = useRef(api.scopeKey);

  useEffect(() => {
    if (scope.current !== api.scopeKey) { scope.current = api.scopeKey; setData(null); setError(null); }
    if (!path) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    api.get<{ data: T }>(path)
      .then((j) => { if (alive && latest.current === path) { setData(j.data); setError(null); } })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path, tick, api]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** For list endpoints that also return a total. */
export function useList<T>(path: string | null) {
  return useApi<T[]>(path);
}
