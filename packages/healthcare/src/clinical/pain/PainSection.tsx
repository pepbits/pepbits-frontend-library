"use client";
import {useRecordScopeKey} from "../consult-records/record-state";
import React, {useCallback, useEffect, useState} from "react";
import {Badge, Button, Input, Select, Segmented, Textarea} from "@pepbits/ui";
import {Sparkline} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters, useScreenHost} from "@pepbits/patterns/screen-host";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {useClinicalActor} from "../context/clinical-context";
import {ConsultSection} from "../layout/ConsultSection";
import {ProblemNotice} from "../layout/panel";
import {encounterClosed, RecordLoadError, useRecordMutation, useRecordResource} from "../consult-records/record-state";
import type {ConsultSectionProps} from "../models/consult-workflow";
import type {PainAssessmentInput, PainInput, PainScale, PainSite, PainSuggestion} from "../models/consult-records";
import {BodyMapPicker} from "./BodyMap";
import {bandFor, painErrors, painPayload, painTotal, painSitesOf, siteLabel} from "./model";

const FACES = ["😀", "🙂", "😐", "🙁", "😣", "😭"];
const FACE_LABELS = ["No hurt", "Hurts a little bit", "Hurts a little more", "Hurts even more", "Hurts a whole lot", "Hurts worst"];
export function PainScoreFields({scales, value, onChange, suggested, readOnly = false}: {
  scales: PainScale[]; value: PainInput; onChange: (value: PainInput) => void; suggested?: PainSuggestion; readOnly?: boolean;
}) {
  const {t} = useLocalization(), format = useFormatters(), scale = scales.find(s => s.id === value.scale), total = painTotal(scale, value);
  const choose = (id: string) => {if (!readOnly) onChange({scale: id, items: {}});};
  return <fieldset disabled={readOnly} className="grid gap-3"><Select label="Pain scale" value={value.scale} options={scales.map(s => ({value: s.id, label: s.name}))} onChange={e => choose(e.target.value)}/>
    {suggested ? <p>{t("Suggested scale")}: {suggested.scale} · {suggested.reason} {suggested.basis?.join(" · ")}{suggested.scale !== value.scale ? <Button variant="ghost" onClick={() => choose(suggested.scale)}>Use suggested scale</Button> : null}</p> : null}
    {scale ? <><p>{scale.use}</p>{scale.items.length ? scale.items.map(item => <Segmented key={item.key} label={item.label} value={value.items[item.key] == null ? "" : String(value.items[item.key])} options={item.options.map(o => ({value: String(o.score), label: o.label, disabled: readOnly}))} onChange={next => onChange({...value, items: {...value.items, [item.key]: Number(next)}})}/>) : <div role="radiogroup" aria-label={t(scale.name)} className="flex flex-wrap gap-2">{scale.choices.map((score, i) => <Button key={score} role="radio" aria-checked={value.score === score} variant="secondary" onClick={() => onChange({...value, score})}>{scale.id === "faces" ? <><span aria-hidden="true">{FACES[i]}</span> {t(FACE_LABELS[i] ?? "Pain")} </> : null}{format.number(score)}</Button>)}</div>}
      <Button variant="ghost" onClick={() => onChange({scale: value.scale, items: {}})}>Clear score</Button>
      {total != null ? <p>{t("Total")}: {format.number(total)}/{format.number(scale.max)} <Badge tone={bandFor(scale, total) === "severe" ? "danger" : bandFor(scale, total) === "moderate" ? "warning" : "neutral"}>{t(bandFor(scale, total))}</Badge></p> : null}</> : null}
  </fieldset>;
}

