"use client";
// Copied from the AllyVora clinical workspace (components/clinical/ReferralSource.tsx) at commit 1ede87f; see provenance.json.

import { Field, SelectField, Textarea, TextField } from "./ui";

/** Inbound referral source, matching the API's Referrals.source validation (HL7 FHIR request priorities). */
export interface ReferralSource {
  sourceType: "external-clinician" | "external-facility" | "insurer" | "community-service" | "self" | "other";
  referrerName: string; organisation: string; referrerIdentifier: string; contact: string; reference: string;
  referralDate: string; priority: "routine" | "urgent" | "asap" | "stat"; reason: string; letterReceived: boolean;
}

export const EMPTY_REFERRAL: ReferralSource = {
  sourceType: "external-clinician", referrerName: "", organisation: "", referrerIdentifier: "", contact: "", reference: "",
  referralDate: "", priority: "routine", reason: "", letterReceived: false,
};

export const SOURCE_LABELS: Record<ReferralSource["sourceType"], string> = {
  "external-clinician": "External clinician", "external-facility": "Other hospital or clinic", insurer: "Insurer or payer",
  "community-service": "Community or social service", self: "Self-referral", other: "Other",
};
export const PRIORITY_LABELS: Record<ReferralSource["priority"], string> = { routine: "Routine", urgent: "Urgent", asap: "As soon as possible", stat: "Immediate (stat)" };

export function referralProblems(r: ReferralSource): string[] {
  const out: string[] = [];
  if (r.referrerName.trim().length < 2) out.push("Enter who referred the patient.");
  if (!r.referralDate) out.push("Enter the referral date.");
  else if (r.referralDate > new Date().toISOString().slice(0, 10)) out.push("The referral date cannot be in the future.");
  if (r.reason.trim().length < 5) out.push("Enter the reason for referral.");
  return out;
}

export function ReferralSourceFields({ value, onChange }: { value: ReferralSource; onChange: (v: ReferralSource) => void }) {
  const set = <K extends keyof ReferralSource>(k: K, v: ReferralSource[K]) => onChange({ ...value, [k]: v });
  return (
    <fieldset className="grid gap-3 rounded-ctl border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="px-1 text-[12.5px] font-semibold text-ink-2">Referral source</legend>
      <SelectField label="Referred by" value={value.sourceType} onChange={(e) => set("sourceType", e.target.value as ReferralSource["sourceType"])}>
        {Object.entries(SOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      <TextField label="Referrer name" required value={value.referrerName} onChange={(e) => set("referrerName", e.target.value)} autoComplete="off" />
      <TextField label="Organisation" value={value.organisation} onChange={(e) => set("organisation", e.target.value)} autoComplete="off" />
      <TextField label="Referrer licence or registration no." value={value.referrerIdentifier} onChange={(e) => set("referrerIdentifier", e.target.value)} autoComplete="off" />
      <TextField label="Referrer contact" value={value.contact} onChange={(e) => set("contact", e.target.value)} hint="Phone or secure email for the reply" autoComplete="off" />
      <TextField label="Referral reference" value={value.reference} onChange={(e) => set("reference", e.target.value)} hint="The referrer's own number" autoComplete="off" />
      <TextField label="Referral date" required type="date" max={new Date().toISOString().slice(0, 10)} value={value.referralDate} onChange={(e) => set("referralDate", e.target.value)} />
      <SelectField label="Priority" value={value.priority} onChange={(e) => set("priority", e.target.value as ReferralSource["priority"])}>
        {Object.entries(PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      <Field label="Letter received">
        <label className="flex h-9 items-center gap-2 text-[13.5px]"><input type="checkbox" className="size-4 accent-[var(--c-lapis)]" checked={value.letterReceived} onChange={(e) => set("letterReceived", e.target.checked)} />Referral letter is on file</label>
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Reason for referral" required>
          <Textarea rows={2} value={value.reason} onChange={(e) => set("reason", e.target.value)} aria-label="Reason for referral" />
        </Field>
      </div>
    </fieldset>
  );
}
