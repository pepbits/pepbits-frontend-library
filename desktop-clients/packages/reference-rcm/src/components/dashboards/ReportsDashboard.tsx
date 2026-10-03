"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { humanize, useRcmFormat } from "../../lib/format";
import type { Reports } from "../../lib/types";
import { useApp } from "../shell/context";
import { Donut, GroupedBars, HBars, PALETTE } from "./Charts";
import { DashSkeleton, useDashboard } from "./useDashboard";

export function ReportsDashboard() {
  const { scopeInfo } = useApp();
  const { data, error } = useDashboard<Reports>("/dashboard/reports");
  const fmt = useRcmFormat();
  const { t } = useLocalization();
  if (error) return <p role="alert" className="rounded-lg bg-madder-50 p-4 text-madder-700">{error}</p>;
  if (!data) return <DashSkeleton />;
  const cur = scopeInfo.currency;
  const k = data.kpis;
  const monthLabel = (m: string, i: number) => fmt.month(m) + (i === data.series.length - 1 ? ` ${t("(to date)")}` : "");
  const payerTotal = data.payers.reduce((s, p) => s + p.value, 0);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-6 gap-3">
        <Kpi label={t("Billed, 6 months")} value={fmt.money(k.billed, cur, { compact: true })} />
        <Kpi label={t("Collected, 6 months")} value={fmt.money(k.collected, cur, { compact: true })} />
        <Kpi label={t("Collection rate")} value={`${fmt.pct(k.collectionRate)}%`} tone={k.collectionRate >= 90 ? "good" : k.collectionRate >= 75 ? "warn" : "bad"} target={t("Target 95%")} />
        <Kpi label={t("Denial rate")} value={`${fmt.pct(k.denialRate)}%`} tone={k.denialRate <= 5 ? "good" : k.denialRate <= 10 ? "warn" : "bad"} target={t("Target under 5%")} />
        <Kpi label={t("Days in receivables")} value={fmt.num(k.daysInAr)} tone={k.daysInAr <= 45 ? "good" : k.daysInAr <= 60 ? "warn" : "bad"} target={t("Target 45 days")} />
        <Kpi label={t("Outstanding now")} value={fmt.money(k.outstanding, cur, { compact: true })} />
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <section className="panel flex min-h-0 flex-col p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold"><LocalizedText message="Billed against collected" /></h2>
            <span className="flex items-center gap-3 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-harbor-700" /> <LocalizedText message="Billed" /></span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-signal-500" /> <LocalizedText message="Collected" /></span>
            </span>
          </div>
          <div className="mt-4 min-h-0 flex-1">
            <GroupedBars data={data.series} keys={["billed", "collected"]} colors={["#1F3D63", "#22A6B3"]} labels={(d) => monthLabel(d.month, data.series.indexOf(d as never))} />
          </div>
        </section>
        <section className="panel flex min-h-0 flex-col p-4">
          <h2 className="text-[15px] font-semibold"><LocalizedText message="Billing by payer" /></h2>
          <div className="mt-3 flex min-h-0 flex-1 items-center gap-5">
            <Donut items={data.payers.map((p) => ({ label: p.payer, value: p.value }))} colors={PALETTE} center={<><span className="font-display text-[17px] font-semibold">{fmt.money(payerTotal, null, { compact: true })}</span><span className="text-[10.5px] text-muted">{t("{value0} billed", { value0: cur })}</span></>} />
            <ul className="min-w-0 flex-1 space-y-1.5">
              {data.payers.map((p, i) => (
                <li key={p.payer} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="min-w-0 flex-1 truncate">{p.payer}</span>
                  <span className="font-semibold tabular-nums">{fmt.num(Math.round((p.value / Math.max(payerTotal, 1)) * 100))}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid min-h-0 grid-cols-2 gap-3">
        <section className="panel min-h-0 overflow-y-auto p-4">
          <h2 className="text-[15px] font-semibold"><LocalizedText message="Open denials by reason" /></h2>
          <p className="mb-3 text-[11.5px] text-muted"><LocalizedText message="Value still outstanding on denied claims" /></p>
          {data.denials.length ? <HBars items={data.denials.map((d) => ({ label: t(humanize(d.reason)), value: d.value, sub: t(d.count === 1 ? "{value0} claim" : "{value0} claims", { value0: fmt.num(d.count) }) }))} color="#C43D39" /> : <p className="text-[12.5px] text-muted"><LocalizedText message="No open denials." /></p>}
        </section>
        <section className="panel min-h-0 overflow-y-auto p-4">
          <h2 className="text-[15px] font-semibold"><LocalizedText message="Collections by method" /></h2>
          <p className="mb-3 text-[11.5px] text-muted"><LocalizedText message="Receipts in the last 6 months" /></p>
          <HBars items={data.methods.map((m) => ({ label: t(humanize(m.method)), value: m.value }))} color="#22A6B3" />
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, target }: { label: string; value: string; tone?: "good" | "warn" | "bad"; target?: string }) {
  return (
    <div className="panel relative overflow-hidden px-4 py-3">
      {tone && <span className={cx("absolute inset-x-0 top-0 h-[3px]", tone === "good" ? "bg-jade-500" : tone === "warn" ? "bg-saffron-500" : "bg-madder-500")} />}
      <p className="truncate text-[11.5px] font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums">{value}</p>
      {target && <p className="mt-1.5 text-[11px] text-muted">{target}</p>}
    </div>
  );
}
