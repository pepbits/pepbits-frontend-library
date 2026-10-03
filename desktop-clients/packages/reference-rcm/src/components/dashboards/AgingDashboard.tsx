"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink } from "@pepbits/reference-host";
import { cx } from "../../lib/cx";
import { useRcmFormat } from "../../lib/format";
import type { Aging } from "../../lib/types";
import { rcmPaths } from "../../routes";
import { useApp } from "../shell/context";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "../ui/controls";
import { DashSkeleton, useDashboard } from "./useDashboard";

const BUCKET_COLORS = ["#22A6B3", "#3E6CB8", "#E3A72F", "#D9792B", "#C43D39"];

export function AgingDashboard() {
  const { scopeInfo } = useApp();
  const { data, error } = useDashboard<Aging>("/dashboard/aging");
  const fmt = useRcmFormat();
  const { t } = useLocalization();
  if (error) return <p role="alert" className="rounded-lg bg-madder-50 p-4 text-madder-700">{error}</p>;
  if (!data) return <DashSkeleton />;
  const cur = scopeInfo.currency;
  const maxCell = Math.max(...data.parties.flatMap((p) => p.buckets), 1);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-4 gap-3">
        <Stat label={t("Open receivables")} value={fmt.money(data.total, cur)} />
        <Stat label={t("Days in receivables")} value={t("{value0} days", { value0: fmt.num(data.daysInAr) })} hint={t("Outstanding ÷ average daily billing, last 180 days")} />
        <Stat label={t("Older than 90 days")} value={`${fmt.pct(data.over90Share)}%`} tone={data.over90Share > 25 ? "text-madder-700" : undefined} />
        <Stat label={t("Parties owing")} value={fmt.num(data.parties.length)} hint={t("{value0} open invoices", { value0: fmt.num(data.parties.reduce((s, p) => s + p.invoices, 0)) })} />
      </div>

      {/* Age profile */}
      <section className="panel p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold"><LocalizedText message="Age profile" /></h2>
          <span className="text-[11.5px] text-muted"><LocalizedText message="Days since the invoice was issued" /></span>
        </div>
        <div className="mt-3 flex h-7 overflow-hidden rounded-lg">
          {data.totals.map((tot, i) => tot > 0 && (
            <div key={i} className="flex items-center justify-center text-[11px] font-bold text-white" style={{ width: `${(tot / Math.max(data.total, 1)) * 100}%`, background: BUCKET_COLORS[i] }} title={t("{value0} days: {value1}", { value0: data.buckets[i], value1: fmt.money(tot, cur) })}>
              {tot / data.total > 0.08 && `${Math.round((tot / data.total) * 100)}%`}
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-3">
          {data.buckets.map((b, i) => (
            <div key={b} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLORS[i] }} />
              <span className="text-[12px] text-muted">{t("{value0} days", { value0: b })}</span>
              <span className="ml-auto text-[12.5px] font-semibold tabular-nums">{fmt.money(data.totals[i], null, { compact: true })}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_380px] gap-3">
        <section className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-baseline justify-between px-4 pt-4">
            <h2 className="text-[15px] font-semibold"><LocalizedText message="By party" /></h2>
            <span className="text-[11.5px] text-muted"><LocalizedText message="Darker cells hold more money" /></span>
          </div>
          <TableContainer className="mt-3 min-h-0 flex-1">
            <Table className="w-full text-[12.5px]">
              <TableHeader className="sticky top-0 bg-mist text-[11px] font-semibold text-muted">
                <TableRow><TableHead scope="col" className="px-4 py-2 text-left"><LocalizedText message="Party" /></TableHead>{data.buckets.map((b) => <TableHead scope="col" key={b} className="px-2 py-2 text-right">{b}</TableHead>)}<TableHead scope="col" className="px-4 py-2 text-right"><LocalizedText message="Total" /></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data.parties.map((p) => (
                  <TableRow key={p.party} className="border-b border-line">
                    <TableCell className="px-4 py-2"><span className="block font-semibold">{p.party}</span><span className="text-[11px] text-muted">{p.kind} · {t(p.invoices === 1 ? "{value0} invoice" : "{value0} invoices", { value0: fmt.num(p.invoices) })}</span></TableCell>
                    {p.buckets.map((v, i) => (
                      <TableCell key={i} className="px-1 py-1">
                        <span className={cx("block rounded-md px-2 py-1.5 text-right tabular-nums", v / maxCell > 0.55 && "text-white")}
                          style={{ background: v ? `rgba(${i >= 3 ? "196,61,57" : i === 2 ? "227,167,47" : "31,61,99"}, ${0.08 + (v / maxCell) * 0.85})` : "transparent" }}>
                          {v ? fmt.money(v, null, { compact: true }) : <span className="text-harbor-200">—</span>}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className="px-4 py-2 text-right font-bold tabular-nums">{fmt.money(p.total, null)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </section>

        <section className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="px-4 pt-4">
            <h2 className="text-[15px] font-semibold"><LocalizedText message="Oldest open invoices" /></h2>
            <p className="text-[11.5px] text-muted"><LocalizedText message="Start collections or a statement from here" /></p>
          </div>
          <ul className="mt-2 min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {data.oldest.map((o) => (
              <li key={o.id}>
                <ReferenceLink href={rcmPaths.resource("invoices", { open: o.id })} className="flex items-center gap-3 px-4 py-2 hover:bg-mist">
                  <span className={cx("w-12 shrink-0 rounded-md py-1 text-center text-[11px] font-bold", o.age > 120 ? "bg-madder-50 text-madder-700" : o.age > 60 ? "bg-saffron-50 text-saffron-700" : "bg-mist text-muted")}>{t("{value0} d", { value0: fmt.num(o.age) })}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[12px] font-semibold text-harbor-800">{o.ref}</span>
                    <span className="block truncate text-[11.5px] text-muted">{o.patient} · {o.party}</span>
                  </span>
                  <span className="text-[12.5px] font-semibold tabular-nums">{fmt.money(o.balance, o.currency)}</span>
                </ReferenceLink>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-[11.5px] font-medium text-muted">{label}</p>
      <p className={cx("mt-1 font-display text-[24px] font-semibold leading-none tabular-nums", tone)}>{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
