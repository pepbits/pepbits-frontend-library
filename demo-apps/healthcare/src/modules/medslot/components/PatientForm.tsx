"use client";
import type {TemplateSection} from "@pepbits/data/dcp-designer";
import {Input as FormInput} from "@pepbits/ui";
import {TemplateFields} from "@pepbits/patterns/form-designer";
import {LocalizedText,useLocalization} from "@pepbits/i18n/react";

import { useState } from "react";
import { Save } from "@pepbits/icons";
import {useSourceApi, ApiError } from "../lib/api";
import type { Patient } from "../lib/types";
import { Button, Check, ErrorNote } from "./ui";
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
  const sections:TemplateSection[] = [
    {id:'identity',title:'Identity',fields:[
      {id:'first_name',label:'First name',type:'text',required:true},
      {id:'last_name',label:'Last name',type:'text',required:true},
      {id:'dob',label:'Date of birth',type:'date'},
      {id:'sex',label:'Sex',type:'select',options:[{value:'unknown',label:'Prefer not to say'},{value:'female',label:'Female'},{value:'male',label:'Male'},{value:'other',label:'Other'}]},
      {id:'preferred_language',label:'Preferred language',type:'text'},
    ]},
    {id:'contact',title:'Contact',fields:[
      {id:'phone',label:'Mobile number',type:'text',required:true},{id:'email',label:'Email',type:'email'},
      {id:'address',label:'Address',type:'text'},{id:'city',label:'City',type:'text'},{id:'postal_code',label:'Postal code',type:'text'},
    ]},
    {id:'emergency',title:'Emergency contact and insurance',fields:[
      {id:'emergency_contact_name',label:'Emergency contact name',type:'text'},
      {id:'emergency_contact_phone',label:'Emergency contact phone',type:'text'},
      {id:'insurance_provider',label:'Insurance provider',type:'text'},
      {id:'insurance_member_id',label:'Policy or member number',type:'text'},
    ]},
  ];
  const fieldStates=Object.fromEntries(['dob','address','emergency_contact_phone'].map(id=>[id,{hint:patient?.is_provisional?tr('Needed to complete registration'):undefined}]));

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
      {sections.map(section=><TemplateFields key={section.id} section={section} values={f} errors={fe} fieldStates={fieldStates} onChange={(id,value)=>set(id,String(value))} renderField={field=>field.id==='phone'||field.id==='emergency_contact_phone'?<FormInput label={field.label} aria-label={tr(field.label)} type="tel" required={field.required} value={String(f[field.id]??'')} error={fe[field.id]} hint={fieldStates[field.id]?.hint} onChange={event=>set(field.id,event.target.value)}/>:undefined}/>)}
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
