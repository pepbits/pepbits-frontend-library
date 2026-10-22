'use client';

import clsx from 'clsx';
import { ArrowRight, BadgeCheck, FilePlus2, Landmark, Search, Send, Undo2, Vault, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Timeline } from '@/components/bill/BillTabs';
import { useShell } from '@/components/shell/AppShell';
import { ErrorNote, Skeleton } from '@/components/ui/primitives';
import { useApi } from '@/lib/api';
import { money } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { AuditEntry } from '@/lib/types';

interface Dash {
  today: string; inflow: number; outflow: number; net: number; mine: number; count: number; counterClosed: boolean;
  byMode: { mode: string; amount: number }[]; hourly: { hour: number; amount: number }[];
  stats: { open_bills: number; finalized_with_due: number; overpaid: number; claims_to_send: number; patient_outstanding: number; sponsor_outstanding: number };
  approvals: { kind: string; n: number }[]; unrealized: { n: number; amount: number };
  attention: { bill_no: string; status: string; patient_due: number; sponsor_due: number; is_tpa: number; claim_status: string; patient_name: string; pending_results: number; pending_approvals: number }[];
  recent: AuditEntry[];
}

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function DeskPage() {
  const { meta } = useSession();
  const { openNewBill, openSearch } = useShell();
  const { data, error, reload } = useApi<Dash>('/dashboard');
  const me = meta?.me;
  const approvalsN = data?.approvals.reduce((s, a) => s + a.n, 0) || 0;

  const queue = data ? [
    { show: data.stats.overpaid > 0, icon: Undo2, tone: 'rose', title: `${data.stats.overpaid} bill${data.stats.overpaid > 1 ? 's are' : ' is'} overpaid`, body: 'Finalize to move the excess to deposit, or refund it.', href: '/bills?due=overpaid' },
    { show: data.stats.finalized_with_due > 0, icon: Wallet, tone: 'due', title: `${data.stats.finalized_with_due} finalized bill${data.stats.finalized_with_due > 1 ? 's' : ''} still owed`, body: `${money(data.stats.patient_outstanding, { whole: true })} outstanding from patients.`, href: '/bills?status=F&due=patient' },
    { show: approvalsN > 0, icon: BadgeCheck, tone: 'due', title: `${approvalsN} approval${approvalsN > 1 ? 's' : ''} waiting`, body: data.approvals.map((a) => `${a.n} ${a.kind === 'writeoff' ? 'write-off' : a.kind}`).join(', '), href: '/approvals' },
    { show: data.stats.claims_to_send > 0, icon: Send, tone: 'indigo', title: `${data.stats.claims_to_send} claim${data.stats.claims_to_send > 1 ? 's' : ''} ready to send`, body: 'Finalized insured bills not yet sent to the sponsor.', href: '/bills?status=F&insured=1' },
    { show: data.unrealized.n > 0, icon: Landmark, tone: 'indigo', title: `${data.unrealized.n} cheque${data.unrealized.n > 1 ? 's' : ''} to realize`, body: `${money(data.unrealized.amount, { whole: true })} in deposits waiting on the bank.`, href: '/receipts?unrealized=1' },
  ].filter((x) => x.show) : [];

  const maxHour = Math.max(1, ...(data?.hourly.map((h) => Math.abs(h.amount)) || [1]));
  const nowH = new Date().getHours();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 pt-1 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{greet()}, {me?.name.split(' ')[0] || '…'}</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {me?.counter_name ? <> — you’re at <b className="font-medium text-ink">{me.counter_name}</b></> : <> — <span className="text-marigold-800">pick a counter in the header to take payments</span></>}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <QuickAction icon={FilePlus2} label="New bill" kbd="N" onClick={() => openNewBill()} primary />
          <QuickAction icon={Search} label="Find anything" kbd="/" onClick={openSearch} />
          <QuickAction icon={Wallet} label="Collect deposit" href="/patients" />
          <QuickAction icon={Vault} label="Close counter" href="/day-close" />
        </div>
      </div>

      {error && <ErrorNote error={error} onRetry={reload} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        <div className="flex flex-col gap-5">
          <section className="panel">
            <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-[15px] font-semibold">Needs your attention</h2>
              {data && <span className="text-[12.5px] text-ink-mute">{data.stats.open_bills} open bills in total</span>}
            </header>
            {!data ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> : queue.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-ink-soft">Nothing waiting. Every bill, claim and approval is up to date.</p>
            ) : (
              <ul className="divide-y divide-line">
                {queue.map((x) => (
                  <li key={x.title}>
                    <Link href={x.href} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-mist/60">
                      <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        x.tone === 'rose' && 'bg-rose-50 text-rose-600', x.tone === 'due' && 'bg-marigold-50 text-marigold-800', x.tone === 'indigo' && 'bg-indigo-50 text-indigo-600')}>
                        <x.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-medium">{x.title}</span>
                        <span className="block truncate text-[13px] text-ink-soft">{x.body}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-ink-mute transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {data && data.attention.length > 0 && (
              <div className="border-t border-line px-5 py-3">
                <p className="mb-2 text-[12px] font-medium text-ink-mute">Bills to look at first</p>
                <div className="flex flex-wrap gap-2">
                  {data.attention.map((b) => (
                    <Link key={b.bill_no} href={`/bills/${b.bill_no}`} className="rounded-lg border border-line px-3 py-2 text-[12.5px] transition-colors hover:border-pine-500 hover:bg-pine-50/50">
                      <span className="font-semibold">{b.bill_no}</span> <span className="text-ink-soft">{b.patient_name}</span>
                      <span className={clsx('ml-2 font-medium', b.patient_due < 0 ? 'text-rose-600' : 'text-marigold-800')}>
                        {b.patient_due < -0.004 ? `overpaid ${money(-b.patient_due, { whole: true })}` : b.patient_due > 0.004 ? `owes ${money(b.patient_due, { whole: true })}` : 'claim to send'}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="panel max-h-[440px] overflow-y-auto">
            <header className="sticky top-0 z-[2] flex items-center justify-between border-b border-line bg-white px-5 py-3.5">
              <h2 className="text-[15px] font-semibold">Recent activity</h2>
              <Link href="/audit" className="text-[13px] font-medium text-pine-700 hover:underline">Full audit trail</Link>
            </header>
            {data ? <Timeline entries={data.recent} showBill /> : <Skeleton className="m-4 h-40" />}
          </section>
        </div>

        {/* Till tape */}
        <section aria-label="Today’s collections" className="self-start">
          <div className="relative overflow-hidden rounded-t-panel border border-b-0 border-line bg-white px-6 pb-5 pt-5">
            <div className="flex items-baseline justify-between border-b border-dashed border-line-strong pb-3">
              <h2 className="text-[15px] font-semibold">Today’s till</h2>
              <span className="text-[12.5px] text-ink-mute">{data?.count ?? '…'} entries, all counters</span>
            </div>
            {!data ? <Skeleton className="mt-4 h-48" /> : (
              <>
                <ul className="mt-3 space-y-2 text-[14px]">
                  {data.byMode.length === 0 && <li className="py-4 text-center text-ink-soft">No money moved yet today.</li>}
                  {data.byMode.map((m) => (
                    <li key={m.mode} className="flex items-baseline gap-2">
                      <span>{m.mode}</span>
                      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-line-strong" aria-hidden />
                      <span className={clsx('font-medium tabular-nums', m.amount < 0 && 'text-rose-600')}>{money(m.amount)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-1.5 border-t border-dashed border-line-strong pt-3 text-[13.5px]">
                  <Row label="Money in" value={money(data.inflow)} />
                  <Row label="Refunds out" value={money(data.outflow)} tone={data.outflow < 0 ? 'rose' : undefined} />
                  {me?.counter_id ? <Row label={`At ${me.counter_name}`} value={money(data.mine)} /> : null}
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-3">
                  <span className="text-[14px] font-semibold">Net collected</span>
                  <span className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums">{money(data.net)}</span>
                </div>
                <div className="mt-5">
                  <div className="flex h-16 items-end gap-[3px]" aria-label="Collections by hour">
                    {data.hourly.slice(7, 22).map((h) => (
                      <div key={h.hour} className="group relative flex h-full flex-1 items-end">
                        <div className={clsx('w-full rounded-t-[3px] transition-colors', h.amount < 0 ? 'bg-rose-200' : h.hour === nowH ? 'bg-marigold-500' : 'bg-pine-200 group-hover:bg-pine-500')}
                          style={{ height: `${Math.max(3, (Math.abs(h.amount) / maxHour) * 100)}%` }} />
                        <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[11px] text-white group-hover:block">{h.hour}:00 {money(h.amount, { whole: true })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-ink-mute"><span>7 am</span><span>2 pm</span><span>9 pm</span></div>
                </div>
              </>
            )}
          </div>
          {data && (
            <Link href="/day-close" className={clsx('flex items-center justify-between rounded-b-panel border border-t-0 px-6 py-3 text-[13px] font-medium transition-colors',
              data.counterClosed ? 'border-pine-100 bg-pine-50 text-pine-800' : 'border-line bg-mist text-ink hover:bg-mist-2')}>
              {data.counterClosed ? 'Your counter is closed for today' : 'Count cash and close your counter'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'rose' }) {
  return <div className="flex justify-between"><span className="text-ink-soft">{label}</span><span className={clsx('tabular-nums', tone === 'rose' && 'text-rose-600')}>{value}</span></div>;
}

function QuickAction({ icon: Icon, label, onClick, href, kbd, primary }: { icon: React.ElementType; label: string; onClick?: () => void; href?: string; kbd?: string; primary?: boolean }) {
  const cls = clsx('inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-[13.5px] font-medium transition-colors',
    primary ? 'bg-pine-600 text-white hover:bg-pine-700' : 'border border-line bg-white hover:border-line-strong');
  const inner = <><Icon className="h-4 w-4" />{label}{kbd && <kbd className={clsx('ml-1 hidden rounded border px-1 text-[11px] sm:inline', primary ? 'border-white/30 text-white/80' : 'border-line text-ink-mute')}>{kbd}</kbd>}</>;
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}
