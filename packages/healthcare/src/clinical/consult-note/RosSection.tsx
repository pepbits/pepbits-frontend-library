"use client";
import React, {useId} from "react";
import {Badge, Button, Input, Segmented} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {ConsultSection} from "../layout/ConsultSection";
import {useConsultHost} from "../context/consult-host";
import {ROS_SYSTEMS, TRI_OPTIONS, type TriValue} from "../models/consult-note";
import type {ConsultSectionProps} from "../models/consult-workflow";
export function RosSection({draft, onChange, readOnly, id}: ConsultSectionProps) {
  const uid = useId(), {t} = useLocalization(), format = useFormatters(), host = useConsultHost();
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Review of systems" subtitle="Unasked questions stay unanswered. Only an answer you record is counted.">
    <div className="grid gap-3 lg:grid-cols-2">{ROS_SYSTEMS.map(s => {
      const answers = Object.values(draft.ros[s.id] ?? {}), positive = answers.filter(v => v === "present").length;
      return <section key={s.id} aria-label={t(s.label)} className="border border-[var(--border)] rounded-[var(--radius)] p-3">
        <h3>{t(s.label)}</h3><p>{format.number(answers.filter(v => v !== "not-asked").length)}/{format.number(s.symptoms.length)} {t("asked")}</p>
        {!!positive && <Badge tone="danger">{format.number(positive)} {t("positive")}</Badge>}
        <Button disabled={readOnly} variant="ghost" onClick={() => {if (!readOnly) onChange(n => {n.ros[s.id] = Object.fromEntries(s.symptoms.map(sym => [sym, n.ros[s.id]?.[sym] === "present" ? "present" : "absent"]));});}}>{t("Asked, all absent")}</Button>
        {s.symptoms.map(sym => <div key={sym} className="flex flex-wrap items-center justify-between gap-2 my-2"><span>{t(sym)}</span>
          <Segmented size="sm" label={sym} value={draft.ros[s.id]?.[sym] ?? ""} options={TRI_OPTIONS.map(o => ({...o, disabled: readOnly}))} onChange={value => {if (!readOnly) onChange(n => {n.ros[s.id] = {...n.ros[s.id], [sym]: value as TriValue};});}}/>
          <Button variant="ghost" disabled={readOnly || !draft.ros[s.id]?.[sym]} aria-label={`${t("Clear")} ${t(sym)}`} onClick={() => {if (!readOnly) onChange(n => {if (n.ros[s.id]) delete n.ros[s.id]![sym];});}}>{t("Clear")}</Button>
        </div>)}
        {!!positive && <Input label={`${t(s.label)}: ${t("Details of positive findings")}`} disabled={readOnly} value={draft.rosNotes[s.id] ?? ""} onChange={e => {if (!readOnly) onChange(n => {n.rosNotes[s.id] = e.target.value;});}}/>}
      </section>;
    })}</div>
  </ConsultSection>;
}
