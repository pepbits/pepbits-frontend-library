"use client";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {Badge, Button, Input, Select} from "@pepbits/ui";
import {ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters, useScreenHost} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import type {MedStatement, ProcedureHistory, RecordChange} from "../types";
import type {MedicationPatch, ProcedureHistoryPatch} from "../models/consult-records";

/** Patient/port-scoped reads: obsolete responses cannot replace the current patient's records. */
export function useClinicalResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{load: typeof load; data?: T; error?: unknown}>();
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({load, data: previous?.load === load ? previous.data : undefined}));
    void load(controller.signal).then(data => {if (!controller.signal.aborted) setState({load, data});})
      .catch(error => {if (!controller.signal.aborted) setState({load, error});});
    return () => controller.abort();
  }, [load, attempt]);
  return {data: state?.load === load ? state.data : undefined, error: state?.load === load ? state.error : undefined, reload: useCallback(() => setAttempt(n => n + 1), [])};
}

/** Writes retain forms on failure and ignore completion after a patient or port replacement. */
export function useClinicalMutation(scope: string, disabled = false) {
  const port = useConsultPort(), {notify} = useScreenHost(), {t} = useLocalization();
  const identity = useRef({port, scope, alive: true, busy: false});
  if (identity.current.port !== port || identity.current.scope !== scope) {
    identity.current.alive = false;
    identity.current = {port, scope, alive: true, busy: false};
  }
  const current = identity.current;
  const [state, setState] = useState<{identity: typeof current; busy: boolean; problems: string[]}>();
  useEffect(() => {current.alive = true; return () => {current.alive = false;};}, [current]);
  const run = async <T,>(action: () => Promise<T>, success?: (value: T) => void | Promise<void>) => {
    if (disabled || !current.alive || current.busy) return false;
    current.busy = true; setState({identity: current, busy: true, problems: []});
    try {
      const result = await action();
      if (!current.alive) return false;
      notify(t("Saved to record"), {tone: "success"});
      await success?.(result);
      return true;
    } catch (error) {
      if (current.alive) setState({identity: current, busy: false, problems: problemsOf(error)});
      return false;
    } finally {
      current.busy = false;
      if (current.alive) setState(s => ({identity: current, busy: false, problems: s?.identity === current ? s.problems : []}));
    }
  };
  return {run, busy: state?.identity === current && state.busy, problems: state?.identity === current ? state.problems : []};
}

export function HistoryToggle({changes, text}: {changes?: RecordChange[]; text?: (change: RecordChange) => string}) {
  const [open, setOpen] = useState(false), {t} = useLocalization(), format = useFormatters();
  if (!changes?.length) return null;
  return <div><Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{t(open ? "Hide history" : "Show history")} ({format.number(changes.length)})</Button>
    {open && <ol>{changes.map((c, i) => <li key={i}>{format.dateTime(c.at)} · {c.actorName} · {text ? text(c) : Object.entries(c.after).map(([key, value]) => `${t(key)}: ${String(c.before[key] ?? "—")} → ${String(value ?? "—")}`).join("; ")} {c.reason}</li>)}</ol>}</div>;
}

export function EditMedicine({patientId, med, onDone, onCancel, readOnly = false}: {patientId: string; med: MedStatement; onDone: () => void | Promise<void>; onCancel: () => void; readOnly?: boolean}) {
  const port = useConsultPort(), {t} = useLocalization(), mutation = useClinicalMutation(`${patientId}/${med.id}`, readOnly);
  const [f, setF] = useState({display: med.display, dose: med.dose ?? "", status: med.status}), [reason, setReason] = useState("");
  const changed = f.display !== med.display || f.dose !== (med.dose ?? "") || f.status !== med.status;
  const save = () => {
    if (!changed || reason.trim().length < 5) return;
    const patch: MedicationPatch = {version: med.version ?? 1, reason};
    if (f.display !== med.display) patch.display = f.display;
    if (f.dose !== (med.dose ?? "")) patch.dose = f.dose;
    if (f.status !== med.status) patch.status = f.status;
    void mutation.run(() => port.updateReportedMedication(patientId, med.id, patch), onDone);
  };
  return <fieldset disabled={readOnly || mutation.busy} className="grid gap-3">
    <Input label="Medicine" maxLength={120} value={f.display} onChange={e => setF({...f, display: e.target.value})}/>
    <Input label="Dose and how often" maxLength={120} value={f.dose} onChange={e => setF({...f, dose: e.target.value})}/>
    <Select label="Status" value={f.status} options={[['taking','Taking'], ['not-taking','Not taking'], ['unknown','Unsure'], ['stopped','Stopped'], ['entered-in-error','Entered in error (recorded by mistake)']].map(([value, label]) => ({value: value!, label: label!}))} onChange={e => setF({...f, status: e.target.value})}/>
    <Input label="Reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/>
    {f.display !== med.display && <p>{t("A changed name is no longer linked to the formulary, so it is matched by name in safety checks.")}</p>}
    <ProblemNotice problems={mutation.problems}/><div><Button onClick={onCancel}>{t("Cancel")}</Button><Button variant="primary" disabled={!changed || reason.trim().length < 5} onClick={save}>{t("Save correction")}</Button></div>
  </fieldset>;
}

