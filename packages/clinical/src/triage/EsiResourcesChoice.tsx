"use client";
import React from "react";
import {Segmented} from "@pepbits/ui";
import type {EsiResources} from "./model";

export const ESI_RESOURCE_OPTIONS = [{value: "0", label: "None"}, {value: "1", label: "One"}, {value: "2", label: "Two or more"}];

/** Decision C: how many resources (labs, imaging, IV fluids, specialist…) the patient will need. */
export function EsiResourcesChoice({value, onChange}: {value: EsiResources | null; onChange: (value: EsiResources) => void}) {
  return <Segmented size="sm" label="Resources" value={value === null ? "" : String(value)} onChange={x => onChange(Number(x) as EsiResources)} options={ESI_RESOURCE_OPTIONS}/>;
}
