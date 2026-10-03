"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { useEffect, useState } from "react";
import { Calculator, Check, Trash2 } from "lucide-react";
import type { ScoreResult } from "../../../shared/types";
import { useConsult } from "./context";
import { useTeleconsultClient } from "../../lib/api";
import { useDebounced } from "../../lib/hooks";
import { Button, Empty, cx } from "../ui";

const BAND = {
  low: "bg-vital-50 text-vital-600 border-vital-500",
  moderate: "bg-caution-50 text-caution-600 border-caution-500",
  high: "bg-alarm-50 text-alarm-600 border-alarm-500",
};

export function ScoresPanel() {
  const { t } = useLocalization();
  const { enc, update, catalog, scoreKey, setScoreKey, locked } = useConsult();
  const client = useTeleconsultClient();
  const def = catalog.scores.find((s) => s.key === scoreKey) ?? catalog.scores[0];
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ScoreResult>();
  const dAnswers = useDebounced(answers, 150);
  const complete = def.auto || def.items.every((i) => dAnswers[i.id] !== undefined);

  useEffect(() => {
    setAnswers({});
    setResult(undefined);
  }, [def.key]);

  // Recalculate on the server whenever answers or vitals change
  useEffect(() => {
    if (!complete) return setResult(undefined);
    const controller = new AbortController();
    // A superseded calculation is aborted so an older answer set can never overwrite a newer result.
    client.post<ScoreResult>("/api/scores/compute", { key: def.key, answers: dAnswers, encounter: enc }, { signal: controller.signal }).then(setResult).catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, def.key, dAnswers, complete, enc.vitals.length]);

  const save = () => {
    if (!result) return;
    update((e) => ({ ...e, scores: [...e.scores.filter((s) => s.key !== result.key), result] }));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div className="space-y-3">
        <ul className="space-y-1" role="tablist" aria-label={t("Scores")}>
          {catalog.scores.map((s) => {
            const saved = enc.scores.find((x) => x.key === s.key);
            return (
              <li key={s.key}>
                <SourceButton
                  role="tab"
                  aria-selected={s.key === def.key}
                  onClick={() => setScoreKey(s.key)}
                  className={cx("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left", s.key === def.key ? "bg-pulse-50 text-pulse-700" : "hover:bg-canvas text-ink")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{s.name}</span>
                    <span className="block truncate text-2xs text-ink-400">{s.purpose}</span>
                  </span>
                  {saved && <span className={cx("rounded px-1.5 text-2xs font-semibold tabular", BAND[saved.band])}>{saved.value}</span>}
                </SourceButton>
              </li>
            );
          })}
        </ul>
        {enc.scores.length > 0 && (
          <div className="border-t border-line pt-3">
            <p className="mb-1.5 text-xs font-medium text-ink-700"><LocalizedText message={"Saved to note"} /></p>
            <ul className="space-y-1">
              {enc.scores.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-ink">{s.name} <b className="tabular">{s.value}</b></span>
                  <SourceButton disabled={locked} onClick={() => update((e) => ({ ...e, scores: e.scores.filter((x) => x.id !== s.id) }))} className="text-ink-400 hover:text-alarm-500" aria-label={t("Remove {value0}", { value0: s.name })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </SourceButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3">
          <h3 className="text-[15px] font-semibold text-ink">{def.name}</h3>
          <p className="text-xs text-ink-400">{def.purpose}</p>
        </div>
        {def.auto ? (
          !enc.vitals.length ? (
            <Empty title="No vitals saved yet"><LocalizedText message={"Capture a reading from the live monitor or record vitals in triage. NEWS2 then calculates by itself."} /></Empty>
          ) : result && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Object.entries(result.answers).map(([k, pts]) => (
                <div key={k} className={cx("rounded-md border px-2.5 py-1.5", pts >= 3 ? "border-alarm-500 bg-alarm-50" : pts > 0 ? "border-caution-100 bg-caution-50" : "border-line")}>
                  <p className="text-2xs capitalize text-ink-400">{t(k === "sys" ? "Systolic BP" : k === "spo2" ? "SpO2" : k === "rr" ? "Resp rate" : k === "hr" ? "Pulse" : k)}</p>
                  <p className="text-lg font-semibold text-ink tabular">{pts}</p>
                </div>
              ))}
            </div>
          )
        ) : (
          <ol className="space-y-2.5">
            {def.items.map((it, idx) => (
              <li key={it.id} className="rounded-md border border-line p-2.5">
                <p className="mb-1.5 text-[13px] text-ink"><span className="mr-1.5 text-ink-400 tabular">{idx + 1}.</span>{it.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {it.options.map((o) => (
                    <SourceButton
                      key={o.label}
                      disabled={locked}
                      onClick={() => setAnswers((a) => ({ ...a, [it.id]: o.points }))}
                      className={cx("rounded-full border px-2.5 py-0.5 text-xs", answers[it.id] === o.points ? "border-pulse-500 bg-pulse-500 text-white" : "border-line text-ink-700 hover:border-pulse-500")}
                    >
                      {o.label}
                    </SourceButton>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className={cx("mt-4 flex flex-wrap items-center gap-3 rounded-lg border-l-4 p-3", result ? BAND[result.band] : "border-line bg-canvas text-ink-400")}>
          <Calculator className="h-5 w-5" />
          {result ? (
            <>
              <p className="text-2xl font-semibold tabular">{result.value}<span className="text-sm font-normal opacity-70">/{result.max}</span></p>
              <p className="min-w-[200px] flex-1 text-sm">{result.interpretation}</p>
              <Button variant="primary" size="sm" disabled={locked} onClick={save} icon={<Check className="h-4 w-4" />}>
                {enc.scores.some((s) => s.key === result.key) ? "Update in note" : "Save to note"}
              </Button>
            </>
          ) : (
            <p className="text-sm">{def.auto ? t("Waiting for vitals") : t("Answer all {value0} items to see the score", { value0: def.items.length })}</p>
          )}
        </div>
      </div>
    </div>
  );
}
