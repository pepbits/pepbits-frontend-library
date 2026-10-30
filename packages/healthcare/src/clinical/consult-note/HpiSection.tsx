"use client";
import React, {useId} from "react";
import {Button, Input, Textarea} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {ConsultSection} from "../layout/ConsultSection";
import {useConsultHost} from "../context/consult-host";
import type {ConsultSectionProps} from "../models/consult-workflow";
const fields = [["onset", "Onset"], ["character", "Character"], ["location", "Location and radiation"], ["timing", "Timing and pattern"], ["aggravating", "Made worse by"], ["relieving", "Eased by"]] as const;
const narratives = [["narrative", "Narrative"], ["context", "Relevant context (exposure, travel, injury)"], ["concerns", "Patient’s concerns and expectations"]] as const;
export function HpiSection({draft, onChange, readOnly, id}: ConsultSectionProps) {
  const uid = useId(), {t} = useLocalization(), format = useFormatters(), host = useConsultHost();
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="History of present illness" subtitle="Structured where it helps, narrative where it matters. Not every field is needed for every complaint.">
    <div className="grid gap-3 md:grid-cols-3">{fields.map(([key, label]) => <Input key={key} label={label} disabled={readOnly} value={draft.hpi[key]} onChange={e => {if (!readOnly) onChange(n => {n.hpi[key] = e.target.value;});}}/>)}</div>
    <p className="mt-3">{t("Severity (patient-rated, 0–10)")}</p><div className="flex flex-wrap gap-1">{Array.from({length: 11}, (_, value) => <Button key={value} disabled={readOnly} aria-pressed={draft.hpi.severity === value} onClick={() => {if (!readOnly) onChange(n => {n.hpi.severity = n.hpi.severity === value ? null : value;});}}>{format.number(value)}</Button>)}</div>
    <div className="grid gap-3 mt-3">{narratives.map(([key, label]) => <Textarea key={key} label={label} rows={key === "narrative" ? 5 : 2} disabled={readOnly} value={draft.hpi[key]} onChange={e => {if (!readOnly) onChange(n => {n.hpi[key] = e.target.value;});}}/>)}</div>
  </ConsultSection>;
}
