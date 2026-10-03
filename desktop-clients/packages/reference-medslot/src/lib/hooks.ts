"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSourceApi, ApiError } from "./api";

/** Loads a GET endpoint; re-fetches when the path changes. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const api=useSourceApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(e as ApiError);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path,api]);

  useEffect(() => { setData(null);setError(null);load();return ()=>{seq.current++;}; }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
