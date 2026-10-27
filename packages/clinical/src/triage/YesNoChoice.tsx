"use client";
import React from "react";
import {Segmented} from "@pepbits/ui";

const OPTIONS = [{value: "yes", label: "Yes"}, {value: "no", label: "No"}];

/** A Yes / No radio group over a boolean; `null` is unanswered. */
export function YesNoChoice({label, value, onChange}: {label: string; value: boolean | null; onChange: (value: boolean) => void}) {
  return <Segmented size="sm" label={label} value={value === null ? "" : value ? "yes" : "no"} onChange={x => onChange(x === "yes")} options={OPTIONS}/>;
}
