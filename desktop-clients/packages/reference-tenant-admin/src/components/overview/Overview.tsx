"use client";
import { useEffect, useRef } from "react";
import { Check, CircleDashed, Clock3, Inbox, Minus, RefreshCw } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink } from "@pepbits/reference-host";
import { useApi } from "../../lib/api";
import { cx } from "../../lib/cx";
import { useTenantFormat } from "../../lib/format";
import { Icon } from "../../lib/icons";
import type { AuditEvent } from "../../lib/types";
import { tenantAdminPaths } from "../../routes";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { Card, CardGrid, SourceButton } from "../ui/controls";

interface Check { label: string; ok: boolean; detail: string; href: string }
interface Stage { key: string; title: string; summary: string; optional?: boolean; checks: Check[]; done: number; total: number; state: "complete" | "partial" | "missing" }
interface OverviewData {
  stages: Stage[]; billingOpen: boolean;
  totals: { pending: number; drafts: number; effective: number; records: number };
  upcoming: { resource: string; code: string; name: string; effectiveFrom: string; id: number }[];
  recent: AuditEvent[];
}
interface Pending { resource: string; resourceLabel: string; id: number; code: string; name: string; revision: number; submittedBy: number; submittedAt: string; effectiveFrom: string | null }

/** `href` values in the overview payload are source paths (`/config/items`); they stay inside the module. */
const inModule = (href: string) => (href.startsWith("/") && !href.startsWith("//") ? href : tenantAdminPaths.overview());

