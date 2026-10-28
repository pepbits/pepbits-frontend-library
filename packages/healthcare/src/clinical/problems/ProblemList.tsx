"use client";
import React, {useCallback, useEffect, useId, useState, type ReactNode} from "react";
import {Badge, Button, Checkbox, Input, Select} from "@pepbits/ui";
import {Drawer, ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useClinicalActor} from "../context/clinical-context";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import {ConsultSection} from "../layout/ConsultSection";
import {CodedSearch} from "../complaint/CodedSearch";
import {useClinicalMutation, useClinicalResource} from "../history/PatientHistory";
import type {CatalogItem} from "../types";
import type {ConditionPatch, ConditionRow} from "../models/consult-records";
import type {ConsultSectionProps} from "../models/consult-workflow";
const ACTIVE = new Set(["active", "recurrence", "relapse"]);
const statusLabels: Record<string, string> = {active: "Active", recurrence: "Recurrence", relapse: "Relapse", remission: "In remission", resolved: "Resolved", inactive: "Inactive"};
type Change = {label: string; patch: Omit<ConditionPatch, "version">; reason?: string};
const changesFor = (r: ConditionRow): Change[] => [
  ...(ACTIVE.has(r.clinicalStatus) ? [{label: "Mark resolved", patch: {clinicalStatus: "resolved"}}, {label: "In remission", patch: {clinicalStatus: "remission"}}, {label: "Mark inactive", patch: {clinicalStatus: "inactive"}}]
    : [{label: "Active again", patch: {clinicalStatus: "active"}}, {label: "Recurrence", patch: {clinicalStatus: "recurrence"}}, {label: "Relapse", patch: {clinicalStatus: "relapse"}}]),
  ...(r.verification !== "confirmed" && r.verification !== "refuted" ? [{label: "Confirm", patch: {verification: "confirmed"}}] : []),
  {label: "Refute", patch: {verification: "refuted"}, reason: "Why is this problem refuted? e.g. investigations normal"},
  {label: "Entered in error", patch: {verification: "entered-in-error"}, reason: "Why was this entered in error? e.g. wrong patient"},
];
export function ProblemList({patientId, canEdit: allowed, readOnly = false, inline = false, toolbar, onRecordsChanged}: {patientId: string; canEdit?: boolean; readOnly?: boolean; inline?: boolean; toolbar?: ReactNode; onRecordsChanged?: () => void | Promise<void>}) {
  const port = useConsultPort(), {can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters();
  const canEdit = !readOnly && (allowed ?? can("note.write")), mutation = useClinicalMutation(patientId, !canEdit);
  const resource = useClinicalResource(useCallback(signal => port.listConditions(patientId, signal), [port, patientId]));
  const [adding, setAdding] = useState(false), [item, setItem] = useState<CatalogItem | null>(null), [past, setPast] = useState<ConditionRow | null>(null);
  const [verification, setVerification] = useState("confirmed"), [onset, setOnset] = useState(""), [severity, setSeverity] = useState("");
  const [showInactive, setShowInactive] = useState(false), [history, setHistory] = useState<string | null>(null), [asking, setAsking] = useState<{row: ConditionRow; change: Change} | null>(null), [reason, setReason] = useState("");
  useEffect(() => {setAdding(false); setItem(null); setPast(null); setHistory(null); setAsking(null);}, [port, patientId]);
  const changed = async () => {resource.reload(); await onRecordsChanged?.();};
  const change = (row: ConditionRow, patch: Omit<ConditionPatch, "version">, why?: string) => mutation.run(() => port.updateCondition(patientId, row.id, {...patch, version: row.version, ...(why ? {reason: why} : {})}), async () => {setAsking(null); setPast(null); setAdding(false); await changed();});
  const live = (resource.data ?? []).filter(r => r.verification !== "entered-in-error"), problems = live.filter(r => r.category === "problem-list-item");
  const active = problems.filter(r => ACTIVE.has(r.clinicalStatus) && r.verification !== "refuted"), inactive = problems.filter(r => !active.includes(r)), diagnoses = live.filter(r => r.category === "encounter-diagnosis");
  const pick = (candidate: CatalogItem) => {
    const existing = problems.find(r => r.verification !== "refuted" && !ACTIVE.has(r.clinicalStatus) && ((r.snomed && r.snomed === candidate.code) || (r.icd10 && [candidate.code, candidate.meta?.icd10, candidate.meta?.icd10cm].includes(r.icd10))));
    if (existing) {setPast(existing); setItem(null);} else {setPast(null); setItem(candidate);}
  };
  const rowView = (r: ConditionRow) => <li key={r.id} className="grid gap-2 border border-[var(--border)] rounded-[var(--radius)] p-3">
    <strong>{r.display}</strong><div><Badge tone={ACTIVE.has(r.clinicalStatus) ? "warning" : "neutral"}>{t(statusLabels[r.clinicalStatus] ?? r.clinicalStatus)}</Badge> <Badge>{t(r.verification)}</Badge>{r.severity && <Badge>{t(r.severity)}</Badge>}</div>
    <p>{r.icd10 ? `ICD-10 ${r.icd10}` : `SNOMED ${r.snomed}`} {r.onset && `${t("since")} ${r.onset}`} {r.abatement && `${t("ended")} ${r.abatement}`}</p>
    {!!r.diagnosedAt?.length && <p>{format.number(r.diagnosedAt.length)} {t("visits")} · {format.dateTime(r.diagnosedAt[0]!.recordedAt)}</p>}
    {!!r.documentedIn?.length && <p>{r.documentedIn.map(d => d.title ?? d.documentType).join(", ")}</p>}
    <Button variant="ghost" onClick={() => setHistory(r.id)}>{t("View history")}</Button>
    {canEdit && <Select label={`${t("Actions")}: ${r.display}`} value="" disabled={mutation.busy} options={[{value: "", label: "Choose action"}, ...changesFor(r).map(c => ({value: c.label, label: c.label}))]} onChange={e => {
      const action = changesFor(r).find(c => c.label === e.target.value); if (!action || !canEdit) return;
      if (action.reason) {setAsking({row: r, change: action}); setReason("");} else void change(r, action.patch);
    }}/>}
    {asking?.row.id === r.id && canEdit && <div><Input label={`${t(asking.change.label)}: ${t("reason")}`} required maxLength={500} placeholder={asking.change.reason} value={reason} onChange={e => setReason(e.target.value)}/>
      <Button disabled={reason.trim().length < 5 || mutation.busy} onClick={() => void change(r, asking.change.patch, reason.trim())}>{t(asking.change.label)}</Button><Button onClick={() => setAsking(null)}>{t("Cancel")}</Button></div>}
  </li>;
  const body = <div className="grid gap-3">
    <div className="flex flex-wrap gap-3">{toolbar}<span>{format.number(active.length)} {t("active")}</span><Button onClick={() => setHistory("all")}>{t("History")}</Button>
      {canEdit && !adding && <Button onClick={() => {setAdding(true); setItem(null); setPast(null); setVerification("confirmed"); setOnset(""); setSeverity("");}}>{t("Add problem")}</Button>}</div>
    {adding && canEdit && <fieldset disabled={mutation.busy} className="grid gap-3">
      {item ? <div>{item.display}<Button onClick={() => setItem(null)}>{t("Choose another problem")}</Button></div> : <CodedSearch catalog="diagnoses" label="Find the problem" disabledCodes={active.map(r => r.snomed)} onPick={pick}/>}
      {past && <div><p>{past.display}: {t("Already on the list. Reactivate it so its history stays in one record.")}</p><Button onClick={() => void change(past, {clinicalStatus: "recurrence"})}>{t("Mark as recurrence")}</Button><Button onClick={() => void change(past, {clinicalStatus: "active"})}>{t("Active again")}</Button></div>}
      <Select label="Verification" value={verification} options={["confirmed", "provisional", "unconfirmed"].map(value => ({value, label: value}))} onChange={e => setVerification(e.target.value)}/>
      <Input label="Since" placeholder="YYYY or YYYY-MM" value={onset} onChange={e => setOnset(e.target.value)}/><Select label="Severity" value={severity} options={[{value: "", label: "Not stated"}, ...["mild", "moderate", "severe"].map(value => ({value, label: value}))]} onChange={e => setSeverity(e.target.value)}/>
      <Button disabled={!item} onClick={() => {if (item) void mutation.run(() => port.addCondition(patientId, {code: item.code, verification, onset: onset || undefined, severity: severity || undefined}), async () => {setAdding(false); await changed();});}}>{t("Add problem")}</Button><Button onClick={() => {setAdding(false); setPast(null);}}>{t("Cancel")}</Button>
    </fieldset>}
    <ProblemNotice problems={mutation.problems}/>
    {resource.error ? <ErrorState title="Could not load problems" description={problemsOf(resource.error).join(" ")} onRetry={resource.reload}/> : !resource.data ? <p>{t("Loading…")}</p> : active.length ? <ul className="grid gap-3 md:grid-cols-2">{active.map(rowView)}</ul> : <p>{t("No active problems.")}</p>}
    {!!inactive.length && <><Button aria-expanded={showInactive} onClick={() => setShowInactive(!showInactive)}>{t("Past and refuted problems")} ({format.number(inactive.length)})</Button>{showInactive && <ul>{inactive.map(rowView)}</ul>}</>}
    {history && <ProblemHistory key={`${patientId}/${history}`} patientId={patientId} focus={history} onClose={() => setHistory(null)}/>}
  </div>;
  if (inline) return body;
  return <><ClinicalPanel title="Problems">{body}</ClinicalPanel><ClinicalPanel title="Encounter diagnoses">
    {!diagnoses.length && <p>{t("No diagnoses recorded yet.")}</p>}<ul className="grid gap-3">{diagnoses.map(r => <li key={r.id}><strong>{r.display}</strong> {r.rank === 1 && t("principal")} · {t(r.verification)} · {format.dateTime(r.recordedAt)} · {r.recorderName}
      <p>{r.problemId ? `${t("Problem")}: ${r.problemDisplay ?? t("linked")}` : t("Not on the problem list")}</p>
      {canEdit && <Select label={`${t("Problem link")}: ${r.display}`} value="" disabled={mutation.busy} options={[{value: "", label: "Link…"}, ...(!r.problemId && r.verification !== "differential" ? [{value: "promote", label: "Add to problem list"}] : []), ...active.filter(p => p.id !== r.problemId).map(p => ({value: p.id, label: `${t("Link to")}: ${p.display}`})), ...(r.problemId ? [{value: "unlink", label: "Unlink from problem"}] : [])]}
        onChange={e => {const value = e.target.value; if (value) void mutation.run(() => value === "promote" ? port.promoteCondition(patientId, r.id) : port.linkCondition(patientId, r.id, r.version, value === "unlink" ? null : value), changed);}}/>}
    </li>)}</ul></ClinicalPanel></>;
}
function ProblemHistory({patientId, focus, onClose}: {patientId: string; focus: string; onClose: () => void}) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters(), [only, setOnly] = useState(focus);
  const resource = useClinicalResource(useCallback(signal => port.loadProblemTimeline(patientId, signal), [port, patientId]));
  return <Drawer open title={t("Problem history")} width="lg" onClose={onClose}>
    {resource.error ? <ErrorState title="Could not load problem history" description={problemsOf(resource.error).join(" ")} onRetry={resource.reload}/> : !resource.data ? <p>{t("Loading…")}</p> : <>
      <Select label="Show the history of" value={only} options={[{value: "all", label: "All problems"}, ...resource.data.map(r => ({value: r.problem.id, label: r.problem.display}))]} onChange={e => setOnly(e.target.value)}/>
      {resource.data.filter(r => only === "all" || r.problem.id === only).map(({problem, events}) => <section key={problem.id}><h3>{problem.display}</h3><Badge>{t(statusLabels[problem.clinicalStatus] ?? problem.clinicalStatus)}</Badge><ol>{events.map((event, i) => <li key={i}>{format.dateTime(event.at)} · {event.actor}<p>{event.text}</p>{event.reason && <p>{event.reason}</p>}{event.visit && <p>{event.visit}</p>}</li>)}</ol></section>)}
    </>}
  </Drawer>;
}
export function ProblemSection({detail, draft, onChange, readOnly, onRecordsChanged, id}: ConsultSectionProps) {
  const uid = useId(), host = useConsultHost();
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Problem list" subtitle="Review ongoing and past problems with the patient. Changes are saved to the patient record at once.">
    <ProblemList patientId={detail.patient.id} inline readOnly={readOnly} onRecordsChanged={onRecordsChanged} toolbar={<Checkbox label="Reviewed with patient" checked={draft.history.problemsReviewed} disabled={readOnly} onChange={e => {if (!readOnly) onChange(n => {n.history.problemsReviewed = e.target.checked;});}}/>}/>
  </ConsultSection>;
}
