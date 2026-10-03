"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer } from "../../../components/controls";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "../../../lib/navigation";
import { useApi } from "../../../lib/hooks";
import { useMeta } from "../../../lib/auth";
import { Badge, EmptyState, ErrorState, Field, Input, Loading, PageHeader, Panel, Select, Stat, Tabs, DateInput } from "../../../components/ui";
import { BarsChart } from "../../../components/charts";
import { TransactionDrawer } from "../../../components/TransactionDrawer";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface Summary { population: number; measured: number; within: number; over: number; incomplete: number; negative: number; cancelled: number; pctWithin: number | null; median: number | null; p90: number | null; mean: number | null; target: number }
interface Analysis {
  definition: { id: number; name: string; domain: string; start_event: string; end_event: string; target_minutes: number; description: string };
  summary: Summary;
  histogram: { label: string; count: number; withinTarget: boolean; from: number }[];
  trend: { bucket: string; median: number | null; p90: number | null; pctWithin: number | null; volume: number }[];
  byFacility: (Summary & { facility: { id: number; name: string; code: string } })[];
  stages: { from: string; to: string; median: number | null; p90: number | null; n: number }[];
  exceptions: { transactionId: string; facility: string; priority: string; attributes: Record<string, unknown>; startedAt: string; endedAt: string | null; minutes: number | null; outcome: string; currentState: string }[];
}

const dubaiToday = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 4 * 3600000 - n * 86400000).toISOString().slice(0, 10);
const STAGE_COLORS = ["#0e6b5c", "#3b8c7d", "#6aae9f", "#2b6cb0", "#6b93c9", "#b7791f", "#c99a52"];

