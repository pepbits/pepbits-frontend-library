"use client";
import React, {useEffect, useMemo, useState} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {Activity} from "@pepbits/icons";
import {cn} from "@pepbits/ui";
import {useClinicalPort} from "../context/clinical-context";
import {ClinicalPanel, TEXT} from "../layout/panel";
import type {ScoreResult} from "../types";
import {measurementErrors, news2Inputs, type NotMeasured, type Vitals} from "./model";

/**
 * Live NEWS2 preview through the data port, 300 ms after the last change. Invalid measurements
 * are never sent. The server recalculates authoritatively when the record is saved.
 */
export function useNews2(vitals: Vitals, notMeasured: NotMeasured) {
  const port = useClinicalPort();
  const invalid = Object.keys(measurementErrors(vitals, notMeasured)).length > 0;
  const key = useMemo(() => JSON.stringify(news2Inputs(vitals, notMeasured)), [vitals, notMeasured]);
  const [result, setResult] = useState<{key: string; news: ScoreResult} | null>(null);
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      port.calculateScore("news2", JSON.parse(key) as Record<string, unknown>, controller.signal)
        .then(news => { if (!controller.signal.aborted) setResult({key, news}); })
        .catch(() => { if (!controller.signal.aborted) setResult(null); });
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [key, invalid, port]);
  return {news: !invalid && result?.key === key ? result.news : null, invalid};
}

const SEVERITY_INK: Record<string, string> = {critical: "text-[var(--danger-ink)]", high: "text-[var(--danger-ink)]", moderate: "text-[var(--warning-ink)]", low: "text-[var(--success-ink)]"};

export function News2Panel({news, invalid = false}: {news: ScoreResult | null; invalid?: boolean}) {
  const {t} = useLocalization();
  return <ClinicalPanel title="NEWS2" icon={<Activity className="size-4"/>} subtitle="Calculated live on the server">
    <div aria-live="polite">
      {!invalid && news?.status === "complete" ? <div>
        <div className="flex items-end gap-3">
          <span className={cn("text-[length:calc(44px*var(--fs-scale))] font-bold leading-none tabular-nums", SEVERITY_INK[news.severity ?? "low"])}>{news.total}</span>
          <span className={cn("pb-1 font-bold", TEXT.body)}>{news.band}</span>
        </div>
        <p className={cn("mt-2", TEXT.body)}>{news.interpretation}</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
          {news.components.map(c => <li key={c.key} className={cn("flex justify-between gap-2", TEXT.muted)}>
            <span className="truncate">{c.label}</span>
            <span className={cn("font-bold tabular-nums", (c.points ?? 0) >= 3 ? "text-[var(--danger-ink)]" : (c.points ?? 0) > 0 ? "text-[var(--warning-ink)]" : undefined)}>{c.points}</span>
          </li>)}
        </ul>
      </div> : <p className={TEXT.muted}>{invalid ? t("Correct the invalid measurements before calculating NEWS2.") : news?.missing.length ? `${t("Waiting for")}: ${news.missing.join(", ")}.` : t("Enter observations to calculate.")}</p>}
    </div>
  </ClinicalPanel>;
}
