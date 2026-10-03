"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./controls";

import { AlertTriangle } from "lucide-react";
import { Badge } from "./ui";
import { KpiStatusBadge, STATUS_COLOR, TargetBand } from "./kpi";
import { BarsChart, TrendChart } from "./charts";
import { STATUS_LABEL, cls } from "../lib/format";
import { useQualityFormat } from "../lib/format";
import type { IndicatorMeta, KpiStatus } from "../lib/types";

interface KpiRow {
  indicator: IndicatorMeta;
  facility: { id: number; name: string; code: string } | null;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  status: KpiStatus;
  completeness: number | null;
  approvalCoverage: number | null;
}

export interface RenderedReport {
  template?: { id: number; name: string };
  period: { from: string; to: string; months: string[] };
  facilities: { id: number; code: string; name: string }[];
  generatedAt: string;
  checksum: string;
  summary: { indicators: number; on_target: number; warning: number; breach: number; no_data: number; approvalCoverage: number | null };
  sections: { id: string; type: string; title: string; body?: string; data: any }[];
}

export function ReportRenderer({ report, title, description, compact }: { report: RenderedReport; title: string; description?: string | null; compact?: boolean }) {
  const { fmtDateTime, fmtPeriodRange } = useQualityFormat();
  const allFacilities = report.facilities.length;
  return (
    <article className="rounded-lg border border-line bg-panel print:border-0">
      <header className="border-b border-line px-6 py-5 print:px-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={cls("font-semibold tracking-[-0.01em]", compact ? "text-lg" : "text-xl")}>{title}</h2>
            {description && <p className="mt-1 max-w-[70ch] text-sm text-ink-2">{description}</p>}
          </div>
          <div className="text-right text-xs text-ink-3">
            <div className="text-sm font-medium text-ink">{fmtPeriodRange(report.period.from, report.period.to)}</div>
            <div><LocalizedText message="Generated {value0}" values={{ value0: fmtDateTime(report.generatedAt) }} /></div>
            <div className="font-mono" title={report.checksum}><LocalizedText message="SHA-256 {value0}…" values={{ value0: report.checksum.slice(0, 12) }} /></div>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          <LocalizedText message={allFacilities === 1 ? "{value0} facility: {value1}" : "{value0} facilities: {value1}"} values={{ value0: allFacilities, value1: report.facilities.map((f) => f.name).join(", ") }} />
        </p>
        {report.summary.approvalCoverage !== null && report.summary.approvalCoverage < 100 && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-warn-soft px-3 py-2 text-sm text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
            <LocalizedText message="{value0}% of the results in this report are approved. Results still in review may change before submission." values={{ value0: report.summary.approvalCoverage }} />
          </p>
        )}
      </header>
      <div className="divide-y divide-line">
        {report.sections.map((s) => (
          <section key={s.id} className="print-break px-6 py-5 print:px-0">
            <h3 className="mb-3 text-[15px] font-semibold">{s.title}</h3>
            <Section section={s} />
          </section>
        ))}
      </div>
    </article>
  );
}

