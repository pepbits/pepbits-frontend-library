"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/controls";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useState } from "react";
import { ArrowRight, CalendarClock, ShieldAlert, Inbox } from "lucide-react";
import { useApi } from "../../lib/hooks";
import { useAuth, useMeta } from "../../lib/auth";
import { Badge, Copy, ErrorState, Loading, PageHeader, Panel, Select, SubmissionStatus } from "../../components/ui";
import { Delta, KpiStatusBadge, Sparkline, STATUS_COLOR, TargetBand } from "../../components/kpi";
import { STATUS_LABEL, cls } from "../../lib/format";
import { useQualityFormat } from "../../lib/format";
import type { KpiStatus, Unit } from "../../lib/types";

interface DashboardKpi {
  id: number;
  code: string;
  name: string;
  domain: string;
  program: string;
  unit: Unit;
  direction: "higher" | "lower";
  target: number;
  warning: number;
  value: number | null;
  previous: number | null;
  status: KpiStatus;
  completeness: number | null;
  spark: (number | null)[];
}

interface Dashboard {
  period: string;
  previousPeriod: string;
  kpis: DashboardKpi[];
  statusCounts: Record<KpiStatus, number>;
  byDomain: { domain: string; total: number; on_target: number; warning: number; breach: number; no_data: number }[];
  workflow: { status: string; n: number }[];
  issues: { severity: string; n: number }[];
  tat: { id: number; code: string; name: string; domain: string; median: number | null; p90: number | null; pctWithin: number | null; measured: number; incomplete: number; target: number }[];
  upcoming: { id: number; name: string; next_run_at: string; frequency: string; authority: string | null; require_approval: number }[];
  submissions: { id: number; reference: string; status: string; period_from: string; period_to: string; updated_at: string; authority: string | null; template: string }[];
  activity: { id: number; ts: string; user_name: string; action: string; summary: string }[];
  pendingMine: { status: string; count: number } | null;
}

const ORDER: KpiStatus[] = ["on_target", "warning", "breach", "no_data"];

