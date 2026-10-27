"use client";
import React, {useState} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {AlertTriangle, Check, CircleHelp, Plus} from "@pepbits/icons";
import {Badge, Button, Input, Segmented, Select, cn} from "@pepbits/ui";
import {useClinicalPort} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import type {AllergyReviewOutcome} from "../forms/intake-model";
import {ClinicalPanel, TEXT} from "../layout/panel";
import {CodedSearch} from "../complaint/CodedSearch";
import {useRelativeTime} from "../time";
import type {Allergy, AllergyBlock} from "../types";

/** Active allergies as chips; unconfirmed ones are dashed. Shows NKA, unknown or not assessed when there are none. */
export function AllergyStrip({allergies, compact}: {allergies: AllergyBlock; compact?: boolean}) {
  const {t} = useLocalization();
  const relative = useRelativeTime();
  const active = allergies.entries.filter(a => a.clinicalStatus === "active" && a.verification !== "refuted");
  const state = allergies.assessment.state;
  if (!active.length) {
    if (state === "nka") return <Badge tone="success"><Check className="size-3"/>{t("No known allergies")}{!compact && allergies.assessment.at ? ` · ${relative(allergies.assessment.at)}` : ""}</Badge>;
    return <Badge tone="warning"><CircleHelp className="size-3"/>{t(state === "unknown" ? "Allergies unknown" : "Allergies not assessed")}</Badge>;
  }
  return <span className="inline-flex flex-wrap items-center gap-1">
    {active.map(a => <span key={a.id} title={`${a.reaction ?? t("Reaction not recorded")} · ${a.verification}`}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-px text-[length:calc(11px*var(--fs-scale))] font-bold leading-5",
        a.verification === "confirmed" ? "bg-[var(--danger-fill)] text-white" : "border border-dashed border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] text-[var(--danger-ink)]")}>
      <AlertTriangle className="size-3"/>{a.substance}{a.verification !== "confirmed" ? <span className="font-normal opacity-80">· {t("unconfirmed")}</span> : null}
    </span>)}
  </span>;
}