function TatInner() {
  const { t } = useLocalization();
  const { fmtDate, fmtDateTime, fmtDayMonth, fmtMinutes, fmtNumber, humanize } = useQualityFormat();
  const meta = useMeta();
  const params = useSearchParams();
  const defs = meta.tatDefinitions;
  const [definition, setDefinition] = useState(params.get("definition") ?? String(defs[0]?.id ?? ""));
  const [facility, setFacility] = useState("");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(dubaiToday());
  const [exTab, setExTab] = useState<"all" | "over" | "incomplete" | "negative">("all");
  const [tx, setTx] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi<Analysis>("/tat/analysis", { definition, facility, from, to });

  const grouped = useMemo(() => meta.eventDomains.map((d) => ({ ...d, defs: defs.filter((x) => x.domain === d.id) })).filter((d) => d.defs.length), [meta, defs]);
  const s = data?.summary;
  const tone = s?.pctWithin == null ? undefined : s.pctWithin >= 90 ? "ok" : s.pctWithin >= 80 ? "warn" : "bad";
  const targetBucket = data?.histogram.find((h) => h.from + 0.0001 >= (data?.definition.target_minutes ?? 0))?.label;
  const stageTotal = (data?.stages ?? []).reduce((a, b) => a + (b.median ?? 0), 0);
  const exceptions = (data?.exceptions ?? []).filter((e) => exTab === "all" || e.outcome === exTab);

  const preset = (days: number) => {
    setFrom(daysAgo(days - 1));
    setTo(dubaiToday());
  };

  return (
    <>
      <PageHeader title="Turnaround times" description="Measured from the immutable clinical event history. Corrections replace the events they supersede, duplicates are never counted twice, and missing stages are reported as incomplete rather than estimated." />

      <Panel className="mb-6" bodyClassName="grid gap-3 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto_auto]">
        <Field label="Measure">
          <Select value={definition} onChange={(e) => setDefinition(e.target.value)}>
            {grouped.map((g) => (
              <optgroup key={g.id} label={t(g.label)}>
                {g.defs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {`${d.name} ${t("(target {value0})", { value0: fmtMinutes(d.target_minutes) })}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Facility">
          <Select value={facility} onChange={(e) => setFacility(e.target.value)}>
            <option value=""><LocalizedText message="All facilities" /></option>
            {meta.facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <DateInput value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <DateInput value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex items-end gap-1">
          {[7, 30, 90].map((d) => (
            <SourceButton key={d} onClick={() => preset(d)} className="h-9 rounded-md border border-line px-2.5 text-xs text-ink-2 hover:bg-surface"><LocalizedText message="{value0} days" values={{ value0: d }} /></SourceButton>
          ))}
        </div>
      </Panel>

      {error && <ErrorState message={error} onRetry={reload} />}
      {!data && loading && <Loading rows={8} />}
      {data && s && (
        <div className={cls("space-y-6", loading && "opacity-60")}>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 lg:grid-cols-7">
            <div className="col-span-2 bg-panel p-4 sm:col-span-1">
              <Stat label={t("Within {value0}", { value0: fmtMinutes(s.target) })} value={s.pctWithin === null ? "—" : `${s.pctWithin}%`} tone={tone as "ok" | "warn" | "bad" | undefined} sub={<LocalizedText message="{value0} of {value1}" values={{ value0: fmtNumber(s.within), value1: fmtNumber(s.measured) }} />} />
            </div>
            <div className="bg-panel p-4"><Stat label="Median" value={fmtMinutes(s.median)} /></div>
            <div className="bg-panel p-4"><Stat label="90th percentile" value={fmtMinutes(s.p90)} /></div>
            <div className="bg-panel p-4"><Stat label="Mean" value={fmtMinutes(s.mean)} /></div>
            <div className="bg-panel p-4"><Stat label="Incomplete" value={fmtNumber(s.incomplete)} sub="no end event yet" tone={s.incomplete ? "warn" : undefined} /></div>
            <div className="bg-panel p-4"><Stat label="Clock errors" value={fmtNumber(s.negative)} sub="end before start" tone={s.negative ? "bad" : undefined} /></div>
            <div className="bg-panel p-4"><Stat label="Cancelled" value={fmtNumber(s.cancelled)} sub="excluded" /></div>
          </section>

          {s.population === 0 ? (
            <Panel>
              <EmptyState title="No transactions in this range"><LocalizedText message="Widen the date range or choose another facility." /></EmptyState>
            </Panel>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Distribution" description={t("{value0} to {value1}, minutes", { value0: humanize(data.definition.start_event), value1: humanize(data.definition.end_event) })}>
                  <BarsChart
                    data={data.histogram}
                    xKey="label"
                    bars={[{ key: "count", name: "Transactions" }]}
                    colorFor={(r) => ((r as { withinTarget: boolean }).withinTarget ? "#0e6b5c" : "#d9a3a3")}
                    reference={targetBucket ? { x: targetBucket, label: "Target" } : undefined}
                  />
                </Panel>
                <Panel title="Trend" description={t(data.trend.length > 40 || (Date.parse(to) - Date.parse(from)) / 86400000 <= 35 ? "Median and 90th percentile by day" : "Median and 90th percentile by week")}>
                  <div className="h-[240px]">
                    <ResponsiveContainer>
                      <LineChart data={data.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--color-line)" vertical={false} />
                        <XAxis dataKey="bucket" tickFormatter={(b) => fmtDayMonth(b)} tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} axisLine={false} tickLine={false} width={44} />
                        <Tooltip labelFormatter={(b) => fmtDate(String(b))} formatter={(v: number, n: string) => [fmtMinutes(v), n]} contentStyle={{ borderRadius: 6, border: "1px solid var(--color-line)", background: "var(--color-panel)", color: "var(--color-ink)", fontSize: 12 }} />
                        <ReferenceLine y={data.definition.target_minutes} stroke="var(--color-ok)" strokeDasharray="4 4" label={{ value: t("Target"), position: "insideTopRight", fill: "var(--color-ok)", fontSize: 11 }} />
                        <Line dataKey="median" name={t("Median")} stroke="#0e6b5c" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line dataKey="p90" name={t("90th percentile")} stroke="#b7791f" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <Panel title="Where the time goes" description="Median minutes between consecutive stages, for transactions that reported both stages">
                <div className="flex h-9 overflow-hidden rounded-md">
                  {data.stages.map((st, i) =>
                    st.median ? (
                      <div
                        key={st.from}
                        className="flex min-w-0 items-center justify-center text-[11px] font-medium text-white"
                        style={{ width: `${(st.median / (stageTotal || 1)) * 100}%`, background: STAGE_COLORS[i % STAGE_COLORS.length] }}
                        title={`${humanize(st.from)} → ${humanize(st.to)}: ${fmtMinutes(st.median)}`}
                      >
                        <span className="truncate px-1">{(st.median / (stageTotal || 1)) > 0.08 ? fmtMinutes(st.median) : ""}</span>
                      </div>
                    ) : null,
                  )}
                </div>
                <TableContainer overflow="horizontal" className="mt-4">
                  <Table className="data-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead><LocalizedText message="Interval" /></TableHead>
                        <TableHead className="right"><LocalizedText message="Median" /></TableHead>
                        <TableHead className="right"><LocalizedText message="90th percentile" /></TableHead>
                        <TableHead className="right"><LocalizedText message="Transactions" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.stages.map((st, i) => (
                        <TableRow key={st.from}>
                          <TableCell>
                            <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
                            <LocalizedText message="{value0} to {value1}" values={{ value0: humanize(st.from), value1: humanize(st.to).toLowerCase() }} />
                          </TableCell>
                          <TableCell className="num right">{fmtMinutes(st.median)}</TableCell>
                          <TableCell className="num right text-ink-2">{fmtMinutes(st.p90)}</TableCell>
                          <TableCell className="num right text-ink-3">{fmtNumber(st.n)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Panel>

              <Panel title="By facility" bodyClassName="overflow-x-auto p-0">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead><LocalizedText message="Facility" /></TableHead>
                      <TableHead className="right"><LocalizedText message="Measured" /></TableHead>
                      <TableHead className="w-1/3"><LocalizedText message="Within target" /></TableHead>
                      <TableHead className="right"><LocalizedText message="Median" /></TableHead>
                      <TableHead className="right"><LocalizedText message="90th percentile" /></TableHead>
                      <TableHead className="right"><LocalizedText message="Incomplete" /></TableHead>
                      <TableHead className="right"><LocalizedText message="Clock errors" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byFacility.map((f) => {
                      const pct = f.pctWithin ?? 0;
                      const color = pct >= 90 ? "var(--color-ok)" : pct >= 80 ? "var(--color-warn)" : "var(--color-bad)";
                      return (
                        <TableRow key={f.facility.id}>
                          <TableCell className="font-medium">{f.facility.name}</TableCell>
                          <TableCell className="num right">{fmtNumber(f.measured)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative h-1.5 flex-1 rounded-full bg-surface">
                                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
                                <span className="absolute -top-1 h-3.5 w-px bg-ink/40" style={{ left: "90%" }} />
                              </div>
                              <span className="num w-12 text-right font-medium" style={{ color }}>
                                {f.pctWithin === null ? "—" : `${f.pctWithin}%`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="num right">{fmtMinutes(f.median)}</TableCell>
                          <TableCell className="num right text-ink-2">{fmtMinutes(f.p90)}</TableCell>
                          <TableCell className="num right">{f.incomplete || "—"}</TableCell>
                          <TableCell className={cls("num right", f.negative > 0 && "text-bad")}>{f.negative || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Panel>

              <Panel title="Exceptions" description="Clock errors first, then incomplete workflows, then the slowest transactions over target. Select one to see its event history." bodyClassName="p-0">
                <div className="px-4">
                  <Tabs
                    value={exTab}
                    onChange={setExTab}
                    items={[
                      { id: "all", label: "All", count: data.exceptions.length },
                      { id: "over", label: "Over target", count: data.exceptions.filter((e) => e.outcome === "over").length },
                      { id: "incomplete", label: "Incomplete", count: data.exceptions.filter((e) => e.outcome === "incomplete").length },
                      { id: "negative", label: "Clock errors", count: data.exceptions.filter((e) => e.outcome === "negative").length },
                    ]}
                  />
                </div>
                <TableContainer className="max-h-[480px]">
                  <Table className="data-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead><LocalizedText message="Transaction" /></TableHead>
                        <TableHead><LocalizedText message="Facility" /></TableHead>
                        <TableHead><LocalizedText message="Detail" /></TableHead>
                        <TableHead><LocalizedText message="Started" /></TableHead>
                        <TableHead className="right"><LocalizedText message="Duration" /></TableHead>
                        <TableHead><LocalizedText message="Outcome" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exceptions.map((e) => (
                        <TableRow key={e.transactionId} className="cursor-pointer" onClick={() => setTx(e.transactionId)}>
                          <TableCell className="font-mono text-xs">{e.transactionId}</TableCell>
                          <TableCell className="text-ink-2">{e.facility}</TableCell>
                          <TableCell className="text-ink-2">
                            {e.priority === "STAT" && <Badge tone="bad" className="mr-1.5"><LocalizedText message="STAT" /></Badge>}
                            {String(e.attributes.test ?? e.attributes.modality ?? e.attributes.department ?? e.attributes.acuity ?? e.attributes.ward ?? "")}
                          </TableCell>
                          <TableCell className="num text-ink-2">{fmtDateTime(e.startedAt)}</TableCell>
                          <TableCell className={cls("num right font-medium", e.outcome === "negative" && "text-bad")}>{e.minutes === null ? "—" : fmtMinutes(e.minutes)}</TableCell>
                          <TableCell>
                            <Badge tone={e.outcome === "negative" ? "bad" : e.outcome === "incomplete" ? "warn" : "neutral"}>
                              {e.outcome === "over" ? <LocalizedText message="Over target" /> : e.outcome === "incomplete" ? <LocalizedText message="Stopped at {value0}" values={{ value0: humanize(e.currentState).toLowerCase() }} /> : e.outcome === "negative" ? <LocalizedText message="Clock error" /> : e.outcome}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Panel>
            </>
          )}
        </div>
      )}
      <TransactionDrawer id={tx} onClose={() => setTx(null)} />
    </>
  );
}

export default function TatPage() {
  return (
    <Suspense>
      <TatInner />
    </Suspense>
  );
}
