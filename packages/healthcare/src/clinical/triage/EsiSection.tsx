"use client";
import React from "react";
import {Gauge} from "@pepbits/icons";
import {ClinicalPanel} from "../layout/panel";
import {AreaSelect} from "./AreaSelect";
import {EsiDecisionPoints} from "./EsiDecisionPoints";
import {EsiOverrideFields} from "./EsiOverrideFields";
import {EsiResultSummary} from "./EsiResultSummary";
import {finalEsiLevel, type EsiPreview, type TriageValue} from "./model";

/**
 * Emergency Severity Index: the decision points, the calculated level with its explanation, an
 * optional change of level with a reason, and the area to send the patient to. The host supplies
 * the preview (`useEsiPreview`), so the same section works in triage and re-triage.
 */
export function EsiSection({value, onChange, preview, painScore}: {
  value: TriageValue; onChange: (value: TriageValue) => void; preview: EsiPreview | null; painScore?: number | null;
}) {
  return <ClinicalPanel title="Emergency Severity Index" icon={<Gauge className="size-4"/>} subtitle="Work through each decision point. The level is calculated, and you can change it with a reason.">
    <EsiDecisionPoints value={value.decisions} onChange={decisions => onChange({...value, decisions})} painScore={painScore}/>
    {preview ? <div className="mt-4 flex flex-wrap items-start gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <EsiResultSummary preview={preview} finalLevel={finalEsiLevel(preview.level, value.override)}/>
      <EsiOverrideFields value={value.override} onChange={override => onChange({...value, override})}/>
    </div> : null}
    <div className="mt-4"><AreaSelect value={value.area} onChange={area => onChange({...value, area})}/></div>
  </ClinicalPanel>;
}
