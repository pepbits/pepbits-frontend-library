"use client";
import React, {useCallback, useEffect, useState} from "react";
import {Badge, Button} from "@pepbits/ui";
import {ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useClinicalActor} from "../context/clinical-context";
import {useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ClinicalPanel} from "../layout/panel";
import {useClinicalResource} from "../history/PatientHistory";
import {CATEGORY_LABEL, OPEN, OUTCOME_LABEL, STATUS_LABEL, programmeStatusTone, type Decision, type Programme, type ProgrammesView, type RecallContact} from "../models/consult-workflow";
import {DecisionDrawer} from "./CareGaps";
const CONTACT_METHOD: Record<RecallContact["method"], string> = {phone: "Phone call", sms: "Text message", letter: "Letter", "in-person": "In person"};
const CONTACT_RESULT: Record<string, string> = {reached: "Reached", booked: "Appointment booked", "no-answer": "No answer", declined: "Declined", "wrong-number": "Wrong number", "message-queued": "Message queued", "message-not-sent": "Message not sent", "letter-sent": "Letter sent"};
export function CareProgrammesPanel({patientId, encounterId, className, readOnly = false, onRecordsChanged}: {patientId: string; encounterId?: string; className?: string; readOnly?: boolean; onRecordsChanged?: () => void | Promise<void>}) {
  const port = useConsultPort(), {can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters();
  const allowed = can("patient.read"), canDecide = can("note.write") && !readOnly;
  const resource = useClinicalResource(useCallback(signal => allowed ? port.loadCareProgrammes(patientId, encounterId, signal) : Promise.resolve<ProgrammesView>({programmes: [], visit: null, evaluatedAt: ""}), [port, patientId, encounterId, allowed]));
  const [showHistory, setShowHistory] = useState(false), [deciding, setDeciding] = useState<{programme: Programme; withdraw?: Decision} | null>(null);
  const history = useClinicalResource(useCallback(async signal => {
    if (!allowed || !showHistory) return {decisions: [] as Decision[], contacts: [] as RecallContact[]};
    const [decisions, contacts] = await Promise.all([port.listCareDecisions(patientId, signal), port.listRecallContacts(patientId, signal)]);
    return {decisions, contacts};
  }, [port, patientId, allowed, showHistory]));
  useEffect(() => {setDeciding(null); setShowHistory(false);}, [port, patientId, encounterId]);
  if (!allowed) return null;
  const names = new Map(resource.data?.programmes.map(p => [p.id, p.name]));
  return <ClinicalPanel title="Care programmes" className={className} subtitle="Screening and reviews that apply to this patient, from the published programmes." actions={<Button aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>{t(showHistory ? "Hide history" : "History")}</Button>}>
    {resource.error ? <ErrorState title="Could not load care programmes" description={problemsOf(resource.error).join(" ")} onRetry={resource.reload}/> : !resource.data ? <p>{t("Loading…")}</p> : !resource.data.programmes.length ? <p>{t("No programme applies to this patient.")}</p> : <ul className="grid gap-3">{resource.data.programmes.map(p => <li key={p.id}>
      <h3>{p.name}</h3><Badge tone={programmeStatusTone(p.status)}>{t(STATUS_LABEL[p.status])}</Badge> {t(CATEGORY_LABEL[p.category] ?? p.category)}
      <p>{p.lastDone ? `${t("Last done")} ${format.dateTime(p.lastDone.on)}${p.lastDone.source === "outside" ? ` (${t("elsewhere")})` : ""}` : t("No record of it being done")} · {t(p.status === "up-to-date" || p.status === "due-soon" ? "Next due" : "Due")} {p.dueOn ? format.dateTime(p.dueOn) : "—"}</p>
      {p.inProgress && <p>{p.inProgress.display} · {format.dateTime(p.inProgress.on)}</p>}
      {p.decision && <p>{t(OUTCOME_LABEL[p.decision.outcome])}: {p.decision.reason} · {p.decision.recordedByName}{p.decision.until && ` · ${format.dateTime(p.decision.until)}`} {canDecide && <Button onClick={() => setDeciding({programme: p, withdraw: p.decision!})}>{t("Withdraw")}</Button>}</p>}
      {canDecide && p.status !== "up-to-date" && !p.decision && <Button onClick={() => setDeciding({programme: p})}>{t("Record decision")}</Button>}
    </li>)}</ul>}
    {showHistory && (history.error ? <ErrorState title="Could not load care history" description={problemsOf(history.error).join(" ")} onRetry={history.reload}/> : !history.data ? <p>{t("Loading…")}</p> : <div className="grid gap-3 mt-3 md:grid-cols-2">
      <section><h3>{t("Decisions")}</h3>{!history.data.decisions.length && <p>{t("None recorded.")}</p>}<ul>{history.data.decisions.map(d => <li key={d.id}>{format.dateTime(d.recordedAt)} · {names.get(d.programmeId) ?? d.programmeId}: {t(OUTCOME_LABEL[d.outcome])} ({d.reason}) · {d.recordedByName}{d.withdrawnAt && <p>{t("Withdrawn")}: {d.withdrawReason}</p>}</li>)}</ul></section>
      <section><h3>{t("Recall contacts")}</h3>{!history.data.contacts.length && <p>{t("None recorded.")}</p>}<ul>{history.data.contacts.map(c => <li key={c.id}>{format.dateTime(c.contactedAt)} · {names.get(c.programmeId ?? "") ?? c.programmeId} · {t(CONTACT_METHOD[c.method])} · {t(CONTACT_RESULT[c.result] ?? c.result)} · {c.note} · {c.contactedByName}</li>)}</ul></section>
    </div>)}
    {deciding && canDecide && <DecisionDrawer key={`${patientId}/${deciding.programme.id}/${deciding.withdraw?.id}`} {...deciding} patientId={patientId} encounterId={encounterId} onClose={() => setDeciding(null)} onDone={async () => {setDeciding(null); resource.reload(); history.reload(); await onRecordsChanged?.();}}/>}
  </ClinicalPanel>;
}
export function CareGapsFlag({patientId, encounterId, onOpen}: {patientId: string; encounterId?: string; onOpen: () => void}) {
  const port = useConsultPort(), {can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters(), allowed = can("patient.read");
  const resource = useClinicalResource(useCallback(signal => allowed ? port.loadCareProgrammes(patientId, encounterId, signal) : Promise.resolve<ProgrammesView>({programmes: [], visit: null, evaluatedAt: ""}), [port, patientId, encounterId, allowed]));
  if (!allowed || !resource.data?.programmes.some(p => p.mode !== "hidden")) return null;
  const open = resource.data.programmes.filter(p => p.mode !== "hidden" && OPEN.includes(p.status));
  return <Button onClick={onOpen}><span>{t("Care gaps")}</span><Badge tone={open.some(p => p.status === "overdue") ? "danger" : open.length ? "warning" : "success"}>{open.length ? `${format.number(open.length)} ${t("due")}` : t("Up to date")}</Badge></Button>;
}
export default CareProgrammesPanel;
