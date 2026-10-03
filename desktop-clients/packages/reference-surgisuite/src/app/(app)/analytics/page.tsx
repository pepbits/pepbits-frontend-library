"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { Table } from "@pepbits/ops-ui";

import { useState } from "react";
import { useApi } from "./../../../lib/api";
import { localDateKey, useSourceFormat} from "./../../../lib/format";
import { ErrorNote, PanelHeader, Segmented, Spinner, cx } from "./../../../components/ui";

type A = {
  from: string; to: string;
  totals: { cases: number; completed: number; cancelled: number; cancellationRate: number; onTimeStart: number | null; avgTurnover: number; implantSpend: number; reportCompletion: number | null };
  utilization: { theatre: string; pct: number; hours: number }[];
  specialties: { specialty: string; cases: number; avgActual: number; avgPlanned: number; revenue: number }[];
  delayReasons: { label: string; n: number }[];
  cancelReasons: { label: string; n: number }[];
  daily: { date: string; completed: number; cancelled: number }[];
  scores: { kind: string; band: string; n: number }[];
  surgeons: { name: string; cases: number; avgRoomMin: number; onTimePct: number | null }[];
};

const PRESETS: Record<string, number> = { "7": 7, "21": 21, "30": 30 };

export default function AnalyticsPage() {
 const {t:translateSource}=useLocalization();
 const {money}=useSourceFormat();
  const [days, setDays] = useState("21");
  const to = localDateKey();
  const from = localDateKey(new Date(Date.now() - PRESETS[days] * 86400000));
  const { data, loading, error } = useApi<A>(`/analytics?from=${from}&to=${to}`);

  if (loading && !data) return <Spinner label="Crunching theatre data" />;
  if (error && !data) return <div className="p-6"><ErrorNote error={error} /></div>;
  if (!data) return null;
  const t = data.totals;
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.completed + d.cancelled));
  const maxDur = Math.max(1, ...data.specialties.map((s) => Math.max(s.avgActual, s.avgPlanned)));
  const maxDelay = Math.max(1, ...data.delayReasons.map((d) => d.n));

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-cond text-[24px] font-semibold"><LocalizedText message={"Analytics"}/></h1>
        <Segmented value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "21", label: "21 days" }, { value: "30", label: "30 days" }]} />
        <dl className="ml-auto flex flex-wrap divide-x divide-line rounded-[10px] border border-line bg-white">
          {[
            ["Cases", t.cases],
            ["Completed", t.completed],
            ["Cancelled", `${t.cancellationRate}%`],
            ["First starts on time", t.onTimeStart === null ? "—" : `${t.onTimeStart}%`],
            ["Avg turnover", `${t.avgTurnover}m`],
            ["Reports signed", t.reportCompletion === null ? "—" : `${t.reportCompletion}%`],
            ["Implant spend", money(t.implantSpend).replace(/\.\d+$/, "")],
          ].map(([k, v]) => (
            <div key={k as string} className="px-3.5 py-2">
              <dd className="font-cond text-[20px] font-semibold leading-none">{v}</dd>
              <dt className="mt-1 text-[11px] text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="scroll-y grid min-h-0 flex-1 auto-rows-min gap-3 lg:grid-cols-3">
        <section className="panel">
          <PanelHeader title="Theatre utilization" />
          <ul className="space-y-2 p-4">
            {data.utilization.map((u) => (
              <li key={u.theatre} className="grid grid-cols-[52px_1fr_88px] items-center gap-2 text-[13px]">
                <span className="font-cond font-semibold">{u.theatre}</span>
                <span className="relative h-4 rounded-[3px] bg-steel">
                  <span className={cx("absolute inset-y-0 left-0 rounded-[3px]", u.pct >= 85 ? "bg-amber" : u.pct >= 65 ? "bg-go" : "bg-ceil")} style={{ width: `${Math.min(100, u.pct)}%` }} />
                  <span className="absolute inset-y-0 w-px bg-ink/40" style={{ left: "85%" }} />
                </span>
                <span className="text-right"><b>{u.pct}%</b> <span className="text-muted">{u.hours}<LocalizedText message={"h"}/></span></span>
              </li>
            ))}
          </ul>
          <p className="px-4 pb-3 text-[12px] text-muted"><LocalizedText message={"Patient-in-room time over a 10-hour session. The line marks the 85% target."}/></p>
        </section>

        <section className="panel">
          <PanelHeader title="Daily volume">
            <span className="flex gap-3 text-[12px] text-muted"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-scrub-3" /><LocalizedText message={"Completed"}/></span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-stop" /><LocalizedText message={"Cancelled"}/></span></span>
          </PanelHeader>
          <div className="flex h-48 items-end gap-1 px-4 pb-2 pt-4">
            {data.daily.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-px" title={translateSource("{value0}: {value1} completed, {value2} cancelled",{value0:d.date,value1:d.completed,value2:d.cancelled})}>
                <span className="w-full rounded-t-[2px] bg-stop" style={{ height: `${(d.cancelled / maxDaily) * 150}px` }} />
                <span className="w-full rounded-t-[2px] bg-scrub-3" style={{ height: `${(d.completed / maxDaily) * 150}px` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between px-4 pb-3 text-[11px] text-muted"><span>{data.daily[0]?.date}</span><span>{data.daily.at(-1)?.date}</span></div>
        </section>

        <section className="panel">
          <PanelHeader title="Why cases started late" />
          <ul className="space-y-2 p-4">
            {data.delayReasons.length === 0 && <li className="text-[13px] text-muted"><LocalizedText message={"No delays recorded."}/></li>}
            {data.delayReasons.map((d) => (
              <li key={d.label} className="text-[13px]">
                <div className="flex justify-between"><span>{d.label}</span><b>{d.n}</b></div>
                <div className="mt-0.5 h-1.5 rounded bg-steel"><div className="h-1.5 rounded bg-amber" style={{ width: `${(d.n / maxDelay) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          {data.cancelReasons.length > 0 && (
            <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">
              <LocalizedText message={"Cancellations:"}/>{" "}{data.cancelReasons.map((c) => `${c.label.toLowerCase()} (${c.n})`).join(", ")}.
            </p>
          )}
        </section>

        <section className="panel lg:col-span-2">
          <PanelHeader title="Surgical time by specialty, actual against planned">
            <span className="flex gap-3 text-[12px] text-muted"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ceil" /><LocalizedText message={"Actual"}/></span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-steel-2 ring-1 ring-line" /><LocalizedText message={"Planned"}/></span></span>
          </PanelHeader>
          <div className="scroll-x">
            <Table className="w-full min-w-[640px] text-[13px]">
              <tbody className="divide-y divide-line">
                {data.specialties.map((s) => {
                  const over = s.avgActual - s.avgPlanned;
                  return (
                    <tr key={s.specialty}>
                      <td className="w-48 px-4 py-2 font-medium">{s.specialty}<span className="block text-[12px] font-normal text-muted">{s.cases} {" "}<LocalizedText message={"cases"}/></span></td>
                      <td className="px-2 py-2">
                        <div className="relative h-3 rounded bg-steel-2" style={{ width: `${(s.avgPlanned / maxDur) * 100}%` }} />
                        <div className="mt-1 h-3 rounded bg-ceil" style={{ width: `${(s.avgActual / maxDur) * 100}%` }} />
                      </td>
                      <td className="w-32 px-2 py-2 text-right">{s.avgActual}<LocalizedText message={"m"}/>{" "}<span className={cx("text-[12px]", over > 10 ? "text-stop" : "text-muted")}>({over >= 0 ? "+" : ""}{over})</span></td>
                      <td className="w-28 px-4 py-2 text-right font-medium">{money(s.revenue).replace(/\.\d+$/, "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <p className="border-t border-line px-4 py-2 text-[12px] text-muted"><LocalizedText message={"Incision to closure. Consistent overruns mean booking templates need longer default durations. Revenue is the surgeon fee for performed CPT codes."}/></p>
        </section>

        <section className="panel">
          <PanelHeader title="Risk profile of completed cases" />
          {["SURGICAL_APGAR", "NNIS"].map((k) => {
            const rows = data.scores.filter((s) => s.kind === k);
            const total = rows.reduce((a, r) => a + r.n, 0) || 1;
            return (
              <div key={k} className="px-4 py-3">
                <p className="mb-1.5 text-[12px] font-medium text-muted">{k === "NNIS" ? "Infection risk (NNIS)" : "Surgical Apgar"}</p>
                <div className="flex h-4 overflow-hidden rounded">
                  {rows.map((r) => (
                    <span key={r.band} title={translateSource("{value0}: {value1}",{value0:r.band,value1:r.n})} className={cx(/High|Very/.test(r.band) ? "bg-stop" : /Moderate/.test(r.band) ? "bg-amber" : "bg-go")} style={{ width: `${(r.n / total) * 100}%` }} />
                  ))}
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                  {rows.map((r) => <li key={r.band}>{r.band}: <b className="text-ink">{r.n}</b></li>)}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="panel lg:col-span-3">
          <PanelHeader title="Surgeons" />
          <div className="scroll-x">
            <Table className="w-full min-w-[560px] text-[13px]">
              <thead className="bg-steel/60 text-left text-[12px] text-muted">
                <tr><th className="px-4 py-2 font-medium"><LocalizedText message={"Surgeon"}/></th><th className="px-2 py-2 text-right font-medium"><LocalizedText message={"Cases"}/></th><th className="px-2 py-2 text-right font-medium"><LocalizedText message={"Avg room time"}/></th><th className="px-4 py-2 text-right font-medium"><LocalizedText message={"Started within 10 min"}/></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.surgeons.map((s) => (
                  <tr key={s.name}>
                    <td className="px-4 py-1.5 font-medium">{s.name}</td>
                    <td className="px-2 py-1.5 text-right">{s.cases}</td>
                    <td className="px-2 py-1.5 text-right">{s.avgRoomMin}<LocalizedText message={"m"}/></td>
                    <td className={cx("px-4 py-1.5 text-right", (s.onTimePct ?? 100) < 60 && "text-stop")}>{s.onTimePct ?? "—"}%</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
