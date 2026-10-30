"use client";
import {useRecordScopeKey} from "./record-state";
import React, {useEffect, useState} from "react";
import {Badge, Button, Input} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {useClinicalActor} from "../context/clinical-context";
import {ConsultSection} from "../layout/ConsultSection";
import {ProblemNotice} from "../layout/panel";
import type {ConsultSectionProps} from "../models/consult-workflow";
import {RecordVitals} from "../vitals/RecordVitals";
import {VitalsSummary} from "../vitals/VitalsSection";
import {useVitalParameters} from "../vitals/useVitalParameters";
import {VisitReadings, isVitalReading} from "../vitals/Corrections";
import {ScreeningReview} from "../screening/ScreeningReview";
import {PregnancyStatus} from "../screening/PregnancyStatus";
import {NursingEntries} from "./NursingEntries";
import {encounterClosed, RecordLoadError, useRecordMutation} from "./record-state";

export function ReviewSection(props: ConsultSectionProps & {allergySectionId?: string; onRecordVitals?: () => void; onBusyChange?: (busy: boolean) => void}) {
  return <ReviewSectionBody key={useRecordScopeKey(`${props.detail.patient.id}:${props.detail.encounter.id}`)} {...props}/>;
}
function ReviewSectionBody(props: ConsultSectionProps & {allergySectionId?: string; onRecordVitals?: () => void; onBusyChange?: (busy: boolean) => void}) {
  const {detail, draft, onChange, onRecordsChanged, id, allergySectionId, onRecordVitals, onBusyChange} = props;
  const port = useConsultPort(), host = useConsultHost(), {actor, can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters();
  const catalogue = useVitalParameters();
  const readOnly = props.readOnly || encounterClosed(detail.encounter.status);
  const [recording, setRecording] = useState(false), [readings, setReadings] = useState(false);
  const mutation = useRecordMutation(detail.encounter.id, readOnly);
  useEffect(() => {onBusyChange?.(mutation.busy || recording || readings); return () => onBusyChange?.(false);}, [mutation.busy, recording, readings, onBusyChange]);
  const tasks = detail.reviews.filter(r => r.assigneeRole === "doctor" && !["acknowledged", "completed", "cancelled", "closed"].includes(r.status));
  const routine = tasks.filter(r => !r.abnormal && r.requiredAction === "acknowledge");
  const acknowledge = (ids: string[]) => void mutation.run(() => port.acknowledgeReviews(ids), async () => {await onRecordsChanged?.();});
  const measured = detail.observations.history.some(o => o.encounterId === detail.encounter.id && isVitalReading(o, catalogue.parameters) && o.status !== "entered-in-error");
  return <ConsultSection stickyOffset={host.stickyOffset} id={id ?? "review"} title="Vitals and nurse findings" subtitle="Acknowledge what you’ve seen. Abnormal findings must be acknowledged one by one.">
    {!readOnly ? <div className="flex gap-2">{can("vitals.write") ? <Button variant="secondary" onClick={() => onRecordVitals ? onRecordVitals() : setRecording(true)}>{measured ? "Repeat vitals" : "Record vitals"}</Button> : null}{routine.length > 1 ? <Button disabled={mutation.busy} onClick={() => acknowledge(routine.map(r => r.id))}>Acknowledge all routine</Button> : null}</div> : null}
    <Button variant="ghost" onClick={() => setReadings(v => !v)}>{readings ? "Hide visit readings" : "Readings and corrections"}</Button>
    <RecordLoadError {...catalogue}/><VitalsSummary detail={detail} parameters={catalogue.parameters}/>
    {readings ? <VisitReadings detail={detail} readOnly={readOnly} onRecordsChanged={onRecordsChanged}/> : null}
    {recording && !readOnly && can("vitals.write") ? <RecordVitals encounterId={detail.encounter.id} latest={detail.observations.latest} onCancel={() => setRecording(false)} onSaved={() => setRecording(false)} onRecordsChanged={onRecordsChanged}/> : null}
    {!measured ? <Input label="Reason vitals were not taken" value={draft.vitalsNotTaken} maxLength={200} disabled={readOnly} onChange={e => {const value = e.target.value; onChange(n => {n.vitalsNotTaken = value;});}}/> : null}
    <ul className="grid gap-3">{tasks.map(task => <li key={task.id} className="rounded-[var(--radius)] border border-[var(--border)] p-3"><p><b>{task.title}</b> {task.abnormal ? <Badge tone="danger">Abnormal</Badge> : null}</p><p>{task.detail} · {task.authorName} · {format.dateTime(task.createdAt)}</p>
      {task.requiredAction === "verify" ? allergySectionId ? <a href={`#${allergySectionId}`}>{t("Verify in allergies")}</a> : <p>{t("Verify in allergies")}</p> : task.requiredAction === "acknowledge" && !readOnly ? <Button variant={task.abnormal ? "danger" : "secondary"} disabled={mutation.busy} onClick={() => acknowledge([task.id])}>Acknowledge</Button> : <p>{t("Required action")}: {t(task.requiredAction)}</p>}
    </li>)}</ul><ProblemNotice problems={mutation.problems}/>
    <ScreeningReview {...props} readOnly={readOnly} id={`${id ?? "review"}-screening`}/>
    {detail.patient.sex === "female" && detail.patient.age >= 12 ? <PregnancyStatus key={`${detail.patient.id}:${detail.encounter.id}`} patientId={detail.patient.id} encounterId={detail.encounter.id} status={detail.reproductiveStatus} canWrite={!readOnly && can("note.write")} clinician={actor?.role === "doctor" || actor?.role === "resident"} onChanged={onRecordsChanged}/> : null}
    <NursingEntries key={`${detail.encounter.id}:${detail.encounter.version}:${detail.observations.history.length}`} encounterId={detail.encounter.id} canWrite={!readOnly && can("note.write")} closed={readOnly} onRecordsChanged={onRecordsChanged}/>
  </ConsultSection>;
}