export function Overview() {
  const { meta, user, resource, actor, pending: pendingMap, pendingReady } = useApp();
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const overview = useApi<OverviewData>("/overview", { revalidateOnFocus: false });
  const approvals = useApi<Pending[]>("/approvals", { revalidateOnFocus: false });
  const data = overview.data ?? null;
  const queue = approvals.data ?? [];
  const error = overview.error?.message ?? approvals.error?.message ?? null;
  const { mutate: reloadOverview } = overview;
  const { mutate: reloadApprovals } = approvals;
  const load = () => { void reloadOverview(); void reloadApprovals(); };

  // The source re-read both whenever the pending counts changed (the shell polls them); a change in the counts is the cue.
  // The first answer is not a change: the page has just read the same data.
  const signature = JSON.stringify(pendingMap);
  const lastSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingReady) return;
    if (lastSignature.current !== null && lastSignature.current !== signature) { void reloadOverview(); void reloadApprovals(); }
    lastSignature.current = signature;
  }, [signature, pendingReady, reloadOverview, reloadApprovals]);

  if (error && !data) return <Card shadow="none" tone="transparent" className="panel p-8"><p role="alert" className="font-semibold"><LocalizedText message="Couldn’t load the overview" /></p><p className="text-muted"><LocalizedText message={error} /></p><SourceButton className="btn-quiet mt-3" onClick={load}><LocalizedText message="Try again" /></SourceButton></Card>;
  if (!data) return <div role="status" aria-label={t("Loading")} className="h-full animate-pulse rounded-[14px] bg-white/60" />;

  const required = data.stages.filter((s) => !s.optional);
  const ready = required.filter((s) => s.state === "complete").length;
  const mine = queue.filter((q) => q.submittedBy !== actor.id).length;
  const lead = mine
    ? t("{value0} of {value1} required setup stages are complete. {value2} changes are waiting for an independent approver, {value4} of which you can decide, and {value3} drafts are in progress.", { value0: fmt.int(ready), value1: fmt.int(required.length), value2: fmt.int(data.totals.pending), value3: fmt.int(data.totals.drafts), value4: fmt.int(mine) })
    : t("{value0} of {value1} required setup stages are complete. {value2} changes are waiting for an independent approver, and {value3} drafts are in progress.", { value0: fmt.int(ready), value1: fmt.int(required.length), value2: fmt.int(data.totals.pending), value3: fmt.int(data.totals.drafts) });

  return (
    <CardGrid className="h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      {/* Status statement */}
      <section className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[26px] font-semibold leading-tight">
            <LocalizedText message={data.billingOpen ? "Billing is open for {value0}" : "Billing is closed for {value0}"} values={{ value0: meta.tenant.name }} />
          </h2>
          <p className="mt-1 max-w-[72ch] text-[13.5px] text-muted">{lead}</p>
        </div>
        <dl className="flex gap-6">
          <Stat label="In force" value={fmt.int(data.totals.effective)} />
          <Stat label="Awaiting approval" value={fmt.int(data.totals.pending)} tone="saffron" />
          <Stat label="Drafts" value={fmt.int(data.totals.drafts)} tone="cobalt" />
        </dl>
        <SourceButton className="btn-ghost btn-sm" onClick={load}><RefreshCw className="h-4 w-4" /> <LocalizedText message="Refresh" /></SourceButton>
      </section>

      {/* Activation path */}
      <Card as="section" shadow="none" tone="transparent" className="panel px-5 pb-4 pt-4" aria-label={t("Activation path")}>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h3 className="text-[16px] font-semibold"><LocalizedText message="Activation path" /></h3>
          <p className="text-[12px] text-muted"><LocalizedText message="Stages follow the recommended setup order. A missing required stage keeps billing closed." /></p>
        </div>
        <ol className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 xl:grid-cols-8">
          {data.stages.map((s, i) => (
            <li key={s.key} className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  s.state === "complete" && "bg-jade-600 text-white",
                  s.state === "partial" && "bg-saffron-500 text-spruce-950",
                  s.state === "missing" && (s.optional ? "border border-dashed border-[#93A3A0] text-muted" : "bg-madder-600 text-white"))}>
                  {s.state === "complete" ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cx("hidden h-[2px] flex-1 rounded xl:block", i === data.stages.length - 1 ? "bg-transparent" : s.state === "complete" ? "bg-jade-500" : "bg-line")} />
              </div>
              <p className="mt-2 font-display text-[14.5px] font-semibold leading-tight"><LocalizedText message={s.title} />{s.optional && <span className="ml-1 font-sans text-[11px] font-medium text-muted"><LocalizedText message="optional" /></span>}</p>
              <p className="text-[11.5px] text-muted"><LocalizedText message={s.summary} /></p>
              <ul className="mt-2 space-y-1">
                {s.checks.map((c) => (
                  <li key={c.label}>
                    <ReferenceLink href={inModule(c.href)} className="group flex items-start gap-1.5 rounded text-[12px] leading-snug hover:text-spruce-700">
                      {c.ok ? <Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-jade-600" strokeWidth={2.5} /> : s.optional ? <Minus className="mt-[2px] h-3.5 w-3.5 shrink-0 text-muted" /> : <CircleDashed className="mt-[2px] h-3.5 w-3.5 shrink-0 text-madder-600" />}
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:underline"><LocalizedText message={c.label} /></span>
                        <span className="block truncate text-[11px] text-muted" title={c.detail}><LocalizedText message={c.detail} /></span>
                      </span>
                    </ReferenceLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>

      {/* Working panels */}
      <section className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Waiting for a decision" action={<ReferenceLink href={tenantAdminPaths.approvals()} className="text-[12px] font-semibold text-spruce-700 hover:underline"><LocalizedText message="Open approvals" /></ReferenceLink>}>
          {queue.length === 0 && <Empty icon={<Inbox className="h-5 w-5" />} text="Nothing is waiting. New submissions appear here." />}
          {queue.map((q) => {
            const r = resource(q.resource);
            const blocked = q.submittedBy === actor.id;
            return (
              <ReferenceLink key={`${q.resource}-${q.id}`} href={tenantAdminPaths.resource(q.resource, { open: q.id })} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-mist">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-saffron-50 text-saffron-700"><Icon name={r?.icon ?? "Boxes"} className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{q.name}</span>
                  <span className="block truncate text-[11.5px] text-muted">{q.resourceLabel}, {q.code} {`r${q.revision}`}{q.effectiveFrom ? `, ${t("from {value0}", { value0: fmt.date(q.effectiveFrom) })}` : ""}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Avatar user={user(q.submittedBy)} size="sm" />
                  <span className={cx("text-[10.5px]", blocked ? "text-muted" : "font-semibold text-jade-700")}><LocalizedText message={blocked ? "Yours" : "You can decide"} /></span>
                </span>
              </ReferenceLink>
            );
          })}
        </Panel>

        <Panel title="Coming into effect">
          {data.upcoming.length === 0 && <Empty icon={<Clock3 className="h-5 w-5" />} text="No approved versions are scheduled for a future date." />}
          {data.upcoming.map((u) => {
            const days = Math.round((new Date(u.effectiveFrom + "T00:00:00Z").getTime() - Date.now()) / 86400000);
            return (
              <ReferenceLink key={`${u.resource}-${u.id}`} href={tenantAdminPaths.resource(u.resource, { open: u.id })} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-mist">
                <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-jade-50 py-1 text-jade-700">
                  <span className="text-[15px] font-bold leading-none">{fmt.int(Math.max(days, 0))}</span>
                  <span className="text-[10px]"><LocalizedText message={days === 1 ? "day" : "days"} /></span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{u.name}</span>
                  <span className="block truncate text-[11.5px] text-muted">{t("{value0}, from {value1}", { value0: resource(u.resource)?.label ?? u.resource, value1: fmt.date(u.effectiveFrom) })}</span>
                </span>
              </ReferenceLink>
            );
          })}
        </Panel>

        <Panel title="Recent activity" action={<ReferenceLink href={tenantAdminPaths.activity()} className="text-[12px] font-semibold text-spruce-700 hover:underline"><LocalizedText message="Full audit trail" /></ReferenceLink>}>
          {data.recent.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-2 py-2">
              <Avatar user={user(e.actorId)} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-snug"><LocalizedText message={e.summary} /></span>
                <span className="block text-[11px] text-muted">{user(e.actorId)?.name}, {fmt.relative(e.at)}, {resource(e.resource)?.label}</span>
              </span>
            </div>
          ))}
        </Panel>
      </section>
    </CardGrid>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "saffron" | "cobalt" }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted"><LocalizedText message={label} /></dt>
      <dd className={cx("font-display text-[24px] font-semibold leading-none", tone === "saffron" && "text-saffron-700", tone === "cobalt" && "text-cobalt-700")}>{value}</dd>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card shadow="none" tone="transparent" className="panel flex min-h-[220px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-[15px] font-semibold"><LocalizedText message={title} /></h3>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
    </Card>
  );
}

const Empty = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-8 text-center text-[12.5px] text-muted">{icon}<LocalizedText message={text} /></div>
);
