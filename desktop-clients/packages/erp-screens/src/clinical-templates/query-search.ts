import {useCallback, useEffect, useRef, useState} from "react";
import type {PatientFilters, PatientSearchResult} from "@pepbits/erp-config";
import type {ClinicalTemplateAdapter} from "@pepbits/erp-data";

/** One outstanding request per query; retired queries cannot publish rows or errors. */
export function usePatientSearch(adapter: ClinicalTemplateAdapter, applied: PatientFilters | null, infinite: boolean) {
  const [value, setValue] = useState<PatientSearchResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const current = useRef<{controller: AbortController; value: PatientSearchResult | null; loading: boolean} | null>(null);
  const fetchPage = useCallback(async (state: NonNullable<typeof current.current>, filters: PatientFilters, append: boolean) => {
    if (state.loading || state.controller.signal.aborted) return;
    state.loading = true;
    setBusy(true);
    setError(null);
    try {
      const result = await adapter.search(filters, {signal: state.controller.signal});
      if (current.current !== state || state.controller.signal.aborted) return;
      const rows = append ? [...(state.value?.rows ?? []), ...result.rows] : result.rows;
      // Stable identity also protects against overlapping cursor pages during concurrent changes.
      const unique = [...new Map(rows.map(row => [row.id, row])).values()];
      state.value = {...result, rows: unique};
      setValue(state.value);
    } catch (failure) {
      if (current.current === state && !state.controller.signal.aborted) setError(failure);
    } finally {
      state.loading = false;
      if (current.current === state && !state.controller.signal.aborted) setBusy(false);
    }
  }, [adapter]);
  useEffect(() => {
    const state = {controller: new AbortController(), value: null, loading: false};
    current.current = state;
    setValue(null);
    setError(null);
    setBusy(false);
    if (applied) void fetchPage(state, applied, false);
    return () => { state.controller.abort(); if (current.current === state) current.current = null; };
  }, [applied, fetchPage, revision]);
  const more = useCallback(() => {
    const state = current.current;
    if (!infinite || !applied || !state?.value?.hasMore) return;
    void fetchPage(state, {...applied, page: state.value.page + 1}, true);
  }, [applied, fetchPage, infinite]);
  return {value, error, busy, more, retry: () => value && infinite ? more() : setRevision(r => r + 1), refresh: () => setRevision(r => r + 1)};
}
