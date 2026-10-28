"use client";
import {useRecordScopeKey} from "../consult-records/record-state";
import React, {useState} from "react";
import {Button, Input, Select} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useConsultPort} from "../context/consult-host";
import {ProblemNotice} from "../layout/panel";
import {RecordLoadError, useRecordMutation} from "../consult-records/record-state";
import type {Allergy, AllergyBlock} from "../types";
import type {AllergyAction, AllergyPatch} from "../models/consult-records";
import {isActiveAllergy, useAllergyMasters} from "./AllergyForm";

export const ALLERGY_ACTION_LABELS: Record<AllergyAction, string> = {edit: "Edit details", inactive: "Mark inactive", resolved: "Mark resolved", refuted: "Refute", "entered-in-error": "Entered in error", reactivate: "Reactivate"};
export const allergyActions = (a: Allergy): AllergyAction[] => a.verification === "entered-in-error" ? [] : isActiveAllergy(a) ? ["edit", "inactive", "resolved", "refuted", "entered-in-error"] : ["reactivate", "edit", "entered-in-error"];
const EXPLANATION = {
  inactive: "No longer considered current, without proof it has resolved. It leaves the list and prescribing checks and can be reactivated.",
  resolved: "The patient is no longer allergic, with evidence. No symptoms lately is not enough: they may simply be avoiding it.",
  refuted: "Assessment shows the suspected allergy was never present. It stays in the history as refuted.",
  "entered-in-error": "Recorded by mistake: wrong patient, wrong allergen or a duplicate. It is removed from the list and kept only in the audit history.",
  reactivate: "Back on the active list and in prescribing checks, with its earlier history kept.",
};
export function AllergyActions({allergy, onPick, readOnly = false}: {allergy: Allergy; onPick: (action: AllergyAction) => void; readOnly?: boolean}) {
  return <div className="flex flex-wrap gap-2">{allergyActions(allergy).map(action => <Button key={action} size="sm" variant="ghost" disabled={readOnly} onClick={() => onPick(action)}>{ALLERGY_ACTION_LABELS[action]}</Button>)}</div>;
}
function AllergyStatusChangeBody({patientId, allergy, action, onDone, onCancel, readOnly = false}: {
  patientId: string; allergy: Allergy; action: Exclude<AllergyAction, "edit">; onDone: (block: AllergyBlock) => void | Promise<void>; onCancel: () => void; readOnly?: boolean;
}) {
  const port = useConsultPort(), {t} = useLocalization(), masters = useAllergyMasters();
  const [baseline] = useState(allergy);
  const [reason, setReason] = useState(""), [resolution, setResolution] = useState("");
  const mutation = useRecordMutation(`${patientId}:${allergy.id}`, readOnly);
  const save = () => {
    if (reason.trim().length < 5 || (action === "resolved" && !resolution)) return;
    const change: Partial<AllergyPatch> = action === "inactive" ? {clinicalStatus: "inactive"} : action === "resolved" ? {clinicalStatus: "resolved", resolution} : action === "refuted" || action === "entered-in-error" ? {verification: action} : {...(baseline.clinicalStatus !== "active" ? {clinicalStatus: "active"} : {}), ...(baseline.verification === "refuted" ? {verification: "unconfirmed"} : {})};
    void mutation.run(() => port.updateAllergy(patientId, allergy.id, {...change, version: baseline.version ?? 1, reason}), onDone);
  };
  return <div className="grid gap-3"><p><b>{t(ALLERGY_ACTION_LABELS[action])}: {allergy.substance}</b></p><p>{t(EXPLANATION[action])}</p>
    {action === "resolved" ? <><RecordLoadError {...masters}/><Select label="How was resolution established?" aria-label="How was resolution established?" required value={resolution} disabled={readOnly || mutation.busy} options={(masters.data?.fixed.resolution ?? []).map(r => ({value: r.code, label: r.display}))} onChange={e => setResolution(e.target.value)}/></> : null}
    <Input label="Reason" aria-label="Reason" required maxLength={500} value={reason} disabled={readOnly || mutation.busy} onChange={e => setReason(e.target.value)}/><ProblemNotice problems={mutation.problems}/>
    <div className="flex gap-2"><Button variant="ghost" disabled={mutation.busy} onClick={onCancel}>Cancel</Button><Button variant={action === "entered-in-error" ? "danger" : "primary"} loading={mutation.busy} disabled={readOnly || reason.trim().length < 5 || (action === "resolved" && !resolution)} onClick={save}>{ALLERGY_ACTION_LABELS[action]}</Button></div>
  </div>;
}

export function AllergyStatusChange(props: React.ComponentProps<typeof AllergyStatusChangeBody>) {
  return <AllergyStatusChangeBody key={useRecordScopeKey(`${props.patientId}:${props.allergy.id}:${props.action}`)} {...props}/>;
}
