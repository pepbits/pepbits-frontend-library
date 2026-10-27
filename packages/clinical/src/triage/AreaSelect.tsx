"use client";
import React from "react";
import {Select} from "@pepbits/ui";
import {EMERGENCY_AREAS} from "./model";

/** Where the triaged patient goes next. Optional; stored as `disposition.area`. */
export function AreaSelect({value, onChange, areas = EMERGENCY_AREAS}: {value: string; onChange: (value: string) => void; areas?: readonly string[]}) {
  return <div className="max-w-xs">
    <Select label="Send to area" placeholder="Choose area" value={value} onChange={e => onChange(e.target.value)} options={areas.map(area => ({value: area, label: area}))}/>
  </div>;
}
