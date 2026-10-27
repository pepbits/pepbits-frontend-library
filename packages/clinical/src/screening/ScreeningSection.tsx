"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {ShieldQuestion, Siren} from "@pepbits/icons";
import {Segmented, cn} from "@pepbits/ui";
import {ClinicalPanel, TEXT} from "../layout/panel";
import {SCREENING_ANSWERS, SCREENING_QUESTIONS, flaggedQuestions, questionsFor, type ScreeningAnswer, type ScreeningAnswers, type ScreeningContext, type ScreeningQuestion} from "./model";

/** Screening questions that start unanswered; a flagged answer lists the action it calls for. */
export function ScreeningSection({context, value, onChange, questions = SCREENING_QUESTIONS}: {
  context: ScreeningContext; value: ScreeningAnswers; onChange: (value: ScreeningAnswers) => void; questions?: ScreeningQuestion[];
}) {
  const {t} = useLocalization();
  const flags = flaggedQuestions(context, value, questions);
  const actions = [...new Set(flags.map(f => f.action))];
  return <ClinicalPanel title="Screening" icon={<ShieldQuestion className="size-4"/>} subtitle="Questions start unanswered. Ask each one, or record that the patient declined.">
    <div className="divide-y divide-[var(--border)]">
      {questionsFor(context, questions).map(q => <div key={q.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
        <span className={TEXT.body}>{t(q.label)}</span>
        <Segmented size="sm" label={q.label} value={value[q.key] ?? ""} onChange={x => onChange({...value, [q.key]: x as ScreeningAnswer})} options={SCREENING_ANSWERS}/>
      </div>)}
    </div>
    {actions.length ? <div role="status" className={cn("mt-3 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))] p-3 text-[var(--danger-ink)]", TEXT.body)}>
      <p className="flex items-center gap-1.5 font-bold"><Siren className="size-4"/>{t("Action needed")}</p>
      <ul className="mt-1 list-disc ps-5">{actions.map(action => <li key={action}>{t(action)}</li>)}</ul>
    </div> : null}
  </ClinicalPanel>;
}
