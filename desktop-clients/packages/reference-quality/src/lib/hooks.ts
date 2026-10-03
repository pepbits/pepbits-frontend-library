"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQualityApi, withQuery, type Query } from "./api";

/** Fetches JSON from the host API and re-fetches when the path, query or authenticated scope changes. Pass null to skip. */
export function useApi<T>(path: string | null, query?: Query) {
  const { api } = useQualityApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const key = path ? withQuery(path, query) : null;
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const id = ++seq.current;
    controller.current?.abort();
    if (!key) return;
    const abort = (controller.current = new AbortController());
    setLoading(true);
    setError(null);
    try {
      const result = await api<T>(key, { signal: abort.signal });
      if (id === seq.current) setData(result);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [api, key]);

  useEffect(() => {
    void load();
    return () => { seq.current++; controller.current?.abort(); };
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
