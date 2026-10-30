"use client";
import {useRecordScopeKey} from "./record-state";
import React, {useCallback, useState} from "react";
import {Button, Textarea} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import {RecordLoadError, useRecordMutation, useRecordResource} from "./record-state";

function NursingEntriesBody({encounterId, canWrite, closed, onRecordsChanged}: {
  encounterId: string; canWrite: boolean; closed: boolean; onRecordsChanged?: () => void | Promise<void>;
}) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters();
  const resource = useRecordResource(useCallback((signal: AbortSignal) => port.listNursingEntries(encounterId, signal), [port, encounterId]));
  const mutation = useRecordMutation(encounterId, !canWrite || closed);
  const [open, setOpen] = useState<string | null>(null), [text, setText] = useState("");
  return <ClinicalPanel title="Nursing entries at this visit">
    <RecordLoadError {...resource}/><ProblemNotice problems={mutation.problems}/>
    {!resource.data && !resource.problems.length ? <p>{t("Loading nursing entries…")}</p> : null}
    {resource.data?.length === 0 ? <p>{t("No nursing entries recorded for this visit.")}</p> : null}
    <ul className="grid gap-3">{resource.data?.map(entry => {
      const key = `${entry.recordType}:${entry.recordId}`;
      return <li key={key} className="grid gap-2">
        <p><b>{entry.title}</b> · {entry.authorName ?? t("unknown user")} · {format.dateTime(entry.at)}</p><p>{entry.summary}</p>
        <ol>{entry.clarifications.map(c => <li key={c.id}><p className="whitespace-pre-line">{c.text}</p><p>{t("Clarification by")} {c.authorName ?? t("unknown user")} · {format.dateTime(c.signedAt)}</p></li>)}</ol>
        {canWrite && !closed ? open === key ? <div className="grid gap-2">
          <Textarea label={t("Clarification to {title}", {title: entry.title})} value={text} maxLength={2000} onChange={e => setText(e.target.value)} disabled={mutation.busy}/>
          <div className="flex gap-2"><Button disabled={mutation.busy} variant="ghost" onClick={() => {setOpen(null); setText("");}}>Cancel</Button>
            <Button loading={mutation.busy} disabled={text.trim().length < 5} onClick={() => void mutation.run(() => port.requestClarification(encounterId, {recordType: entry.recordType, recordId: entry.recordId, text}), async () => {setOpen(null); setText(""); resource.retry(); await onRecordsChanged?.();})}>Sign clarification</Button></div>
        </div> : <Button variant="ghost" onClick={() => {setOpen(key); setText("");}}>Add clarification</Button> : null}
      </li>;
    })}</ul>
  </ClinicalPanel>;
}

export function NursingEntries(props: React.ComponentProps<typeof NursingEntriesBody>) {
  return <NursingEntriesBody key={useRecordScopeKey(props.encounterId)} {...props}/>;
}
