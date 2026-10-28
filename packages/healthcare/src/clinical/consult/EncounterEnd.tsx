"use client";
import React, {useEffect, useState} from "react";
import {Button, Input, Textarea, Select, Checkbox} from "@pepbits/ui";
import {Drawer} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {useClinicalActor} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import type {Addendum, EndOutcome} from "../models/consult-workflow";
import {useWorkflow} from "./useWorkflow";
import {toLocalDateTime} from "./ClinicalDischarge";

const help: Record<string, string> = {
  cancelled: "The visit is not going ahead (for example the patient asked to rebook). Use before any clinical contact.",
  "left-without-being-seen": "The patient left before a clinician saw them. For emergency patients triaged ESI 1–3 a follow-up task is sent to the doctors.",
  "left-against-advice": "The patient chose to leave against medical advice after being assessed.",
  deceased: "The patient died during this visit. The patient record is marked deceased and no new visits can be started.",
  "entered-in-error": "This visit should never have existed (wrong patient or duplicate registration). Only possible before a note is signed and with no active orders.",
};
export function EndVisitButton({encounterId, version, patientName, onEnded, onBusyChange, disabled = false}: {
  encounterId: string; version: number; patientName?: string; onEnded: () => void | Promise<void>; onBusyChange?: (busy: boolean) => void; disabled?: boolean;
}) {
  const {t} = useLocalization(), port = useConsultPort();
  const [open, setOpen] = useState(false), [outcomes, setOutcomes] = useState<EndOutcome[] | null>(null), [code, setCode] = useState("");
  const [form, setForm] = useState({reason: "", contactAttempted: false, lastSeenAt: "", risksExplained: false, capacity: "", formSigned: false, followUpAdvice: "", diedAt: toLocalDateTime(new Date().toISOString())});
  const action = useWorkflow(onBusyChange, open && !!code);
  const set = <K extends keyof typeof form,>(key: K, value: typeof form[K]) => setForm(current => ({...current, [key]: value}));
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController(); setOutcomes(null);
    void port.listEndOutcomes(encounterId, abort.signal).then(value => {if (!abort.signal.aborted) setOutcomes(value);}, error => {if (!abort.signal.aborted) action.setProblems(problemsOf(error));});
    return () => abort.abort();
  }, [open, encounterId, port]);
  const required = ["cancelled", "left-against-advice", "entered-in-error"].includes(code);
  const valid = !!outcomes?.some(o => o.code === code) && (!required || form.reason.trim().length >= 3);
  const submit = () => {
    if (disabled || !valid) return;
    const iso = (value: string) => value ? new Date(value).toISOString() : undefined;
    void action.run(() => port.endEncounter(encounterId, {outcome: code, version, reason: form.reason,
      ...(code === "left-without-being-seen" ? {contactAttempted: form.contactAttempted, lastSeenAt: iso(form.lastSeenAt)} : {}),
      ...(code === "left-against-advice" ? {risksExplained: form.risksExplained, capacity: form.capacity === "" ? undefined : form.capacity === "yes", formSigned: form.formSigned, followUpAdvice: form.followUpAdvice} : {}),
      ...(code === "deceased" ? {diedAt: iso(form.diedAt)} : {}),
    }), async () => {setOpen(false); await onEnded();});
  };
  return <>
    <Button variant="ghost" disabled={disabled} onClick={() => {setCode(""); action.setProblems([]); setOpen(true);}}>{t("End visit")}</Button>
    <Drawer open={open} title={`${t("End visit")}${patientName ? ` · ${patientName}` : ""}`} onClose={() => {if (!action.busy) setOpen(false);}}
      footer={<div className="flex gap-2"><Button disabled={action.busy} onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button variant="primary" loading={action.busy} disabled={!valid || disabled || action.busy} onClick={submit}>{t("Record")}</Button></div>}>
      <div className="grid gap-3"><ProblemNotice problems={action.problems}/>
        {!outcomes && !action.problems.length && <p>{t("Loading…")}</p>}
        {outcomes?.length === 0 && <p>{t("This visit can't be ended this way now. Use checkout, emergency disposition or inpatient discharge.")}</p>}
        <Select label="How did the visit end?" value={code} disabled={action.busy} onChange={e => setCode(e.target.value)} options={(outcomes ?? []).map(o => ({value: o.code, label: t(o.label)}))}/>
        {code && <p>{t(help[code] ?? "")}</p>}
        {code === "left-without-being-seen" && <><Input label="Last seen in the waiting area" type="datetime-local" disabled={action.busy} value={form.lastSeenAt} onChange={e => set("lastSeenAt", e.target.value)}/><Checkbox label="We tried to contact the patient" disabled={action.busy} checked={form.contactAttempted} onChange={e => set("contactAttempted", e.target.checked)}/></>}
        {code === "left-against-advice" && <><Checkbox label="The risks of leaving, and how to come back, were explained to the patient." disabled={action.busy} checked={form.risksExplained} onChange={e => set("risksExplained", e.target.checked)}/>
          <Select label="Did the patient have capacity to make this decision?" disabled={action.busy} value={form.capacity} onChange={e => set("capacity", e.target.value)} options={[{value: "yes", label: "Yes"}, {value: "no", label: "No (escalate per policy)"}]}/>
          <Checkbox label="The patient signed the discharge-against-advice form" disabled={action.busy} checked={form.formSigned} onChange={e => set("formSigned", e.target.checked)}/><Input label="Follow-up advice given" disabled={action.busy} value={form.followUpAdvice} onChange={e => set("followUpAdvice", e.target.value)}/></>}
        {code === "deceased" && <Input label="Time of death" type="datetime-local" required disabled={action.busy} value={form.diedAt} onChange={e => set("diedAt", e.target.value)}/>}
        {code && <Textarea label={required ? "Reason" : "Note (optional)"} required={required} disabled={action.busy} rows={3} maxLength={500} value={form.reason} onChange={e => set("reason", e.target.value)}/>}
        {code === "entered-in-error" && <p>{t('At least 10 characters, for example "registered under the wrong patient".')}</p>}
      </div>
    </Drawer>
  </>;
}
const reasons = [["correction", "Correction"], ["additional-information", "Additional information"], ["late-entry", "Late entry"], ["result-follow-up", "Result follow-up"], ["other", "Other"]] as const;
export function NoteAddenda({encounterId, addenda, onAdded, onBusyChange}: {encounterId: string; addenda: Addendum[]; onAdded: () => void | Promise<void>; onBusyChange?: (busy: boolean) => void}) {
  const {t} = useLocalization(), format = useFormatters(), port = useConsultPort(), {can} = useClinicalActor();
  const [adding, setAdding] = useState(false), [reason, setReason] = useState("additional-information"), [text, setText] = useState("");
  const action = useWorkflow(onBusyChange, adding && !!text);
  return <ClinicalPanel title="Addenda" subtitle="Corrections and later information. The signed note stays as it was; each addendum is signed with its author and time."
    actions={can("note.sign") && !adding && <Button onClick={() => setAdding(true)}>{t("Add addendum")}</Button>}>
    <ProblemNotice problems={action.problems}/>
    {!addenda.length && !adding && <p>{t("No addenda.")}</p>}
    {addenda.map(a => <article key={a.id} className="border-b border-[var(--border)] py-2"><p>{t(reasons.find(r => r[0] === a.reason)?.[1] ?? a.reason)} · {t("Signed by")} {a.authorName} · {format.dateTime(a.signedAt)}</p><p className="whitespace-pre-wrap" data-phi>{a.text}</p></article>)}
    {adding && <div className="grid gap-2"><Select label="Reason" disabled={action.busy} value={reason} onChange={e => setReason(e.target.value)} options={reasons.map(([value, label]) => ({value, label}))}/>
      <Textarea label="Addendum text" required disabled={action.busy} rows={4} maxLength={5000} value={text} onChange={e => setText(e.target.value)}/>
      <Button disabled={action.busy} onClick={() => setAdding(false)}>{t("Cancel")}</Button><Button disabled={!can("note.sign") || text.trim().length < 5 || action.busy} loading={action.busy} onClick={() => {if (can("note.sign") && text.trim().length >= 5) void action.run(() => port.addNoteAddendum(encounterId, {reason, text}), async () => {setText(""); setAdding(false); await onAdded();});}}>{t("Sign addendum")}</Button>
    </div>}
  </ClinicalPanel>;
}
