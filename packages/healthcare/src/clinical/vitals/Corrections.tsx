"use client";
import {useRecordScopeKey} from "../consult-records/record-state";
import React, {useEffect, useState} from "react";
import {Badge, Button, Input, Select, Textarea} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useClinicalActor} from "../context/clinical-context";
import {useConsultPort} from "../context/consult-host";
import {ProblemNotice} from "../layout/panel";
import {encounterClosed, RecordLoadError, useRecordMutation} from "../consult-records/record-state";
import {RecordHistory} from "../allergy/AllergyHistory";
import {ACVPU_CODE, ACVPU_TEXT, OXYGEN_CODE, FALLBACK_PARAMETERS, type ObservationCorrection, type VitalParameter} from "../models/consult-records";
import {LOINC, type ConsultationDetail, type Observation} from "../types";
import {useVitalParameters} from "./useVitalParameters";

export const isVitalReading = (o: Observation, parameters: VitalParameter[] = FALLBACK_PARAMETERS) => !o.category && (parameters.some(p => p.code === o.code) || [OXYGEN_CODE, ACVPU_CODE].includes(o.code) || o.code.startsWith("absent:"));
export function VisitReadings({detail, readOnly = false, onRecordsChanged}: {detail: ConsultationDetail; readOnly?: boolean; onRecordsChanged?: () => void | Promise<void>}) {
  const {actor, can} = useClinicalActor(), {t} = useLocalization(), catalogue = useVitalParameters();
  const closed = readOnly || encounterClosed(detail.encounter.status);
  const readings = [...detail.observations.history, ...(detail.observations.enteredInError ?? [])].filter((o, i, all) => all.findIndex(x => x.id === o.id) === i && o.encounterId === detail.encounter.id && isVitalReading(o, catalogue.parameters)).sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
  return <div className="grid gap-3"><RecordLoadError {...catalogue}/>{closed ? <p>{t("This visit is closed, so its readings can no longer be corrected.")}</p> : null}
    {!readings.length ? <p>{t("No vital signs recorded for this visit.")}</p> : null}
    {readings.map(o => <ObservationCorrectionForm key={o.id} observation={o} graceSeconds={catalogue.settings.correctionGraceSeconds} parameters={catalogue.parameters} mine={!!actor?.id && actor.id === o.authorId} readOnly={closed || !can("vitals.write") || !(actor?.role === "doctor" || actor?.role === "resident" || (!!actor?.id && actor.id === o.authorId))} onRecordsChanged={onRecordsChanged}/>)}
  </div>;
}
function ObservationCorrectionFormBody({observation: o, readOnly = false, mine = false, graceSeconds = 0, parameters = FALLBACK_PARAMETERS, onRecordsChanged}: {
  observation: Observation; readOnly?: boolean; mine?: boolean; graceSeconds?: number; parameters?: VitalParameter[]; onRecordsChanged?: () => void | Promise<void>;
}) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters();
  const [mode, setMode] = useState<"correct" | "error" | null>(null), [value, setValue] = useState(String(o.value ?? "")), [value2, setValue2] = useState(String(o.value2 ?? "")), [valueCode, setValueCode] = useState(o.valueCode ?? ""), [reason, setReason] = useState("");
  const [baseVersion, setBaseVersion] = useState(o.version ?? 1);
  const open = (next: "correct" | "error") => {setBaseVersion(o.version ?? 1); setValue(String(o.value ?? "")); setValue2(String(o.value2 ?? "")); setValueCode(o.valueCode ?? ""); setReason(""); setMode(next);};
  const [, tick] = useState(0);
  const grace = mine && o.enteredAt ? Math.max(0, Math.floor(graceSeconds - (Date.now() - Date.parse(o.enteredAt)) / 1000)) : 0;
  useEffect(() => {if (!mode || grace <= 0) return; const timer = setTimeout(() => tick(n => n + 1), 1000); return () => clearTimeout(timer);}, [mode, grace]);
  const withdrawn = o.status === "entered-in-error", bp = o.code === LOINC.bp, oxygen = o.code === OXYGEN_CODE, acvpu = o.code === ACVPU_CODE;
  const mutation = useRecordMutation(o.id, readOnly || withdrawn);
  const submit = () => {
    if (!mode || (grace <= 0 && reason.trim().length < 5)) return;
    const version = baseVersion;
    if (mode === "error") return void mutation.run(() => port.withdrawObservation(o.id, {version, reason}), async () => {setMode(null); setReason(""); await onRecordsChanged?.();});
    const p = parameters.find(p => p.code === o.code);
    const invalid = acvpu ? !Object.hasOwn(ACVPU_TEXT, valueCode) : oxygen ? !["air", "oxygen"].includes(valueCode) || (valueCode === "oxygen" && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 60)) : !value.trim() || !Number.isFinite(Number(value)) || (p && (Number(value) < p.min || Number(value) > p.max)) || (bp && (!value2.trim() || !Number.isFinite(Number(value2)) || Number(value) <= Number(value2) || (p && (Number(value2) < (p.min2 ?? 20) || Number(value2) > (p.max2 ?? 200)))));
    if (invalid) {mutation.setProblems(["Enter a valid corrected value within the parameter range."]); return;}
    const input: ObservationCorrection = oxygen || acvpu ? {version, reason, valueCode, value: oxygen && valueCode === "oxygen" && value.trim() ? Number(value) : null} : {version, reason, value: Number(value), ...(bp ? {value2: Number(value2)} : {})};
    void mutation.run(() => port.correctObservation(o.id, input), async () => {setMode(null); setReason(""); await onRecordsChanged?.();});
  };
  return <div className="grid gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
    <p><b>{o.display}</b> · {format.dateTime(o.effectiveAt)} · {o.authorName ?? t("unknown user")}</p>
    <p className={withdrawn ? "line-through" : ""}>{o.absentReason ? `${t("Not measured")}: ${t(o.absentReason)}` : o.valueDisplay ?? (o.value == null ? "—" : `${format.number(o.value)}${o.value2 == null ? "" : `/${format.number(o.value2)}`} ${o.unit ?? ""}`)}</p>
    {o.status ? <Badge tone={withdrawn ? "neutral" : "warning"}>{t(o.status)}</Badge> : null}
    <details><summary>{t("Change history")}</summary><RecordHistory changes={o.history}/></details>
    {!readOnly && !withdrawn ? mode ? <fieldset disabled={mutation.busy} className="grid gap-2">
      {mode === "correct" ? acvpu || oxygen ? <><Select label={acvpu ? "Corrected consciousness (ACVPU)" : "Corrected breathing"} value={valueCode} onChange={e => setValueCode(e.target.value)} options={Object.entries(acvpu ? ACVPU_TEXT : {air: "Room air", oxygen: "Supplemental oxygen"}).map(([v, label]) => ({value: v, label}))}/>{oxygen && valueCode === "oxygen" ? <Input label="Flow (optional)" type="number" min={0} max={60} step={0.5} value={value} onChange={e => setValue(e.target.value)}/> : null}</> : <><Input label={bp ? "Systolic" : "Corrected value"} type="number" step="any" value={value} onChange={e => setValue(e.target.value)}/>{bp ? <Input label="Diastolic" type="number" value={value2} onChange={e => setValue2(e.target.value)}/> : null}</> : <p>{t("The reading stays in the record, struck through, and no longer counts towards NEWS2, trends or signing. Record a fresh measurement if one is needed.")}</p>}
      <Textarea label="Reason" aria-label="Reason" required={grace <= 0} value={reason} maxLength={500} onChange={e => setReason(e.target.value)}/>
      {grace > 0 ? <p>{t("Your own entry: no reason needed for {seconds} more seconds. The change is still kept in the history.", {seconds: format.number(grace)})}</p> : null}
      <div className="flex gap-2"><Button variant="ghost" onClick={() => {setMode(null); setReason("");}}>Cancel</Button><Button variant={mode === "error" ? "danger" : "primary"} disabled={grace <= 0 && reason.trim().length < 5} onClick={submit}>{mode === "correct" ? "Save correction" : "Mark entered in error"}</Button></div>
    </fieldset> : <div className="flex gap-2">{!o.code.startsWith("absent:") ? <Button variant="ghost" onClick={() => open("correct")}>Correct</Button> : null}<Button variant="ghost" onClick={() => open("error")}>Entered in error</Button></div> : null}
    <ProblemNotice problems={mutation.problems}/>
  </div>;
}

export function ObservationCorrectionForm(props: React.ComponentProps<typeof ObservationCorrectionFormBody>) {
  return <ObservationCorrectionFormBody key={useRecordScopeKey(props.observation.id)} {...props}/>;
}
