"use client";
import {AsyncLookup} from "@pepbits/ui";
import {SourceButton} from "@pepbits/ui";
import {LocalizedText,useLocalization} from "@pepbits/i18n/react";

import { useEffect, useState, useCallback } from "react";
import { Search, UserPlus, UserRound } from "@pepbits/icons";
import {useSourceApi, ApiError, qs } from "../../lib/api";
import { useDebounced } from "../../lib/hooks";
import {age,useMedslotFormat} from "../../lib/format";
import type { Patient } from "../../lib/types";
import { Badge, Button, Check, Field, Input, Segmented, Select, Spinner, cx , DateInput} from "../ui";
import { useToast } from "../toast";

export function PatientPicker({ onPick }: { onPick: (p: Patient, kind: "new" | "existing") => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  return (
    <div className="flex flex-col gap-4">
      <Segmented value={mode} onChange={setMode} options={[["existing", <><UserRound className="size-3.5" /><LocalizedText message="Existing patient" /></>], ["new", <><UserPlus className="size-3.5" /><LocalizedText message="New patient" /></>]]} />
      {mode === "existing" ? <ExistingSearch onPick={(p) => onPick(p, p.is_provisional ? "new" : "existing")} onNew={() => setMode("new")} />
        : <QuickRegister onDone={(p) => onPick(p, "new")} onUseExisting={(p) => onPick(p, "existing")} />}
    </div>
  );
}

function ExistingSearch({ onPick, onNew }: { onPick: (p: Patient) => void; onNew: () => void }) {
 const api=useSourceApi();
 const loadOptions=useCallback((q:string,signal:AbortSignal)=>api<Patient[]>(`/patients${qs({q,limit:8})}`,{signal}),[api]);
 return <div className="space-y-3"><AsyncLookup label="Search patients" placeholder="Name, MRN, phone or email" minChars={0} autoFocus
 loadOptions={loadOptions} getKey={p=>String(p.id)} onPick={onPick} renderOption={p=><span>{p.first_name} {p.last_name} · {p.mrn} · {p.phone_masked}</span>}/>
 <Button size="sm" variant="quiet" onClick={onNew}><LocalizedText message="Register as a new patient"/></Button></div>;
}

/** Minimum data for an unknown patient: name + phone + consent. The rest is completed at registration. */
function QuickRegister({ onDone, onUseExisting }: { onDone: (p: Patient) => void; onUseExisting: (p: Patient) => void }) {
  const api = useSourceApi();
  const toast = useToast();
  const [f, setF] = useState({ first_name: "", last_name: "", phone: "", dob: "", sex: "unknown", email: "", sms_opt_in: true, email_opt_in: true, whatsapp_opt_in: false, consent: false });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const dup = err?.status === 409 ? (err.details?.duplicate as Patient | undefined) : undefined;

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const p = await api<Patient>("/patients", { method: "POST", json: { ...f, dob: f.dob || null, email: f.email || null, consent: f.consent || undefined } });
      toast.success("Patient registered", `${p.first_name} ${p.last_name} (${p.mrn})`);
      onDone(p);
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const fe = err?.fields ?? {};
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-mute"><LocalizedText message="Only name, phone and consent are needed now. The front desk can complete registration at check-in." /></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" required error={fe.first_name}><Input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} invalid={!!fe.first_name} data-autofocus /></Field>
        <Field label="Last name" required error={fe.last_name}><Input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} invalid={!!fe.last_name} /></Field>
        <Field label="Mobile number" required error={fe.phone} hint="Used for SMS and WhatsApp updates"><Input type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" invalid={!!fe.phone} /></Field>
        <Field label="Email" error={fe.email}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} invalid={!!fe.email} /></Field>
        <Field label="Date of birth" error={fe.dob}><DateInput  value={f.dob} onChange={(e) => set("dob", e.target.value)} max={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Sex"><Select value={f.sex} onChange={(e) => set("sex", e.target.value)}>
          <option value="unknown"><LocalizedText message="Prefer not to say" /></option><option value="female"><LocalizedText message="Female" /></option><option value="male"><LocalizedText message="Male" /></option><option value="other"><LocalizedText message="Other" /></option></Select></Field>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-paper px-3 py-2.5">
        <span className="w-full text-xs font-medium text-mute"><LocalizedText message="Patient agrees to receive" /></span>
        <Check label="SMS" checked={f.sms_opt_in} onChange={(v) => set("sms_opt_in", v)} />
        <Check label="Email" checked={f.email_opt_in} onChange={(v) => set("email_opt_in", v)} disabled={!f.email} />
        <Check label="WhatsApp" checked={f.whatsapp_opt_in} onChange={(v) => set("whatsapp_opt_in", v)} />
      </div>
      <div className={cx("rounded-lg border px-3 py-2.5", fe.consent ? "border-triage/50 bg-triage-soft/40" : "border-line")}>
        <Check checked={f.consent} onChange={(v) => set("consent", v)} label="Patient consents to us storing their details for scheduling"
          description="Required. Covered by the hospital's privacy notice." />
        {fe.consent && <p className="mt-1 text-xs text-triage">{fe.consent}</p>}
      </div>
      {err && !Object.keys(fe).length && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-soft px-3 py-2.5 text-sm text-amber">
          <span className="flex-1">{err.message}</span>
          {dup && <Button size="sm" variant="secondary" onClick={async () => onUseExisting(await api<Patient>(`/patients/${dup.id}`))}><LocalizedText message="Use existing record" /></Button>}
        </div>
      )}
      <div><Button variant="primary" loading={busy} onClick={submit} icon={<UserPlus className="size-4" />}><LocalizedText message="Register and continue" /></Button></div>
    </div>
  );
}
