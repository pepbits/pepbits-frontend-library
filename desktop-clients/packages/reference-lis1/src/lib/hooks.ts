'use client';
import {useDiagnosticResource} from '@pepbits/reference-diagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';


/** Loads data from the API and exposes reload(); re-runs when the path or params change. */
export function useApi<T = any>(path: string | null, params?: Record<string, any>) {
  return useDiagnosticResource<T>(path, params);
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Host-bound lookup: no module-global cross-branch patient/master cache. */
export function useMaster(slug:string|null){const {data}=useApi<any[]>(slug?`/masters/${slug}`:null,{take:2000});return data??[];}

/** Reads a setting value (e.g. billing.currency) from the settings master. */
export function useSetting(key: string, fallback = '') {
  const rows = useMaster('settings');
  return rows.find((r) => r.key === key)?.value ?? fallback;
}
export const useCurrency = () => useSetting('billing.currency', 'USD');
