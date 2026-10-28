"use client";
import React, {useCallback, useEffect, useId, useRef, useState, type ReactNode} from "react";
import {Button, Badge, Skeleton} from "@pepbits/ui";
import {Drawer, ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters, useScreenHost} from "@pepbits/patterns/screen-host";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {useClinicalActor} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import type {ConsultationDataPort} from "../context/consult-contracts";
import type {ConsultationDetail} from "../types";
import type {ConsultSectionProps, SignResult} from "../models/consult-workflow";
import {PatientBanner} from "../banner/PatientBanner";
import {ProblemNotice} from "../layout/panel";
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

/** Local assembly seam until WP2 provides RecordVitals. No additional data-port operation. */
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
  const host = useConsultHost(), port = useConsultPort(), {can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters(), screen = useScreenHost();
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
  const domainBusy = Object.values(busySources).some(Boolean);
  const action = useWorkflow(busyFor("workspace"));
  const dirty = draft.dirty || draft.state === "saving" || draft.signing || domainBusy;
  useEffect(() => {host.onDirtyChange?.(dirty); return () => host.onDirtyChange?.(false);}, [host.onDirtyChange, dirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {if (dirty) {event.preventDefault(); event.returnValue = "";}};
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {host.onPatientOpened?.(detail.patient); return () => host.onPatientOpened?.(null);}, [host.onPatientOpened, detail.patient]);
  const context: ConsultSectionProps = {detail, draft: draft.draft, onChange: draft.onChange, readOnly: draft.readOnly, onRecordsChanged: reload};
  const slotProps = {detail, readOnly: draft.readOnly, onRecordsChanged: reload};
  const sign = async () => {
    if (!can("note.sign") || draft.readOnly || domainBusy) return;
    try {const next = await draft.sign(); if (!live.current) return; setResult(next); screen.notify(t("Note signed. Orders recorded."), {tone: "success"}); await reload();} catch { /* Session retains typed server problems and the draft. */ }
  };
  const contextFor = (section: ConsultWorkspaceSection): ConsultWorkspaceSectionContext => ({...context, id: consultSectionId(instanceId, section.id), onBusyChange: busyFor(section.id), onRecordVitals: () => setRecordVitals(true),
    acknowledgeReviews: async tasks => {
      if (draft.readOnly) return;
      await action.run(() => port.acknowledgeReviews(tasks.map(task => task.id)), reload);
    },
    verifyAllergy: async (id, verification) => {
      if (draft.readOnly) return;
      const allergy = detail.allergies.entries.find(entry => entry.id === id); if (!allergy) return;
      await action.run(() => port.verifyAllergy(detail.patient.id, id, {verification, version: allergy.version ?? 1}), reload);
    },
  });
  const saveLabel = draft.state === "saving" ? "Saving…" : draft.state === "dirty" ? "Unsaved changes" : draft.state === "error" ? "Not saved — retry" : draft.state === "conflict" ? "Changed elsewhere. Reload to continue." : draft.savedAt ? "Draft saved" : "Nothing saved yet";
  return <div className="grid gap-3 text-[length:calc(13px*var(--fs-scale))] text-[var(--text)]">
    <PatientBanner patient={detail.patient} allergies={detail.allergies} latest={detail.observations.latest} encounter={detail.encounter} right={<div className="flex flex-wrap gap-2">
      {host.renderLink({kind: "patient-chart", patientId: detail.patient.id}, {children: t("Open patient chart"), newTab: true})}
      {host.renderTelehealth ? host.renderTelehealth({...slotProps, onBusyChange: busyFor("telehealth")}) : <span>{t("Telehealth unavailable")}</span>}
      <EndVisitButton encounterId={detail.encounter.id} version={detail.encounter.version} patientName={detail.patient.name} disabled={draft.signing || domainBusy && !busySources.end} onBusyChange={busyFor("end")}
        onEnded={() => host.onNavigate({kind: detail.encounter.class === "ER" ? "emergency-list" : "consultation-list"})}/>
    </div>}/>
    <div role="status">{draft.signed ? <Badge tone="success">{t("Signed")}</Badge> : <>{t(saveLabel)}{draft.savedAt && draft.state === "saved" ? ` · ${format.dateTime(draft.savedAt)}` : ""}</>}</div>
    <ProblemNotice problems={draft.problems}/><ProblemNotice problems={action.problems}/>
    {draft.state === "conflict" && <div><p>{t("Your local draft is preserved. Reloading discards it and opens the latest server note.")}</p><Button disabled={refreshing || domainBusy} onClick={() => void reset()}>{t("Discard local draft and reload")}</Button></div>}
    <nav aria-label={t("Encounter workspace")} className="flex gap-2"><Button disabled={domainBusy} aria-pressed={tab === "consult"} onClick={() => setTab("consult")}>{t("Consultation")}</Button><Button disabled={domainBusy || draft.signing} aria-pressed={tab === "administer"} onClick={() => setTab("administer")}>{t("Administer")}</Button></nav>
    {tab === "administer" && (host.renderAdministration ? host.renderAdministration({...slotProps, onBusyChange: busyFor("administration")}) : <p>{t("Medication administration unavailable. Connect the host administration workflow.")}</p>)}
    <div hidden={tab !== "consult"}>
      <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_20rem]">
        <SectionRail instanceId={instanceId} sections={sections} context={context} stickyOffset={host.stickyOffset}/>
        <div className="grid min-w-0 content-start gap-3">{sections.map(section => <div key={section.id} style={{scrollMarginTop: host.stickyOffset}} data-consult-section={section.id}>{section.render(contextFor(section))}</div>)}
          {draft.signed && <><NoteAddenda encounterId={detail.encounter.id} addenda={detail.note?.addenda ?? []} onAdded={reload} onBusyChange={busyFor("addenda")}/><ClinicalDischarge encounter={detail.encounter} onRecordsChanged={reload} onBusyChange={busyFor("discharge")}/></>}
          <div className="flex flex-wrap gap-2">{host.renderLink({kind: "consultation-list"}, {children: t("Back to list")})}<Button disabled={draft.readOnly} onClick={() => void draft.saveNow().catch(() => {})}>{t("Save draft")}</Button>
            <Button variant="primary" disabled={!can("note.sign") || draft.readOnly || domainBusy} onClick={() => {setResult(null); setSignOpen(true);}}>{t("Review and sign")}</Button>
            <Button disabled={draft.readOnly || !can("vitals.write")} onClick={() => setRecordVitals(true)}>{t("Record vitals")}</Button></div>
        </div>
        <aside className="grid content-start gap-3"><CareTeam encounterId={detail.encounter.id} onChanged={reload} onBusyChange={busyFor("team")} disabled={draft.signing}/><AiTray {...context} onBusyChange={busyFor("ai")}/></aside>
      </div>
    </div>
    <Drawer open={recordVitals} title={t("Record vitals")} onClose={() => {if (!busySources.vitals) setRecordVitals(false);}}>
      {recordVitals && (renderRecordVitals ? renderRecordVitals({...context, readOnly: context.readOnly || !can("vitals.write"), onClose: () => setRecordVitals(false), onBusyChange: busyFor("vitals")}) : <p>{t("Vitals entry unavailable until the consultation vitals module is connected.")}</p>)}
    </Drawer>
    <SignDialog {...context} open={signOpen} onClose={() => setSignOpen(false)} onSign={() => void sign()} signing={draft.signing} disabled={!can("note.sign") || draft.readOnly || domainBusy} problems={draft.problems} result={result}/>
  </div>;
}
