"use client";
import React, {useId} from "react";
import {Badge, Button, Checkbox, Segmented, Textarea} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {CodedSearch} from "../complaint/CodedSearch";
import {ConsultSection} from "../layout/ConsultSection";
import {useConsultHost} from "../context/consult-host";
import type {ConsultSectionProps} from "../models/consult-workflow";
import type {Dx} from "../models/consult-note";
export function AssessmentSection({draft, onChange, readOnly, id}: ConsultSectionProps) {
  const uid = useId(), {t} = useLocalization(), host = useConsultHost();
  return <ConsultSection id={id ?? uid} stickyOffset={host.stickyOffset} title="Assessment and diagnoses" subtitle="Clinical concept in SNOMED CT; the ICD-10-CM claim code is kept separately.">
    <Textarea label="Clinical assessment" rows={3} disabled={readOnly} value={draft.assessment} onChange={e => {if (!readOnly) onChange(n => {n.assessment = e.target.value;});}}/>
    {!readOnly && <CodedSearch catalog="diagnoses" label="Add diagnosis" disabledCodes={draft.diagnoses.map(x => x.code)} renderMeta={it => `ICD-10-CM ${String(it.meta?.icd10cm ?? "—")}`}
      onPick={it => {if (!readOnly) onChange(n => {if (!n.diagnoses.some(x => x.code === it.code)) n.diagnoses.push({code: it.code, display: it.display, icd10: String(it.meta?.icd10cm ?? ""), primary: !n.diagnoses.length, verification: "provisional"});});}}/>}
    {!draft.diagnoses.length && <p>{t("No diagnosis yet.")} {t("Add at least one, with a primary, to sign.")}</p>}
    <ol className="grid gap-3 mt-3">{draft.diagnoses.map((dx, i) => <li key={dx.code} className="border border-[var(--border)] p-3 rounded-[var(--radius)]">
      <strong>{dx.display}</strong> {dx.primary && <Badge tone="brand">{t("Primary")}</Badge>}<p>SNOMED {dx.code} · ICD-10-CM {dx.icd10 || "—"}</p>
      <Button variant="ghost" disabled={readOnly} onClick={() => {if (!readOnly) onChange(n => n.diagnoses.forEach((x, j) => {x.primary = j === i;}));}}>{t(dx.primary ? "Primary diagnosis" : "Make primary")}</Button>
      <Segmented label={`${t("Verification")}: ${dx.display}`} value={dx.verification} options={["provisional", "differential", "confirmed"].map(value => ({value, label: value[0]!.toUpperCase() + value.slice(1), disabled: readOnly}))}
        onChange={value => {if (!readOnly) onChange(n => {n.diagnoses[i]!.verification = value as Dx["verification"];});}}/>
      <Checkbox label="Problem list" disabled={readOnly || dx.verification === "differential"} checked={!!dx.addToProblems && dx.verification !== "differential"}
        onChange={e => {if (!readOnly && dx.verification !== "differential") onChange(n => {n.diagnoses[i]!.addToProblems = e.target.checked;});}}/>
      <Button variant="ghost" disabled={readOnly} aria-label={`${t("Remove")} ${dx.display}`} onClick={() => {if (!readOnly) onChange(n => {n.diagnoses.splice(i, 1); if (n.diagnoses.length && !n.diagnoses.some(x => x.primary)) n.diagnoses[0]!.primary = true;});}}>{t("Remove")}</Button>
    </li>)}</ol>
  </ConsultSection>;
}
