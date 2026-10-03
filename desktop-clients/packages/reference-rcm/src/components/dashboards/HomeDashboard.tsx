"use client";
import { ArrowRight, Banknote, CircleAlert, FilePlus2, Inbox, PiggyBank, RadioTower, Receipt, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink } from "@pepbits/reference-host";
import { cx } from "../../lib/cx";
import { useRcmFormat } from "../../lib/format";
import type { Home } from "../../lib/types";
import { Icon } from "../../lib/icons";
import { rcmPaths, safeRcmHref } from "../../routes";
import { useApp } from "../shell/context";
import { Spark } from "./Charts";
import { DashSkeleton, useDashboard } from "./useDashboard";

const CAT_TINT: Record<string, string> = {
  front: "bg-signal-50 text-signal-700", charges: "bg-cobalt-50 text-cobalt-700", money: "bg-jade-50 text-jade-700", insurance: "bg-harbor-50 text-harbor-700",
  receivables: "bg-saffron-50 text-saffron-700", coding: "bg-madder-50 text-madder-700", accounting: "bg-harbor-100 text-harbor-800", cross: "bg-signal-50 text-signal-700",
};

/** The registry pages the "Start something" tiles open: each is shown only when the server lists the page and allows creating on it. */
const QUICK = [
  { resource: "estimates", message: "New estimate", icon: <Receipt className="h-4 w-4" /> },
  { resource: "deposits", message: "New deposit", icon: <PiggyBank className="h-4 w-4" /> },
  { resource: "receipts", message: "New receipt", icon: <Wallet className="h-4 w-4" /> },
  { resource: "manual-charges", message: "New manual charge", icon: <FilePlus2 className="h-4 w-4" /> },
] as const;

