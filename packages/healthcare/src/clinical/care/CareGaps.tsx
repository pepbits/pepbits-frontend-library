"use client";
import React, {useCallback, useEffect, useId, useRef, useState} from "react";
import {Badge, Button, Input, Select, Textarea} from "@pepbits/ui";
import {Drawer, ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useClinicalActor} from "../context/clinical-context";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ProblemNotice} from "../layout/panel";
import {ConsultSection} from "../layout/ConsultSection";
import {useClinicalMutation, useClinicalResource} from "../history/PatientHistory";
import {addressedInNote, stillDue, CATEGORY_LABEL, OUTCOME_LABEL, STATUS_LABEL, programmeStatusTone, type AssessmentCreateInput, type CareOutcome, type ConsultSectionProps, type Decision, type Programme, type ProgrammeAction} from "../models/consult-workflow";
export {addressedInNote, stillDue};
export function CareGapsSection({detail, draft, onChange, readOnly, onRecordsChanged, onProgrammes, id}: ConsultSectionProps & {onProgrammes?: (rows: Programme[]) => void}) {
  const uid = useId(), port = useConsultPort(), host = useConsultHost(), {can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters();
  const snapshot = detail.note?.status === "final" ? detail.note.careGaps : undefined;
  const canDecide = !readOnly && can("note.write"), mutation = useClinicalMutation(`${detail.patient.id}/${detail.encounter.id}`, readOnly);
  const resource = useClinicalResource(useCallback(signal => port.loadCareProgrammes(detail.patient.id, detail.encounter.id, signal), [port, detail.patient.id, detail.encounter.id]));
  const report = useRef(onProgrammes); report.current = onProgrammes;
  useEffect(() => {if (resource.data) report.current?.(resource.data.programmes.filter(p => p.mode !== "hidden"));}, [resource.data]);
  const [deciding, setDeciding] = useState<{programme: Programme; withdraw?: Decision} | null>(null), [reminders, setReminders] = useState(false), [conflict, setConflict] = useState("");
  const retry = useRef<{key: string; input: AssessmentCreateInput} | null>(null);
  useEffect(() => {setDeciding(null); setConflict(""); retry.current = null;}, [port, detail.patient.id, detail.encounter.id]);
  const act = (p: Programme, action: ProgrammeAction) => {
    if (readOnly || mutation.busy) return;
    setConflict("");
    if (action.type === "assessment") {
      if (!can("assessment.perform")) return;
      const key = `${p.id}/${action.code}`;
      if (retry.current?.key !== key) retry.current = {key, input: {requestId: crypto.randomUUID(), patientId: detail.patient.id, encounterId: detail.encounter.id, toolId: action.code, mode: "current-knowledge", workflowStage: null, purpose: p.name, effectiveAt: null}};
      void mutation.run(() => port.createAssessment(retry.current!.input), async view => {retry.current = null; host.onNavigate({kind: "assessment", assessmentId: view.assessment.id}); await onRecordsChanged?.();});
      return;
    }
    if (action.type === "referral" && draft.referral && draft.referral.specialty !== action.code) {setConflict(`${t("This note already refers to")} ${draft.referral.specialty}. ${t("Change it under Patient education → Referral.")}`); return;}
    onChange(n => {
      const indication = `${t("Screening")}: ${p.name}`;
      if (action.type === "lab" && !n.labs.some(x => x.code === action.code)) n.labs.push({code: action.code, display: action.display, priority: "", indication});
      if (action.type === "imaging" && !n.imaging.some(x => x.code === action.code)) n.imaging.push({code: action.code, display: action.display, priority: "", indication});
      if (action.type === "referral") n.referral = {specialty: action.code, urgency: "routine", question: `${p.name}: ${action.display.toLowerCase()}.`};
    });
  };
  const undo = (p: Programme) => {if (!readOnly) onChange(n => {for (const action of p.actions) {if (action.type === "lab") n.labs = n.labs.filter(x => x.code !== action.code); if (action.type === "imaging") n.imaging = n.imaging.filter(x => x.code !== action.code); if (action.type === "referral" && n.referral?.specialty === action.code) n.referral = null;}});};
  const rows = resource.data?.programmes.filter(p => p.mode !== "hidden") ?? [];
  const row = (p: Programme) => {
    const inNote = addressedInNote(p, draft);
    return <li key={p.id} className="grid gap-2 border border-[var(--border)] rounded-[var(--radius)] p-3">
      <h3 title={p.guideline}>{p.name}</h3><div><Badge tone={inNote ? "brand" : programmeStatusTone(p.status)}>{t(inNote ? "Added to this visit" : STATUS_LABEL[p.status])}</Badge> {t(CATEGORY_LABEL[p.category] ?? p.category)}</div>
      <p>{p.lastDone ? `${t("Last done")} ${format.dateTime(p.lastDone.on)}${p.lastDone.source === "outside" ? ` (${t("elsewhere")})` : ""}` : t("No record of it being done")} · {t("Due")} {p.dueOn ? format.dateTime(p.dueOn) : "—"}</p>
      {p.inProgress && <p>{p.inProgress.display} · {format.dateTime(p.inProgress.on)}</p>}
      {p.status === "check" && <p>{t("Not enough in the record to decide")}: {p.eligibility.filter(e => e.result === "unknown").map(e => e.label).join(", ")}</p>}
      {p.decision && <p>{t(OUTCOME_LABEL[p.decision.outcome])}: {p.decision.reason} · {p.decision.recordedByName} · {format.dateTime(p.decision.recordedAt)} {p.decision.until && format.dateTime(p.decision.until)} {canDecide && <Button onClick={() => setDeciding({programme: p, withdraw: p.decision!})}>{t("Withdraw")}</Button>}</p>}
      {!readOnly && p.status !== "up-to-date" && <div className="flex flex-wrap gap-2">{inNote ? <Button onClick={() => undo(p)}>{t("Remove from this visit")}</Button> : !["ordered", "referred", "in-progress"].includes(p.status) && p.actions.map(action => <Button key={`${action.type}/${action.code}`} disabled={mutation.busy || (action.type === "assessment" && !can("assessment.perform"))} onClick={() => act(p, action)}>{action.type === "assessment" ? `${t("Start")} ` : action.type !== "referral" ? `${t("Order")} ` : ""}{action.display}</Button>)}
        {canDecide && !inNote && <Button onClick={() => setDeciding({programme: p})}>{t("Record decision")}</Button>}</div>}
    </li>;
  };
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Care gaps" subtitle="Preventive care and reviews due for this patient. Suggestions only: nothing is ordered unless you add it.">
    {snapshot ? <><h3>{t("Care programmes when this note was signed")}</h3><ul>{snapshot.map(p => <li key={p.id}><strong>{p.name}</strong> <Badge tone={programmeStatusTone(p.status)}>{t(STATUS_LABEL[p.status])}</Badge> · {p.dueOn ? format.dateTime(p.dueOn) : "—"} {p.mode === "reminder" && t("reminder")}</li>)}</ul></>
      : resource.error ? <ErrorState title="Could not load care programmes" description={problemsOf(resource.error).join(" ")} onRetry={resource.reload}/> : !resource.data ? <p>{t("Loading…")}</p> : <>
        <p>{format.number(stillDue(rows, draft).length)} {t("to address")}</p><ul className="grid gap-3">{rows.filter(p => p.mode === "full").map(row)}</ul>
        {rows.some(p => p.mode === "reminder") && <><Button aria-expanded={reminders} onClick={() => setReminders(!reminders)}>{t("Primary care reminders")}</Button>{reminders && <ul>{rows.filter(p => p.mode === "reminder").map(row)}</ul>}</>}
      </>}
    <ProblemNotice problems={[...mutation.problems, ...(conflict ? [conflict] : [])]}/>
    {deciding && canDecide && <DecisionDrawer key={`${detail.patient.id}/${deciding.programme.id}/${deciding.withdraw?.id}`} {...deciding} patientId={detail.patient.id} encounterId={detail.encounter.id} onClose={() => setDeciding(null)} onDone={async () => {setDeciding(null); resource.reload(); await onRecordsChanged?.();}}/>}
  </ConsultSection>;
}
export const CareGaps = CareGapsSection;
export function DecisionDrawer({programme, withdraw, patientId, encounterId, onClose, onDone, readOnly = false}: {programme: Programme; withdraw?: Decision; patientId: string; encounterId?: string; onClose: () => void; onDone: (message: string) => void | Promise<void>; readOnly?: boolean}) {
  const port = useConsultPort(), {t} = useLocalization(), mutation = useClinicalMutation(`${patientId}/${programme.id}`, readOnly);
  const [outcome, setOutcome] = useState<CareOutcome>("done-elsewhere"), [reason, setReason] = useState(""), [performedOn, setPerformedOn] = useState(""), [until, setUntil] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const ready = reason.trim().length >= 3 && (!!withdraw || ((outcome !== "done-elsewhere" || (!!performedOn && performedOn <= today)) && (outcome !== "deferred" || (!!until && until >= today)) && (outcome !== "not-applicable" || !until || until >= today)));
  const save = () => {if (ready) void mutation.run(() => withdraw ? port.withdrawCareDecision(withdraw.id, {reason, encounterId}) : port.recordCareDecision(patientId, {programmeId: programme.id, outcome, reason, encounterId, ...(outcome === "done-elsewhere" ? {performedOn} : {}), ...(["deferred", "not-applicable"].includes(outcome) ? {until} : {})}), () => onDone(withdraw ? t("Decision withdrawn") : `${programme.name}: ${t(OUTCOME_LABEL[outcome])}`));};
  return <Drawer open onClose={() => {if (!mutation.busy) onClose();}} title={withdraw ? `${t("Withdraw decision")}: ${programme.name}` : programme.name} footer={<div><Button disabled={mutation.busy} onClick={onClose}>{t("Cancel")}</Button><Button variant="primary" disabled={!ready || readOnly || mutation.busy} onClick={save}>{t(withdraw ? "Withdraw" : "Save decision")}</Button></div>}>
    <fieldset disabled={readOnly || mutation.busy} className="grid gap-3"><ProblemNotice problems={mutation.problems}/>
      {withdraw ? <p>{t(OUTCOME_LABEL[withdraw.outcome])}: {withdraw.reason}. {t("The decision stays in the record as withdrawn.")}</p> : <>
        <Select label="Decision" value={outcome} options={[{value: "done-elsewhere", label: "Done elsewhere"}, {value: "declined", label: "Patient declined"}, {value: "deferred", label: "Defer until a date"}, {value: "not-applicable", label: "Not applicable to this patient"}]} onChange={e => setOutcome(e.target.value as CareOutcome)}/>
        {outcome === "done-elsewhere" && <Input label="Date it was done" type="date" max={today} value={performedOn} onChange={e => setPerformedOn(e.target.value)}/>}
        {(outcome === "deferred" || outcome === "not-applicable") && <Input label={outcome === "deferred" ? "Defer until" : "Review on (optional)"} hint={outcome === "not-applicable" ? "Leave empty if it will never apply." : undefined} type="date" min={today} value={until} onChange={e => setUntil(e.target.value)}/>}
        {outcome === "declined" && <p>{t("A declined programme is offered again after 12 months.")}</p>}
      </>}
      <Textarea label={withdraw ? "Why withdraw it" : outcome === "done-elsewhere" ? "Where, and the result" : "Reason"} value={reason} maxLength={500} onChange={e => setReason(e.target.value)}/>
    </fieldset>
  </Drawer>;
}
