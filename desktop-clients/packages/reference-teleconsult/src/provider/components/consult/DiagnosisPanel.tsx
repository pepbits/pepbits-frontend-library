"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput } from "../../../shared/controls";
import { useState } from "react";
import { Plus, Search, Star, X } from "lucide-react";
import type { IcdCode } from "../../../shared/types";
import { useConsult } from "./context";
import { useApi, useDebounced } from "../../lib/hooks";
import { Badge, Empty, Segmented, cx } from "../ui";

export function DiagnosisPanel() {
  const { t } = useLocalization();
  const { enc, update, actions, patient, role, locked } = useConsult();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 150);
  const results = useApi<IcdCode[]>(`/api/catalog/icd?q=${encodeURIComponent(dq)}`);
  const readOnly = role === "nurse" || locked;
  const chosen = new Set(enc.diagnoses.map((d) => d.code));

  const patch = (code: string, p: Partial<(typeof enc.diagnoses)[number]>) =>
    update((e) => ({
      ...e,
      diagnoses: e.diagnoses.map((d) => {
        if (p.type === "primary" && d.code !== code && d.type === "primary") return { ...d, type: "secondary" };
        return d.code === code ? { ...d, ...p } : d;
      }),
    }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
          <SourceInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ICD-10 by code, term or symptom"
            disabled={readOnly}
            className="h-9 w-full rounded-md border border-line pl-8 pr-2 text-sm focus:border-pulse-500 focus:outline-none focus:ring-2 focus:ring-pulse-500/20 disabled:bg-canvas"
          />
        </div>
        <ul className="mt-2 max-h-[380px] divide-y divide-line overflow-y-auto rounded-md border border-line scroll-thin">
          {results.data?.map((c) => (
            <li key={c.code}>
              <SourceButton
                disabled={readOnly || chosen.has(c.code)}
                onClick={() => actions.addDiagnosis(c.code)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas disabled:cursor-default disabled:opacity-50"
              >
                <span className="w-16 shrink-0 text-xs font-semibold text-ink-600 tabular">{c.code}</span>
                <span className="flex-1 text-[13px] text-ink">{c.display}</span>
                {chosen.has(c.code) ? <span className="text-2xs text-pulse-600"><LocalizedText message={"Added"} /></span> : <Plus className="h-4 w-4 text-ink-400" />}
              </SourceButton>
            </li>
          ))}
        </ul>
        {patient.problems.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-ink-700"><LocalizedText message={"Known problems: tap to carry over"} /></p>
            <div className="flex flex-wrap gap-1.5">
              {patient.problems.map((p) => (
                <SourceButton
                  key={p.code}
                  disabled={readOnly || chosen.has(p.code)}
                  onClick={() => actions.addDiagnosis(p.code)}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-700 hover:border-pulse-500 disabled:opacity-40"
                >
                  {p.code} {p.display}
                </SourceButton>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-700"><LocalizedText message={"This visit"} /></p>
        {readOnly && role === "nurse" && <p className="mb-2 rounded-md bg-canvas p-2 text-xs text-ink-600"><LocalizedText message={"Diagnoses are recorded by the doctor. You can see what has been added."} /></p>}
        {!enc.diagnoses.length ? (
          <Empty title="No diagnoses yet"><LocalizedText message={"Search on the left, accept a suggestion, or press Ctrl K to add from anywhere."} /></Empty>
        ) : (
          <ul className="space-y-2">
            {enc.diagnoses.map((d) => (
              <li key={d.code} className={cx("rounded-lg border p-2.5", d.type === "primary" ? "border-pulse-500 bg-pulse-50/50" : "border-line")}>
                <div className="flex items-start gap-2">
                  {d.type === "primary" && <Star className="mt-0.5 h-4 w-4 shrink-0 fill-pulse-500 text-pulse-500" aria-label={t("Primary")} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink"><span className="tabular text-ink-600">{d.code}</span> {d.display}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Segmented size="sm" value={d.type} onChange={(v) => !readOnly && patch(d.code, { type: v })} options={[{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }]} />
                      <Segmented size="sm" value={d.certainty} onChange={(v) => !readOnly && patch(d.code, { certainty: v })} options={[{ value: "confirmed", label: "Confirmed" }, { value: "provisional", label: "Provisional" }]} />
                      <label className="flex items-center gap-1 text-xs text-ink-600">
                        <SourceInput type="checkbox" className="accent-pulse-500" disabled={readOnly} checked={d.addToProblemList} onChange={(e) => patch(d.code, { addToProblemList: e.target.checked })} />
                        
                        <LocalizedText message={"Add to problem list"} />
                      </label>
                      {patient.problems.some((p) => p.code === d.code) && <Badge className="bg-ink/5 text-ink-600"><LocalizedText message={"Known problem"} /></Badge>}
                    </div>
                  </div>
                  {!readOnly && (
                    <SourceButton onClick={() => update((e) => ({ ...e, diagnoses: e.diagnoses.filter((x) => x.code !== d.code) }))} className="rounded p-1 text-ink-400 hover:bg-ink/5 hover:text-alarm-500" aria-label={t("Remove {value0}", { value0: d.display })}>
                      <X className="h-4 w-4" />
                    </SourceButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
