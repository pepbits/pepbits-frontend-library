"use client";
import React, {useCallback, useEffect, useState} from "react";
import {Badge, Button, Checkbox, Input, Segmented, Select, Textarea} from "@pepbits/ui";
import {Drawer, ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ProblemNotice} from "../layout/panel";
import {CodedSearch} from "../complaint/CodedSearch";
import {FacilityPicker} from "../reference/FacilityPicker";
import {useClinicalMutation, useClinicalResource} from "./PatientHistory";
import type {MedHistoryScope} from "../models/consult-records";
export const HISTORY_SCOPES = [{value: "visit", label: "This visit"}, {value: "organisation", label: "Our organisation"}, {value: "external", label: "Other facilities"}];
export function MedicationHistory({patientId, encounterId, focus, onClose, onAdded, onRecordsChanged, canAdd = true, readOnly = false}: {
  patientId: string; encounterId: string; focus?: string; onClose: () => void; onAdded?: () => void; onRecordsChanged?: () => void | Promise<void>; canAdd?: boolean; readOnly?: boolean;
}) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters();
  const [scope, setScope] = useState<MedHistoryScope>("organisation"), [q, setQ] = useState(focus ?? ""), [onlyActive, setOnlyActive] = useState(false), [adding, setAdding] = useState(false);
  const [withdraw, setWithdraw] = useState(""), [reason, setReason] = useState("");
  const canWrite = canAdd && !readOnly, mutation = useClinicalMutation(`${patientId}/${encounterId}`, !canWrite);
  const resource = useClinicalResource(useCallback(signal => port.loadMedicationHistory(patientId, {scope, encounterId}, signal), [port, patientId, encounterId, scope]));
  useEffect(() => {setAdding(false); setWithdraw(""); setReason(""); setQ(focus ?? "");}, [port, patientId, encounterId, focus]);
  const changed = async () => {resource.reload(); await onRecordsChanged?.();};
  const shown = resource.data?.groups.filter(g => g.display.toLowerCase().includes(q.trim().toLowerCase()) && (!onlyActive || (g.current ? !["stopped", "not-taking"].includes(g.current.status) : g.events.some(e => ["prescribed", "active"].includes(e.meta?.orderStatus ?? ""))))) ?? [];
  return <Drawer open onClose={onClose} title={t("Medication history")} width="lg"><div className="grid gap-3">
    <Segmented label="Show medication history from" value={scope} onChange={v => setScope(v as MedHistoryScope)} options={HISTORY_SCOPES}/>
    {canWrite && <Button onClick={() => setAdding(true)}>{t("Add to history")}</Button>}
    {adding && canWrite && <AddPastMedicine key={`${patientId}/${encounterId}`} patientId={patientId} encounterId={encounterId} external={scope === "external"} onCancel={() => setAdding(false)} onSaved={async taking => {setAdding(false); if (taking) onAdded?.(); await changed();}}/>}
    <Input label="Search medicines" value={q} onChange={e => setQ(e.target.value)}/><Checkbox label="Current only" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)}/>
    {scope === "external" && resource.data && !resource.data.externalSource.connected && <p>{resource.data.externalSource.note}</p>}
    {resource.error ? <ErrorState title="Could not load medication history" description={problemsOf(resource.error).join(" ")} onRetry={resource.reload}/> : !resource.data ? <p>{t("Loading…")}</p> : !shown.length ? <p>{t("No medication history matches.")}</p> : shown.map(g => <section key={g.key} className="border border-[var(--border)] rounded-[var(--radius)] p-3">
      <h3>{g.display}</h3>{g.current?.dose} <Badge>{t(g.current?.status ?? (g.past ? "Past medicine" : "Not on medicine list"))}</Badge>{g.external && <Badge tone="brand">{g.current?.externalFacility ?? t("Other facility")}</Badge>}
      {g.current?.replacedBy && <Badge>{t("replaced")}</Badge>}
      <ol className="grid gap-2">{g.events.map((e, i) => <li key={i}>{e.text} {e.encounterId === encounterId && <Badge tone="brand">{t("this visit")}</Badge>}
        <p>{format.dateTime(e.at)} · {e.by} · {e.facility ?? t("facility not recorded")} · {e.department} · {e.meta?.source}</p>
        {e.meta?.reason && <p>{e.meta.reason}</p>}{e.meta?.origin === "otc" && <Badge>{t("over the counter")}</Badge>}
        {e.meta?.pastId && canWrite && <Button variant="ghost" onClick={() => {setWithdraw(e.meta!.pastId!); setReason("");}}>{t("Entered in error")}</Button>}
      </li>)}</ol></section>)}
    {withdraw && canWrite && <div><Input label="Why is this entry wrong? (required)" value={reason} onChange={e => setReason(e.target.value)}/><Button disabled={!reason.trim() || mutation.busy} onClick={() => void mutation.run(() => port.withdrawMedicationHistory(patientId, withdraw, reason.trim()), async () => {setWithdraw(""); await changed();})}>{t("Mark entered in error")}</Button><Button onClick={() => setWithdraw("")}>{t("Cancel")}</Button></div>}
    <ProblemNotice problems={mutation.problems}/>
  </div></Drawer>;
}
const STOP_REASONS = [["completed-course", "Course completed"], ["side-effect", "Side effect"], ["not-effective", "Not effective"], ["changed", "Changed to another medicine"], ["cost", "Cost"], ["patient-choice", "Patient's choice"], ["other", "Other"]];
const SOURCES = [["patient", "Patient"], ["family", "Family or carer"], ["discharge-summary", "Discharge summary"], ["referral-letter", "Referral letter"], ["pharmacy", "Pharmacy record"], ["document", "Scanned document"], ["record", "Old records"]];
function AddPastMedicine({patientId, encounterId, external, onCancel, onSaved}: {patientId: string; encounterId: string; external: boolean; onCancel: () => void; onSaved: (taking: boolean) => void | Promise<void>}) {
  const port = useConsultPort(), {t} = useLocalization(), mutation = useClinicalMutation(`${patientId}/${encounterId}`);
  const [drug, setDrug] = useState<{code?: string; display: string} | null>(null), [freeText, setFreeText] = useState(false);
  const [f, setF] = useState({dose: "", status: "completed", origin: external ? "external" : "organisation", facility: "", started: "", stopped: "", approximate: false, stopReason: "", source: "patient", note: ""});
  const taking = f.status === "taking", ready = !!drug?.display.trim() && (f.origin !== "external" || f.facility.trim().length >= 2) && (taking || f.status === "completed" || !!f.stopReason);
  const save = () => {
    if (!ready || !drug) return;
    void mutation.run(async () => {
      if (taking) await port.addReportedMedication(patientId, {drugCode: drug.code, display: drug.display.trim(), dose: f.dose || undefined, status: "taking", encounterId, externalFacility: f.origin === "external" ? f.facility.trim() : undefined});
      else await port.addMedicationHistory(patientId, {...f, drugCode: drug.code, display: drug.display.trim(), facility: f.origin === "external" ? f.facility : undefined, stopReason: f.status === "completed" ? f.stopReason || "completed-course" : f.stopReason, encounterId});
    }, () => onSaved(taking));
  };
  return <fieldset disabled={mutation.busy} className="grid gap-3 border border-[var(--border)] rounded-[var(--radius)] p-3">
    <h3>{t("Add to medication history")}</h3>
    {freeText ? <Input label="Medicine" required maxLength={120} value={drug?.display ?? ""} onChange={e => setDrug({display: e.target.value})}/> : drug ? <div>{drug.display}<Button onClick={() => setDrug(null)}>{t("Change")}</Button></div> : <CodedSearch catalog="drugs" label="Medicine" onPick={it => setDrug({code: it.code, display: it.display})}/>}
    <Button variant="ghost" onClick={() => {setFreeText(!freeText); setDrug(null);}}>{t(freeText ? "Search the formulary instead" : "Not in the formulary? Type the name")}</Button>
    <Input label="Dose and how often" maxLength={120} value={f.dose} onChange={e => setF({...f, dose: e.target.value})}/>
    <Segmented label="Now" value={f.status} options={[{value: "taking", label: "Still taking"}, {value: "completed", label: "Completed"}, {value: "stopped", label: "Stopped"}]} onChange={status => setF({...f, status})}/>
    <Segmented label="Prescribed or obtained" value={f.origin} options={[{value: "organisation", label: "Our organisation"}, {value: "external", label: "Another facility"}, {value: "otc", label: "Over the counter"}]} onChange={origin => setF({...f, origin})}/>
    {f.origin === "external" && <FacilityPicker label="Facility" required value={f.facility} onChange={facility => setF({...f, facility})}/>}
    {taking ? <p>{t("It goes on the current medicine list, to continue, change or stop in this visit.")}</p> : <>
      <Input label="Started (month)" type="month" value={f.started} onChange={e => setF({...f, started: e.target.value})}/><Input label={f.status === "completed" ? "Finished (month)" : "Stopped (month)"} type="month" value={f.stopped} onChange={e => setF({...f, stopped: e.target.value})}/>
      <Checkbox label="Approximate" checked={f.approximate} onChange={e => setF({...f, approximate: e.target.checked})}/>
      <Select label={f.status === "completed" ? "Why it ended" : "Why it was stopped"} required={f.status === "stopped"} value={f.stopReason || (f.status === "completed" ? "completed-course" : "")} options={[{value: "", label: "Choose"}, ...STOP_REASONS.map(([value, label]) => ({value: value!, label: label!}))]} onChange={e => setF({...f, stopReason: e.target.value})}/>
      <Textarea label="Note" maxLength={500} value={f.note} onChange={e => setF({...f, note: e.target.value})}/>
    </>}
    {f.stopReason === "side-effect" && <p>{t("If it was an allergy or intolerance, also record it under Allergies so prescribing checks know.")}</p>}
    <Select label="Information from" value={f.source} options={SOURCES.map(([value, label]) => ({value: value!, label: label!}))} onChange={e => setF({...f, source: e.target.value})}/>
    <ProblemNotice problems={mutation.problems}/><div><Button onClick={onCancel}>{t("Cancel")}</Button><Button variant="primary" disabled={!ready} onClick={save}>{t(taking ? "Add to current list" : "Add to history")}</Button></div>
  </fieldset>;
}
