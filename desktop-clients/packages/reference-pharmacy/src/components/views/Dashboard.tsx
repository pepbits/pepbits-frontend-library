"use client";
import clsx from "clsx";
import { Boxes, ChevronRight, CircleAlert, FileCheck2, Landmark, Siren, Snowflake, Truck } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useState } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { useRouter } from "../../lib/navigation";
import { PairedBars, StackedColumns } from "../ui/charts";
import { Button, EmptyState, ErrorNote, Panel, PanelHeader, Skeleton, StatusPill, TONE } from "../ui/primitives";
import { useToast } from "../ui/toast";
import type { Dashboard as D } from "../shell/nav";
import { useApi, useApiClient, useRefreshAll } from "../../lib/api";
import { statusOf, usePharmacyFormat } from "../../lib/format";

const STAGES = [
  { key: "intake", label: "Intake", note: "New, not yet opened" },
  { key: "review", label: "Review", note: "Clinical check, holds" },
  { key: "fill", label: "Fill", note: "Verified, to prepare" },
  { key: "check", label: "Check", note: "Prepared, needs final check" },
  { key: "handover", label: "Ready", note: "Checked, waiting for the patient" },
] as const;

export function DashboardView() {
  const { data, error, mutate } = useApi<D>("/dashboard", { refreshInterval: 20_000 });
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!data) return <DashboardSkeleton />;
  return (
    <div className="scroll-y h-full">
      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 md:p-5 xl:h-full xl:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)]">
        <FlowStrip d={data} />
        <div className="grid min-h-0 gap-4 lg:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr]">
          <Throughput d={data} />
          <RevenueCycle d={data} />
          <StockWatch d={data} />
        </div>
        <div className="grid min-h-0 gap-4 xl:grid-cols-[2.25fr_1fr]">
          <Trend d={data} />
          <Activity d={data} />
        </div>
      </div>
    </div>
  );
}

function FlowStrip({ d }: { d: D }) {
  const { t, int, moneyC, num } = usePharmacyFormat();
  const busiest = Math.max(...STAGES.map((s) => d.queues[s.key] ?? 0), 1);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <Panel as="div" className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-[13.5px] font-semibold"><LocalizedText message="Prescriptions in the pharmacy now" /></h2>
          <Link href="/workbench" className="text-[13px] font-medium text-cobalt hover:underline"><LocalizedText message="Open workbench" /></Link>
        </div>
        <ol className="grid grid-cols-5 gap-px p-3 pt-2">
          {STAGES.map((s, i) => {
            const n = d.queues[s.key] ?? 0;
            return (
              <li key={s.key}>
                <Link href={`/workbench?stage=${s.key}`} className="group relative flex h-full flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
                    <LocalizedText message={s.label} />
                    {i < STAGES.length - 1 && <ChevronRight className="ml-auto size-3.5 text-line-strong" aria-hidden />}
                  </span>
                  <span className="num mt-1 text-[28px] font-semibold leading-none tracking-tight">{int(n)}</span>
                  <span className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-cobalt" style={{ width: `${(n / busiest) * 100}%` }} /></span>
                  <span className="mt-1.5 truncate text-[11.5px] text-ink-3"><LocalizedText message={s.note} /></span>
                </Link>
              </li>
            );
          })}
        </ol>
      </Panel>
      <Panel as="div" className="grid grid-cols-2 gap-x-6 gap-y-2.5 px-5 py-3.5 sm:grid-cols-4 lg:grid-cols-2">
        <Kpi label="Received today" value={int(d.kpi.rx_received)} />
        <Kpi label="Handed over today" value={int(d.kpi.rx_handed_over)} />
        <Kpi label="Avg. turnaround, 7 days" value={t("{value0} min", { value0: num(d.kpi.turnaround_min) })} tone={d.kpi.turnaround_min > 60 ? "warn" : undefined} />
        <Kpi label="Sales today" value={moneyC(d.kpi.sales_today)} />
      </Panel>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11.5px] text-ink-3"><LocalizedText message={label} /></p>
      <p className={clsx("num truncate text-[17px] font-semibold", tone && TONE[tone].text)}>{value}</p>
    </div>
  );
}

function Throughput({ d }: { d: D }) {
  const nowH = new Date().getUTCHours();
  const hours = d.hours.filter((h) => h.hour >= 3 && h.hour <= Math.max(nowH, 16));
  return (
    <Panel>
      <PanelHeader title="Today by hour" sub="Prescriptions received against supplies handed over (UTC)"
        actions={<div className="flex items-center gap-3 text-[11.5px] text-ink-3"><span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-line-strong" /><LocalizedText message="Received" /></span><span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-cobalt" /><LocalizedText message="Handed over" /></span></div>} />
      <div className="flex min-h-[160px] flex-1 flex-col justify-end px-4 pb-3 pt-2">
        <PairedBars height={150} a="received" b="handed over" data={hours.map((h) => ({ label: String(h.hour).padStart(2, "0"), a: h.received, b: h.handed_over }))} labels={(i) => i % 2 === 0} />
      </div>
    </Panel>
  );
}

