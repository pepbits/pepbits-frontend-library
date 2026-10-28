"use client";
import React, {useId} from "react";
import {Badge, Button, Input, Segmented} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {ConsultSection} from "../layout/ConsultSection";
import {useConsultHost} from "../context/consult-host";
import {EXAM_SYSTEMS, type NoteContent} from "../models/consult-note";
import type {ConsultSectionProps} from "../models/consult-workflow";
export function ExamSection({draft, onChange, readOnly, id}: ConsultSectionProps) {
  const uid = useId(), {t} = useLocalization(), format = useFormatters(), host = useConsultHost();
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Examination" subtitle="Record only what you examined. “Not examined” stays visibly different from normal."
    status={`${format.number(EXAM_SYSTEMS.filter(s => draft.exam[s.id]?.state).length)} ${t("recorded")}`}>
    <ul className="grid gap-3 lg:grid-cols-2">{EXAM_SYSTEMS.map(s => {const exam = draft.exam[s.id] ?? {state: null, findings: [], note: ""};
      return <li key={s.id} className="p-3 border border-[var(--border)] rounded-[var(--radius)]"><h3>{t(s.label)}</h3>
        {exam.state && <Badge tone={exam.state === "abnormal" ? "danger" : exam.state === "normal" ? "success" : "neutral"}>{t(exam.state === "not-examined" ? "Not examined" : exam.state === "normal" ? "Normal" : "Abnormal")}</Badge>}
        <Segmented label={s.label} value={exam.state ?? ""} options={[{value: "normal", label: "Normal"}, {value: "abnormal", label: "Abnormal"}, {value: "not-examined", label: "Not examined"}].map(o => ({...o, disabled: readOnly}))}
          onChange={state => {if (!readOnly) onChange(n => {n.exam[s.id] = {...exam, state: state as NoteContent["exam"][string]["state"]};});}}/>
        <Button variant="ghost" disabled={readOnly || !exam.state} aria-label={`${t("Clear")} ${t(s.label)}`} onClick={() => {if (!readOnly) onChange(n => {n.exam[s.id] = {...exam, state: null};});}}>{t("Clear")}</Button>
        {exam.state === "abnormal" && <div className="grid gap-2 mt-2"><div className="flex flex-wrap gap-1">{s.findings.map(finding => <Button key={finding} disabled={readOnly} aria-pressed={exam.findings.includes(finding)} onClick={() => {if (!readOnly) onChange(n => {const value = n.exam[s.id]!; value.findings = value.findings.includes(finding) ? value.findings.filter(f => f !== finding) : [...value.findings, finding];});}}>{t(finding)}</Button>)}</div>
          <Input label={`${t(s.label)} ${t("finding")}`} value={exam.note} disabled={readOnly} onChange={e => {if (!readOnly) onChange(n => {n.exam[s.id]!.note = e.target.value;});}}/></div>}
      </li>;})}</ul>
  </ConsultSection>;
}