export default function DashboardPage() {
  const { t } = useLocalization();
  const { fmtDateTime, fmtMinutes, fmtPeriod, fmtPeriodRange, fmtRelative, fmtValue, humanize } = useQualityFormat();
  const meta = useMeta();
  const { user } = useAuth();
  const [period, setPeriod] = useState(meta.latestPeriod ?? "");
  const [facility, setFacility] = useState("");
  const { data, error, loading, reload } = useApi<Dashboard>("/dashboard", { period, facility });

  const attention = (data?.kpis ?? []).filter((k) => k.status === "breach" || k.status === "warning").sort((a, b) => (a.status === b.status ? a.code.localeCompare(b.code) : a.status === "breach" ? -1 : 1));
  const total = data ? Object.values(data.statusCounts).reduce((a, b) => a + b, 0) : 0;
  const blocking = data?.issues.find((i) => i.severity === "blocking")?.n ?? 0;
  const warnings = data?.issues.find((i) => i.severity === "warning")?.n ?? 0;
  const wf = Object.fromEntries((data?.workflow ?? []).map((w) => [w.status, w.n]));
  const wfTotal = Object.values(wf).reduce((a: number, b) => a + (b as number), 0) as number;

  return (
    <>
      <PageHeader
        title={t(GREETING[greeting()], { value0: user?.name.replace(/^Dr\.\s*/, "").split(" ")[0] ?? "" })}
        description="Group quality performance against target, with the work that needs attention this period."
        actions={
          <>
            <Select aria-label="Facility" value={facility} onChange={(e) => setFacility(e.target.value)} className="w-56">
              <option value=""><LocalizedText message="All facilities" /></option>
              {meta.facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36">
              {[...meta.periods].reverse().map((p) => (
                <option key={p} value={p}>
                  {fmtPeriod(p)}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {!data && loading && <Loading rows={8} />}

      {data && (
        <div className={cls("space-y-6 transition-opacity", loading && "opacity-60")}>
          {/* Scorecard strip */}
          <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div className="bg-panel p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm text-ink-2">
                  <span className="num text-[28px] font-semibold tracking-tight text-ink">{data.statusCounts.on_target}</span>
                  <span className="ml-1.5"><LocalizedText message="of {value0} indicators on target in {value1}" values={{ value0: total, value1: fmtPeriod(data.period) }} /></span>
                </p>
              </div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface" role="img" aria-label="Indicator status distribution">
                {ORDER.map((s) => (
                  <span key={s} style={{ width: `${(data.statusCounts[s] / (total || 1)) * 100}%`, background: STATUS_COLOR[s], opacity: s === "no_data" ? 0.35 : 0.9 }} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
                {ORDER.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                    <LocalizedText message={STATUS_LABEL[s]} /> <span className="num font-medium text-ink">{data.statusCounts[s]}</span>
                  </span>
                ))}
              </div>
            </div>
            <QuickStat
              href="/verification"
              icon={<Inbox className="size-4" />}
              label={data.pendingMine ? actionFor(data.pendingMine.status) : "Results in review"}
              value={data.pendingMine ? data.pendingMine.count : (wf.submitted ?? 0) + (wf.verified ?? 0)}
              sub={data.pendingMine ? t("{value0} results", { value0: humanize(data.pendingMine.status).toLowerCase() }) : "submitted or verified this period"}
            />
            <QuickStat href="/validation?status=open&severity=blocking" icon={<ShieldAlert className="size-4" />} label="Blocking validation issues" value={blocking} sub={t("{value0} warnings open", { value0: warnings })} tone={blocking ? "bad" : undefined} />
            <QuickStat
              href="/schedules"
              icon={<CalendarClock className="size-4" />}
              label="Next scheduled delivery"
              value={data.upcoming[0] ? fmtRelative(data.upcoming[0].next_run_at) : "None"}
              sub={data.upcoming[0]?.name ?? "No active schedules"}
              small
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
            <Panel
              title="Needs attention"
              description={t("{value0} indicators are off target or in the watch zone", { value0: attention.length })}
              actions={
                <Link href="/indicators" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><LocalizedText message="All indicators" /> <ArrowRight className="size-3.5" />
                </Link>
              }
              bodyClassName="p-0"
            >
              {attention.length === 0 ? (
                <p className="p-6 text-sm text-ink-2"><LocalizedText message="Every indicator with data is on target this period." /></p>
              ) : (
                <ul className="divide-y divide-line">
                  {attention.slice(0, 9).map((k) => (
                    <li key={k.id}>
                      <Link href={`/indicators/${k.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-4 py-3 hover:bg-surface/70 md:grid-cols-[minmax(0,1.4fr)_minmax(140px,1fr)_auto_auto]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-ink-3">{k.code}</span>
                            <KpiStatusBadge status={k.status} />
                          </div>
                          <div className="mt-0.5 truncate text-sm font-medium text-ink">{k.name}</div>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <TargetBand value={k.value} target={k.target} warning={k.warning} direction={k.direction} unit={k.unit} />
                          <div className="mt-0.5 text-[11px] text-ink-3"><LocalizedText message="Target {value0} {value1}" values={{ value0: k.direction === "higher" ? "≥" : "≤", value1: fmtValue(k.target, k.unit) }} /></div>
                        </div>
                        <div className="hidden md:block">
                          <Sparkline values={k.spark} target={k.target} color={STATUS_COLOR[k.status]} />
                        </div>
                        <div className="row-start-1 text-right md:row-auto">
                          <div className="num text-base font-semibold">{fmtValue(k.value, k.unit)}</div>
                          <Delta current={k.value} previous={k.previous} direction={k.direction} unit={k.unit} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="space-y-6">
              <Panel
                title="Turnaround times"
                description={t("From Event Pulse, {value0}", { value0: fmtPeriod(data.period) })}
                actions={
                  <Link href="/tat" className="text-sm text-primary hover:underline"><LocalizedText message="Analyse" /></Link>
                }
                bodyClassName="divide-y divide-line"
              >
                {data.tat.map((t) => {
                  const tone = t.pctWithin === null ? "neutral" : t.pctWithin >= 90 ? "ok" : t.pctWithin >= 80 ? "warn" : "bad";
                  return (
                    <Link key={t.id} href={`/tat?definition=${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface/70">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{t.name}</div>
                        <div className="num mt-0.5 text-xs text-ink-3"><LocalizedText message="Median {value0} · P90 {value1} · target {value2}" values={{ value0: fmtMinutes(t.median), value1: fmtMinutes(t.p90), value2: fmtMinutes(t.target) }} /></div>
                      </div>
                      <Badge tone={tone}>
                        <span className="num">{t.pctWithin === null ? "—" : `${t.pctWithin}%`}</span>
                      </Badge>
                    </Link>
                  );
                })}
              </Panel>

              <Panel title="Verification progress" description={t("{value0} results for {value1}", { value0: wfTotal, value1: fmtPeriod(data.period) })}>
                <div className="flex h-2 overflow-hidden rounded-full bg-surface">
                  {(["approved", "verified", "submitted", "draft", "rejected"] as const).map((s) => (
                    <span key={s} style={{ width: `${((wf[s] ?? 0) / (wfTotal || 1)) * 100}%`, background: WF_COLOR[s] }} />
                  ))}
                </div>
                <dl className="mt-3 grid grid-cols-5 gap-2 text-xs">
                  {(["approved", "verified", "submitted", "draft", "rejected"] as const).map((s) => (
                    <div key={s}>
                      <dt className="flex items-center gap-1 text-ink-3">
                        <span className="size-1.5 rounded-full" style={{ background: WF_COLOR[s] }} />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </dt>
                      <dd className="num mt-0.5 text-sm font-semibold">{wf[s] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          </div>

          <Panel title="Performance by domain" bodyClassName="overflow-x-auto p-0">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="Domain" /></TableHead>
                  <TableHead className="w-1/2"><LocalizedText message="Status mix" /></TableHead>
                  <TableHead className="right"><LocalizedText message="On target" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Watch" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Off target" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byDomain.map((d) => (
                  <TableRow key={d.domain}>
                    <TableCell className="font-medium">
                      <Link href={`/indicators?domain=${encodeURIComponent(d.domain)}`} className="hover:underline">
                        {d.domain}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex h-2 overflow-hidden rounded-full bg-surface">
                        {ORDER.map((s) => (
                          <span key={s} style={{ width: `${(d[s] / d.total) * 100}%`, background: STATUS_COLOR[s], opacity: s === "no_data" ? 0.35 : 0.85 }} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="num right">{d.on_target}</TableCell>
                    <TableCell className={cls("num right", d.warning > 0 && "text-warn")}>{d.warning}</TableCell>
                    <TableCell className={cls("num right", d.breach > 0 && "font-medium text-bad")}>{d.breach}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Upcoming deliveries" actions={<Link href="/schedules" className="text-sm text-primary hover:underline"><LocalizedText message="Schedules" /></Link>} bodyClassName="divide-y divide-line">
              {data.upcoming.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {fmtDateTime(s.next_run_at)} · {s.authority ?? <LocalizedText message="Internal recipients" />}
                    {s.require_approval ? <> <LocalizedText message="· needs approval" /></> : ""}
                  </div>
                </div>
              ))}
            </Panel>
            <Panel title="Recent submissions" actions={<Link href="/submissions" className="text-sm text-primary hover:underline"><LocalizedText message="Submissions" /></Link>} bodyClassName="divide-y divide-line">
              {data.submissions.map((s) => (
                <Link key={s.id} href={`/submissions?open=${s.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface/70">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.template}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-3">
                      {s.reference} · {fmtPeriodRange(s.period_from, s.period_to)}
                    </div>
                  </div>
                  <SubmissionStatus status={s.status} />
                </Link>
              ))}
            </Panel>
            <Panel title="Recent activity" bodyClassName="divide-y divide-line">
              {data.activity.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="line-clamp-2 text-sm text-ink">{a.summary}</div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {a.user_name} · {fmtRelative(a.ts)}
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

const WF_COLOR: Record<string, string> = {
  approved: "var(--color-ok)",
  verified: "var(--color-primary)",
  submitted: "var(--color-info)",
  draft: "var(--color-line-strong)",
  rejected: "var(--color-bad)",
};

const GREETING = { morning: "Good morning, {value0}", afternoon: "Good afternoon, {value0}", evening: "Good evening, {value0}" } as const;

/** Time of day in the viewer's own zone (the source assumed Gulf Standard Time). */
function greeting(): keyof typeof GREETING {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function actionFor(status: string) {
  return ({ submitted: "Waiting for you to verify", verified: "Waiting for you to approve", draft: "Waiting for you to submit" } as Record<string, string>)[status] ?? "Waiting for you to review";
}

function QuickStat({ href, icon, label, value, sub, tone, small }: { href: string; icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; tone?: "bad"; small?: boolean }) {
  return (
    <Link href={href} className="group flex flex-col justify-between bg-panel p-5 hover:bg-surface/60">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <span className="text-ink-3 group-hover:text-primary">{icon}</span>
        <Copy>{label}</Copy>
      </div>
      <div>
        <div className={cls("num mt-3 font-semibold tracking-tight", small ? "text-lg" : "text-[28px]", tone === "bad" && "text-bad")}>{value}</div>
        <div className="mt-0.5 truncate text-xs text-ink-3"><Copy>{sub}</Copy></div>
      </div>
    </Link>
  );
}
