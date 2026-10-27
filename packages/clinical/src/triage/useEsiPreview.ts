"use client";
import {useEffect, useMemo, useState} from "react";
import {useClinicalPort} from "../context/clinical-context";
import {esiInputs, type EsiDecisions, type EsiPreview} from "./model";
import type {VitalsPayload} from "../vitals/model";

/**
 * Live ESI preview through the data port, 300 ms after the last change. Nothing is sent while a
 * measurement is invalid (`paused`), and a result for older inputs is never shown. The server
 * recalculates on save.
 */
export function useEsiPreview(decisions: EsiDecisions, ageYears: number | undefined, vitals: Pick<VitalsPayload, "hr" | "rr" | "spo2">, paused = false): EsiPreview | null {
  const port = useClinicalPort();
  const key = useMemo(() => JSON.stringify(esiInputs(decisions, ageYears, vitals)), [decisions, ageYears, vitals.hr, vitals.rr, vitals.spo2]);
  const [result, setResult] = useState<{key: string; preview: EsiPreview} | null>(null);
  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      port.previewEsi(JSON.parse(key) as Record<string, unknown>, controller.signal)
        .then(preview => { if (!controller.signal.aborted) setResult({key, preview}); })
        .catch(() => { if (!controller.signal.aborted) setResult(null); });
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [key, paused, port]);
  return !paused && result?.key === key ? result.preview : null;
}
