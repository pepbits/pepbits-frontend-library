"use client";
import {useRecordScopeKey} from "../consult-records/record-state";
import React, {useState} from "react";
import {Button, Input, Segmented} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {ConsultSection} from "../layout/ConsultSection";
import {ProblemNotice} from "../layout/panel";
import {encounterClosed, useRecordMutation} from "../consult-records/record-state";
import type {ConsultSectionProps} from "../models/consult-workflow";
import {SCREENING_ANSWERS, SCREENING_QUESTIONS} from "./model";

function ScreeningReviewBody({detail, readOnly, onRecordsChanged, id}: ConsultSectionProps) {
  const port = useConsultPort(), host = useConsultHost(), {t} = useLocalization(), format = useFormatters();
  const [statusVersion, setStatusVersion] = useState(detail.reproductiveStatus?.version ?? 0);
  const [reassessing, setReassessing] = useState(false), [answers, setAnswers] = useState<Record<string, string>>({}), [note, setNote] = useState("");
  const closed = readOnly || encounterClosed(detail.encounter.status), mutation = useRecordMutation(detail.encounter.id, closed);
  const nurse = detail.encounter.intake?.screening ?? {}, reviews = detail.screeningReviews ?? [];
  const latest: Record<string, {answer: string; by?: string; at: string}> = {};
  for (const review of reviews) for (const [key, answer] of Object.entries(review.answers)) latest[key] = {answer, by: review.byName, at: review.at};
  const keys = [...new Set([...Object.keys(nurse), ...Object.keys(latest)])];
  const send = (action: "reviewed" | "reassessed") => {
    if (action === "reassessed" && !Object.keys(answers).length) return;
    void mutation.run(() => port.reviewScreening(detail.encounter.id, {action, answers: action === "reviewed" ? {} : answers, note, statusVersion: action === "reviewed" ? detail.reproductiveStatus?.version ?? 0 : statusVersion}), async () => {setReassessing(false); setAnswers({}); setNote(""); await onRecordsChanged?.();});
  };
  const label = (answer?: string) => t(SCREENING_ANSWERS.find(a => a.value === answer)?.label ?? answer ?? "Not recorded");
  return <ConsultSection stickyOffset={host.stickyOffset} id={id ?? "screening"} title="Screening at intake">
    {!keys.length ? <p>{t("No screening answers recorded.")}</p> : <>
      <ul className="grid gap-3">{keys.map(key => {
        const question = SCREENING_QUESTIONS.find(q => q.key === key), mine = latest[key];
        return <li key={key}><p>{t(question?.label ?? key)}</p><p className={question?.flagOn === nurse[key] ? "text-[var(--danger-ink)]" : ""}>{t("Nurse")}: {label(nurse[key])}</p>
          {mine ? <p className={question?.flagOn === mine.answer ? "text-[var(--danger-ink)]" : ""}>{t("Reassessed")}: {label(mine.answer)} · {mine.by} · {format.dateTime(mine.at)}</p> : null}
          {reassessing && !closed ? <Segmented label={question?.label ?? key} value={answers[key] ?? ""} options={SCREENING_ANSWERS.map(a => ({...a, disabled: mutation.busy}))} onChange={answer => setAnswers({...answers, [key]: answer})}/> : null}
        </li>;
      })}</ul>
      {!closed ? reassessing ? <div className="grid gap-2"><p>{t("Answer only what you asked again. The nurse’s answers stay as recorded. A pregnancy answer here also updates the patient’s pregnancy status as confirmed.")}</p>
        <Input label="Note" value={note} maxLength={500} disabled={mutation.busy} hint={detail.reproductiveStatus?.verification === "confirmed" && answers.pregnant ? "Required as the reason when this changes the confirmed pregnancy status." : undefined} onChange={e => setNote(e.target.value)}/>
        <div className="flex gap-2"><Button variant="ghost" disabled={mutation.busy} onClick={() => {setReassessing(false); setAnswers({}); setNote("");}}>Cancel</Button><Button loading={mutation.busy} disabled={!Object.keys(answers).length} onClick={() => send("reassessed")}>Save reassessment</Button></div>
      </div> : <div className="flex gap-2"><Button loading={mutation.busy} onClick={() => send("reviewed")}>Reviewed</Button><Button disabled={mutation.busy} variant="ghost" onClick={() => {setStatusVersion(detail.reproductiveStatus?.version ?? 0); setReassessing(true);}}>Reassess</Button></div> : null}
    </>}
    {reviews.length ? <details><summary>{t("Review history")}</summary><ul>{reviews.map(r => <li key={r.id}>{t(r.action)} · {r.byName} · {format.dateTime(r.at)} {r.note}</li>)}</ul></details> : null}
    <ProblemNotice problems={mutation.problems}/>
  </ConsultSection>;
}

export function ScreeningReview(props: React.ComponentProps<typeof ScreeningReviewBody>) {
  return <ScreeningReviewBody key={useRecordScopeKey(`${props.detail.patient.id}:${props.detail.encounter.id}`)} {...props}/>;
}
