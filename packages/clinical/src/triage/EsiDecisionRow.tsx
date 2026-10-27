"use client";
import React, {type ReactNode} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {cn} from "@pepbits/ui";
import {TEXT} from "../layout/panel";

/** One ESI decision point: its letter, the question, an optional hint and the answer control. */
export function EsiDecisionRow({letter, label, hint, children}: {letter: string; label: string; hint?: string; children: ReactNode}) {
  const {t} = useLocalization();
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2.5">
    <span className={TEXT.body}>
      <b className="me-2 text-[var(--primary)]" aria-hidden="true">{letter}</b>{t(label)}
      {hint ? <span className={cn("ms-2", TEXT.muted)}>{t(hint)}</span> : null}
    </span>
    {children}
  </div>;
}
