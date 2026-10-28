"use client";
import {useRecordScopeKey} from "../consult-records/record-state";
import React, {useCallback, useState} from "react";
import {Button, Input, Select, Textarea} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useConsultPort} from "../context/consult-host";
import {CodedSearch} from "../complaint/CodedSearch";
import {ProblemNotice} from "../layout/panel";
import {RecordLoadError, useRecordMutation, useRecordResource} from "../consult-records/record-state";
import type {Allergy, AllergyBlock} from "../types";
import type {AllergenPick, AllergyDraft, AllergyMasterData, AllergyPatch, DetailedNewAllergy, MasterEntry} from "../models/consult-records";

export const isActiveAllergy = (a: Allergy) => (a.clinicalStatus || "active") === "active" && !["refuted", "entered-in-error"].includes(a.verification);
export const draftOf = (a?: Allergy): AllergyDraft => ({items: [], group: a?.group || a?.category || "medication", substance: a?.substance ?? "", allergenCode: a?.allergenCode ?? "", type: a?.type || "unknown", reactions: a?.reactions ?? [], reactionOther: a?.reactionOther ?? (a?.reactions?.length ? "" : a?.reaction ?? ""), severity: a?.severity ?? "", criticality: a?.criticality ?? "", onset: a?.onset ?? "", informant: a?.informant ?? "", route: a?.route ?? "", note: a?.note ?? "", clinicalStatus: a?.clinicalStatus ?? "active", verification: a?.verification ?? "unconfirmed"});
const bodyOf = (f: AllergyDraft): DetailedNewAllergy => ({group: f.group, substance: f.substance.trim(), allergenCode: f.allergenCode || undefined, type: f.type, reactions: f.reactions, reactionOther: f.reactionOther.trim(), severity: f.severity, criticality: f.criticality, onset: f.onset.trim(), informant: f.informant, route: f.route, note: f.note.trim()});
const sameAllergen = (a: AllergenPick, b: {substance: string; allergenCode?: string}) => a.allergenCode ? a.allergenCode === b.allergenCode : a.substance.trim().toLowerCase() === b.substance.trim().toLowerCase();
export function useAllergyMasters() {
  const port = useConsultPort();
  return useRecordResource(useCallback((signal: AbortSignal) => port.loadAllergyMasters(signal), [port]));
}