function Section({ section }: { section: RenderedReport["sections"][number] }) {
  const { fmtMinutes, fmtNumber, fmtValue, humanize } = useQualityFormat();
  const d = section.data;
  if (d?.error) return <p className="text-sm text-warn">{d.error}</p>;
  switch (section.type) {
    case "scorecard":
      return (
        <div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
            {(["on_target", "warning", "breach", "no_data"] as KpiStatus[]).map((s) => (
              <div key={s} className="bg-panel p-3">
                <div className="flex items-center gap-1.5 text-xs text-ink-3">
                  <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                  <LocalizedText message={STATUS_LABEL[s]} />
                </div>
                <div className="num mt-1 text-2xl font-semibold">{d.counts[s]}</div>
              </div>
            ))}
          </div>
          {d.rows.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {(d.rows as KpiRow[]).map((r) => (
                <li key={r.indicator.id} className="grid grid-cols-[minmax(0,1fr)_160px_90px] items-center gap-4 text-sm">
                  <span className="truncate">
                    <span className="text-ink-3">{r.indicator.code}</span> {r.indicator.name}
                  </span>
                  <TargetBand compact value={r.value} target={r.indicator.target} warning={r.indicator.warning} direction={r.indicator.direction} unit={r.indicator.unit} />
                  <span className="num text-right font-medium">{fmtValue(r.value, r.indicator.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "kpi_table":
      return (
        <TableContainer overflow="horizontal" className="rounded-md border border-line">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead><LocalizedText message="Indicator" /></TableHead>
                <TableHead className="right"><LocalizedText message="Numerator" /></TableHead>
                <TableHead className="right"><LocalizedText message="Denominator" /></TableHead>
                <TableHead className="right"><LocalizedText message="Result" /></TableHead>
                <TableHead className="right"><LocalizedText message="Target" /></TableHead>
                <TableHead><LocalizedText message="Status" /></TableHead>
                <TableHead className="right"><LocalizedText message="Complete" /></TableHead>
                <TableHead className="right"><LocalizedText message="Approved" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(d.rows as KpiRow[]).map((r, i) => (
                <TableRow key={`${r.indicator.id}-${r.facility?.id ?? "all"}-${i}`} className={r.facility ? "text-ink-2" : ""}>
                  <TableCell className={cls("max-w-[380px]", r.facility && "pl-8")}>
                    {r.facility ? (
                      <span className="text-[13px]">{r.facility.name}</span>
                    ) : (
                      <>
                        <span className="text-xs text-ink-3">{r.indicator.code}</span>
                        <span className="block font-medium text-ink">{r.indicator.name}</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="num right">{fmtNumber(r.numerator, r.indicator.unit === "minutes" ? 1 : 0)}</TableCell>
                  <TableCell className="num right">{fmtNumber(r.denominator)}</TableCell>
                  <TableCell className={cls("num right", !r.facility && "font-semibold")}>{fmtValue(r.value, r.indicator.unit)}</TableCell>
                  <TableCell className="num right text-ink-3">
                    {r.indicator.direction === "higher" ? "≥" : "≤"} {fmtValue(r.indicator.target, r.indicator.unit)}
                  </TableCell>
                  <TableCell>
                    <KpiStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className={cls("num right", r.completeness !== null && r.completeness < 100 && "text-warn")}>{r.completeness === null ? "—" : `${r.completeness}%`}</TableCell>
                  <TableCell className={cls("num right", r.approvalCoverage !== null && r.approvalCoverage < 100 && "text-warn")}>{r.approvalCoverage === null ? "—" : `${r.approvalCoverage}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    case "kpi_trend": {
      const ind = d.indicator as IndicatorMeta;
      return (
        <>
          <p className="mb-2 text-xs text-ink-3"><LocalizedText message="{value0} {value1}, pooled across the selected facilities" values={{ value0: ind.code, value1: ind.name }} /></p>
          <TrendChart periods={d.series.map((p: any) => p.period)} series={[{ name: ind.code, values: d.series.map((p: any) => p.value), emphasis: true }]} unit={ind.unit} target={ind.target} warning={ind.warning} height={220} />
        </>
      );
    }
    case "facility_comparison": {
      const ind = d.indicator as IndicatorMeta;
      return (
        <>
          <p className="mb-2 text-xs text-ink-3">
            {ind.code} {ind.name}
          </p>
          <BarsChart
            data={d.rows.map((r: any) => ({ facility: r.facility.code, value: r.value, status: r.status }))}
            xKey="facility"
            bars={[{ key: "value", name: ind.name }]}
            colorFor={(r) => STATUS_COLOR[(r as { status: KpiStatus }).status]}
            reference={{ y: ind.target, label: "Target" }}
            yFormatter={(v) => fmtValue(v, ind.unit)}
            height={220}
          />
        </>
      );
    }
    case "tat_summary":
      return (
        <TableContainer overflow="horizontal" className="rounded-md border border-line">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead><LocalizedText message="Measure" /></TableHead>
                <TableHead className="right"><LocalizedText message="Target" /></TableHead>
                <TableHead className="right"><LocalizedText message="Measured" /></TableHead>
                <TableHead className="right"><LocalizedText message="Median" /></TableHead>
                <TableHead className="right"><LocalizedText message="90th percentile" /></TableHead>
                <TableHead className="right"><LocalizedText message="Within target" /></TableHead>
                <TableHead className="right"><LocalizedText message="Incomplete" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.rows.map((r: any) => (
                <TableRow key={r.definition.id}>
                  <TableCell className="font-medium">{r.definition.name}</TableCell>
                  <TableCell className="num right text-ink-3">{fmtMinutes(r.target)}</TableCell>
                  <TableCell className="num right">{fmtNumber(r.measured)}</TableCell>
                  <TableCell className="num right">{fmtMinutes(r.median)}</TableCell>
                  <TableCell className="num right text-ink-2">{fmtMinutes(r.p90)}</TableCell>
                  <TableCell className="right">
                    <Badge tone={r.pctWithin === null ? "neutral" : r.pctWithin >= 90 ? "ok" : r.pctWithin >= 80 ? "warn" : "bad"}>
                      <span className="num">{r.pctWithin === null ? "—" : `${r.pctWithin}%`}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="num right text-ink-3">{r.incomplete}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    case "validation_summary": {
      const open = d.open as { id: number; code: string; severity: string; message: string }[];
      const openBlocking = (d.byRule as any[]).filter((r) => r.status === "open" && r.severity === "blocking").reduce((a, b) => a + b.n, 0);
      const openWarn = (d.byRule as any[]).filter((r) => r.status === "open" && r.severity === "warning").reduce((a, b) => a + b.n, 0);
      const closed = (d.byRule as any[]).filter((r) => r.status !== "open").reduce((a, b) => a + b.n, 0);
      return (
        <div>
          <p className="text-sm text-ink-2">
            <LocalizedText message="{value0} blocking and {value1} warning issues open; {value2} resolved or waived." values={{ value0: openBlocking, value1: openWarn, value2: closed }} />
          </p>
          {open.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {open.map((i) => (
                <li key={i.id} className="flex gap-2">
                  <Badge tone={i.severity === "blocking" ? "bad" : "warn"}>{i.code}</Badge>
                  <span className="text-ink-2">{i.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "verification_status": {
      const order = ["approved", "verified", "submitted", "draft", "rejected"];
      const colors: Record<string, string> = { approved: "var(--color-ok)", verified: "var(--color-primary)", submitted: "var(--color-info)", draft: "var(--color-line-strong)", rejected: "var(--color-bad)" };
      return (
        <div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
            {order.map((s) => (
              <span key={s} style={{ width: `${(d.counts[s] / (d.total || 1)) * 100}%`, background: colors[s] }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {order.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-ink-2">
                <span className="size-2 rounded-full" style={{ background: colors[s] }} />
                {humanize(s)} <span className="num font-medium text-ink">{d.counts[s]}</span>
              </span>
            ))}
          </div>
        </div>
      );
    }
    default:
      return <p className="max-w-[75ch] text-sm leading-relaxed whitespace-pre-line text-ink-2">{d?.body || section.body}</p>;
  }
}
