"use client";
import React from "react";
import {Input, Select} from "@pepbits/ui";
import {ESI_LEVELS, type EsiLevel, type EsiOverride} from "./model";

/** An optional change to the calculated level; choosing one asks for the reason. */
export function EsiOverrideFields({value, onChange}: {value: EsiOverride; onChange: (value: EsiOverride) => void}) {
  return <div className="grid w-full gap-2 sm:w-[260px]">
    <Select label="Change level (optional)" placeholder="Keep calculated level" value={value.level === null ? "" : String(value.level)}
      onChange={e => onChange({...value, level: e.target.value ? Number(e.target.value) as EsiLevel : null})}
      options={ESI_LEVELS.map(level => ({value: String(level), label: `ESI ${level}`}))}/>
    {value.level !== null ? <Input label="Reason for change" required value={value.reason} onChange={e => onChange({...value, reason: e.target.value})} placeholder="Clinical concern not captured above"/> : null}
  </div>;
}
