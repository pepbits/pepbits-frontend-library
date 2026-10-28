"use client";
import React, {useEffect, useState} from "react";
import {Drawer} from "@pepbits/components";
import {Button, Badge} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {addressedInNote, stillDue, type AssessmentRow, type Programme} from "../models/consult-workflow";
import {ProblemNotice} from "../layout/panel";
import type {ConsultSectionProps, SignResult} from "../models/consult-workflow";

export interface SignDialogProps extends Pick<ConsultSectionProps, "detail" | "draft"> {
  open: boolean; onClose: () => void; onSign: () => void;
  signing: boolean; disabled?: boolean; problems: string[]; result: SignResult | null;
}
export function SignDialog({open, onClose, onSign, signing, disabled, problems, result, draft: note, detail}: SignDialogProps) {
  const {t} = useLocalization(), host = useConsultHost(), format = useFormatters();
  const port = useConsultPort();
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]), [care, setCare] = useState<Programme[]>([]), [previewProblems, setPreviewProblems] = useState<string[]>([]);
  useEffect(() => {
    if (!open || result) return;
    const abort = new AbortController(); setPreviewProblems([]); setAssessments([]); setCare([]);
    void Promise.allSettled([port.listAssessments({encounterId: detail.encounter.id}, abort.signal), port.loadCareProgrammes(detail.patient.id, detail.encounter.id, abort.signal)]).then(([assessmentResult, careResult]) => {
      if (abort.signal.aborted) return;
      const errors: string[] = [];
      if (assessmentResult.status === "fulfilled") setAssessments(assessmentResult.value); else errors.push(...problemsOf(assessmentResult.reason));
      if (careResult.status === "fulfilled") setCare(careResult.value.programmes); else errors.push(...problemsOf(careResult.reason));
      setPreviewProblems(errors);
    });
    return () => abort.abort();
  }, [open, result, port, detail.encounter.id, detail.patient.id]);
  const block = (label: string, value: string) => <div><p className="font-semibold">{t(label)}</p><p className="whitespace-pre-line">{value || t("None")}</p></div>;
  return <Drawer open={open} onClose={() => { if (!signing) onClose(); }} title={t(result ? "Note signed" : "Review and sign")} width="lg"
    footer={<div className="flex justify-end gap-2">{!result && <p>{t("Signing records your identity, the time and this note version.")}</p>}<Button disabled={signing} onClick={onClose}>{t(result ? "Done" : "Cancel")}</Button>
      {!result && <Button variant="primary" loading={signing} disabled={disabled || signing} onClick={onSign}>{t("Sign note")}</Button>}</div>}>
    <div className="grid gap-4">
      <ProblemNotice title="Unable to refresh the signing summary" problems={previewProblems}/>
      <ProblemNotice title="This note can’t be signed yet:" problems={problems}/>
      {result ? <>
        <p>{t("Note signed. Orders recorded.")}</p>
        {result.followUpTask && <p>{t("Reception task")}: {result.followUpTask}.</p>}
        {!!result.priorAuthRequests && <p>{t("Insurer approval requests")}: {format.number(result.priorAuthRequests)}</p>}
        {result.admission && <p>{t(result.admission.planned ? "Planned admission created" : "Admission requested")} {host.renderLink(result.admission.planned ? {kind: "planned-admissions"} : {kind: "bed-board"}, {children: t("View admission")})}</p>}
        {result.certificate && <p>{t("Medical certificate issued")}: {result.certificate.number} · {t(result.certificate.portal)} {host.renderLink({kind: "certificate", certificateId: result.certificate.id}, {children: t("Print"), newTab: true})}</p>}
        <ul>{result.orders.map((order, i) => <li key={i}>{order.display} <Badge tone={order.priorAuth === "requested" ? "warning" : "success"}>{t(order.priorAuth === "requested" ? "awaiting insurer" : order.status)}</Badge></li>)}</ul>
      </> : <>
        {block("Complaint", note.complaints.map(c => `${c.display}${c.duration ? ` (${format.number(c.duration.value)} ${t(c.duration.unit)})` : ""}`).join("; "))}
        {block("Diagnoses", note.diagnoses.map(d => `${d.primary ? "★ " : ""}${d.display} [${d.icd10}] · ${t(d.verification)}`).join("\n"))}
        {block("Signed assessments", assessments.filter(a => ["final", "amended"].includes(a.status)).map(a => `${a.displayLabel || a.toolName}: ${a.result?.display ?? (a.result?.total != null ? format.number(a.result.total) : "")} ${a.result?.band ?? ""}`.trim()).join("\n"))}
        {assessments.some(a => ["draft", "completed"].includes(a.status)) && <p>{format.number(assessments.filter(a => ["draft", "completed"].includes(a.status)).length)} {t("assessment(s) at this visit are not signed yet and will not be part of this note.")}</p>}
        {block("Care gaps addressed", care.filter(programme => addressedInNote(programme, note)).map(programme => `${programme.name}: ${t("ordered or referred in this note")}`).join("\n"))}
        {!!stillDue(care, note).length && <p>{t("Still due with no decision")}: {stillDue(care, note).map(programme => programme.name).join(", ")}. {t("You can sign; they stay open for the next visit.")}</p>}
        {block("Investigations", [...note.labs, ...note.imaging, ...(note.procedures ?? [])].map(o => `${o.display} (${t(o.priority ?? "routine")})`).join("\n"))}
        {block("Prescriptions", note.prescriptions.map(r => `${r.display}: ${r.dose} ${r.route}, ${r.frequency}, ${format.number(r.days)} ${t("days")}${r.flags.allergy ? ` · ${t("ALLERGY OVERRIDE")}: ${r.overrideReason || t("reason missing")}` : ""}`).join("\n"))}
        {block("Medicine list updates when you sign", [...detail.medications.filter(m => ["change", "stop"].includes(note.history.meds[m.id] ?? "")).map(m => `${m.display}: ${note.history.meds[m.id] === "stop" ? t("Stop") : `${m.dose ?? t("dose not recorded")} → ${note.history.medChanges?.[m.id]?.dose || t("new dose missing")}`}`), ...note.prescriptions.filter(r => r.administration !== "in-clinic").map(r => `${r.display}: ${t(r.renews ? "Renewed" : "Added")} ${r.dose} ${r.frequency}`)].join("\n"))}
        {block("Referral", note.referral ? `${note.referral.specialty} (${t(note.referral.urgency)}): ${note.referral.question}` : "")}
        {block("Disposition and follow-up", [note.disposition ? t(note.disposition) : "", note.followUp ? `${format.number(note.followUp.value)} ${t(note.followUp.unit)}` : note.followUpNone ? t("Follow-up as needed") : ""].filter(Boolean).join(" · "))}
        {!!note.aiAccepted.length && <p>{format.number(note.aiAccepted.length)} {t("fields came from assistant suggestions you accepted.")}</p>}
      </>}
    </div>
  </Drawer>;
}
