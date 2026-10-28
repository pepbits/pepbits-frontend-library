"use client";
import {useRecordScopeKey} from "../consult-records/record-state";
import React, {useState} from "react";
import {Badge, Button, Input, Select} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import {useRecordMutation} from "../consult-records/record-state";
import {RecordHistory} from "../allergy/AllergyHistory";
import type {ReproductiveStatus} from "../types";
import type {ReproductiveStatusUpdate} from "../models/consult-records";

export const PREGNANCY_LABELS = {pregnant: "Pregnant", possibly: "May be pregnant", "not-pregnant": "Not pregnant", unknown: "Unknown"};
export const FEEDING_LABELS = {yes: "Breastfeeding", no: "Not breastfeeding", unknown: "Unknown"};
function PregnancyStatusBody({patientId, encounterId, status, canWrite, clinician, onChanged}: {
  patientId: string; encounterId: string; status?: ReproductiveStatus; canWrite: boolean; clinician: boolean; onChanged?: () => void | Promise<void>;
}) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters();
  const s = status ?? {version: 0};
  const start = {pregnancy: s.pregnancy ?? "", breastfeeding: s.breastfeeding ?? "", lmp: s.lmp ?? "", edd: s.edd ?? "", note: s.note ?? ""};
  const [baseline, setBaseline] = useState({fields: start, version: s.version, verification: s.verification});
  const [editing, setEditing] = useState(false), [form, setForm] = useState(start), [reason, setReason] = useState("");
  const mutation = useRecordMutation(patientId, !canWrite);
  const changed = (Object.keys(start) as (keyof typeof start)[]).filter(k => form[k] !== baseline.fields[k]);
  const confirmedChange = baseline.verification === "confirmed" && (changed.includes("pregnancy") || changed.includes("breastfeeding"));
  const save = (confirm = false) => {
    if (!confirm && confirmedChange && reason.trim().length < 5) return;
    const input: ReproductiveStatusUpdate = {version: confirm ? s.version : baseline.version, encounterId};
    if (!confirm) {
      input.reason = reason;
      for (const key of changed) if (form[key] || !["pregnancy", "breastfeeding"].includes(key)) Object.assign(input, {[key]: form[key]});
    }
    void mutation.run(() => port.updateReproductiveStatus(patientId, input), async () => {setEditing(false); setReason(""); await onChanged?.();});
  };
  return <ClinicalPanel title="Pregnancy and breastfeeding">
    {s.version ? <div className="grid gap-2"><p>{t(s.pregnancy ? PREGNANCY_LABELS[s.pregnancy] : "Pregnancy not recorded")} · {s.breastfeeding ? t(FEEDING_LABELS[s.breastfeeding]) : ""} <Badge tone={s.verification === "confirmed" ? "success" : "warning"}>{s.verification ?? "unconfirmed"}</Badge></p>
      <p>{s.lmp ? `${t("Last period")} ${format.date(s.lmp)} · ` : ""}{s.edd ? `${t("Due")} ${format.date(s.edd)} · ` : ""}{s.recordedByName} {s.recordedAt ? format.dateTime(s.recordedAt) : ""} · {s.note}</p>
      <details><summary>{t("Status history")}</summary><RecordHistory changes={s.history}/></details>
      {canWrite && clinician && s.verification === "unconfirmed" && !editing ? <Button loading={mutation.busy} onClick={() => save(true)}>Confirm as recorded</Button> : null}
    </div> : <p>{t("Not recorded. Prescribing and imaging checks treat pregnancy as unknown.")}</p>}
    {canWrite ? editing ? <fieldset disabled={mutation.busy} className="grid gap-3 sm:grid-cols-2">
      <Select label="Pregnancy" value={form.pregnancy} options={Object.entries(PREGNANCY_LABELS).map(([value, label]) => ({value, label}))} onChange={e => setForm({...form, pregnancy: e.target.value})}/>
      <Select label="Breastfeeding" value={form.breastfeeding} options={Object.entries(FEEDING_LABELS).map(([value, label]) => ({value, label}))} onChange={e => setForm({...form, breastfeeding: e.target.value})}/>
      <Input label="First day of last period" type="date" value={form.lmp} onChange={e => setForm({...form, lmp: e.target.value})}/><Input label="Estimated due date" type="date" value={form.edd} onChange={e => setForm({...form, edd: e.target.value})}/>
      <Input label="Note" maxLength={300} value={form.note} onChange={e => setForm({...form, note: e.target.value})}/><Input label="Reason" aria-label="Reason" required={confirmedChange} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/>
      {!clinician ? <p>{t("Your entry is saved as unconfirmed until a clinician confirms it.")}</p> : null}
      <div className="flex gap-2"><Button variant="ghost" onClick={() => {setEditing(false); setForm(start); setReason("");}}>Cancel</Button><Button disabled={(!changed.length && !(clinician && s.verification !== "confirmed")) || (confirmedChange && reason.trim().length < 5)} onClick={() => save()}>Save</Button></div>
    </fieldset> : <Button variant="ghost" disabled={mutation.busy} onClick={() => {setBaseline({fields: start, version: s.version, verification: s.verification}); setForm(start); setReason(""); setEditing(true);}}>{s.version ? "Update" : "Record"}</Button> : null}
    <ProblemNotice problems={mutation.problems}/>
  </ClinicalPanel>;
}

export function PregnancyStatus(props: React.ComponentProps<typeof PregnancyStatusBody>) {
  return <PregnancyStatusBody key={useRecordScopeKey(`${props.patientId}:${props.encounterId}`)} {...props}/>;
}
