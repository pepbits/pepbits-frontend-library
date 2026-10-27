"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {Stethoscope, X} from "@pepbits/icons";
import {IconButton, Input, Segmented} from "@pepbits/ui";
import {ChoiceField, ClinicalPanel} from "../layout/panel";
import type {ArrivalValue, ComplaintValue} from "../forms/intake-model";
import {CodedSearch} from "./CodedSearch";

/**
 * Who gave the history, interpreter need and the coded presenting complaint. `showArrivalMode`
 * adds how the patient arrived (walk-in, ambulance, police, referral) for emergency encounters;
 * otherwise answering either question records a walk-in.
 */
export function ArrivalComplaintSection({arrival, onArrival, complaint, onComplaint, receptionReason, requireComplaint = false, showArrivalMode = false}: {
  arrival: ArrivalValue; onArrival: (value: ArrivalValue) => void; complaint: ComplaintValue; onComplaint: (value: ComplaintValue) => void;
  receptionReason?: string; requireComplaint?: boolean; showArrivalMode?: boolean;
}) {
  const {t} = useLocalization();
  return <ClinicalPanel title="Arrival and complaint" icon={<Stethoscope className="size-4"/>}>
    <div className="grid gap-4 md:grid-cols-3">
      {showArrivalMode ? <ChoiceField label="Arrived by">
        <Segmented size="sm" label="Arrived by" value={arrival.mode ?? ""} onChange={x => onArrival({...arrival, mode: x})}
          options={[{value: "walk-in", label: "Walk-in"}, {value: "ambulance", label: "Ambulance"}, {value: "police", label: "Police"}, {value: "referral", label: "Referral"}]}/>
      </ChoiceField> : null}
      <ChoiceField label="History from">
        <Segmented size="sm" label="History from" value={arrival.source ?? ""} onChange={x => onArrival({...arrival, source: x, mode: arrival.mode ?? "walk-in"})}
          options={[{value: "patient", label: "Patient"}, {value: "relative", label: "Relative"}, {value: "paramedic", label: "Paramedic"}]}/>
      </ChoiceField>
      <ChoiceField label="Interpreter needed">
        <Segmented size="sm" label="Interpreter needed" value={arrival.interpreter ?? ""} onChange={x => onArrival({...arrival, interpreter: x, mode: arrival.mode ?? "walk-in"})}
          options={[{value: "no", label: "No"}, {value: "yes", label: "Yes"}]}/>
      </ChoiceField>
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <ChoiceField label="Presenting complaint" required={requireComplaint} hint={receptionReason ? `${t("Reception noted")}: “${receptionReason}”` : undefined}>
        {complaint.item ? <div className="flex h-9 items-center justify-between rounded-[10px] border border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] ps-3">
          <span className="truncate font-bold text-[var(--text)]">{complaint.item.display}</span>
          <IconButton label="Remove complaint" onClick={() => onComplaint({...complaint, item: null})}><X className="size-4"/></IconButton>
        </div> : <CodedSearch catalog="complaints" label="Presenting complaint" placeholder="Search symptoms, e.g. chest pain" onPick={item => onComplaint({...complaint, item})}/>}
      </ChoiceField>
      <Input label="In the patient’s own words" value={complaint.words} onChange={e => onComplaint({...complaint, words: e.target.value})} placeholder="“Tight feeling when I climb stairs”" maxLength={500}/>
    </div>
  </ClinicalPanel>;
}