export function AllergyFields({value: f, onChange, masters, existing = [], editing, multiple = false, disabled = false, onExisting}: {
  value: AllergyDraft; onChange: (value: AllergyDraft) => void; masters: AllergyMasterData; existing?: Allergy[]; editing?: Allergy; multiple?: boolean; disabled?: boolean; onExisting?: (allergy: Allergy) => void;
}) {
  const {t} = useLocalization();
  const [found, setFound] = useState<Allergy>();
  const set = <K extends keyof AllergyDraft>(key: K, value: AllergyDraft[K]) => onChange({...f, [key]: value});
  const options = (rows: MasterEntry[], selected = "") => rows.filter(r => r.status !== "retired" || r.code === selected).map(r => ({value: r.code, label: r.display}));
  const serious = masters.reactions.some(r => r.serious && f.reactions.includes(r.code));
  const unknown = masters.reactions.some(r => r.exclusive && f.reactions.includes(r.code));
  const pick = (item: AllergenPick) => {
    if (disabled) return;
    const duplicate = existing.find(a => a.id !== editing?.id && sameAllergen(item, a));
    if (duplicate) {setFound(duplicate); return;}
    setFound(undefined);
    onChange(multiple ? {...f, items: f.items.some(a => sameAllergen(item, a)) ? f.items : [...f.items, item], substance: "", allergenCode: ""} : {...f, ...item});
  };
  return <fieldset disabled={disabled} className="grid gap-3">
    <Select label="Allergen category" value={f.group} options={options(masters.categories, f.group)} onChange={e => onChange({...f, group: e.target.value, ...(f.allergenCode ? {substance: "", allergenCode: ""} : {})})}/>
    <CodedSearch disabled={disabled} disabledCodes={multiple ? f.items.map(item => item.allergenCode).filter(Boolean) : []} key={f.group} catalog="allergens" category={f.group} label="Find allergen" onPick={item => pick({substance: item.display, allergenCode: item.code, group: String(item.meta?.group ?? f.group)})}/>
    {found ? <div role="status"><p>{found.substance} · {t("Already recorded. Edit or reactivate this entry.")}</p>{onExisting ? <Button variant="ghost" onClick={() => onExisting(found)}>{isActiveAllergy(found) ? "Edit it" : "Reactivate it"}</Button> : null}</div> : null}
    <Input label="Allergen" aria-label="Allergen" value={f.substance} required={!f.items.length} onChange={e => onChange({...f, substance: e.target.value, allergenCode: ""})}/>
    {f.substance.trim() && !f.allergenCode && f.group === "medication" ? <p className="text-[var(--warning-ink)]">{t("Not picked from the list. It is recorded as free text and matched by name, which may miss it in prescribing checks. Pick a list entry where one exists.")}</p> : null}
    {multiple ? <><Button variant="secondary" disabled={f.substance.trim().length < 2} onClick={() => pick({substance: f.substance.trim(), allergenCode: f.allergenCode, group: f.group})}>Add allergen to batch</Button>
      <ul>{f.items.map((item, i) => <li key={`${item.allergenCode}:${item.substance}`}>{item.substance} <Button variant="ghost" aria-label={t("Remove {name}", {name: item.substance})} onClick={() => set("items", f.items.filter((_, j) => j !== i))}>Remove</Button></li>)}</ul></> : null}
    <Select label="Allergy or intolerance" value={f.type} options={options(masters.fixed.type, f.type)} onChange={e => set("type", e.target.value)}/>
    <div role="group" aria-label={t("Reactions")} className="flex flex-wrap gap-2">{masters.reactions.filter(r => r.status !== "retired" || f.reactions.includes(r.code)).map(r => <Button key={r.code} variant="secondary" aria-pressed={f.reactions.includes(r.code)} onClick={() => {
      const reactions = f.reactions.includes(r.code) ? f.reactions.filter(x => x !== r.code) : r.exclusive ? [r.code] : [...f.reactions.filter(x => !masters.reactions.find(m => m.code === x)?.exclusive), r.code];
      onChange({...f, reactions, reactionOther: r.exclusive && reactions.includes(r.code) ? "" : f.reactionOther, criticality: masters.reactions.some(m => m.serious && reactions.includes(m.code)) ? "high" : f.criticality});
    }}>{r.display}</Button>)}</div>
    <Input label="Other reaction or description" disabled={unknown} value={f.reactionOther} maxLength={200} onChange={e => set("reactionOther", e.target.value)}/>
    <Select label="Severity of the past reaction" value={f.severity} options={options(masters.fixed.severity, f.severity)} onChange={e => set("severity", e.target.value)}/>
    <Select label="Future risk" value={serious ? "high" : f.criticality} disabled={serious} options={options(masters.fixed.criticality, f.criticality)} onChange={e => set("criticality", e.target.value)}/>
    {serious ? <p>{t("A serious reaction means a high risk if exposed again.")}</p> : null}
    <Input label="When it started" maxLength={60} value={f.onset} onChange={e => set("onset", e.target.value)}/>
    <Select label="Reported by" value={f.informant} options={options(masters.informants, f.informant)} onChange={e => set("informant", e.target.value)}/>
    <Select label="How exposed" value={f.route} options={options(masters.routes, f.route)} onChange={e => set("route", e.target.value)}/>
    <Textarea label="Clinical note" maxLength={500} value={f.note} onChange={e => set("note", e.target.value)}/>
  </fieldset>;
}