function RevenueCycle({ d }: { d: D }) {
  const router = useRouter();
  const toast = useToast();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const { t, int, moneyC, plural, num } = usePharmacyFormat();
  const [busy, setBusy] = useState(false);
  const submitDrafts = async () => {
    setBusy(true);
    try {
      const drafts = await api.get<{ id: string }[]>("/claims?status=draft");
      const r = await api.post<{ submitted: number; results: { ok: boolean }[] }>("/claims/submit", { ids: drafts.map((c) => c.id), note: "Batch submitted from command center" });
      await refreshAll();
      const waiting = drafts.length - r.submitted;
      toast({
        tone: "ok", title: t("{value0} submitted", { value0: plural(r.submitted, "claim") }),
        body: waiting <= 0 ? undefined : waiting === 1 ? t("1 secondary claim waits for the primary payer.") : t("{value0} secondary claims wait for the primary payer.", { value0: int(waiting) }),
      });
    } catch (e) { toast({ tone: "error", title: (e as Error).message }); } finally { setBusy(false); }
  };
  const rows = [
    { icon: FileCheck2, label: "{value0} draft claims", sub: "ready for the nightly batch", n: d.rcm.drafts.n, v: d.rcm.drafts.v, tone: "neutral" as const,
      action: <Button size="sm" variant="secondary" loading={busy} disabled={!d.rcm.drafts.n} onClick={submitDrafts}><LocalizedText message="Submit all" /></Button> },
    { icon: CircleAlert, label: "{value0} rejected claims", sub: "fix and resubmit", n: d.rcm.rejected.n, v: d.rcm.rejected.v, tone: "danger" as const,
      action: <Button size="sm" variant="secondary" disabled={!d.rcm.rejected.n} onClick={() => router.push("/claims?status=rejected")}><LocalizedText message="Review" /></Button> },
    { icon: Landmark, label: "{value0} remittances to post", sub: "payer money not yet allocated", n: d.rcm.unposted_ra.n, v: d.rcm.unposted_ra.v, tone: "info" as const,
      action: <Button size="sm" variant="secondary" disabled={!d.rcm.unposted_ra.n} onClick={() => router.push("/remittance")}><LocalizedText message="Post" /></Button> },
  ];
  return (
    <Panel>
      <PanelHeader title="Revenue cycle" sub={t("{value0} outstanding with payers across {value1}", { value0: moneyC(d.rcm.outstanding.v), value1: plural(d.rcm.outstanding.n, "claim") })} />
      <ul className="flex-1 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 px-4 py-2.5">
            <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[r.tone].bg, TONE[r.tone].text)}><r.icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="num text-[13px] font-medium"><LocalizedText message={r.label} values={{ value0: int(r.n) }} /></p>
              <p className="num truncate text-xs text-ink-3"><LocalizedText message="{value0}, {value1}" values={{ value0: moneyC(r.v), value1: t(r.sub) }} /></p>
            </div>
            {r.action}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 border-t border-line">
        <div className="px-4 py-2.5"><p className="text-[11.5px] text-ink-3"><LocalizedText message="Denial rate, 30 days" /></p><p className={clsx("num text-[15px] font-semibold", d.rcm.denial_rate > 10 ? "text-danger" : "text-ink")}>{num(d.rcm.denial_rate)}%</p></div>
        <div className="border-l border-line px-4 py-2.5"><p className="text-[11.5px] text-ink-3"><LocalizedText message="Collected from payers, 30 days" /></p><p className="num text-[15px] font-semibold">{moneyC(d.rcm.collected_30d)}</p></div>
      </div>
    </Panel>
  );
}

