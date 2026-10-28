"use client";
import React, {useId} from "react";
import {Button, Input, Select} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {CodedSearch} from "../complaint/CodedSearch";
import {ConsultSection} from "../layout/ConsultSection";
import {useConsultHost} from "../context/consult-host";
import type {ConsultSectionProps} from "../models/consult-workflow";

export function ComplaintSection({detail, draft, onChange, readOnly, id}: ConsultSectionProps) {
  const uid = useId(), {t} = useLocalization(), host = useConsultHost();
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Presenting complaint"
    subtitle={detail.encounter.reason ? `${t("Recorded at intake:")} ${detail.encounter.reason}` : undefined}>
    {!readOnly && <CodedSearch catalog="complaints" label="Add complaint" placeholder="Add a complaint (SNOMED CT)" disabledCodes={draft.complaints.map(c => c.code)}
      onPick={item => {if (!readOnly) onChange(n => {if (!n.complaints.some(c => c.code === item.code)) n.complaints.push({code: item.code, display: item.display, primary: !n.complaints.length});});}}/>}
    {!draft.complaints.length && <p>{t("No complaint added yet.")}</p>}
    <ul className="grid gap-3 mt-3">{draft.complaints.map((c, i) => <li key={c.code} className="grid gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3 md:grid-cols-4">
      <div><strong>{c.display}</strong><Button variant="ghost" disabled={readOnly} aria-pressed={c.primary} onClick={() => {if (!readOnly) onChange(n => n.complaints.forEach((x, j) => {x.primary = j === i;}));}}>{t(c.primary ? "Primary complaint" : "Make primary")}</Button></div>
      <Input label="Patient’s words" disabled={readOnly} value={c.patientWords ?? ""} onChange={e => {if (!readOnly) onChange(n => {n.complaints[i]!.patientWords = e.target.value;});}}/>
      <div className="flex gap-2"><Input label="Duration value" type="number" min={0} disabled={readOnly} value={c.duration?.value ?? ""}
        onChange={e => {if (!readOnly) onChange(n => {n.complaints[i]!.duration = e.target.value === "" ? undefined : {value: Number(e.target.value), unit: c.duration?.unit ?? "day"};});}}/>
        <Select label="Duration unit" disabled={readOnly} value={c.duration?.unit ?? "day"} options={["hour", "day", "week", "month", "year"].map(value => ({value, label: `${value}s`}))}
          onChange={e => {if (!readOnly) onChange(n => {n.complaints[i]!.duration = {value: c.duration?.value ?? 0, unit: e.target.value};});}}/></div>
      <Button variant="ghost" disabled={readOnly} aria-label={`${t("Remove")} ${c.display}`} onClick={() => {if (!readOnly) onChange(n => {n.complaints.splice(i, 1); if (n.complaints.length && !n.complaints.some(x => x.primary)) n.complaints[0]!.primary = true;});}}>{t("Remove")}</Button>
    </li>)}</ul>
  </ConsultSection>;
}
