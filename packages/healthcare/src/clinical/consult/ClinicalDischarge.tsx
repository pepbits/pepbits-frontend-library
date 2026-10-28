"use client";
import React, {useState} from "react";
import {Button, Input, Textarea, Badge} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {useClinicalActor} from "../context/clinical-context";
import {ProblemNotice, ClinicalPanel} from "../layout/panel";
import type {ConsultationEncounter} from "../types";
import {useWorkflow} from "./useWorkflow";

export function toLocalDateTime(value: string) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16);
}
const dischargeLabels: Record<string, string> = {home: "Clinically discharged at", "follow-up": "Clinically discharged at", "refer-er": "Left our care at", admit: "Decision to admit at", "refer-external": "Left our care at"};
export function DischargeTime({disposition, value, arrivedAt, disabled, onChange}: {disposition: string; value: string; arrivedAt?: string; disabled: boolean; onChange: (value: string) => void}) {
  const {t} = useLocalization();
  const label = dischargeLabels[disposition] ?? "Clinically discharged at", time = Date.parse(value);
  const problem = !value || !Number.isFinite(time) ? "required" : time > Date.now() + 300000 ? "can't be in the future" : arrivedAt && time < Date.parse(arrivedAt) - 60000 ? "before the visit started" : null;
  return <div className="grid gap-2"><Input label={label} type="datetime-local" disabled={disabled} value={toLocalDateTime(value)} min={arrivedAt ? toLocalDateTime(arrivedAt) : undefined}
    max={toLocalDateTime(new Date().toISOString())} onChange={e => { if (!disabled) onChange(e.target.value ? new Date(e.target.value).toISOString() : ""); }}/>
    <Button disabled={disabled} onClick={() => { if (!disabled) onChange(new Date().toISOString()); }}>{t("Now")}</Button>
    <p>{problem ? `${t(label)}: ${t(problem)}.` : t("When you released the patient, not when you sign. Check-out keeps its own time.")}</p></div>;
}
export function ClinicalDischarge({encounter, onRecordsChanged, onBusyChange}: {encounter: ConsultationEncounter; onRecordsChanged?: () => void | Promise<void>; onBusyChange?: (busy: boolean) => void}) {
  const {t} = useLocalization(), format = useFormatters(), port = useConsultPort(), {can} = useClinicalActor();
  const [open, setOpen] = useState(false), [at, setAt] = useState(""), [reason, setReason] = useState("");
  const [corrected, setCorrected] = useState<ConsultationEncounter | null>(null);
  const enc = corrected && corrected.version >= encounter.version ? corrected : encounter;
  const action = useWorkflow(onBusyChange, open && (!!at || !!reason));
  return <ClinicalPanel title="Clinical discharge">
    <p>{t(enc.clinicalDischargeKind === "admit-decision" ? "Decision to admit at" : enc.clinicalDischargeKind === "left-care" ? "Left our care at" : "Clinically discharged at")}: {enc.clinicalDischargeAt ? format.dateTime(enc.clinicalDischargeAt) : t("Not recorded")} {!!enc.clinicalDischargeChanges?.length && <Badge tone="warning">{t("corrected")}</Badge>}</p>
    {can("note.write") && !open && <Button onClick={() => {setAt(toLocalDateTime(enc.clinicalDischargeAt ?? "")); setReason(""); setOpen(true);}}>{t("Correct")}</Button>}
    {open && <div className="grid gap-2"><Input label="Correct time" type="datetime-local" disabled={action.busy} value={at} max={toLocalDateTime(new Date().toISOString())} onChange={e => setAt(e.target.value)}/>
      <Textarea label="Reason" required maxLength={500} disabled={action.busy} value={reason} onChange={e => setReason(e.target.value)}/>
      <Button disabled={action.busy} onClick={() => setOpen(false)}>{t("Cancel")}</Button>
      <Button disabled={!can("note.write") || !at || reason.trim().length < 5 || action.busy} onClick={() => {if (can("note.write") && at && reason.trim().length >= 5) void action.run(() => port.recordClinicalDischarge(enc.id, {at: new Date(at).toISOString(), reason, expectedVersion: enc.version}), async next => {setCorrected(next); setOpen(false); await onRecordsChanged?.();});}}>{t("Save correction")}</Button></div>}
    <ProblemNotice problems={action.problems}/>
    <ol>{enc.clinicalDischargeChanges?.map((change, i) => <li key={i}>{change.from ? format.dateTime(change.from) : "—"} → {format.dateTime(change.to)} · {change.byName}, {format.dateTime(change.at)} · {change.reason}</li>)}</ol>
  </ClinicalPanel>;
}