function PainAssessmentFormBody({encounterId, patientId, suggested, readOnly = false, onSaved, onCancel}: {
  encounterId: string; patientId?: string; suggested?: PainSuggestion; readOnly?: boolean; onSaved: () => void | Promise<void>; onCancel?: () => void;
}) {
  const port = useConsultPort(), {t} = useLocalization(), {notify} = useScreenHost();
  const resource = useRecordResource(useCallback(async (signal: AbortSignal) => {
    const [scales, codes, maps] = await Promise.all([port.listPainScales(signal), port.loadCodesets(signal), port.loadPainMaps({patientId, encounterId}, signal)]);
    return {scales, codes, maps};
  }, [port, patientId, encounterId]));
  const [input, setInput] = useState<PainInput>({scale: suggested?.scale ?? "nrs", items: {}}), [sites, setSites] = useState<PainSite[]>([]), [goal, setGoal] = useState("");
  const [details, setDetails] = useState<NonNullable<PainAssessmentInput["details"]>>({character: [], onset: "", started: "", duration: "", pattern: "", aggravatingFactors: [], relievingFactors: [], aggravating: "", relieving: "", function: "", sleep: "", note: ""});
  useEffect(() => {if (suggested?.scale) setInput(previous => previous.score === undefined && !Object.keys(previous.items).length ? {scale: suggested.scale, items: {}} : previous);}, [suggested?.scale]);
  const [mapOpen, setMapOpen] = useState(false), [detailsOpen, setDetailsOpen] = useState(false);
  const mutation = useRecordMutation(`${patientId}:${encounterId}`, readOnly), scale = resource.data?.scales.find(s => s.id === input.scale);
  const set = <K extends keyof typeof details>(key: K, value: typeof details[K]) => setDetails({...details, [key]: value});
  const save = () => {
    const errors = painErrors(scale, input, sites, goal); mutation.setProblems(errors); if (errors.length || !scale) return;
    void mutation.run(() => port.recordPain(encounterId, painPayload(input, scale, sites, details, goal)), async result => {
      notify(result.alert ? t("Saved. {alert}; the doctor has been notified.", {alert: result.alert}) : t("Pain assessment saved."), {tone: result.alert ? "warning" : "success"}); await onSaved();
    });
  };
  const select = (key: "onset" | "duration" | "pattern" | "function" | "sleep", label: string, options: {value: string; label: string}[]) => <Select label={label} value={details[key] ?? ""} options={options} onChange={e => set(key, e.target.value)}/>;
  const levels = ["none", "mild", "moderate", "severe"].map(value => ({value, label: value}));
  return <div className="grid gap-3"><RecordLoadError {...resource}/>
    {resource.data ? <fieldset disabled={readOnly || mutation.busy} className="grid gap-3">
      <PainScoreFields scales={resource.data.scales} value={input} onChange={next => {setInput(next); if (next.scale !== input.scale) {setSites(sites.map(s => ({...s, score: null}))); setGoal("");}}} suggested={suggested} readOnly={readOnly || mutation.busy}/>
      <div className="flex gap-2"><Button variant="ghost" onClick={() => setMapOpen(v => !v)}>{mapOpen ? "Hide body map" : "Where is the pain?"}</Button><Button variant="ghost" onClick={() => setDetailsOpen(v => !v)}>{detailsOpen ? "Hide pain details and goal" : "Add pain details and goal"}</Button></div>
      {mapOpen ? <BodyMapPicker maps={resource.data.maps} codes={resource.data.codes} sites={sites} readOnly={readOnly || mutation.busy} onChange={next => {setSites(next); const worst = Math.max(-1, ...next.map(s => s.score ?? -1)); if (scale && !scale.items.length && next.length > 1 && worst >= 0 && input.score === undefined) setInput({...input, score: worst});}} scoreChoices={scale && !scale.items.length && sites.length > 1 ? scale.choices : undefined} scoreMax={scale?.max ?? 10}/> : null}
      {detailsOpen ? <div className="grid gap-3 sm:grid-cols-2">
        <div role="group" aria-label={t("Overall character")}>{(resource.data.codes["pain-character"] ?? []).map(c => <Button key={c.code} variant="ghost" aria-pressed={details.character?.includes(c.code)} onClick={() => set("character", details.character?.includes(c.code) ? details.character.filter(x => x !== c.code) : (details.character?.length ?? 0) < 5 ? [...details.character ?? [], c.code] : details.character)}>{c.display}</Button>)}</div>
        {select("onset", "Onset", [{value: "sudden", label: "Sudden"}, {value: "gradual", label: "Gradual"}])}
        <Input label="Started" value={details.started ?? ""} onChange={e => set("started", e.target.value)}/>
        {select("duration", "Duration", [{value: "acute", label: "Acute (under 3 months)"}, {value: "chronic", label: "Chronic (3 months or more)"}])}
        {select("pattern", "Pattern", (resource.data.codes["pain-pattern"] ?? []).map(c => ({value: c.code, label: c.display})))}
        {(["aggravatingFactors", "relievingFactors"] as const).map(key => <div key={key} role="group" aria-label={t(key === "aggravatingFactors" ? "Worse with" : "Better with")}>{resource.data!.codes["pain-factor"]?.filter(c => c.body?.type === (key === "aggravatingFactors" ? "AGGRAVATING" : "RELIEVING")).map(c => <Button key={c.code} variant="ghost" aria-pressed={details[key]?.includes(c.code)} onClick={() => set(key, details[key]?.includes(c.code) ? details[key]!.filter(x => x !== c.code) : [...details[key] ?? [], c.code])}>{c.display}</Button>)}</div>)}
        <Input label="Other: worse with" value={details.aggravating ?? ""} onChange={e => set("aggravating", e.target.value)}/><Input label="Other: better with" value={details.relieving ?? ""} onChange={e => set("relieving", e.target.value)}/>
        {select("function", "Effect on activity", levels)}{select("sleep", "Effect on sleep", levels)}
        <Input label="Acceptable pain goal" type="number" min={scale?.min} max={scale?.max} value={goal} onChange={e => setGoal(e.target.value)}/><Textarea label="Pain notes" value={details.note ?? ""} onChange={e => set("note", e.target.value)}/>
      </div> : null}
    </fieldset> : !resource.problems.length ? <p>{t("Loading pain assessment…")}</p> : null}
    <ProblemNotice problems={mutation.problems}/><div className="flex gap-2">{onCancel ? <Button variant="ghost" disabled={mutation.busy} onClick={onCancel}>Cancel</Button> : null}<Button loading={mutation.busy} disabled={readOnly || !resource.data} onClick={save}>Save pain assessment</Button></div>
  </div>;
}