export interface AllergyFormProps {patientId: string; existing?: Allergy[]; onDone: (block: AllergyBlock) => void | Promise<void>; onCancel: () => void; readOnly?: boolean; onExisting?: (allergy: Allergy) => void}
function AllergyFormBody({patientId, existing = [], onDone, onCancel, onExisting, readOnly = false, reaction}: AllergyFormProps & {reaction?: {id: string; version: number; substance: string; reaction: string}}) {
  const port = useConsultPort(), masters = useAllergyMasters();
  const [form, setForm] = useState<AllergyDraft>(() => ({...draftOf(), substance: reaction?.substance ?? "", reactionOther: reaction?.reaction ?? ""}));
  const mutation = useRecordMutation(patientId, readOnly);
  const picks = [...form.items, ...(form.substance.trim().length >= 2 ? [{substance: form.substance.trim(), allergenCode: form.allergenCode, group: form.group}] : [])].filter((p, i, all) => all.findIndex(other => sameAllergen(p, other)) === i);
  const save = () => {
    if (!picks.length || !masters.data) return;
    if (picks.some(p => existing.some(a => sameAllergen(p, a)))) {mutation.setProblems(["This allergen is already recorded. Edit or reactivate its existing entry."]); return;}
    const f = masters.data.reactions.some(r => r.serious && form.reactions.includes(r.code)) ? {...form, criticality: "high"} : form;
    void mutation.run(() => {
      if (picks.length > 1) {
        const {substance: _s, allergenCode: _c, group: _g, ...shared} = bodyOf(f);
        return port.addAllergies(patientId, {...shared, items: picks});
      }
      return port.addAllergy(patientId, {...bodyOf({...f, ...picks[0]!}), ...(reaction ? {reactionId: reaction.id, reactionVersion: reaction.version} : {})});
    }, onDone);
  };
  return <div className="grid gap-3"><RecordLoadError {...masters}/>
    {masters.data ? <AllergyFields value={form} onChange={setForm} masters={masters.data} existing={existing} multiple={!reaction} onExisting={onExisting} disabled={readOnly || mutation.busy}/> : null}
    <ProblemNotice problems={mutation.problems}/><div className="flex gap-2"><Button variant="ghost" disabled={mutation.busy} onClick={onCancel}>Cancel</Button><Button loading={mutation.busy} disabled={readOnly || !masters.data || !picks.length} onClick={save}>{picks.length > 1 ? "Add allergies as unconfirmed" : "Add as unconfirmed"}</Button></div>
  </div>;
}

function EditAllergyBody({patientId, allergy, existing = [], onDone, onCancel, readOnly = false}: AllergyFormProps & {allergy: Allergy}) {
  const port = useConsultPort(), masters = useAllergyMasters();
  const [baseline] = useState(allergy);
  const [form, setForm] = useState(() => draftOf(allergy)), [reason, setReason] = useState("");
  const mutation = useRecordMutation(`${patientId}:${allergy.id}`, readOnly);
  const start = bodyOf(draftOf(baseline)), body = bodyOf(masters.data?.reactions.some(r => r.serious && form.reactions.includes(r.code)) ? {...form, criticality: "high"} : form);
  const changed = (Object.keys(body) as (keyof DetailedNewAllergy)[]).filter(k => JSON.stringify(start[k]) !== JSON.stringify(body[k]));
  const save = () => {
    if (!changed.length || reason.trim().length < 5) return;
    const patch: AllergyPatch = {version: baseline.version ?? 1, reason};
    Object.assign(patch, Object.fromEntries(changed.map(k => [k, body[k] ?? ""])));
    if (changed.includes("substance") || changed.includes("allergenCode")) Object.assign(patch, {substance: body.substance, allergenCode: form.allergenCode});
    if (changed.includes("reactions") || changed.includes("reactionOther")) Object.assign(patch, {reactions: form.reactions, reactionOther: body.reactionOther});
    void mutation.run(() => port.updateAllergy(patientId, allergy.id, patch), onDone);
  };
  return <div className="grid gap-3"><RecordLoadError {...masters}/>{masters.data ? <AllergyFields value={form} onChange={setForm} masters={masters.data} existing={existing} editing={allergy} disabled={readOnly || mutation.busy}/> : null}
    <Input label="Reason" aria-label="Reason" required value={reason} maxLength={500} disabled={readOnly || mutation.busy} onChange={e => setReason(e.target.value)}/><ProblemNotice problems={mutation.problems}/>
    <div className="flex gap-2"><Button variant="ghost" disabled={mutation.busy} onClick={onCancel}>Cancel</Button><Button loading={mutation.busy} disabled={readOnly || !changed.length || reason.trim().length < 5} onClick={save}>Save changes</Button></div>
  </div>;
}

export function AllergyForm(props: React.ComponentProps<typeof AllergyFormBody>) {
  return <AllergyFormBody key={useRecordScopeKey(props.patientId)} {...props}/>;
}

export function EditAllergy(props: React.ComponentProps<typeof EditAllergyBody>) {
  return <EditAllergyBody key={useRecordScopeKey(`${props.patientId}:${props.allergy.id}`)} {...props}/>;
}
