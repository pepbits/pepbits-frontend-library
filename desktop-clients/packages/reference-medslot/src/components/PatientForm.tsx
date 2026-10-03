"use client";
import {LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useState } from "react";
import { Save } from "lucide-react";
import {useSourceApi, ApiError } from "../lib/api";
import type { Patient } from "../lib/types";
import { Button, Check, ErrorNote, Field, Input, Select } from "./ui";
import { useToast } from "./toast";

type F = Record<string, string | boolean>;

/** Full registration form. Saving with DOB, address and emergency contact completes a provisional record. */
export function PatientForm({ patient, onSaved }: { patient?: Patient; onSaved: (p: Patient) => void }) {
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const [f, setF] = useState<F>({
    first_name: patient?.first_name ?? "", last_name: patient?.last_name ?? "", phone: patient?.phone ?? "", email: patient?.email ?? "",
    dob: patient?.dob ?? "", sex: patient?.sex ?? "unknown", address: patient?.address ?? "", city: patient?.city ?? "", postal_code: patient?.postal_code ?? "",
    preferred_language: patient?.preferred_language ?? "English", insurance_provider: patient?.insurance_provider ?? "", insurance_member_id: patient?.insurance_member_id ?? "",
    emergency_contact_name: patient?.emergency_contact_name ?? "", emergency_contact_phone: patient?.emergency_contact_phone ?? "",
    sms_opt_in: patient?.sms_opt_in ?? true, email_opt_in: patient?.email_opt_in ?? true, whatsapp_opt_in: patient?.whatsapp_opt_in ?? false, consent: !!patient,
  });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const fe = err?.fields ?? {};
  const txt = (k: string, label: string, o: { req?: boolean; type?: string; hint?: string; ph?: string } = {}) => (
    <Field label={label} required={o.req} error={fe[k]} hint={o.hint}>
      <Input type={o.type ?? "text"} value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value)} invalid={!!fe[k]} placeholder={o.ph} />
    </Field>
  );

  const save = async () => {
    setBusy(true); setErr(null);
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v]));
    try {
      if (patient) {
        const r = await api<{ mrn: string; is_provisional: boolean }>(`/patients/${patient.id}`, { method: "PUT", json: body });
        toast.success(patient.is_provisional && !r.is_provisional ? "Registration completed" : "Patient saved", r.mrn);
        onSaved({ ...patient, ...(body as unknown as Patient), mrn: r.mrn, is_provisional: r.is_provisional });
      } else {
        const p = await api<Patient>("/patients?mode=full", { method: "POST", json: body });
        toast.success("Patient registered", p.mrn);
        onSaved(p);
      }
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      {err && !Object.keys(fe).length && <ErrorNote error={err} />}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold"><LocalizedText message="Identity" /></legend>
        {txt("first_name", "First name", { req: true })}
        {txt("last_name", "Last name", { req: true })}
        {txt("dob", "Date of birth", { type: "date", hint: patient?.is_provisional ? tr("Needed to complete registration") : undefined })}
        <Field label="Sex"><Select value={String(f.sex)} onChange={(e) => set("sex", e.target.value)}><option value="unknown"><LocalizedText message="Prefer not to say" /></option><option value="female"><LocalizedText message="Female" /></option><option value="male"><LocalizedText message="Male" /></option><option value="other"><LocalizedText message="Other" /></option></Select></Field>
        {txt("preferred_language", "Preferred language")}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold"><LocalizedText message="Contact" /></legend>
        {txt("phone", "Mobile number", { req: true, type: "tel" })}
        {txt("email", "Email", { type: "email" })}
        <div className="sm:col-span-2">{txt("address", "Address", { hint: patient?.is_provisional ? tr("Needed to complete registration") : undefined })}</div>
        {txt("city", "City")}
        {txt("postal_code", "Postal code")}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold"><LocalizedText message="Emergency contact and insurance" /></legend>
        {txt("emergency_contact_name", "Emergency contact name")}
        {txt("emergency_contact_phone", "Emergency contact phone", { type: "tel", hint: patient?.is_provisional ? tr("Needed to complete registration") : undefined })}
        {txt("insurance_provider", "Insurance provider")}
        {txt("insurance_member_id", "Policy or member number")}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold"><LocalizedText message="Messages and consent" /></legend>
        <div className="flex flex-wrap gap-5">
          <Check label="SMS" checked={!!f.sms_opt_in} onChange={(v) => set("sms_opt_in", v)} />
          <Check label="Email" checked={!!f.email_opt_in} onChange={(v) => set("email_opt_in", v)} />
          <Check label="WhatsApp" checked={!!f.whatsapp_opt_in} onChange={(v) => set("whatsapp_opt_in", v)} />
        </div>
        {!patient && <Check label="Patient consents to us storing their details" checked={!!f.consent} onChange={(v) => set("consent", v)} />}
      </fieldset>
      <div className="flex justify-end"><Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}>{patient ? (patient.is_provisional ? tr("Save and complete registration") : tr("Save changes")) : tr("Register patient")}</Button></div>
    </div>
  );
}
