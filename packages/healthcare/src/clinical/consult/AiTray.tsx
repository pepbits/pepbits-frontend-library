"use client";
import React, {useEffect, useRef, useState} from "react";
import {Button, Textarea, Badge} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import type {ConsultSectionProps, Proposal, ExtractionResult, ChartSummary} from "../models/consult-workflow";
import type {NoteContent, TriValue} from "../models/consult-note";
import {useWorkflow} from "./useWorkflow";

/** AI payloads are untrusted proposals; accept only supported field shapes. */
export function applyNoteProposal(note: NoteContent, proposal: Proposal) {
  const value = proposal.value;
  const record = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  if (proposal.field === "complaint" && typeof record.code === "string" && typeof record.display === "string") {
    if (!note.complaints.some(c => c.code === record.code)) note.complaints.push({code: record.code, display: record.display, primary: !note.complaints.length});
  } else if (proposal.field === "duration" && typeof record.value === "number" && Number.isFinite(record.value) && typeof record.unit === "string") {
    const complaint = note.complaints.find(c => c.primary) ?? note.complaints[0];
    if (complaint) complaint.duration = {value: record.value, unit: record.unit}; else note.hpi.onset = `${proposal.display} ago`;
  } else if (proposal.field === "severity" && typeof value === "number" && Number.isFinite(value)) note.hpi.severity = value;
  else if (proposal.field === "smoking" && typeof value === "string" && ["never", "current", "former", "unknown"].includes(value)) note.history.smoking = value as NoteContent["history"]["smoking"];
  else if (/^ros\.[a-z-]+\.[\w -]+$/i.test(proposal.field) && typeof value === "string" && ["present", "absent", "unknown", "not-asked", "declined"].includes(value)) {
    const [, system, symptom] = proposal.field.split(".");
    if ([system, symptom].some(key => ["__proto__", "constructor", "prototype"].includes(key!))) throw new Error("Unsupported assistant suggestion.");
    note.ros[system!] = {...note.ros[system!], [symptom!]: value as TriValue};
  } else if (proposal.field.startsWith("vitals.")) note.hpi.context = `${note.hpi.context ? `${note.hpi.context}\n` : ""}Patient-reported ${proposal.label.toLowerCase().replace(" (reported)", "")}: ${proposal.display} (not measured here).`;
  else throw new Error("Unsupported assistant suggestion.");
  note.aiAccepted.push({field: proposal.field, at: new Date().toISOString()});
}
export function AiTray({detail, draft: _draft, onChange, readOnly, onRecordsChanged, onBusyChange}: ConsultSectionProps & {onBusyChange?: (busy: boolean) => void}) {
  const {t} = useLocalization(), format = useFormatters(), port = useConsultPort();
  const [text, setText] = useState(""), [result, setResult] = useState<ExtractionResult | null>(null), [summary, setSummary] = useState<ChartSummary | null>(null), [showSent, setShowSent] = useState(false);
  const [done, setDone] = useState<Record<string, "accepted" | "dismissed">>({});
  const doneRef = useRef(done); doneRef.current = done;
  const readonlyRef = useRef(readOnly); readonlyRef.current = readOnly;
  const action = useWorkflow(onBusyChange);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), [port, detail.encounter.id]);
  const read = <T,>(request: (signal: AbortSignal) => Promise<T>, accept: (value: T) => void) => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    void action.run(() => request(controller.signal), value => {if (!controller.signal.aborted) accept(value);});
  };
  const accept = async (proposal: Proposal) => {
    if (readonlyRef.current || doneRef.current[proposal.id]) return;
    if (proposal.field === "allergy") {
      const value = proposal.value as {substance?: unknown; reaction?: unknown} | null;
      if (typeof value?.substance !== "string" || !value.substance.trim() || typeof value.reaction !== "string") throw new Error("Unsupported assistant suggestion.");
      await port.addAllergy(detail.patient.id, {substance: value.substance[0]!.toUpperCase() + value.substance.slice(1), category: "medication", reaction: value.reaction});
      if (abort.current?.signal.aborted) return;
      onChange(note => {note.aiAccepted.push({field: proposal.field, at: new Date().toISOString()});});
      await onRecordsChanged?.();
    } else onChange(note => applyNoteProposal(note, proposal));
    doneRef.current = {...doneRef.current, [proposal.id]: "accepted"}; setDone(doneRef.current);
  };
  return <ClinicalPanel title="Assistant" subtitle="Suggestions only. Nothing enters the note until you accept it.">
    <div className="grid gap-3"><ProblemNotice problems={action.problems}/>
      {!readOnly && <><Textarea label="Dictation or free text" rows={4} maxLength={4000} disabled={action.busy} value={text} onChange={e => setText(e.target.value)}/>
        <div className="flex flex-wrap gap-2"><Button variant="primary" disabled={action.busy || text.trim().length < 3} onClick={() => read(signal => port.extractSuggestions(detail.encounter.id, text, signal), value => {setResult(value); setDone({}); doneRef.current = {};})}>{t("Suggest fields")}</Button>
          <Button disabled={action.busy} onClick={() => read(signal => port.summarizeChart(detail.patient.id, signal), setSummary)}>{t("Summarise chart")}</Button></div></>}
      {result && <><p>{result.provider}</p><Button variant="ghost" aria-expanded={showSent} onClick={() => setShowSent(current => !current)}>{format.number(result.redactions)} {t("identifiers removed before sending")}</Button>
        {showSent && <p className="whitespace-pre-wrap" data-phi>{result.sentText}</p>}
        {!readOnly && result.proposals.filter(p => !done[p.id]).length > 1 && <Button disabled={action.busy} onClick={() => void action.run(async () => {for (const proposal of result.proposals.filter(p => p.confidence === "high" && !done[p.id])) await accept(proposal);})}>{t("Accept all high-confidence")}</Button>}
        <ul className="grid gap-2">{result.proposals.map(proposal => <li key={proposal.id} className="rounded-[var(--radius)] border border-[var(--border)] p-3">
          <p>{t(proposal.label)} <Badge tone={proposal.confidence === "high" ? "success" : proposal.confidence === "medium" ? "warning" : "neutral"}>{t(proposal.confidence)}</Badge></p><p>{proposal.display}</p><p data-phi>{proposal.evidence}</p>
          {!done[proposal.id] && !readOnly && <div className="flex gap-2"><Button disabled={action.busy} onClick={() => void action.run(() => accept(proposal))}>{t("Accept")}</Button><Button disabled={action.busy} onClick={() => setDone(current => ({...current, [proposal.id]: "dismissed"}))}>{t("Dismiss")}</Button></div>}
          {done[proposal.id] && <p>{t(done[proposal.id] === "accepted" ? proposal.field === "allergy" ? "Added as an unconfirmed allergy" : "Added to the note" : "Dismissed")}</p>}
        </li>)}</ul>{!result.proposals.length && <p>{t("Nothing recognisable to suggest.")}</p>}</>}
      {summary && <div><p>{t("Chart summary")} · {summary.provider}</p><p className="whitespace-pre-wrap" data-phi>{summary.summary}</p></div>}
    </div>
  </ClinicalPanel>;
}
