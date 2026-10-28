"use client";
import React, {useCallback, useEffect, useState} from "react";
import {Badge, Button, Input, Segmented, Select, Textarea} from "@pepbits/ui";
import {Drawer, ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ProblemNotice} from "../layout/panel";
import {FacilityPicker} from "../reference/FacilityPicker";
import {useClinicalMutation, useClinicalResource} from "./PatientHistory";
import {HISTORY_SCOPES} from "./MedicationHistory";
import type {HistoryKind, MedHistoryScope} from "../models/consult-records";
const KIND_LABEL = {lab: "Laboratory", imaging: "Imaging", procedure: "Procedures"};
export function InvestigationHistory({patientId, encounterId, kind: initialKind, onClose, canAdd = true, readOnly = false, onRecordsChanged}: {patientId: string; encounterId: string; kind: HistoryKind; onClose: () => void; canAdd?: boolean; readOnly?: boolean; onRecordsChanged?: () => void | Promise<void>}) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters();
  const [kind, setKind] = useState(initialKind), [scope, setScope] = useState<MedHistoryScope>("organisation"), [q, setQ] = useState(""), [adding, setAdding] = useState(false), [withdraw, setWithdraw] = useState(""), [reason, setReason] = useState("");
  const canWrite = canAdd && !readOnly, mutation = useClinicalMutation(`${patientId}/${encounterId}`, !canWrite);
  const resource = useClinicalResource(useCallback(signal => port.loadInvestigationHistory(patientId, {kind, scope, encounterId}, signal), [port, patientId, encounterId, kind, scope]));
  useEffect(() => {setKind(initialKind); setAdding(false); setWithdraw(""); setQ("");}, [initialKind, patientId, encounterId, port]);
  const changed = async () => {resource.reload(); await onRecordsChanged?.();};
  const shown = resource.data?.groups.filter(g => g.display.toLowerCase().includes(q.trim().toLowerCase())) ?? [];
  return <Drawer open onClose={onClose} title={`${t(KIND_LABEL[kind])} ${t("history")}`} width="lg"><div className="grid gap-3">
    <Segmented label="Kind" value={kind} options={Object.entries(KIND_LABEL).map(([value, label]) => ({value, label}))} onChange={v => {setKind(v as HistoryKind); setAdding(false); setWithdraw("");}}/>
    <Segmented label="Show history from" value={scope} options={HISTORY_SCOPES} onChange={v => setScope(v as MedHistoryScope)}/>
    {canWrite && <Button onClick={() => setAdding(true)}>{t(kind === "procedure" ? "Add past procedure" : "Add outside result")}</Button>}
    {adding && canWrite && <HistoryEntry key={`${patientId}/${encounterId}/${kind}`} patientId={patientId} encounterId={encounterId} kind={kind} onCancel={() => setAdding(false)} onSaved={async () => {setAdding(false); if (kind !== "procedure") setScope("external"); await changed();}}/>}
    <Input label="Search" value={q} onChange={e => setQ(e.target.value)}/>
    {scope === "external" && resource.data && !resource.data.externalSource.connected && <p>{resource.data.externalSource.note}</p>}
    {resource.error ? <ErrorState title="Could not load investigation history" description={problemsOf(resource.error).join(" ")} onRetry={resource.reload}/> : !resource.data ? <p>{t("Loading…")}</p> : !shown.length ? <p>{t("No history yet.")}</p> : shown.map(g => <section key={g.key} className="border border-[var(--border)] rounded-[var(--radius)] p-3">
      <h3>{g.display}</h3>{g.open && <Badge tone="warning">{t("Open order")}</Badge>}{g.external && <Badge tone="brand">{t("Other facility")}</Badge>}
      <ol>{g.events.map((e, i) => <li key={i}>{e.text} {e.encounterId === encounterId && <Badge tone="brand">{t("this visit")}</Badge>}
        <p>{e.at.length <= 7 ? e.at : format.dateTime(e.at)} · {e.by} · {e.facility || t("facility not recorded")} · {e.department} · {e.meta?.source}</p>{e.meta?.reason && <p>{e.meta.reason}</p>}
        {e.meta?.externalId && canWrite && <Button variant="ghost" onClick={() => {setWithdraw(e.meta!.externalId!); setReason("");}}>{t("Entered in error")}</Button>}
      </li>)}</ol></section>)}
    {withdraw && canWrite && <div><Input label="Why is this entry wrong? (required)" value={reason} onChange={e => setReason(e.target.value)}/><Button disabled={!reason.trim() || mutation.busy} onClick={() => void mutation.run(() => port.withdrawExternalResult(patientId, withdraw, reason.trim()), async () => {setWithdraw(""); await changed();})}>{t("Mark entered in error")}</Button><Button onClick={() => setWithdraw("")}>{t("Cancel")}</Button></div>}
    <ProblemNotice problems={mutation.problems}/>
  </div></Drawer>;
}
function HistoryEntry({patientId, encounterId, kind, onCancel, onSaved}: {patientId: string; encounterId: string; kind: HistoryKind; onCancel: () => void; onSaved: () => void | Promise<void>}) {
  const port = useConsultPort(), {t} = useLocalization(), mutation = useClinicalMutation(`${patientId}/${encounterId}`);
  const [f, setF] = useState({test: "", performed: "", facility: "", value: "", unit: "", flag: "", summary: "", source: "report", note: "", elsewhere: false});
  const procedure = kind === "procedure";
  const ready = f.test.trim().length >= 2 && (procedure ? !f.elsewhere || f.facility.trim().length >= 2 : !!f.performed && f.facility.trim().length >= 2 && (!!f.value.trim() || !!f.summary.trim()));
  const save = () => {
    if (!ready) return;
    void mutation.run(() => procedure ? port.addProcedureHistory(patientId, {procedure: f.test.trim(), performed: f.performed, note: f.note, facility: f.elsewhere ? f.facility : undefined})
      : port.addExternalResult(patientId, {kind, test: f.test, performed: f.performed, facility: f.facility, value: f.value, unit: f.unit, flag: f.flag, summary: f.summary, source: f.source, note: f.note, encounterId}), onSaved);
  };
  return <fieldset disabled={mutation.busy} className="grid gap-3 border border-[var(--border)] rounded-[var(--radius)] p-3">
    <Input label={procedure ? "Procedure" : kind === "lab" ? "Test" : "Examination"} required maxLength={160} value={f.test} onChange={e => setF({...f, test: e.target.value})}/>
    <Input label={procedure ? "When (year, month or date)" : "Date"} type={procedure ? "text" : "date"} required={!procedure} max={procedure ? undefined : new Date().toISOString().slice(0, 10)} value={f.performed} onChange={e => setF({...f, performed: e.target.value})}/>
    {procedure && <Segmented label="Where" value={f.elsewhere ? "external" : "here"} options={[{value: "here", label: "Here"}, {value: "external", label: "Another facility"}]} onChange={v => setF({...f, elsewhere: v === "external"})}/>}
    {(!procedure || f.elsewhere) && <FacilityPicker label="Facility" required value={f.facility} onChange={facility => setF({...f, facility})}/>}
    {kind === "lab" && <><Input label="Result" maxLength={60} value={f.value} onChange={e => setF({...f, value: e.target.value})}/><Input label="Unit" maxLength={30} value={f.unit} onChange={e => setF({...f, unit: e.target.value})}/>
      <Select label="Flag" value={f.flag} options={[{value: "", label: "Not stated"}, ...["normal", "abnormal", "critical"].map(value => ({value, label: value}))]} onChange={e => setF({...f, flag: e.target.value})}/></>}
    {!procedure && <><Textarea label={kind === "lab" ? "Summary (optional)" : "Impression"} required={kind === "imaging"} maxLength={2000} value={f.summary} onChange={e => setF({...f, summary: e.target.value})}/>
      <Select label="Information from" value={f.source} options={[["report", "Printed report"], ["discharge-summary", "Discharge summary"], ["referral-letter", "Referral letter"], ["document", "Scanned document"], ["patient", "Patient"], ["family", "Family or carer"], ["record", "Old records"]].map(([value, label]) => ({value: value!, label: label!}))} onChange={e => setF({...f, source: e.target.value})}/></>}
    <Input label="Note" maxLength={500} value={f.note} onChange={e => setF({...f, note: e.target.value})}/><ProblemNotice problems={mutation.problems}/>
    <div><Button onClick={onCancel}>{t("Cancel")}</Button><Button variant="primary" disabled={!ready} onClick={save}>{t(procedure ? "Add procedure" : "Add result")}</Button></div>
  </fieldset>;
}
