"use client";
import {useCallback, useEffect, useState} from "react";
import {useClinicalPort} from "../context/clinical-context";
import type {EncounterClass, QueueRow} from "../types";

/**
 * Today's encounters of one class through the data port, refreshed every `refreshMs`. A failed
 * refresh keeps the previous rows and reports the error.
 */
export function useEncounterRows(encounterClass: EncounterClass, refreshMs = 30_000, reloadKey?: unknown) {
  const port = useClinicalPort();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => port.listEncounters(encounterClass).then(result => { setRows(result); setError(null); }).catch(setError), [port, encounterClass]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), refreshMs); return () => clearInterval(timer); }, [load, refreshMs, reloadKey]);
  return {rows, error, reload: () => void load()};
}
