"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/controls";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { Activity, ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import { useQualityApi } from "../../../../lib/api";
import { useApi } from "../../../../lib/hooks";
import { useAuth } from "../../../../lib/auth";
import { Badge, Button, Copy, ErrorState, Loading, PageHeader, Panel, ResultStatus, Select, Stat } from "../../../../components/ui";
import { KpiStatusBadge, TargetBand } from "../../../../components/kpi";
import { TrendChart } from "../../../../components/charts";
import { IndicatorForm } from "../../../../components/IndicatorForm";
import { ResultDrawer } from "../../../../components/ResultDrawer";
import { useToast } from "../../../../components/toast";

import { useQualityFormat } from "../../../../lib/format";
import type { Facility, Indicator, KpiStatus } from "../../../../lib/types";

interface SeriesPoint { period: string; value: number | null; numerator: number | null; denominator: number | null; status: KpiStatus }
interface Detail {
  indicator: Indicator;
  owner: { id: number; name: string; title: string } | null;
  tat: { id: number; code: string; name: string; target_minutes: number } | null;
  facilities: Facility[];
  series: SeriesPoint[];
  byFacility: { facility: Facility; series: SeriesPoint[] }[];
  results: { id: number; period: string; facility_code: string; facility_name: string; numerator: number | null; denominator: number | null; value: number | null; status: string; source: string; version: number }[];
  history: { ts: string; user_name: string; action: string; summary: string }[];
}

export default function IndicatorDetailPage({ params }: { params: { id: string } }) {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const { fmtDateTime, fmtMinutes, fmtNumber, fmtPeriod, fmtValue, humanize } = useQualityFormat();
  const { id } = params;
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Detail>(`/indicators/${id}`);
  const [editing, setEditing] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [view, setView] = useState<"group" | "facility">("group");
  const [resultId, setResultId] = useState<number | null>(null);
  const [periodFilter, setPeriodFilter] = useState("");

  const latest = data?.series[data.series.length - 1];
  const periods = data?.series.map((s) => s.period) ?? [];
  const series = useMemo(() => {
    if (!data) return [];
    if (view === "group") return [{ name: t("All facilities"), values: data.series.map((s) => s.value), emphasis: true }];
    return data.byFacility.map((f) => ({ name: f.facility.code, values: f.series.map((s) => s.value) }));
  }, [data, view]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading rows={10} />;
  const ind = data.indicator;
  const withData = data.series.filter((s) => s.value !== null);
  const onTargetMonths = withData.filter((s) => s.status === "on_target").length;
  const results = data.results.filter((r) => !periodFilter || r.period === periodFilter);

  const runRecalc = async () => {
    setRecalc(true);
    try {
      const r = await api<{ periods: string[]; updated: number; created: number; unchanged: number; locked: number }>(`/indicators/${ind.id}/recalculate`, { method: "POST" });
      toast("Recalculated {value0}: {value1} changed, {value2} unchanged, {value3} approved results left locked.", "success", { value0: r.periods.map(fmtPeriod).join(", "), value1: r.updated + r.created, value2: r.unchanged, value3: r.locked });
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Recalculation failed.", "error");
    } finally {
      setRecalc(false);
    }
  };

  return (
    <>
      <Link href="/indicators" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> <LocalizedText message="Indicators" /></Link>
      <PageHeader
        title={ind.name}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink-2">{ind.code}</span>
            <Badge>{ind.program}</Badge>
            <Badge>{ind.domain}</Badge>
            <Badge>{humanize(ind.category)}</Badge>
            <span><LocalizedText message="Definition version {value0}" values={{ value0: ind.version }} /></span>
            {ind.status !== "active" && <Badge tone="warn"><LocalizedText message="Retired" /></Badge>}
          </span>
        }
        actions={
          <>
            {ind.source === "events" && can("results.edit") && (
              <Button icon={<RefreshCw className="size-4" />} loading={recalc} onClick={runRecalc}><LocalizedText message="Recalculate from events" /></Button>
            )}
            {can("indicators.manage") && (
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}><LocalizedText message="Edit definition" /></Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel>
            <div className="grid gap-6 sm:grid-cols-4">
              <Stat label={t("Latest, {value0}", { value0: fmtPeriod(latest?.period) })} value={fmtValue(latest?.value ?? null, ind.unit)} sub={latest && <KpiStatusBadge status={latest.status} />} />
              <Stat label="Target" value={`${ind.direction === "higher" ? "≥" : "≤"} ${fmtValue(ind.target, ind.unit)}`} sub={t("Watch from {value0}", { value0: fmtValue(ind.warning, ind.unit) })} />
              <Stat label="Months on target" value={t("{value0} of {value1}", { value0: onTargetMonths, value1: withData.length })} sub="Last 12 months, pooled" />
              <Stat label="12-month pooled" value={fmtValue(pool(data.series, ind.unit), ind.unit)} sub="Numerators and denominators summed" />
            </div>
            <div className="mt-5">
              <TargetBand value={latest?.value ?? null} target={ind.target} warning={ind.warning} direction={ind.direction} unit={ind.unit} />
            </div>
          </Panel>

          <Panel
            title="Trend"
            description={view === "group" ? "Pooled across applicable facilities" : "Each applicable facility"}
            actions={
              <div className="flex rounded-md border border-line p-0.5 text-xs">
                {(["group", "facility"] as const).map((v) => (
                  <SourceButton key={v} onClick={() => setView(v)} className={`rounded px-2.5 py-1 ${view === v ? "bg-primary-soft font-medium text-primary" : "text-ink-3"}`}>
                    {v === "group" ? <LocalizedText message="Group" /> : <LocalizedText message="By facility" />}
                  </SourceButton>
                ))}
              </div>
            }
          >
            <TrendChart periods={periods} series={series} unit={ind.unit} target={ind.target} warning={ind.warning} height={280} />
          </Panel>

          <Panel
            title="Results"
            description="Select a result to review its trail, correct data or move it through verification."
            actions={
              <Select className="h-8 w-36 text-[13px]" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} aria-label="Period">
                <option value=""><LocalizedText message="All periods" /></option>
                {[...periods].reverse().map((p) => (
                  <option key={p} value={p}>
                    {fmtPeriod(p)}
                  </option>
                ))}
              </Select>
            }
            bodyClassName="max-h-[520px] overflow-auto p-0"
          >
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="Period" /></TableHead>
                  <TableHead><LocalizedText message="Facility" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Numerator" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Denominator" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Value" /></TableHead>
                  <TableHead><LocalizedText message="Status" /></TableHead>
                  <TableHead><LocalizedText message="Source" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setResultId(r.id)}>
                    <TableCell>{fmtPeriod(r.period)}</TableCell>
                    <TableCell title={r.facility_name}>{r.facility_code}</TableCell>
                    <TableCell className="num right text-ink-2">{fmtNumber(r.numerator, ind.unit === "minutes" ? 1 : 0)}</TableCell>
                    <TableCell className="num right text-ink-2">{fmtNumber(r.denominator)}</TableCell>
                    <TableCell className="num right font-medium">{fmtValue(r.value, ind.unit)}</TableCell>
                    <TableCell>
                      <ResultStatus status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-ink-3">{r.source === "events" ? <LocalizedText message="Event Pulse" /> : <LocalizedText message="Submitted" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Definition">
            <dl className="space-y-3 text-sm">
              <Def label="Numerator">{ind.numerator_def}</Def>
              <Def label="Denominator">{ind.denominator_def}</Def>
              {ind.exclusions && <Def label="Exclusions">{ind.exclusions}</Def>}
              <Def label="Unit"><LocalizedText message={{ percent: "Percentage", per_1000: "Rate per 1,000", minutes: "Mean minutes", count: "Count" }[ind.unit]} /></Def>
              <Def label="Better when">{ind.direction === "higher" ? <LocalizedText message="Higher" /> : <LocalizedText message="Lower" />}</Def>
              <Def label="Minimum sample">{ind.min_sample}</Def>
              <Def label="Applies to">{ind.facility_types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}</Def>
              <Def label="Owner">{data.owner ? `${data.owner.name}, ${data.owner.title}` : <LocalizedText message="Unassigned" />}</Def>
              <Def label="Calculation">
                {data.tat ? (
                  <Link href={`/tat?definition=${data.tat.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Activity className="size-3.5" /> {data.tat.name} <LocalizedText message="(target {value0})" values={{ value0: fmtMinutes(data.tat.target_minutes) }} />
                  </Link>
                ) : (
                  <LocalizedText message="Submitted monthly by the facility" />
                )}
              </Def>
            </dl>
          </Panel>
          <Panel title="Facilities">
            <ul className="space-y-3">
              {data.byFacility.map((f) => {
                const last = f.series[f.series.length - 1];
                return (
                  <li key={f.facility.id}>
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{f.facility.name}</span>
                      <span className="num font-medium">{fmtValue(last?.value ?? null, ind.unit)}</span>
                    </div>
                    <div className="mt-1">
                      <TargetBand compact value={last?.value ?? null} target={ind.target} warning={ind.warning} direction={ind.direction} unit={ind.unit} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Change history">
            {data.history.length === 0 ? (
              <p className="text-sm text-ink-3"><LocalizedText message="No changes since the indicator was created." /></p>
            ) : (
              <ul className="space-y-3">
                {data.history.map((h, i) => (
                  <li key={i} className="text-sm">
                    <div className="text-ink">{h.summary}</div>
                    <div className="text-xs text-ink-3">
                      {h.user_name} · {fmtDateTime(h.ts)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <IndicatorForm open={editing} onClose={() => setEditing(false)} indicator={ind} onSaved={() => { setEditing(false); void reload(); }} />
      <ResultDrawer resultId={resultId} onClose={() => setResultId(null)} onChanged={reload} />
    </>
  );
}

function Def({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3"><Copy>{label}</Copy></dt>
      <dd className="mt-0.5 text-ink-2">{children}</dd>
    </div>
  );
}

function pool(series: SeriesPoint[], unit: string): number | null {
  const s = series.filter((p) => p.numerator !== null && p.denominator !== null);
  if (!s.length) return null;
  const n = s.reduce((a, b) => a + (b.numerator ?? 0), 0);
  const d = s.reduce((a, b) => a + (b.denominator ?? 0), 0);
  if (!d) return null;
  return (n / d) * (unit === "percent" ? 100 : unit === "per_1000" ? 1000 : 1);
}