export function HomeDashboard() {
  const { actor, scopeInfo, resource } = useApp();
  const { data, error } = useDashboard<Home>("/dashboard/home");
  const fmt = useRcmFormat();
  const { t } = useLocalization();
  if (error) return <p role="alert" className="rounded-lg bg-madder-50 p-4 text-madder-700">{error}</p>;
  if (!data) return <DashSkeleton />;
  const cur = scopeInfo.currency;
  const hour = new Date().getHours();
  const busy = data.queues.filter((q) => q.count > 0).length;
  const quick = QUICK.filter((q) => resource(q.resource)?.create);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      {/* Cockpit band */}
      <section className="relative overflow-hidden rounded-[16px] bg-harbor-900 text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-signal-500/15 blur-2xl" />
        <div className="relative grid grid-cols-[1.25fr_repeat(4,minmax(0,1fr))] items-stretch divide-x divide-harbor-700">
          <div className="flex flex-col justify-between px-5 py-4">
            <div>
              <p className="text-[12px] text-harbor-200">{fmt.date(new Date().toISOString())} · {scopeInfo.label}</p>
              <h2 className="mt-1 text-[clamp(18px,1.6vw,22px)] font-semibold leading-tight">{t(hour < 12 ? "Good morning, {value0}" : hour < 17 ? "Good afternoon, {value0}" : "Good evening, {value0}", { value0: actor.name.split(" ")[0] })}</h2>
              <p className="mt-1 text-[12.5px] text-harbor-200"><LocalizedText message="{value0} of {value1} queues need attention. Cash by week, last 12 weeks:" values={{ value0: busy, value1: data.queues.length }} /></p>
            </div>
            <div className="mt-3 h-10" role="img" aria-label={t("Cash collected, last 12 weeks")}><Spark values={data.trend.map((w) => ({ label: t("Week of {value0}", { value0: fmt.date(w.date, false) }), value: w.value }))} /></div>
          </div>
          <Metric label={t("Cash collected today")} value={fmt.money(data.cashToday.value, cur)} sub={t("{value0} receipts", { value0: fmt.num(data.cashToday.count) })} href={rcmPaths.resource("receipts")} icon={<Wallet className="h-4 w-4" />} />
          <Metric label={t("Outstanding receivables")} value={fmt.money(data.outstanding, cur, { compact: true })} sub={t("Issued, not yet paid")} href={rcmPaths.aging()} icon={<Banknote className="h-4 w-4" />} />
          <Metric label={t("Denied claims")} value={fmt.money(data.deniedValue, cur, { compact: true })} sub={t("{value0} claims to work", { value0: fmt.num(data.deniedCount) })} href={rcmPaths.resource("claims", { status: "DENIED" })} icon={<CircleAlert className="h-4 w-4" />} alert={data.deniedCount > 0} />
          <Metric label={t("Waiting for a second person")} value={fmt.num(data.approvals)} sub={t("Across all workflows")} href={rcmPaths.approvals()} icon={<Inbox className="h-4 w-4" />} alert={data.approvals > 0} />
        </div>
      </section>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_340px] gap-3">
        {/* Queues */}
        <section className="panel flex min-h-0 flex-col p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold"><LocalizedText message="Today’s queues" /></h2>
            <span className="text-[11.5px] text-muted"><LocalizedText message="Click a queue to open it already filtered" /></span>
          </div>
          <div className="mt-3 grid min-h-0 flex-1 auto-rows-fr grid-cols-3 gap-2.5 overflow-y-auto">
            {data.queues.map((q) => (
              <ReferenceLink key={q.label} href={safeRcmHref(q.href)} className={cx("group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition", q.count ? "border-line bg-white hover:border-harbor-300 hover:shadow-pop" : "border-dashed border-line bg-mist/50")}>
                <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", q.count ? CAT_TINT[q.category] : "bg-white text-muted")}>
                  <Icon name={q.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[12.5px] font-semibold leading-snug">{q.label}</span>
                  <span className="block truncate text-[11.5px] text-muted">{q.value !== null && q.count ? fmt.money(q.value, cur, { compact: true }) : q.count ? t("Open the queue") : t("All clear")}</span>
                </span>
                <span className={cx("font-display text-[24px] font-semibold tabular-nums", !q.count && "text-harbor-200")}>{fmt.num(q.count)}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </ReferenceLink>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3">
          <section className="panel flex min-h-0 flex-1 flex-col p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold"><LocalizedText message="Cash drawers" /></h2>
              <ReferenceLink href={rcmPaths.resource("cash-sessions")} className="text-[12px] font-semibold text-signal-700 hover:underline"><LocalizedText message="All sessions" /></ReferenceLink>
            </div>
            <ul className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
              {data.drawers.length === 0 && <li className="text-[12.5px] text-muted"><LocalizedText message="No open drawers." /></li>}
              {data.drawers.map((d) => (
                <li key={d.id}>
                  <ReferenceLink href={rcmPaths.resource("cash-sessions", { open: d.id })} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 hover:bg-mist">
                    <span className={cx("h-2.5 w-2.5 rounded-full", d.status === "OPEN" ? "animate-pulse-soft bg-signal-500" : "bg-saffron-500")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">{d.cashier}</span>
                      <span className="block text-[11px] text-muted">{d.ref} · <LocalizedText message={d.status === "OPEN" ? "Open" : "Variance review"} /></span>
                    </span>
                    <span className="text-right text-[12px] font-semibold tabular-nums">{fmt.money(d.expected, d.currency)}<span className="block text-[10.5px] font-normal text-muted"><LocalizedText message="expected" /></span></span>
                  </ReferenceLink>
                </li>
              ))}
            </ul>
            <ReferenceLink href={rcmPaths.resource("exchange-messages", { status: "FAILED,DEAD_LETTER" })} className={cx("mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold", data.exchangeFailures ? "bg-madder-50 text-madder-700" : "bg-jade-50 text-jade-700")}>
              <RadioTower className="h-4 w-4" /> {data.exchangeFailures ? t("{value0} exchange messages failing", { value0: fmt.num(data.exchangeFailures) }) : t("Payer exchange healthy")}
            </ReferenceLink>
          </section>
          {quick.length > 0 && (
            <section className="panel p-4">
              <h2 className="text-[15px] font-semibold"><LocalizedText message="Start something" /></h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {quick.map((q) => <Quick key={q.resource} href={rcmPaths.resource(q.resource, { new: true })} icon={q.icon} label={t(q.message)} />)}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, href, icon, alert }: { label: string; value: string; sub: string; href: string; icon: ReactNode; alert?: boolean }) {
  return (
    <ReferenceLink href={href} className="group flex flex-col justify-between px-5 py-4 transition-colors hover:bg-harbor-800">
      <span className="flex items-center gap-2 text-[12px] text-harbor-200">{icon}{label}</span>
      <span className={cx("mt-3 whitespace-nowrap font-display text-[clamp(19px,1.75vw,26px)] font-semibold leading-none tabular-nums", alert && "text-saffron-400")}>{value}</span>
      <span className="mt-2 flex items-center justify-between text-[11.5px] text-harbor-300">{sub}<ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" /></span>
    </ReferenceLink>
  );
}

function Quick({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <ReferenceLink href={href} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold hover:border-harbor-300 hover:bg-mist">
      <span className="text-signal-600">{icon}</span>{label}
    </ReferenceLink>
  );
}
