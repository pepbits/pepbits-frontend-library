"use client";
import React, {useEffect, useRef, useState} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {Check} from "@pepbits/icons";
import {Badge, Button, Skeleton, cn} from "@pepbits/ui";
import {ErrorState} from "@pepbits/components";
import {useScreenHost} from "@pepbits/patterns/screen-host";
import {useClinicalPort} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import {OUTPATIENT_INTAKE, type IntakeProfile} from "../context/profiles";
import {ClinicalPanel, ProblemNotice, TEXT} from "../layout/panel";
import {PatientBanner} from "../banner/PatientBanner";
import {ArrivalComplaintSection} from "../complaint/ArrivalComplaintSection";
import {VitalsSection} from "../vitals/VitalsSection";
import {News2Panel, useNews2} from "../vitals/News2Panel";
import {AllergyReviewSection} from "../allergy/AllergySection";
import {ScreeningSection} from "../screening/ScreeningSection";
import {EMPTY_VITALS, vitalsComplete} from "../vitals/model";
import type {AllergyBlock, EncounterDetail} from "../types";
import {intakePayload, intakeProblems, type IntakeState} from "./intake-model";

const EMPTY: IntakeState = {arrival: {mode: null, source: null, interpreter: null}, complaint: {item: null, words: ""}, vitals: EMPTY_VITALS, notMeasured: {}, screening: {}, allergyReview: null};

/**
 * Nurse intake for one encounter, composed from the clinical sections the profile lists. Opening it
 * moves a waiting visit into intake; saving records vitals, NEWS2, allergy review and screening and
 * hands the visit on (outpatients become "ready for doctor"). The host navigates in `onSaved`/`onCancel`.
 */
export function IntakeForm({encounterId, profile = OUTPATIENT_INTAKE, onSaved, onCancel}: {
  encounterId: string; profile?: IntakeProfile; onSaved: () => void; onCancel: () => void;
}) {
  const {t} = useLocalization();
  const port = useClinicalPort();
  const {notify} = useScreenHost();
  const top = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<EncounterDetail | null>(null);
  const [allergies, setAllergies] = useState<AllergyBlock | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<IntakeState>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<IntakeState>) => setState(current => ({...current, ...next}));

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    port.loadEncounter(encounterId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setDetail(result); setAllergies(result.allergies);
      if (profile.startStatus && profile.inProgressStatus && result.encounter.status === profile.startStatus && result.encounter.class === profile.encounterClass)
        void port.setEncounterStatus(encounterId, profile.inProgressStatus).catch(() => {});
    }).catch(error => { if (!controller.signal.aborted) setLoadError(error); });
    return () => controller.abort();
  }, [port, encounterId, profile, attempt]);

  const {news, invalid} = useNews2(state.vitals, state.notMeasured);

  if (loadError) return <ErrorState title="Couldn’t open this visit" description={problemsOf(loadError).join(" ")} onRetry={() => setAttempt(a => a + 1)}/>;
  if (!detail || !allergies) return <div className="grid gap-3" aria-busy="true"><Skeleton className="h-16"/><Skeleton className="h-64"/><Skeleton className="h-48"/></div>;
  if (detail.encounter.class !== profile.encounterClass)
    return <ErrorState severity="warning" title="This visit uses a different form" description={detail.encounter.class === "IP" ? "Use inpatient observations; outpatient intake or emergency triage cannot change an inpatient admission." : `${t("This form is for")} ${profile.encounterClass} ${t("visits; this one is")} ${detail.encounter.class}.`}/>;

  const {patient, encounter} = detail;
  const has = (section: IntakeProfile["sections"][number]) => profile.sections.includes(section);
  const checklist: [string, boolean][] = [
    ...(has("vitals") ? [["Vital signs, oxygen and consciousness", vitalsComplete(state.vitals, state.notMeasured)] as [string, boolean]] : []),
    ...(has("allergies") ? [["Allergy review", !!state.allergyReview] as [string, boolean]] : []),
    ...(profile.requireComplaint ? [["Complaint", !!state.complaint.item] as [string, boolean]] : []),
  ];

  const save = async () => {
    const found = intakeProblems(state, profile);
    setProblems(found);
    if (found.length) { top.current?.scrollIntoView({behavior: "smooth", block: "start"}); return; }
    setSaving(true);
    try {
      await port.saveIntake(encounterId, intakePayload(state, profile));
      notify(profile.savedMessage(patient.name), {tone: "success"});
      onSaved();
    } catch (error) {
      setProblems(problemsOf(error));
      top.current?.scrollIntoView({behavior: "smooth", block: "start"});
    } finally { setSaving(false); }
  };

  return <div ref={top} className="pb-4" data-intake-form={profile.id}>
    <PatientBanner patient={patient} allergies={allergies} latest={detail.observations.latest} encounter={encounter} right={<Badge tone="info">{profile.title}</Badge>}/>
    <ProblemNotice problems={problems}/>
    <div className={cn("grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]", problems.length > 0 && "mt-3")}>
      <div className="grid min-w-0 content-start gap-3">
        {has("arrival") ? <ArrivalComplaintSection arrival={state.arrival} onArrival={arrival => patch({arrival})} complaint={state.complaint} onComplaint={complaint => patch({complaint})}
          receptionReason={encounter.reason} requireComplaint={profile.requireComplaint} showArrivalMode={profile.encounterClass === "ER"}/> : null}
        {has("vitals") ? <VitalsSection value={{vitals: state.vitals, notMeasured: state.notMeasured}} onChange={v => patch(v)} latest={detail.observations.latest}/> : null}
        {has("allergies") ? <AllergyReviewSection patientId={patient.id} allergies={allergies} onAllergies={setAllergies} outcome={state.allergyReview} onOutcome={allergyReview => patch({allergyReview})}
          onAdded={() => notify(t("Allergy added as unconfirmed. The doctor will be asked to verify it."), {tone: "success"})}/> : null}
        {has("screening") ? <ScreeningSection context={{sex: patient.sex, age: patient.age, emergency: profile.encounterClass === "ER"}} value={state.screening} onChange={screening => patch({screening})}/> : null}
      </div>
      <aside className="grid content-start gap-3 xl:sticky xl:top-4 xl:self-start">
        {has("vitals") ? <News2Panel news={news} invalid={invalid}/> : null}
        <ClinicalPanel title="Before you save">
          <ul className="space-y-1.5">
            {checklist.map(([label, done]) => <li key={label} className={cn("flex items-center gap-2", TEXT.body)}>
              {done ? <Check className="size-4 text-[var(--success)]" aria-hidden="true"/> : <span className="size-4 rounded-full border-2 border-[var(--border-strong)]" aria-hidden="true"/>}
              <span className={done ? undefined : "text-[var(--text-muted)]"}>{t(label)}<span className="sr-only">: {t(done ? "done" : "not done")}</span></span>
            </li>)}
          </ul>
        </ClinicalPanel>
      </aside>
    </div>
    <div className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-end gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-sm)]">
      <p className={cn("me-auto hidden sm:block", TEXT.muted)}>{t(profile.saveNote)}</p>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" size="lg" loading={saving} leftIcon={<Check className="size-4"/>} onClick={() => void save()}>{profile.saveLabel}</Button>
    </div>
  </div>;
}
