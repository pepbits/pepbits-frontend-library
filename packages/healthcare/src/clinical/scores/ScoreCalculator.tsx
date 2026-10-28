"use client";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {Badge, Button, Input, Segmented} from "@pepbits/ui";
import {ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ProblemNotice} from "../layout/panel";
import {useDebounced} from "../hooks/useDebounced";
import {useClinicalMutation, useClinicalResource} from "../history/PatientHistory";
import type {SavedScore, ScoreAutofill, ScoreAutofillValue} from "../models/consult-records";
import type {ScoreDef} from "../types";
type FillNote = {record: ScoreAutofillValue; override?: boolean};
export interface ScoreCalculatorProps {def: ScoreDef; patientId?: string; encounterId?: string; onSaved?: (result: SavedScore) => void | Promise<void>; compact?: boolean; readOnly?: boolean}
/** A new context gets fresh inputs even if the host reuses this component instance. */
export function ScoreCalculator(props: ScoreCalculatorProps) {
  const port = useConsultPort(), identity = useRef({port, generation: 0});
  if (identity.current.port !== port) identity.current = {port, generation: identity.current.generation + 1};
  return <ScoreForm key={`${identity.current.generation}/${props.patientId}/${props.encounterId}/${props.def.id}/${props.def.version}`} {...props}/>;
}
function ScoreForm({def, patientId, encounterId, onSaved, readOnly = false}: ScoreCalculatorProps) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters();
  const [values, setValues] = useState<Record<string, unknown>>({}), [filled, setFilled] = useState<Record<string, FillNote>>({});
  const latest = useRef(values); latest.current = values;
  const debounced = useDebounced(values, 200);
  const calculation = useClinicalResource(useCallback(signal => port.calculateScore(def.id, debounced, signal), [port, def.id, debounced]));
  const autofill = useClinicalResource(useCallback(signal => patientId && def.inputs.some(i => i.autofill) ? port.loadScoreAutofill(patientId, signal) : Promise.resolve<ScoreAutofill>({}), [port, patientId, def]));
  const mutation = useClinicalMutation(`${patientId}/${encounterId}/${def.id}`, readOnly);
  useEffect(() => {
    if (!autofill.data || readOnly) return;
    const next = {...latest.current}, notes: typeof filled = {};
    for (const input of def.inputs) {
      const a = input.autofill && autofill.data[input.autofill];
      if (!a || a.value === undefined || a.value === null) continue;
      if (a.stale) {notes[input.key] = {record: a}; continue;}
      if (next[input.key] !== undefined) continue;
      if (input.kind === "choice" && !input.options?.some(o => o.value === String(a.value))) continue;
      if (input.kind === "number" && !Number.isFinite(Number(a.value))) continue;
      if (input.kind === "flag") continue;
      next[input.key] = input.kind === "number" ? Number(a.value) : String(a.value);
      notes[input.key] = {record: a};
    }
    if (Object.keys(notes).length) {setValues(next); setFilled(f => ({...f, ...notes}));}
  }, [autofill.data, def, readOnly]);
  const setValue = (key: string, value: unknown) => {
    if (readOnly || mutation.busy) return;
    setValues(current => {const next = {...current}; if (value === "" || value === undefined) delete next[key]; else next[key] = value; return next;});
    setFilled(current => {const next = {...current}; const was = current[key]; delete next[key]; if (was && !was.record.stale) next[key] = {...was, override: true}; return next;});
  };
  const fillText = ({record: a, override}: FillNote) => {
    const shown = `${typeof a.value === "number" ? format.number(a.value) : a.value}${a.unit && a.source !== "patient" ? ` ${a.unit}` : ""}`;
    const when = a.at ? format.dateTime(a.at) : t("time unknown");
    if (a.stale) return `${t("Last recorded value")}: ${shown}, ${when} · ${t("older than")} ${format.number(a.windowHours ?? 0)} ${t("hours; not used")}`;
    if (override) return `${t("Changed by you · record value")} ${shown}`;
    const source = t(a.source === "lab" ? "Lab" : a.source === "vital" ? "Vitals" : "Patient record");
    return `${source} · ${when}${a.original ? ` · ${t("reported as")} ${a.original}` : ""}${a.status && a.status !== "final" ? ` · ${t(a.status)}` : ""}`;
  };
  const currentResult = values === debounced ? calculation.data : undefined;
  return <div className="grid gap-3">
    <div><Badge tone="brand">{t(def.category)}</Badge> {t("Method")} {def.version}</div>
    {!!patientId && def.inputs.some(i => i.autofill) && <Button disabled={readOnly || mutation.busy} onClick={autofill.reload}>{t("Refill from record")}</Button>}
    {!!autofill.error && <ErrorState title="Could not fill from record" description={problemsOf(autofill.error).join(" ")} onRetry={autofill.reload}/>}
    <fieldset disabled={readOnly || mutation.busy} className="grid gap-3">{def.inputs.map(input => <div key={input.key}>
      <p>{t(input.label)} {input.points != null ? format.number(input.points) : ""}</p>{input.help && <p>{t(input.help)}</p>}
      {filled[input.key] && <p>{fillText(filled[input.key]!)}</p>}
      {input.kind === "number" ? <Input label={input.label} type="number" min={input.min} max={input.max} step={input.step ?? 1} suffix={input.unit} value={values[input.key] === undefined ? "" : String(values[input.key])} onChange={e => setValue(input.key, e.target.value === "" ? undefined : Number(e.target.value))}/>
        : <><Segmented label={input.label} value={input.kind === "flag" ? values[input.key] === true ? "yes" : values[input.key] === false ? "no" : "" : String(values[input.key] ?? "")}
          options={(input.kind === "flag" ? [{value: "yes", label: "Yes"}, {value: "no", label: "No"}] : (input.options ?? []).map(o => ({value: o.value, label: `${t(o.label)}${o.points != null && !["egfr", "bmi", "rass", "ciwa"].includes(def.id) ? ` (${format.number(o.points)})` : ""}`}))).map(o => ({...o, disabled: readOnly || mutation.busy}))}
          onChange={v => setValue(input.key, input.kind === "flag" ? v === "yes" : v)}/><Button variant="ghost" aria-label={`${t("Clear")} ${t(input.label)}`} onClick={() => setValue(input.key, undefined)}>{t("Clear")}</Button></>}
    </div>)}</fieldset>
    {!!calculation.error && <ErrorState title="Could not calculate score" description={problemsOf(calculation.error).join(" ")} onRetry={calculation.reload}/>}
    <section aria-label={t("Score result")} aria-live="polite"><h3>{def.short} {t("result")}</h3>
      {currentResult?.status === "complete" ? <><strong>{currentResult.display ?? (currentResult.total === null ? "—" : format.number(currentResult.total))}</strong><Badge tone={currentResult.severity === "critical" || currentResult.severity === "high" ? "danger" : currentResult.severity === "moderate" ? "warning" : "success"}>{currentResult.band}</Badge><p>{currentResult.interpretation}</p></>
        : <><p>{t("Incomplete")}</p><p>{currentResult?.missing.length ? `${t("Still needed")}: ${currentResult.missing.map(m => t(m)).join(", ")}.` : t("Answer the inputs to calculate.")} {t("Missing inputs are never counted as zero.")}</p></>}
      <p>{def.citation} {def.licence}</p>
    </section>
    <ProblemNotice problems={mutation.problems}/>
    {patientId && <Button variant="primary" disabled={readOnly || mutation.busy || currentResult?.status !== "complete"} onClick={() => {if (currentResult?.status === "complete") void mutation.run(() => port.saveScore(def.id, {patientId, encounterId, inputs: {...values}}), onSaved);}}>{t("Save to record")}</Button>}
  </div>;
}
