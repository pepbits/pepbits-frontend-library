"use client";
import {useCallback} from "react";
import {useConsultPort} from "../context/consult-host";
import {useRecordResource} from "../consult-records/record-state";
import {FALLBACK_PARAMETERS} from "../models/consult-records";

export function useVitalParameters() {
  const port = useConsultPort();
  const resource = useRecordResource(useCallback((signal: AbortSignal) => port.loadVitalParameters(signal), [port]));
  return {...resource, parameters: resource.data?.items ?? FALLBACK_PARAMETERS,
    settings: resource.data ?? {correctionGraceSeconds: 0, maxBackdateHours: 24}, loading: !resource.data && !resource.problems.length};
}