export function PainSection(props: ConsultSectionProps) {return <PainSectionBody key={useRecordScopeKey(`${props.detail.patient.id}:${props.detail.encounter.id}`)} {...props}/>;}
function PainSectionBody({detail, readOnly, onRecordsChanged, id}: ConsultSectionProps) {
  const port = useConsultPort(), host = useConsultHost(), {can} = useClinicalActor(), {t} = useLocalization(), format = useFormatters();
  const resource = useRecordResource(useCallback((signal: AbortSignal) => port.loadPainHistory(detail.patient.id, detail.encounter.id, signal), [port, detail.patient.id, detail.encounter.id]));
  const codes = useRecordResource(useCallback((signal: AbortSignal) => port.loadCodesets(signal), [port]));
  const [adding, setAdding] = useState(false);
  const canRecord = !readOnly && !encounterClosed(detail.encounter.status) && (can("vitals.write") || can("note.write"));
  const data = resource.data;
  return <ConsultSection stickyOffset={host.stickyOffset} id={id ?? "pain"} title="Pain" subtitle="Score pain with the scale suggested for this patient, and record where and how it hurts."><RecordLoadError {...resource}/><RecordLoadError {...codes}/>
    {data ? <div className="grid gap-3">
      {!data.assessments.length ? <p>{t("No pain assessments yet.")}</p> : <><Sparkline values={[...data.assessments].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)).slice(-30).map(a => a.normalised)}/><ul>{data.assessments.map(a => <li key={a.id}>{format.number(a.value)}/{format.number(a.max)} · {a.scaleName} · {t(a.band)} · {format.dateTime(a.effectiveAt)} · {a.authorName}{a.goal == null ? "" : ` · ${t("Goal")} ${format.number(a.goal)}`}<ul>{painSitesOf(a.details).map((site, i) => <li key={i}>{t(siteLabel(codes.data ?? null, site))}{site.score == null ? "" : ` · ${format.number(site.score)}`}</li>)}</ul>{typeof a.details?.note === "string" && a.details.note ? <p>{a.details.note}</p> : null}</li>)}</ul></>}
      {data.reassessments.filter(r => r.encounterId === detail.encounter.id).map(r => <p key={r.administrationId} className={r.overdue ? "text-[var(--danger-ink)]" : "text-[var(--warning-ink)]"}>{t("Reassess pain after")} {r.medicine}: {t(r.overdue ? "Overdue" : "Due")} {format.dateTime(r.dueAt)} · {host.renderLink({kind: "mar", encounterId: r.encounterId}, {children: t("Record in Medication administration")})}</p>)}
      {data.analgesia.length ? <details><summary>{t("Painkiller doses")}</summary><ul>{data.analgesia.map(a => <li key={a.id}>{a.medicine} · {a.dose} · {format.dateTime(a.at)} · {a.frequency}</li>)}</ul></details> : null}
      {canRecord ? adding ? <PainAssessmentForm encounterId={detail.encounter.id} patientId={detail.patient.id} suggested={data.suggested} onCancel={() => setAdding(false)} onSaved={async () => {setAdding(false); resource.retry(); await onRecordsChanged?.();}}/> : <Button onClick={() => setAdding(true)}>Assess pain</Button> : null}
    </div> : !resource.problems.length ? <p>{t("Loading pain history…")}</p> : null}
  </ConsultSection>;
}

export function PainAssessmentForm(props: React.ComponentProps<typeof PainAssessmentFormBody>) {
  return <PainAssessmentFormBody key={useRecordScopeKey(`${props.patientId}:${props.encounterId}`)} {...props}/>;
}
