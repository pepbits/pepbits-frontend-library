"use client";
import React from "react";
import {EsiDecisionRow} from "./EsiDecisionRow";
import {EsiResourcesChoice} from "./EsiResourcesChoice";
import {YesNoChoice} from "./YesNoChoice";
import {ESI_B_QUESTIONS, esiAsksB, esiAsksC, withEsiAnswer, type EsiDecisions} from "./model";

/**
 * ESI decision points A, B and C, each shown once the one before is answered No. Changing an
 * earlier answer clears the later ones. `painScore` is shown beside the severe-pain question for
 * comparison; the two are not reconciled.
 */
export function EsiDecisionPoints({value, onChange, painScore}: {value: EsiDecisions; onChange: (value: EsiDecisions) => void; painScore?: number | null}) {
  const answer = <K extends keyof EsiDecisions>(key: K) => (x: EsiDecisions[K]) => onChange(withEsiAnswer(value, key, x));
  const lifeSaving = "Needs an immediate life-saving intervention?";
  return <div className="grid gap-2">
    <EsiDecisionRow letter="A" label={lifeSaving}><YesNoChoice label={lifeSaving} value={value.lifeSaving} onChange={answer("lifeSaving")}/></EsiDecisionRow>
    {esiAsksB(value) ? ESI_B_QUESTIONS.map(q => <EsiDecisionRow key={q.key} letter="B" label={q.label}
      hint={q.key === "severePain" && painScore !== null && painScore !== undefined ? `Pain recorded: ${painScore}/10` : undefined}>
      <YesNoChoice label={q.label} value={value[q.key]} onChange={answer(q.key)}/>
    </EsiDecisionRow>) : null}
    {esiAsksC(value) ? <EsiDecisionRow letter="C" label="How many resources will they need?" hint="(labs, imaging, IV fluids, specialist…)">
      <EsiResourcesChoice value={value.resources} onChange={answer("resources")}/>
    </EsiDecisionRow> : null}
  </div>;
}
