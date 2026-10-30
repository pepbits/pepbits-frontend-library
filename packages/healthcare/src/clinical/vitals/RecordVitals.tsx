"use client";
import {useRecordScopeKey} from "../consult-records/record-state";
import React, {useEffect, useState} from "react";
import {Button} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useConsultPort} from "../context/consult-host";
import {ProblemNotice} from "../layout/panel";
import {RecordLoadError, useRecordMutation} from "../consult-records/record-state";
import {consultVitalsErrors, consultVitalsPayload, EMPTY_CONSULT_VITALS, type ConsultVitals} from "../models/consult-records";
import type {Observation, ScoreResult} from "../types";
import {ConsultVitalsFields} from "./VitalsSection";
import {News2Panel, useNews2} from "./News2Panel";
import {useVitalParameters} from "./useVitalParameters";

function RecordVitalsBody({encounterId, latest = {}, readOnly = false, onSaved, onCancel, onRecordsChanged, onBusyChange}: {
  encounterId: string; latest?: Record<string, Observation>; readOnly?: boolean; onSaved?: (news: ScoreResult) => void; onCancel?: () => void; onRecordsChanged?: () => void | Promise<void>; onBusyChange?: (busy: boolean) => void;
}) {
  const port = useConsultPort(), {t} = useLocalization(), catalogue = useVitalParameters();
  const [v, setV] = useState<ConsultVitals>(() => ({...EMPTY_CONSULT_VITALS, extra: {}})), [reasons, setReasons] = useState<Record<string, string>>({});
  const mutation = useRecordMutation(encounterId, readOnly), preview = useNews2(v, reasons, catalogue.parameters);
  useEffect(() => {onBusyChange?.(mutation.busy); return () => onBusyChange?.(false);}, [mutation.busy, onBusyChange]);
  const save = () => {
    const errors = consultVitalsErrors(v, reasons, catalogue.parameters);
    if (v.measuredAt) {
      const measured = Date.parse(v.measuredAt), age = Date.now() - measured;
      if (!Number.isFinite(measured) || age < 0 || age > catalogue.settings.maxBackdateHours * 3600000) errors.push("Measured time must be within the allowed backdate window and cannot be in the future.");
    }
    mutation.setProblems(errors); if (errors.length) return;
    void mutation.run(() => port.recordVitals(encounterId, consultVitalsPayload(v, reasons, catalogue.parameters)), async result => {
      setV({...EMPTY_CONSULT_VITALS, extra: {}}); setReasons({}); onSaved?.(result.news2); await onRecordsChanged?.();
    });
  };
  return <div className="grid gap-3"><RecordLoadError {...catalogue}/>
    {catalogue.problems.length ? <p>{t("Using starter vital parameters until the catalogue can be loaded. The server validates saved measurements.")}</p> : null}
    {catalogue.loading ? <p>{t("Loading vital signs…")}</p> : <ConsultVitalsFields value={v} onChange={setV} notMeasured={reasons} onNotMeasured={setReasons} latest={latest} parameters={catalogue.parameters} settings={catalogue.settings} readOnly={readOnly || mutation.busy}/>}
    <News2Panel {...preview}/><ProblemNotice problems={mutation.problems}/>
    <div className="flex gap-2">{onCancel ? <Button variant="ghost" disabled={mutation.busy} onClick={onCancel}>Cancel</Button> : null}<Button loading={mutation.busy} disabled={readOnly || catalogue.loading} onClick={save}>Save vitals</Button></div>
  </div>;
}

export function RecordVitals(props: React.ComponentProps<typeof RecordVitalsBody>) {
  return <RecordVitalsBody key={useRecordScopeKey(props.encounterId)} {...props}/>;
}
