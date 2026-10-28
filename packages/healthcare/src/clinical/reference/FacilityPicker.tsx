"use client";
import React, {useEffect, useState} from "react";
import {Input, Select} from "@pepbits/ui";
import {useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";
import {ProblemNotice} from "../layout/panel";
import type {FacilityChoice} from "../models/consult-reference";

export interface FacilityPickerProps {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean;
  emptyLabel?: string; hint?: string; className?: string; emergencyOnly?: boolean;
}
const OTHER = "__other";
/** Emits a facility name, including free text. Reads are scoped to the current port and aborted on replacement. */
export function FacilityPicker({label, value, onChange, disabled, required, emptyLabel = "Choose a facility", hint, className, emergencyOnly}: FacilityPickerProps) {
  const port = useConsultPort();
  const [loaded, setLoaded] = useState<{port: typeof port; items: FacilityChoice[]} | null>(null);
  const [other, setOther] = useState(false), [problems, setProblems] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setProblems([]);
    void port.listFacilities(controller.signal).then(items => {
      if (!controller.signal.aborted) setLoaded({port, items});
    }).catch(error => {if (!controller.signal.aborted) setProblems(problemsOf(error));});
    return () => controller.abort();
  }, [port]);
  const names = [...new Set((loaded?.port === port ? loaded.items : []).filter(f => !emergencyOnly || f.emergency).map(f => f.name))];
  const typing = other || (!!value && !names.includes(value));
  return <div className={className}>
    <Select label={label} required={required} hint={hint} disabled={disabled} value={typing ? OTHER : value}
      options={[{value: "", label: emptyLabel}, ...names.map(name => ({value: name, label: name})), {value: OTHER, label: "Other (type the name)"}]}
      onChange={event => {if (disabled) return; const next = event.target.value; setOther(next === OTHER); onChange(next === OTHER ? "" : next);}}/>
    {typing && <Input className="mt-2" label={`${label}: name`} disabled={disabled} required={required} maxLength={120} value={value}
      placeholder="Facility name" onChange={event => {if (!disabled) onChange(event.target.value);}}/>}
    <ProblemNotice title="Could not load facilities" problems={problems}/>
  </div>;
}
