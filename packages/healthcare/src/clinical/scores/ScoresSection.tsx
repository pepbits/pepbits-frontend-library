"use client";
import React, {useCallback, useId, useState} from "react";
import {Badge, Button, Select} from "@pepbits/ui";
import {ErrorState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultHost, useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ConsultSection} from "../layout/ConsultSection";
import {useClinicalResource} from "../history/PatientHistory";
import {PatientAssessmentsPanel} from "../assessments/PatientAssessmentsPanel";
import {DEFAULT_SCORES, SCORE_SUGGESTIONS} from "../models/consult-note";
import type {AssessmentRow, ConsultSectionProps} from "../models/consult-workflow";
import {ScoreCalculator} from "./ScoreCalculator";
export function ScoresSection({detail, draft, onChange, readOnly, id, onRecordsChanged, onAssessments}: ConsultSectionProps & {onAssessments?: (rows: AssessmentRow[]) => void}) {
  const uid = useId(), port = useConsultPort(), host = useConsultHost(), {t} = useLocalization(), format = useFormatters();
  const defs = useClinicalResource(useCallback(signal => port.listScoreDefinitions(signal), [port]));
  const [active, setActive] = useState(""), [history, setHistory] = useState(false);
  const suggested = [...new Set(draft.complaints.flatMap(c => SCORE_SUGGESTIONS[c.code] ?? []))];
  const order = [...new Set([...suggested, ...DEFAULT_SCORES])], def = defs.data?.find(d => d.id === active);
  const signed = detail.note?.status === "final" ? detail.note.assessments : undefined;
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Clinical scores and assessments" subtitle="Validated methods, calculated on the server from exact inputs. Optional unless your pathway requires one.">
    {!!defs.error && <ErrorState title="Could not load score definitions" description={problemsOf(defs.error).join(" ")} onRetry={defs.reload}/>}
    {!readOnly && <><div className="flex flex-wrap gap-2">{order.map(method => {const d = defs.data?.find(x => x.id === method); return d && <Button key={d.id} aria-pressed={active === d.id} onClick={() => setActive(active === d.id ? "" : d.id)}>{d.short}{suggested.includes(d.id) && ` · ${t("Suggested")}`}</Button>;})}</div>
      <Select label="Clinical score" value={active} options={[{value: "", label: "Choose a score"}, ...(defs.data ?? []).map(d => ({value: d.id, label: d.name}))]} onChange={e => setActive(e.target.value)}/>
      {def && <ScoreCalculator def={def} patientId={detail.patient.id} encounterId={detail.encounter.id} onSaved={async result => {if (!readOnly) onChange(n => {if (!n.scores.some(s => s.id === result.id)) n.scores.push({...result, methodId: def.id, label: def.short});}); setActive(""); await onRecordsChanged?.();}}/>}</>}
    {!draft.scores.length && <p>{t("No scores recorded.")}</p>}<ul>{draft.scores.map(s => <li key={s.id}>{s.label} · {s.total === null ? "—" : format.number(s.total)} {s.band && <Badge>{s.band}</Badge>}</li>)}</ul>
    <Button onClick={() => setHistory(!history)} aria-expanded={history}>{t(history ? "Hide score history" : "Score history")}</Button>
    {history && <ul>{detail.scores.map(s => <li key={s.id}>{defs.data?.find(d => d.id === s.methodId)?.short ?? s.methodId} · {s.total === null ? "—" : format.number(s.total)} · {s.band} · {format.dateTime(s.calculatedAt)}</li>)}</ul>}
    {signed && <section><h3>{t("Assessments signed with this note")}</h3>{!signed.length && <p>{t("No signed assessments at this visit.")}</p>}<ul>{signed.map(a => <li key={a.id}>{host.renderLink({kind: "assessment", assessmentId: a.id}, {children: a.label})} · {a.result} · {a.band} · {a.number} · {t("revision")} {format.number(a.revision)} · {a.signedByName}</li>)}</ul></section>}
    <PatientAssessmentsPanel patientId={detail.patient.id} encounterId={detail.encounter.id} visitOnly compact suggested={suggested} readOnly={readOnly} exclude={signed?.map(a => a.id)} title={signed ? "Added after signing" : "Assessments"} onRows={onAssessments} onRecordsChanged={onRecordsChanged}/>
  </ConsultSection>;
}
