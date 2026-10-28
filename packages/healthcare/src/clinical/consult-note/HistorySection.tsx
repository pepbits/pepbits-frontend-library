"use client";
import React, {useId, useState} from "react";
import {Button, Input, Segmented, Select} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useClinicalActor} from "../context/clinical-context";
import {useConsultHost} from "../context/consult-host";
import {SurgicalHistory} from "../history/PatientHistory";
import {ConsultSection} from "../layout/ConsultSection";
import {LIVING, type Living, type NoteContent} from "../models/consult-note";
import type {ConsultSectionProps} from "../models/consult-workflow";
const occupations = ["Office or professional", "Healthcare worker", "Teacher or education", "Driver or transport", "Construction or manual work", "Factory or industrial", "Agriculture or farming", "Retail or hospitality", "Security, police or military", "Domestic worker", "Self-employed or business", "Student", "Homemaker", "Unemployed", "Retired"];
export function HistorySection(props: ConsultSectionProps) {
  const {detail, draft, onChange, readOnly, id, onRecordsChanged} = props;
  const uid = useId(), {t} = useLocalization(), format = useFormatters(), {can} = useClinicalActor(), host = useConsultHost();
  const [other, setOther] = useState(false), typing = other || (!!draft.history.occupation && !occupations.includes(draft.history.occupation));
  const meds = detail.medications.filter(m => m.status !== "stopped");
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Past history" subtitle="Pregnancy, past procedures, and social and family history.">
    <p>{meds.length ? `${t("Current medicines")}: ${meds.map(m => m.display).join(" · ")}` : t("No current medicines recorded.")}</p>
    {detail.patient.sex === "female" && <div>{host.renderScreening ? host.renderScreening(props) : <p>{t("Pregnancy review is unavailable in this host.")}</p>}</div>}
    <SurgicalHistory patientId={detail.patient.id} canAdd={!readOnly && (can("vitals.write") || can("note.write"))} canEdit={!readOnly && can("note.write")} onRecordsChanged={onRecordsChanged}/>
    <p>{t("Saved to the record on signing")}{detail.socialHistory?.updatedAt ? ` · ${format.dateTime(detail.socialHistory.updatedAt)}` : ""}</p>
    <div className="grid gap-3 mt-3">{([['smoking', 'Smoking', ['never', 'former', 'current', 'unknown']], ['alcohol', 'Alcohol', ['none', 'occasional', 'regular', 'unknown']]] as const).map(([key, label, values]) => <div key={key}>
      <p>{t(label)}</p><Segmented label={label} value={draft.history[key] ?? ""} options={values.map(value => ({value, label: value[0]!.toUpperCase() + value.slice(1), disabled: readOnly}))}
        onChange={value => {if (!readOnly) onChange(n => {if (key === "smoking") n.history.smoking = value as NoteContent["history"]["smoking"]; else n.history.alcohol = value as NoteContent["history"]["alcohol"];});}}/>
      <Button variant="ghost" disabled={readOnly} aria-label={`${t("Clear")} ${t(label)}`} onClick={() => {if (!readOnly) onChange(n => {n.history[key] = null;});}}>{t("Clear")}</Button>
    </div>)}
      <Select label="Occupation" disabled={readOnly} value={typing ? "__other" : draft.history.occupation} options={[{value: "", label: "Not asked"}, ...occupations.map(value => ({value, label: value})), {value: "__other", label: "Other (type it)"}]}
        onChange={e => {if (!readOnly) {setOther(e.target.value === "__other"); onChange(n => {n.history.occupation = e.target.value === "__other" ? "" : e.target.value;});}}}/>
      {typing && <Input label="Occupation, other" maxLength={120} disabled={readOnly} value={draft.history.occupation} onChange={e => {if (!readOnly) onChange(n => {n.history.occupation = e.target.value;});}}/>}
      <Select label="Living situation" disabled={readOnly} value={draft.history.living ?? ""} options={[{value: "", label: "Not asked"}, ...LIVING]} onChange={e => {if (!readOnly) onChange(n => {n.history.living = e.target.value as Living || null;});}}/>
      <Input label="Relevant family history" disabled={readOnly} value={draft.history.family} onChange={e => {if (!readOnly) onChange(n => {n.history.family = e.target.value;});}}/>
    </div>
  </ConsultSection>;
}
