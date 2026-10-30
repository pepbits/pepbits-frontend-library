"use client";
import React, {useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode} from "react";
import {Button, Badge, Skeleton} from "@pepbits/ui";
import {Drawer, ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters, useScreenHost} from "@pepbits/patterns/screen-host";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {useClinicalActor} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import type {ConsultationDataPort} from "../context/consult-contracts";
import type {ConsultationDetail} from "../types";
import type {AssessmentRow, Programme, ConsultSectionProps, SignResult} from "../models/consult-workflow";
import {PatientBanner} from "../banner/PatientBanner";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import {consultSectionId} from "../layout/ConsultSection";
import {defaultConsultSections, type ConsultWorkspaceSection, type ConsultWorkspaceSectionContext} from "./sections";
import {useConsultDraft} from "./useConsultDraft";
import {SectionRail} from "./SectionRail";
import {SignDialog} from "./SignDialog";
import {CareTeam} from "./CareTeam";
import {AiTray} from "./AiTray";
import {EndVisitButton, NoteAddenda} from "./EncounterEnd";
import {ClinicalDischarge} from "./ClinicalDischarge";
import {useWorkflow} from "./useWorkflow";
import {RecordVitals, Trends, useVitalParameters} from "../consult-records";
import {isVitalReading} from "../vitals/Corrections";
import {OrderInfoProvider, useOrderInfo} from "../orders";
import {medicationSafetyProblems, type MedicationSafetyState} from "../consult-orders";
import {consultReadiness} from "./readiness";

