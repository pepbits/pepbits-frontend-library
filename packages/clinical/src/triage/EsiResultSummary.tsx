"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {ChevronRight} from "@pepbits/icons";
import {cn} from "@pepbits/ui";
import {TEXT} from "../layout/panel";
import {EsiLevelChip} from "./EsiLevelChip";
import type {EsiLevel, EsiPreview} from "./model";

/** The level that will be saved, with the server's explanation steps and any danger-zone warning. */
export function EsiResultSummary({preview, finalLevel}: {preview: EsiPreview; finalLevel: EsiLevel | null}) {
  const {t} = useLocalization();
  return <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4" aria-live="polite">
    <EsiLevelChip level={finalLevel} size="lg"/>
    <ol className={cn("min-w-0 flex-1 space-y-1", TEXT.body)} aria-label={t("How the level was reached")}>
      {preview.steps.map(step => <li key={step} className="flex gap-1.5"><ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[var(--text-muted)] rtl:rotate-180" aria-hidden="true"/>{step}</li>)}
      {preview.dangerZone ? <li className="font-bold text-[var(--danger-ink)]">{t("Danger-zone vital signs: consider ESI 2.")}</li> : null}
    </ol>
  </div>;
}