/** Each recorded allergy with category, reaction, criticality and verification. */
export function AllergyList({entries}: {entries: Allergy[]}) {
  const {t} = useLocalization();
  if (!entries.length) return null;
  return <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
    {entries.map(a => <li key={a.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2", TEXT.body)}>
      <span><b>{a.substance}</b> <span className="text-[var(--text-muted)]">· {a.category} · {a.reaction ?? t("reaction not recorded")}</span></span>
      <span className="flex gap-1">{a.criticality === "high" ? <Badge tone="danger">High criticality</Badge> : null}<Badge tone={a.verification === "confirmed" ? "success" : "warning"}>{a.verification}</Badge></span>
    </li>)}
  </ul>;
}

/**
 * The review outcome: "Reviewed, no change" when allergies are listed, otherwise "No known allergies";
 * "Unable to confirm" always; "Updated" once an allergy was added in this review.
 */
export function AllergyReviewChoice({hasEntries, value, onChange}: {hasEntries: boolean; value: AllergyReviewOutcome | null; onChange: (value: AllergyReviewOutcome) => void}) {
  const options = [
    ...(hasEntries ? [{value: "reviewed-no-change", label: "Reviewed, no change"}] : [{value: "nka", label: "No known allergies"}]),
    {value: "unknown", label: "Unable to confirm"},
    ...(value === "updated" ? [{value: "updated", label: "Updated"}] : []),
  ];
  return <Segmented label="Allergy review outcome" value={value ?? ""} onChange={x => onChange(x as AllergyReviewOutcome)} options={options}/>;
}

/**
 * Allergy review with the patient: the current list, the review outcome and adding a new allergy
 * (recorded as unconfirmed for the doctor to verify). Adding one sets the outcome to "updated".
 */
export function AllergyReviewSection({patientId, allergies, onAllergies, outcome, onOutcome, onAdded}: {
  patientId: string; allergies: AllergyBlock; onAllergies: (block: AllergyBlock) => void;
  outcome: AllergyReviewOutcome | null; onOutcome: (outcome: AllergyReviewOutcome) => void; onAdded?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return <ClinicalPanel title="Allergies" icon={<AlertTriangle className="size-4"/>} subtitle="Ask the patient. Reviewing an unchanged list records a review, not a new allergy.">
    <div className="mb-3"><AllergyStrip allergies={allergies}/></div>
    {allergies.entries.length ? <div className="mb-3"><AllergyList entries={allergies.entries}/></div> : null}
    <div className="flex flex-wrap items-center gap-2">
      <AllergyReviewChoice hasEntries={allergies.entries.length > 0} value={outcome} onChange={onOutcome}/>
      <Button size="sm" variant="ghost" leftIcon={<Plus className="size-4"/>} onClick={() => setAdding(true)}>Add allergy</Button>
    </div>
    {adding ? <AddAllergyForm patientId={patientId} onCancel={() => setAdding(false)}
      onDone={block => { onAllergies(block); onOutcome("updated"); setAdding(false); onAdded?.(); }}/> : null}
  </ClinicalPanel>;
}

/** Adds an allergy through the data port as unconfirmed. */
export function AddAllergyForm({patientId, onDone, onCancel}: {patientId: string; onDone: (block: AllergyBlock) => void; onCancel: () => void}) {
  const {t} = useLocalization();
  const port = useClinicalPort();
  const [form, setForm] = useState({substance: "", allergenCode: "", category: "medication", reaction: "", criticality: ""});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      onDone(await port.addAllergy(patientId, {substance: form.substance, allergenCode: form.allergenCode || undefined, category: form.category, reaction: form.reaction || undefined, criticality: form.criticality || undefined}));
    } catch (e) { setError(problemsOf(e).join(" ")); } finally { setBusy(false); }
  };
  return <div className="mt-3 grid gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:grid-cols-3">
    <div className="grid gap-2 sm:col-span-3">
      <CodedSearch catalog="allergens" label="Find allergen" placeholder="Search medicines, brands, drug classes, foods and other allergens"
        renderMeta={item => `${String(item.meta?.kind ?? "")}${item.meta?.source ? ` · ${String(item.meta.source)}` : ` · ${t("curated list")}`}`}
        onPick={item => setForm({...form, substance: item.display, allergenCode: item.code, category: String(item.meta?.category ?? "medication")})}/>
      <Input label="Substance" required value={form.substance} onChange={e => setForm({...form, substance: e.target.value, allergenCode: ""})} placeholder="Pick from the list, or type if it isn't listed"/>
      {form.substance.trim() && !form.allergenCode && form.category === "medication" ? <p className={cn(TEXT.muted, "text-[var(--warning-ink)]")}>{t("Not picked from the catalogue. It is recorded as free text and matched by name, which may miss it. Pick a catalogue entry where one exists.")}</p> : null}
    </div>
    <Select label="Category" placeholder="" value={form.category} onChange={e => setForm({...form, category: e.target.value})} options={[{value: "medication", label: "Medicine"}, {value: "food", label: "Food"}, {value: "environment", label: "Environment"}]}/>
    <Input label="Reaction" value={form.reaction} onChange={e => setForm({...form, reaction: e.target.value})} placeholder="e.g. Hives"/>
    <Select label="Severity concern" value={form.criticality} onChange={e => setForm({...form, criticality: e.target.value})} placeholder="Not assessed" options={[{value: "low", label: "Low"}, {value: "high", label: "High"}, {value: "unable-to-assess", label: "Unable to assess"}]}/>
    {error ? <p role="alert" className={cn("sm:col-span-3", TEXT.body, "text-[var(--danger-ink)]")}>{error}</p> : null}
    <div className="flex justify-end gap-2 sm:col-span-3">
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" loading={busy} disabled={!form.substance.trim()} onClick={() => void save()}>Add as unconfirmed</Button>
    </div>
  </div>;
}