/** Hosts may replace the built-in vitals editor without changing the data-port contract. */
export interface ConsultRecordVitalsContext extends ConsultSectionProps {onClose: () => void; onBusyChange: (busy: boolean) => void}
export interface ConsultWorkspaceProps {
  encounterId: string; sections?: readonly ConsultWorkspaceSection[];
  renderRecordVitals?: (context: ConsultRecordVitalsContext) => ReactNode;
  autosaveMs?: number;
}
export function ConsultWorkspace(props: ConsultWorkspaceProps) {
  return <WorkspaceLoader key={props.encounterId} {...props}/>;
}
function WorkspaceLoader(props: ConsultWorkspaceProps) {
  const port = useConsultPort(), host = useConsultHost(), {t} = useLocalization();
  const [loaded, setLoaded] = useState<{port: ConsultationDataPort; detail: ConsultationDetail; generation: number} | null>(null);
  const [problems, setProblems] = useState<string[]>([]), [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const read = useRef<AbortController | null>(null), generation = useRef(0);
  const load = useCallback(async (reset = false) => {
    if (!mounted.current) return;
    read.current?.abort(); const abort = new AbortController(); read.current = abort;
    setLoading(true); setProblems([]);
    try {
      const detail = await port.loadConsultation(props.encounterId, abort.signal);
      if (abort.signal.aborted) return;
      if (detail.encounter.class === "IP") {host.onNavigate({kind: "inpatient", encounterId: detail.encounter.id}, {replace: true}); return;}
      if (reset) generation.current++;
      setLoaded({port, detail, generation: generation.current});
    } catch (error) {if (!abort.signal.aborted) setProblems(problemsOf(error));}
    finally {if (!abort.signal.aborted) setLoading(false);}
  }, [port, props.encounterId, host.onNavigate]);
  useEffect(() => {mounted.current = true; void load(); return () => {mounted.current = false; read.current?.abort();};}, [load]);
  const detail = loaded?.port === port ? loaded.detail : null;
  if (!detail) return problems.length ? <ErrorState title={t("Unable to load consultation")} description={problems.map(problem => t(problem)).join(" ")} onRetry={() => void load()} retrying={loading}/> : <div aria-label={t("Loading consultation")}><Skeleton className="h-20"/><Skeleton className="mt-3 h-96"/></div>;
  return <><ProblemNotice title="Unable to refresh records" problems={problems}/>{problems.length > 0 && <Button disabled={loading} onClick={() => void load()}>{t("Retry")}</Button>}
    <LoadedWorkspace key={loaded!.generation} {...props} detail={detail} reload={() => load()} reset={() => load(true)} refreshing={loading}/></>;
}
function LoadedWorkspace({detail, sections = defaultConsultSections, renderRecordVitals, autosaveMs, reload, reset, refreshing}: ConsultWorkspaceProps & {
  detail: ConsultationDetail; reload: () => Promise<void>; reset: () => Promise<void>; refreshing: boolean;
}) {
  const host = useConsultHost(), port = useConsultPort(), {actor, can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters(), screen = useScreenHost();
  const live = useRef(true);
  useEffect(() => {live.current = true; return () => {live.current = false;};}, []);
  const instanceId = useId(), draft = useConsultDraft(detail, can("note.write"), autosaveMs);
  const [tab, setTab] = useState(host.initialTab ?? "consult"), [signOpen, setSignOpen] = useState(false), [result, setResult] = useState<SignResult | null>(null);
  const [recordVitals, setRecordVitals] = useState(false), [busySources, setBusySources] = useState<Record<string, boolean>>({});
  // Stable callbacks prevent host slots from repeatedly clearing/re-registering their dirty state.
  const callbacks = useRef(new Map<string, (busy: boolean) => void>());
  const busyFor = (key: string) => {
    if (!callbacks.current.has(key)) callbacks.current.set(key, busy => setBusySources(current => current[key] === busy ? current : {...current, [key]: busy}));
    return callbacks.current.get(key)!;
  };
  const domainBusy = Object.values(busySources).some(Boolean) || recordVitals;
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]), [care, setCare] = useState<Programme[] | null>(null);
  const [safety, setSafety] = useState<MedicationSafetyState>({pending: false, ready: false, problems: []});
  const catalogue = useVitalParameters();
  const orderInfo = useOrderInfo(draft.draft, detail.encounter.id, draft.signed || !can("note.write"));
  const action = useWorkflow(busyFor("workspace"));
  const dirty = draft.dirty || draft.state === "saving" || draft.signing || domainBusy;
  useEffect(() => {host.onDirtyChange?.(dirty); return () => host.onDirtyChange?.(false);}, [host.onDirtyChange, dirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {if (dirty) {event.preventDefault(); event.returnValue = "";}};
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {host.onPatientOpened?.(detail.patient); return () => host.onPatientOpened?.(null);}, [host.onPatientOpened, detail.patient]);
  const context: ConsultSectionProps = {detail, draft: draft.draft, onChange: draft.onChange, readOnly: draft.readOnly, onRecordsChanged: reload};
  const readiness = consultReadiness(context, {
    visitVitals: detail.observations.history.some(o => o.encounterId === detail.encounter.id && o.status !== "entered-in-error" && isVitalReading(o, catalogue.parameters)),
    assessments, care: care ?? [], orderPending: orderInfo.pending, orderProblems: orderInfo.problems,
    ordersOpen: orderInfo.open(["labs", "imaging", "procedures"]), prescriptionsOpen: orderInfo.open(["prescriptions"]),
    medicationProblems: [...medicationSafetyProblems(draft.draft), ...(draft.draft.prescriptions.length ? safety.problems : [])],
    medicationReady: safety.ready && !safety.pending,
  });
  const showCare = detail.note?.status === "final" ? !!detail.note.careGaps?.length : care === null || care.length > 0;
  const visibleSections = useMemo(() => sections.filter(section => section.id !== "care" || showCare).map(section => ({
    ...section, state: section.state ?? (() => readiness.states[section.id]),
  })), [sections, showCare, JSON.stringify(readiness.states)]);
  const signProblems = draft.signed ? [] : readiness.problems;
  const slotProps = {detail, readOnly: draft.readOnly, onRecordsChanged: reload};
  const sign = async () => {
    if (!can("note.sign") || draft.readOnly || domainBusy || signProblems.length) return;
    try {const next = await draft.sign(); if (!live.current) return; setResult(next); screen.notify(t("Note signed. Orders recorded."), {tone: "success"}); await reload();} catch { /* Session retains typed server problems and the draft. */ }
  };
  const contextFor = (section: ConsultWorkspaceSection): ConsultWorkspaceSectionContext => ({...context, id: consultSectionId(instanceId, section.id), onBusyChange: busyFor(section.id), renderSignedDischarge: () => <ClinicalDischarge encounter={detail.encounter} onRecordsChanged={reload} onBusyChange={busyFor("discharge")}/>, onRecordVitals: () => setRecordVitals(true),
    orderInfo, allergySectionId: consultSectionId(instanceId, "allergies"), onAssessments: setAssessments, onProgrammes: setCare, onSafetyChange: setSafety,
    canCompleteProcedures: !draft.signing && (can("order.write") || can("note.write")),
    canDecideSubstitution: !draft.signing && can("rx.write"), assessmentsReadOnly: draft.signing || draft.state === "conflict",
    acknowledgeReviews: async tasks => {
      if (draft.readOnly || tasks.length > 1 && tasks.some(task => task.abnormal)) return;
      await action.run(() => port.acknowledgeReviews(tasks.map(task => task.id)), reload);
    },
    verifyAllergy: async (id, verification) => {
      if (draft.readOnly || !can("allergy.verify")) return;
      const allergy = detail.allergies.entries.find(entry => entry.id === id); if (!allergy) return;
      await action.run(() => port.verifyAllergy(detail.patient.id, id, {verification, version: allergy.version ?? 1}), reload);
    },
  });
  const saveLabel = draft.state === "saving" ? "Saving…" : draft.state === "dirty" ? "Unsaved changes" : draft.state === "error" ? "Not saved — retry" : draft.state === "conflict" ? "Changed elsewhere. Reload to continue." : draft.savedAt ? "Draft saved" : "Nothing saved yet";
  return <div className="grid gap-3 text-[length:calc(13px*var(--fs-scale))] text-[var(--text)]">
    <PatientBanner patient={detail.patient} allergies={detail.allergies} latest={detail.observations.latest} encounter={detail.encounter} reproductive={detail.reproductiveStatus} careGaps={{sectionId: consultSectionId(instanceId, "care"), items: detail.note?.status === "final" ? detail.note.careGaps ?? [] : care ?? []}} right={<div className="flex flex-wrap gap-2">
      {host.renderLink({kind: "patient-chart", patientId: detail.patient.id}, {children: t("Open patient chart"), newTab: true})}
      {host.renderTelehealth ? host.renderTelehealth({...slotProps, onBusyChange: busyFor("telehealth")}) : <span>{t("Telehealth unavailable")}</span>}
      <EndVisitButton encounterId={detail.encounter.id} version={detail.encounter.version} patientName={detail.patient.name} disabled={draft.signing || domainBusy && !busySources.end} onBusyChange={busyFor("end")}
        onEnded={() => host.onNavigate({kind: detail.encounter.class === "ER" ? "emergency-list" : "consultation-list"})}/>
    </div>}/>
    <div role="status">{draft.signed ? <Badge tone="success">{t("Signed")}</Badge> : <>{t(saveLabel)}{draft.savedAt && draft.state === "saved" ? ` · ${format.dateTime(draft.savedAt)}` : ""}</>}</div>
    <ProblemNotice problems={draft.problems}/>{orderInfo.problems.length > 0 && <Button onClick={orderInfo.retry}>{t("Retry order evaluation")}</Button>}<ProblemNotice problems={action.problems}/>
    {draft.state === "conflict" && <div><p>{t("Your local draft is preserved. Reloading discards it and opens the latest server note.")}</p><Button disabled={refreshing || domainBusy} onClick={() => void reset()}>{t("Discard local draft and reload")}</Button></div>}
    <nav aria-label={t("Encounter workspace")} className="flex gap-2"><Button disabled={domainBusy} aria-pressed={tab === "consult"} onClick={() => setTab("consult")}>{t("Consultation")}</Button><Button disabled={domainBusy || draft.signing} aria-pressed={tab === "administer"} onClick={() => setTab("administer")}>{t("Administer")}</Button></nav>
    {tab === "administer" && (host.renderAdministration ? host.renderAdministration({...slotProps, onBusyChange: busyFor("administration")}) : <p>{t("Medication administration unavailable. Connect the host administration workflow.")}</p>)}
    <div hidden={tab !== "consult"}>
      <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_20rem]">
        <SectionRail instanceId={instanceId} sections={visibleSections} context={context} signed={draft.signed} stickyOffset={host.stickyOffset}/>
        <div className="grid min-w-0 content-start gap-3"><OrderInfoProvider value={orderInfo}>{sections.map(section => <div hidden={section.id === "care" && !showCare} key={section.id} style={{scrollMarginTop: host.stickyOffset}} data-consult-section={section.id}>{section.render(contextFor(section))}</div>)}</OrderInfoProvider>
          {draft.signed && detail.orders.length > 0 && <ClinicalPanel title="Orders from this visit"><ul className="grid gap-2">{detail.orders.map(order => <li key={order.id}>
            {order.effective?.label ?? order.display} <Badge>{t(order.kind)}</Badge> <Badge tone={order.status === "active" ? "success" : "warning"}>{t(order.priorAuth === "requested" ? "awaiting insurer" : order.status)}</Badge>
            {order.substitution && <span> · {t(order.substitution.status)}</span>}
          </li>)}</ul></ClinicalPanel>}
          {draft.signed && <><NoteAddenda encounterId={detail.encounter.id} addenda={detail.note?.addenda ?? []} onAdded={reload} onBusyChange={busyFor("addenda")}/>{!sections.some(section => section.id === "plan") && <ClinicalDischarge encounter={detail.encounter} onRecordsChanged={reload} onBusyChange={busyFor("discharge")}/>}</>}
          {draft.signed ? <p>{t("Signed. Changes now need an addendum.")} {detail.encounter.class === "ER" && host.renderLink({kind: "emergency-disposition", encounterId: detail.encounter.id}, {children: t("Complete emergency disposition")})}</p> : <ProblemNotice title="To sign" problems={signProblems}/>}
          <div className="flex flex-wrap gap-2">{!draft.signed && actor?.requiresCosign && <p>{t("Your consultant will be asked to co-sign.")}</p>}{host.renderLink({kind: "consultation-list"}, {children: t("Back to list")})}<Button disabled={draft.readOnly} onClick={() => void draft.saveNow().catch(() => {})}>{t("Save draft")}</Button>
            <Button variant="primary" disabled={!can("note.sign") || draft.readOnly || domainBusy} onClick={() => {setResult(null); setSignOpen(true);}}>{t("Review and sign")}</Button>
            <Button disabled={draft.readOnly || !can("vitals.write")} onClick={() => setRecordVitals(true)}>{t("Record vitals")}</Button></div>
        </div>
        <aside className="grid content-start gap-3"><CareTeam encounterId={detail.encounter.id} onChanged={reload} onBusyChange={busyFor("team")} disabled={draft.signing}/><AiTray {...context} onBusyChange={busyFor("ai")}/><Trends observations={detail.observations.history} parameters={catalogue.parameters}/></aside>
      </div>
    </div>
    <Drawer open={recordVitals} title={t("Record vitals")} onClose={() => {if (!busySources.vitals) setRecordVitals(false);}}>
      {recordVitals && (renderRecordVitals ? renderRecordVitals({...context, readOnly: context.readOnly || !can("vitals.write"), onClose: () => setRecordVitals(false), onBusyChange: busyFor("vitals")}) : <RecordVitals encounterId={detail.encounter.id} latest={detail.observations.latest} readOnly={context.readOnly || !can("vitals.write")} onCancel={() => setRecordVitals(false)} onSaved={() => setRecordVitals(false)} onRecordsChanged={reload} onBusyChange={busyFor("vitals")}/>)}
    </Drawer>
    <SignDialog {...context} open={signOpen} onClose={() => setSignOpen(false)} onSign={() => void sign()} signing={draft.signing} disabled={!can("note.sign") || draft.readOnly || domainBusy || signProblems.length > 0} problems={[...signProblems, ...draft.problems]} result={result}/>
  </div>;
}
