"use client";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {Badge, Button, Input, Select, Textarea} from "@pepbits/ui";
import {Drawer, ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useClinicalActor} from "../context/clinical-context";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import {useClinicalMutation, useClinicalResource} from "../history/PatientHistory";
import {assessmentSeverityTone, assessmentStatusTone, type AssessmentCreateInput, type AssessmentRow, type AvailableTool} from "../models/consult-workflow";
export interface PatientAssessmentsPanelProps {
  patientId: string; encounterId?: string; className?: string; visitOnly?: boolean; suggested?: string[]; readOnly?: boolean;
  onRows?: (rows: AssessmentRow[]) => void; compact?: boolean; exclude?: string[]; title?: string; empty?: string; onRecordsChanged?: () => void | Promise<void>;
}
export function PatientAssessmentsPanel({patientId, encounterId, className, visitOnly, suggested = [], readOnly = false, onRows, exclude = [], title = "Assessments", empty, onRecordsChanged}: PatientAssessmentsPanelProps) {
  const port = useConsultPort(), host = useConsultHost(), {can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters();
  const allowed = can("patient.read"), canPerform = can("assessment.perform") && !readOnly;
  const [open, setOpen] = useState(false), [tool, setTool] = useState(""), [mode, setMode] = useState("current-knowledge"), [stage, setStage] = useState(""), [effective, setEffective] = useState(""), [purpose, setPurpose] = useState("");
  const mutation = useClinicalMutation(`${patientId}/${encounterId}`, !canPerform);
  const retry = useRef<{key: string; input: AssessmentCreateInput} | null>(null);
  const rows = useClinicalResource(useCallback(signal => allowed ? port.listAssessments(visitOnly && encounterId ? {encounterId} : {patientId, latest: true}, signal) : Promise.resolve<AssessmentRow[]>([]), [port, patientId, encounterId, visitOnly, allowed]));
  const tools = useClinicalResource(useCallback(signal => open && canPerform ? port.listAvailableAssessments(patientId, encounterId, signal) : Promise.resolve<AvailableTool[]>([]), [port, patientId, encounterId, open, canPerform]));
  const report = useRef(onRows); report.current = onRows;
  useEffect(() => {if (rows.data && allowed) report.current?.(rows.data);}, [rows.data, allowed]);
  useEffect(() => {setOpen(false); setTool(""); setMode("current-knowledge"); setStage(""); setEffective(""); setPurpose(""); retry.current = null;}, [patientId, encounterId, port]);
  if (!allowed) return null;
  const chosen = tools.data?.find(x => x.id === tool), shown = rows.data?.filter(r => !exclude.includes(r.id));
  const ordered = [...(tools.data ?? [])].sort((a, b) => Number(suggested.includes(b.id)) - Number(suggested.includes(a.id)));
  const effectiveTime = effective ? new Date(effective).getTime() : undefined;
  const validTime = effectiveTime === undefined || (Number.isFinite(effectiveTime) && effectiveTime <= Date.now());
  const create = () => {
    if (!canPerform || !chosen?.canPerform || !validTime) return;
    const base = {patientId, encounterId: encounterId ?? null, toolId: tool, mode, workflowStage: stage || null, purpose, effectiveAt: effectiveTime === undefined ? null : new Date(effectiveTime).toISOString()};
    const key = JSON.stringify(base);
    if (retry.current?.key !== key) retry.current = {key, input: {...base, requestId: crypto.randomUUID()}};
    const input = retry.current.input;
    void mutation.run(() => port.createAssessment(input), async view => {setOpen(false); retry.current = null; rows.reload(); host.onNavigate({kind: "assessment", assessmentId: view.assessment.id}); await onRecordsChanged?.();});
  };
  return <ClinicalPanel title={title} className={className} actions={canPerform && <Button onClick={() => {setOpen(true); setTool("");}}>{t("New assessment")}</Button>}>
    {rows.error ? <ErrorState title="Could not load assessments" description={problemsOf(rows.error).join(" ")} onRetry={rows.reload}/> : !shown ? <p>{t("Loading assessments…")}</p> : !shown.length ? <p>{t(empty ?? (visitOnly ? "No assessments at this visit." : "No assessments yet."))}</p> : <ul className="grid gap-3">{shown.map(r => <li key={r.id}>
      {host.renderLink({kind: "assessment", assessmentId: r.id}, {children: <><strong>{r.displayLabel || r.toolName}</strong> {r.number}</>})}
      <p>{r.signedByName ? `${t("Signed by")} ${r.signedByName}` : r.authorName} · {format.dateTime(r.signedAt ?? r.createdAt)}</p>
      {r.result?.status === "complete" && <Badge tone={assessmentSeverityTone(r.result.severity)}>{r.result.display ?? (r.result.total === null ? "—" : format.number(r.result.total))} {r.result.band}</Badge>}
      <Badge tone={assessmentStatusTone(r.status)}>{t(r.status)}</Badge>{r.reviewState === "pending" && <Badge tone="warning">{t("awaiting review")}</Badge>}{r.inputsStale && <Badge tone="warning">{t("inputs changed")}</Badge>}
    </li>)}</ul>}
    {open && canPerform && <Drawer open onClose={() => {if (!mutation.busy) setOpen(false);}} title={t("New assessment")} footer={<div><Button disabled={mutation.busy} onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button variant="primary" disabled={mutation.busy || !chosen?.canPerform || !validTime} onClick={create}>{t("Start assessment")}</Button></div>}>
      <fieldset disabled={mutation.busy} className="grid gap-3"><ProblemNotice problems={mutation.problems}/>
        {tools.error ? <ErrorState title="Could not load assessment tools" description={problemsOf(tools.error).join(" ")} onRetry={tools.reload}/> : !tools.data ? <p>{t("Loading the tools enabled here…")}</p> : <Select label="Assessment tool" value={tool} options={[{value: "", label: "Choose a tool"}, ...ordered.map(x => ({value: x.id, label: `${x.displayLabel || x.name}${suggested.includes(x.id) ? ` · ${t("Suggested")}` : ""}${!x.canPerform ? ` · ${t("Not for your role")}` : ""}`}))]} onChange={e => setTool(e.target.value)}/>}
        {chosen?.helpBanner && <p>{chosen.helpBanner}</p>}
        <Select label="What the result should reflect" value={mode} options={[{value: "current-knowledge", label: "Everything known now"}, {value: "as-known-then", label: "Only what was known at the effective time"}]} onChange={e => setMode(e.target.value)}/>
        <Input label="Effective time" hint="Leave empty for now. It cannot be in the future." type="datetime-local" value={effective} error={!validTime ? "It cannot be in the future." : undefined} onChange={e => setEffective(e.target.value)}/>
        {encounterId && <Select label="Workflow stage" value={stage} options={[{value: "", label: "Not stated"}, ...["admission", "daily-review", "pre-procedure", "discharge", "ad-hoc"].map(value => ({value, label: value.replaceAll("-", " ")}))]} onChange={e => setStage(e.target.value)}/>}
        <Textarea label="Purpose (optional)" maxLength={500} value={purpose} onChange={e => setPurpose(e.target.value)}/>
      </fieldset>
    </Drawer>}
  </ClinicalPanel>;
}
export default PatientAssessmentsPanel;