export function SurgicalHistory({patientId, canAdd = false, canEdit = false, onRecordsChanged}: {patientId: string; canAdd?: boolean; canEdit?: boolean; onRecordsChanged?: () => void | Promise<void>}) {
  const port = useConsultPort(), {t} = useLocalization();
  const resource = useClinicalResource(useCallback(signal => port.listProcedureHistory(patientId, signal), [port, patientId]));
  const mutation = useClinicalMutation(patientId, !canEdit);
  const [editing, setEditing] = useState<ProcedureHistory | "new" | null>(null);
  useEffect(() => setEditing(null), [patientId, port]);
  const done = async () => {setEditing(null); resource.reload(); await onRecordsChanged?.();};
  return <ClinicalPanel title="Surgical and procedures" actions={canAdd && <Button onClick={() => setEditing("new")}>{t("Add procedure")}</Button>}>
    {resource.error ? <ErrorState title="Could not load procedures" description={problemsOf(resource.error).join(" ")} onRetry={resource.reload}/> : !resource.data ? <p>{t("Loading…")}</p> : !resource.data.length ? <p>{t("No past procedures recorded.")}</p> :
      <ul className="grid gap-3">{resource.data.map(p => <li key={p.id}><strong>{p.procedure}</strong> · {p.performed || t("date unknown")} · {p.note} · {p.source} <Badge tone={p.verification === "confirmed" ? "success" : "warning"}>{t(p.verification)}</Badge>
        {canEdit && p.verification === "unconfirmed" && <Button disabled={mutation.busy} onClick={() => void mutation.run(() => port.updateProcedureHistory(patientId, p.id, {version: p.version, verification: "confirmed"}), done)}>{t("Confirm")}</Button>}
        {canEdit && <Button onClick={() => setEditing(p)}>{t("Edit")}</Button>}<HistoryToggle changes={p.history}/>
      </li>)}</ul>}
    <ProblemNotice problems={mutation.problems}/>
    {editing && (editing === "new" ? canAdd : canEdit) && <ProcedureForm key={`${patientId}/${editing === "new" ? "new" : editing.id}`} patientId={patientId} existing={editing === "new" ? undefined : editing} onDone={done} onCancel={() => setEditing(null)}/>}
  </ClinicalPanel>;
}

/** Local draft preserves the source correction vocabulary; the frozen port cannot yet write entered-in-error. */
export interface ProcedureCorrectionDraft {procedure: string; performed: string; note: string; verification: ProcedureHistory["verification"] | "entered-in-error"}

export function ProcedureForm({patientId, existing, onDone, onCancel, readOnly = false}: {patientId: string; existing?: ProcedureHistory; onDone: () => void | Promise<void>; onCancel: () => void; readOnly?: boolean}) {
  const port = useConsultPort(), {t} = useLocalization(), mutation = useClinicalMutation(`${patientId}/${existing?.id ?? "new"}`, readOnly);
  const start = {procedure: existing?.procedure ?? "", performed: existing?.performed ?? "", note: existing?.note ?? "", verification: existing?.verification ?? "confirmed"};
  const [f, setF] = useState<ProcedureCorrectionDraft>(start), [reason, setReason] = useState("");
  const changed = (Object.keys(start) as (keyof typeof start)[]).some(key => f[key] !== start[key]);
  const ready = f.procedure.trim().length >= 2 && (!existing || (changed && reason.trim().length >= 5));
  const save = () => {
    if (!ready || f.verification === "entered-in-error") return;
    if (!existing) {void mutation.run(() => port.addProcedureHistory(patientId, {procedure: f.procedure, performed: f.performed, note: f.note}), onDone); return;}
    const patch: ProcedureHistoryPatch = {version: existing.version, reason};
    if (f.procedure !== start.procedure) patch.procedure = f.procedure;
    if (f.performed !== start.performed) patch.performed = f.performed;
    if (f.note !== start.note) patch.note = f.note;
    if (f.verification !== start.verification) patch.verification = f.verification;
    void mutation.run(() => port.updateProcedureHistory(patientId, existing.id, patch), onDone);
  };
  return <fieldset disabled={readOnly || mutation.busy} className="grid gap-3 mt-3">
    <Input label="Operation or procedure" required maxLength={160} value={f.procedure} onChange={e => setF({...f, procedure: e.target.value})}/>
    <Input label="When" placeholder="YYYY, YYYY-MM or YYYY-MM-DD" value={f.performed} onChange={e => setF({...f, performed: e.target.value})}/>
    <Input label="Note" maxLength={500} value={f.note} onChange={e => setF({...f, note: e.target.value})}/>
    {existing && <><Select label="Verification" value={f.verification} hint="Marking a procedure entered in error is unavailable." options={["unconfirmed", "confirmed", "refuted"].map(value => ({value, label: value}))} onChange={e => setF({...f, verification: e.target.value as ProcedureHistory["verification"]})}/>
      <Input label="Reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/></>}
    <ProblemNotice problems={mutation.problems}/><div><Button onClick={onCancel}>{t("Cancel")}</Button><Button variant="primary" disabled={!ready} onClick={save}>{t(existing ? "Save correction" : "Add procedure")}</Button></div>
  </fieldset>;
}
export const PatientHistory = SurgicalHistory;