function StockWatch({ d }: { d: D }) {
  const { t, moneyC, plural } = usePharmacyFormat();
  const rows = [
    { icon: Truck, label: "At or below reorder level", value: plural(d.stock.low, "product"), href: "/purchasing?tab=suggestions", tone: d.stock.low ? "warn" : "muted" },
    { icon: Boxes, label: "Expiring within 90 days", value: t("{value0}, {value1}", { value0: plural(d.stock.near_expiry.n, "batch"), value1: moneyC(d.stock.near_expiry.v) }), href: "/inventory?tab=expiry", tone: d.stock.near_expiry.n ? "warn" : "muted" },
    { icon: CircleAlert, label: "Expired, awaiting disposal", value: t("{value0}, {value1}", { value0: plural(d.stock.expired.n, "batch"), value1: moneyC(d.stock.expired.v) }), href: "/inventory?tab=expiry&filter=expired", tone: d.stock.expired.n ? "danger" : "muted" },
    { icon: Snowflake, label: "Quarantined or recalled", value: plural(d.stock.quarantined, "batch"), href: "/inventory?tab=expiry&filter=quarantined", tone: d.stock.quarantined ? "violet" : "muted" },
  ] as const;
  return (
    <Panel>
      <PanelHeader title="Stock watch" sub={t("{value0} sellable stock at cost", { value0: moneyC(d.stock.value) })} />
      <ul className="flex-1 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label}>
            <Link href={r.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
              <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[r.tone].bg, TONE[r.tone].text)}><r.icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium"><LocalizedText message={r.label} /></p>
                <p className="num truncate text-xs text-ink-3">{r.value}</p>
              </div>
              <ChevronRight className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Trend({ d }: { d: D }) {
  const { t, compact, dateShort, money, moneyC } = usePharmacyFormat();
  const total = d.trend.reduce((s, x) => s + x.rx + x.otc, 0);
  return (
    <Panel>
      <PanelHeader title="Revenue, last 14 days" sub={t("{value0} finalized", { value0: moneyC(total) })}
        actions={<div className="flex items-center gap-3 text-[11.5px] text-ink-3"><span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-cobalt" /><LocalizedText message="Prescriptions" /></span><span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-amber-mark" /><LocalizedText message="Counter" /></span></div>} />
      <div className="flex min-h-[150px] flex-1 flex-col justify-end px-4 pb-2 pt-3">
        <StackedColumns height={130} format={(n) => money(n)} data={d.trend.map((x) => ({ label: dateShort(x.day), a: x.rx, b: x.otc }))} />
        <div className="mt-1 flex justify-between text-[10.5px] text-ink-3">
          {d.trend.filter((_, i) => i % 3 === 0 || i === d.trend.length - 1).map((x) => <span key={x.day}>{dateShort(x.day)}</span>)}
        </div>
      </div>
      <p className="num border-t border-line px-4 py-2 text-xs text-ink-3"><LocalizedText message="Peak day {value0}, average {value1} per day" values={{ value0: compact(Math.max(...d.trend.map((x) => x.rx + x.otc))), value1: compact(total / Math.max(d.trend.length, 1)) }} /></p>
    </Panel>
  );
}

function Activity({ d }: { d: D }) {
  const { agoLong, ago, entityLabel } = usePharmacyFormat();
  return (
    <Panel>
      <PanelHeader title="Live activity" actions={<span className="flex items-center gap-1.5 text-[11.5px] text-ok"><span className="live-dot size-1.5 rounded-full bg-ok" /><LocalizedText message="Live" /></span>} />
      {d.urgent.length > 0 && (
        <div className="border-b border-line bg-amber-wash/60 px-4 py-2">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber"><Siren className="size-3.5" /><LocalizedText message="Urgent and stat, not yet supplied" /></p>
          {d.urgent.map((u) => (
            <Link key={u.id} href={`/workbench?rx=${u.id}`} className="flex items-center gap-2 py-0.5 text-[12.5px] hover:underline">
              <span className="num font-medium">{u.rx_no}</span><span className="truncate text-ink-2">{u.patient_name}</span>
              <span className="ml-auto shrink-0 text-ink-3">{ago(u.received_at)}</span>
            </Link>
          ))}
        </div>
      )}
      <ul className="scroll-y min-h-0 flex-1 px-4 py-1">
        {d.activity.length === 0 && <EmptyState title="No activity yet today" />}
        {d.activity.map((a) => (
          <li key={a.id} className="flex gap-2.5 py-1.5">
            <span className={clsx("mt-1.5 size-1.5 shrink-0 rounded-full", TONE[statusOf(a.to_status).tone].dot)} />
            <div className="min-w-0 flex-1 text-[12.5px]">
              <p className="truncate"><span className="text-ink-3">{entityLabel(a.entity)}</span> <span className="num font-medium">{a.ref}</span> <StatusPill status={a.to_status} className="ml-0.5 align-middle" /></p>
              <p className="truncate text-[11.5px] text-ink-3">{a.actor_name ?? a.actor}, {agoLong(a.at)}{a.note ? `. ${a.note}` : ""}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 p-5">
      <Skeleton className="h-36" />
      <div className="grid gap-4 xl:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
    </div>
  );
}
