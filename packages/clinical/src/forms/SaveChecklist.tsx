"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {Check} from "@pepbits/icons";
import {cn} from "@pepbits/ui";
import {ClinicalPanel, TEXT} from "../layout/panel";

export interface ChecklistItem { label: string; done: boolean }

/** One checklist line: a tick or an empty circle, with "done / not done" for screen readers. */
export function ChecklistLine({label, done}: ChecklistItem) {
  const {t} = useLocalization();
  return <li className={cn("flex items-center gap-2", TEXT.body)}>
    {done ? <Check className="size-4 text-[var(--success)]" aria-hidden="true"/> : <span className="size-4 rounded-full border-2 border-[var(--border-strong)]" aria-hidden="true"/>}
    <span className={done ? undefined : "text-[var(--text-muted)]"}>{t(label)}<span className="sr-only">: {t(done ? "done" : "not done")}</span></span>
  </li>;
}

/** What still has to be completed before the form can be saved. */
export function SaveChecklist({items, title = "Before you save"}: {items: ChecklistItem[]; title?: string}) {
  return <ClinicalPanel title={title}>
    <ul className="space-y-1.5">{items.map(item => <ChecklistLine key={item.label} {...item}/>)}</ul>
  </ClinicalPanel>;
}
