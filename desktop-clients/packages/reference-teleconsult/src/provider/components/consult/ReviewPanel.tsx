"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { useState } from "react";
import { CheckCircle2, Circle, FileSignature, Sparkles } from "lucide-react";
import type { VisitMode } from "../../../shared/types";
import { useConsult, type TabKey } from "./context";
import { Button, Field, Input, Segmented, Select, Textarea, cx } from "../ui";
import { NoteView } from "../NoteView";

export function ReviewPanel({ onSign, signing, problems }: { onSign: (override?: string) => void; signing: boolean; problems: string[] }) {
  const { t } = useLocalization();
  const { enc, update, alerts, role, setTab, patient, locked, user } = useConsult();
  const [override, setOverride] = useState("");
  const critical = alerts.filter((a) => a.level === "critical" && a.source !== "vitals");
  // Sign-off belongs to the doctor. The page never renders this panel for a nurse; the guard keeps it that way.
  const isDoctor = role === "doctor";

  const checks: { ok: boolean; label: string; tab: TabKey; required: boolean }[] = [
    { ok: !!enc.triage.chiefComplaint, label: "Chief complaint recorded", tab: "triage", required: false },
    { ok: enc.vitals.length > 0, label: "Vitals captured", tab: "triage", required: false },
    { ok: enc.allergiesReviewed, label: "Allergies reviewed", tab: "allergies", required: true },
    { ok: !!(enc.soap.assessment.trim() && enc.soap.plan.trim()), label: "Assessment and plan written", tab: "notes", required: false },
    { ok: enc.diagnoses.some((d) => d.type === "primary"), label: "Primary diagnosis selected", tab: "diagnoses", required: true },
    { ok: critical.length === 0 || override.trim().length > 5, label: critical.length ? t("{value0} critical safety alert(s) resolved or overridden", { value0: critical.length }) : "No critical safety alerts", tab: "rx", required: true },
    { ok: !!enc.patientInstructions.trim(), label: "Instructions for the patient", tab: "review", required: false },
  ];
  const ready = checks.every((c) => !c.required || c.ok);

  const draftInstructions = () => {
    const lines: string[] = [];
    const primary = enc.diagnoses.find((d) => d.type === "primary");
    if (primary) lines.push(`Today we think you have: ${primary.display.toLowerCase().replace(/,\s*(site\s+)?(not specified|unspecified).*$/, "").replace(/\s*\(.*?\)/g, "")}.`);
    enc.prescriptions.forEach((p) => lines.push(`Take ${p.name} ${p.dose}, ${p.frequency.toLowerCase()}${p.prn ? " when needed" : ""} for ${p.durationDays} days.${p.instructions ? ` ${p.instructions}` : ""}`));
    const tests = enc.orders.filter((o) => o.kind === "lab" || o.kind === "imaging" || o.kind === "procedure");
    if (tests.length) lines.push(`Tests booked: ${tests.map((t) => t.name).join(", ")}. Your app shows where to go; results appear there too.`);
    const refs = enc.orders.filter((o) => o.kind === "referral");
    if (refs.some((r) => r.code === "REF-ED")) lines.push("Please go to the emergency department today. Do not drive yourself.");
    else if (refs.length) lines.push(`We have referred you to ${refs.map((r) => r.name).join(", ")}. They will contact you.`);
    enc.orders.filter((o) => o.kind === "nursing").forEach((o) => lines.push(`Our nurse will follow up: ${o.name.toLowerCase()}.`));
    if (patient.allergies.some((a) => a.status === "active" && a.severity === "severe")) lines.push(`Remember your allergy to ${patient.allergies.filter((a) => a.severity === "severe").map((a) => a.substance).join(", ")}. Tell every pharmacist.`);
    lines.push("Get urgent help if you feel much worse, are short of breath, have chest pain, or are confused.");
    if (enc.followUp) lines.push(`Your follow-up ${enc.followUp.mode} visit is in ${enc.followUp.inDays} days. It is already booked in your app.`);
    update((e) => ({ ...e, patientInstructions: lines.join("\n") }));
  };

  if (!isDoctor) return null;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <ul className="space-y-1">
          {checks.map((c) => (
            <li key={c.label}>
              <SourceButton onClick={() => setTab(c.tab)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-canvas">
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-vital-500" /> : <Circle className={cx("h-4 w-4", c.required ? "text-alarm-500" : "text-ink-200")} />}
                <span className={cx(c.ok ? "text-ink" : c.required ? "font-medium text-alarm-600" : "text-ink-600")}>{t(c.label)}</span>
                {!c.ok && !c.required && <span className="text-2xs text-ink-400"><LocalizedText message={"optional"} /></span>}
              </SourceButton>
            </li>
          ))}
        </ul>

        {critical.length > 0 && (
          <Field label="Reason for overriding critical alerts" hint={critical.map((c) => c.title).join(" · ")}>
            <Input value={override} disabled={locked} onChange={(e) => setOverride(e.target.value)} placeholder="e.g. Tolerated previously, benefit outweighs risk, patient counselled" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Follow-up">
            <Select
              disabled={locked}
              value={enc.followUp?.inDays ?? 0}
              onChange={(e) => {
                const d = Number(e.target.value);
                update((x) => ({ ...x, followUp: d ? { inDays: d, mode: x.followUp?.mode ?? "video", note: x.followUp?.note ?? "" } : null }));
              }}
            >
              <option value={0}>{t("None needed")}</option>
              <option value={2}>{t("In 2 days")}</option>
              <option value={7}>{t("In 1 week")}</option>
              <option value={14}>{t("In 2 weeks")}</option>
              <option value={30}>{t("In 1 month")}</option>
              <option value={90}>{t("In 3 months")}</option>
            </Select>
          </Field>
          <Field label="Fit note (days off work)">
            <Input disabled={locked} inputMode="numeric" value={enc.sickNoteDays || ""} onChange={(e) => update((x) => ({ ...x, sickNoteDays: Number(e.target.value.replace(/\D/g, "")) || 0 }))} placeholder="0" />
          </Field>
          {enc.followUp && (
            <>
              <Field label="Follow-up type">
                <Segmented size="sm" value={enc.followUp.mode} onChange={(m: VisitMode) => update((x) => ({ ...x, followUp: x.followUp && { ...x.followUp, mode: m } }))} options={[{ value: "video", label: "Video" }, { value: "audio", label: "Audio" }, { value: "chat", label: "Chat" }]} />
              </Field>
              <Field label="Follow-up reason">
                <Input disabled={locked} value={enc.followUp.note} onChange={(e) => update((x) => ({ ...x, followUp: x.followUp && { ...x.followUp, note: e.target.value } }))} placeholder="Review results" />
              </Field>
            </>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-700"><LocalizedText message={"Instructions sent to the patient app"} /></span>
            <Button size="sm" variant="ghost" disabled={locked} onClick={draftInstructions} icon={<Sparkles className="h-3.5 w-3.5 text-pulse-600" />}><LocalizedText message={"Write from this visit"} /></Button>
          </div>
          <Textarea rows={6} disabled={locked} value={enc.patientInstructions} onChange={(e) => update((x) => ({ ...x, patientInstructions: e.target.value }))} placeholder="Plain-language summary: what we found, what to do, when to get help" className="text-[13px]" />
        </div>

        {problems.length > 0 && (
          <ul className="rounded-md bg-alarm-50 p-2.5 text-sm text-alarm-600">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {!locked && (
          <Button variant="primary" className="h-11 w-full text-[15px]" disabled={!ready} loading={signing} onClick={() => onSign(override || undefined)} icon={<FileSignature className="h-4 w-4" />}>
            <LocalizedText message={"Sign and complete visit"} />
          </Button>
        )}
        {!locked && <p className="text-center text-2xs text-ink-400"><LocalizedText message="Signing locks the note as {value0}, records the orders and prescriptions, books the follow-up and publishes the summary to the demo patient app. Nothing is sent to a real pharmacy or laboratory." values={{ value0: user?.name ?? "" }} /></p>}
      </div>

      <div className="rounded-lg border border-line bg-canvas/50 p-4">
        <p className="mb-3 text-xs font-semibold text-ink-400"><LocalizedText message={"Note preview"} /></p>
        <NoteView enc={enc} signer={undefined} />
      </div>
    </div>
  );
}
