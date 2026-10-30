"use client";
import React from "react";
import {Segmented} from "@pepbits/ui";
import {ChoiceField} from "../layout/panel";
import type {ArrivalValue} from "../forms/intake-model";

export const ARRIVAL_MODES = [{value: "walk-in", label: "Walk-in"}, {value: "ambulance", label: "Ambulance"}, {value: "police", label: "Police"}, {value: "referral", label: "Referral"}];
export const HISTORY_SOURCES = [{value: "patient", label: "Patient"}, {value: "relative", label: "Relative"}, {value: "paramedic", label: "Paramedic"}];
const YES_NO = [{value: "no", label: "No"}, {value: "yes", label: "Yes"}];

/** How the patient arrived. */
export function ArrivalModeChoice({value, onChange}: {value: string | null; onChange: (value: string) => void}) {
  return <ChoiceField label="Arrived by"><Segmented size="sm" label="Arrived by" value={value ?? ""} onChange={onChange} options={ARRIVAL_MODES}/></ChoiceField>;
}

/** Who gave the history. */
export function HistorySourceChoice({value, onChange}: {value: string | null; onChange: (value: string) => void}) {
  return <ChoiceField label="History from"><Segmented size="sm" label="History from" value={value ?? ""} onChange={onChange} options={HISTORY_SOURCES}/></ChoiceField>;
}

/** Whether an interpreter is needed. Records a flag; it does not book one. */
export function InterpreterChoice({value, onChange}: {value: string | null; onChange: (value: string) => void}) {
  return <ChoiceField label="Interpreter needed"><Segmented size="sm" label="Interpreter needed" value={value ?? ""} onChange={onChange} options={YES_NO}/></ChoiceField>;
}

/**
 * Arrival questions. `showArrivalMode` asks how the patient arrived; otherwise, and before it is
 * answered, answering either other question records a walk-in.
 */
export function ArrivalFields({value, onChange, showArrivalMode = false}: {value: ArrivalValue; onChange: (value: ArrivalValue) => void; showArrivalMode?: boolean}) {
  return <div className="grid gap-4 md:grid-cols-3">
    {showArrivalMode ? <ArrivalModeChoice value={value.mode} onChange={mode => onChange({...value, mode})}/> : null}
    <HistorySourceChoice value={value.source} onChange={source => onChange({...value, source, mode: value.mode ?? "walk-in"})}/>
    <InterpreterChoice value={value.interpreter} onChange={interpreter => onChange({...value, interpreter, mode: value.mode ?? "walk-in"})}/>
  </div>;
}
