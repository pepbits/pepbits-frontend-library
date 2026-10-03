"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { Sparkles } from "lucide-react";
import type { Soap } from "../../../shared/types";
import { useConsult } from "./context";
import { Button, Select, Textarea } from "../ui";

const LABELS: { key: keyof Soap; title: string; hint: string }[] = [
  { key: "subjective", title: "Subjective", hint: "History in the patient’s words" },
  { key: "objective", title: "Objective", hint: "Video observation, remote vitals, results" },
  { key: "assessment", title: "Assessment", hint: "Clinical impression and differentials" },
  { key: "plan", title: "Plan", hint: "Treatment, investigations, safety-netting, follow-up" },
];

export function NotesPanel({ onScribe, scribing }: { onScribe: () => void; scribing: boolean }) {
  const { t } = useLocalization();
  const { enc, update, catalog, patient, locked } = useConsult();
  const setSoap = (k: keyof Soap, val: string) => update((e) => ({ ...e, soap: { ...e.soap, [k]: val } }));
  const append = (k: keyof Soap, text: string) =>
    update((e) => ({ ...e, soap: { ...e.soap, [k]: `${e.soap[k]}${e.soap[k] && !e.soap[k].endsWith("\n") ? "\n" : ""}${text}` } }));

  const applyTemplate = (id: string) => {
    const t = catalog.templates.find((x) => x.id === id);
    if (!t) return;
    update((e) => ({
      ...e,
      soap: {
        subjective: e.soap.subjective ? `${e.soap.subjective}\n${t.soap.subjective}` : t.soap.subjective,
        objective: e.soap.objective || t.soap.objective,
        assessment: e.soap.assessment || t.soap.assessment,
        plan: e.soap.plan || t.soap.plan,
      },
    }));
  };

  const latest = enc.vitals[enc.vitals.length - 1];
  const inserts: { label: string; run: () => void; disabled?: boolean }[] = [
    {
      label: "Latest vitals → O",
      disabled: !latest,
      run: () => latest && append("objective", `Vitals (${latest.source}): ${[latest.hr && `HR ${latest.hr}`, latest.sys && `BP ${latest.sys}/${latest.dia}`, latest.spo2 && `SpO2 ${latest.spo2}%`, latest.rr && `RR ${latest.rr}`, latest.temp && `T ${latest.temp} °C`].filter(Boolean).join(", ")}.`),
    },
    { label: "Medications → S", run: () => append("subjective", `Current medications: ${patient.medications.filter((m) => m.status === "active").map((m) => `${m.name} ${m.frequency.toLowerCase()}`).join("; ") || "none"}.`) },
    { label: "Allergies → S", run: () => append("subjective", `Allergies: ${patient.allergies.filter((a) => a.status === "active").map((a) => `${a.substance} (${a.reaction})`).join(", ") || "no known allergies"}.`) },
    { label: "Triage note → S", disabled: !enc.triage.nurseNote, run: () => append("subjective", `Nurse triage: ${enc.triage.nurseNote}`) },
    { label: "Diagnoses → A", disabled: !enc.diagnoses.length, run: () => append("assessment", enc.diagnoses.map((d) => `${d.display} (${d.code})${d.certainty === "provisional" ? ", provisional" : ""}`).join("; ")) },
    { label: "Safety-net → P", run: () => append("plan", "Safety-netting: seek urgent care if worsening, breathless, chest pain, confusion, or not improving in 48 h. Patient understood and agreed.") },
    { label: "Remote limits → O", run: () => append("objective", "Examination limited to video observation and patient-operated devices; no auscultation or palpation.") },
  ];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-auto" value="" disabled={locked} onChange={(e) => applyTemplate(e.target.value)} aria-label="Apply template">
          <option value="">{t("Apply a template…")}</option>
          {catalog.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Button variant="quiet" loading={scribing} disabled={locked} onClick={onScribe} icon={<Sparkles className="h-4 w-4 text-pulse-600" />}>
          
          <LocalizedText message={"Draft from conversation"} />
        </Button>
        <span className="text-2xs text-ink-400">{enc.transcript.length ? t("{value0} transcript lines available", { value0: enc.transcript.length }) : t("Uses triage and check-in when nothing is recorded")}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {inserts.map((i) => (
          <SourceButton key={i.label} onClick={i.run} disabled={i.disabled || locked} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-700 hover:border-pulse-500 hover:text-pulse-700 disabled:opacity-40">
            {i.label}
          </SourceButton>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 md:grid-rows-2">
        {LABELS.map(({ key, title, hint }) => (
          <label key={key} className="flex min-h-[150px] flex-col">
            <span className="mb-1 flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-ink">{t(title)}</span>
              <span className="text-2xs text-ink-400">{t(hint)}</span>
            </span>
            <Textarea value={enc.soap[key]} disabled={locked} onChange={(e) => setSoap(key, e.target.value)} className="flex-1 text-[13px]" />
          </label>
        ))}
      </div>
    </div>
  );
}
