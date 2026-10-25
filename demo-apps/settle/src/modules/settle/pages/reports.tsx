'use client';

import {TableRow} from '@pepbits/components';

import clsx from 'clsx';
import { Download } from '@pepbits/icons';
import { Link } from '../host';
import { usePathname, useRouter, useSearchParams } from '../host';
import { Suspense, useState } from 'react';
import { Button, Empty, ErrorNote, Input, Money, PageHeader, Skeleton, StatusBadge, SettleTable } from '../components/ui/primitives';
import { qs, useApi } from '../lib/api';
import { claimStatusLabel, daysAgoISO, todayISO, useFormat } from '../lib/format';
import { useExportRows } from '../lib/export';
import type { BillStatus } from '../lib/types';

const REPORTS: { key: string; label: string; sub: string; ranged?: boolean }[] = [
  { key: 'collections', label: 'Collections', sub: 'Money in and out by mode, counter, type and user', ranged: true },
  { key: 'payment-consolidated', label: 'Daily consolidated', sub: 'Each day’s advances, settlements, refunds and deposits', ranged: true },
  { key: 'patient-dues', label: 'Patient dues', sub: 'Who owes what, with ageing' },
  { key: 'sponsor-dues', label: 'Sponsor dues', sub: 'Outstanding claims by sponsor' },
  { key: 'outstanding-deposits', label: 'Deposit balances', sub: 'Unused deposits held for patients' },
  { key: 'reward-points', label: 'Reward points', sub: 'Point balances and their value' },
  { key: 'finance-postings', label: 'Finance postings', sub: 'Ledger lines FIN-011 to FIN-014', ranged: true },
];
type Key = 'collections' | 'payment-consolidated' | 'patient-dues' | 'sponsor-dues' | 'outstanding-deposits' | 'reward-points' | 'finance-postings';

export default function ReportsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Inner /></Suspense>;
}

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = (sp.get('r') as Key) || 'collections';
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const meta = REPORTS.find((r) => r.key === key) || REPORTS[0]!;
  const exporter = useExportRows();
  const { data, error, loading, reload } = useApi<Record<string, unknown>>(`/reports/${key}${meta.ranged ? qs({ from, to }) : ''}`);

  return (
    <div>
      <PageHeader title="Reports" sub="Pick a report on the left. Every report exports in your chosen export format." />
      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="panel h-max p-2" aria-label="Reports">
          {REPORTS.map((r) => (
            <button key={r.key} type="button" onClick={() => router.replace(`${pathname}?r=${r.key}`, { scroll: false })} aria-current={key === r.key ? 'page' : undefined}
              className={clsx('block w-full rounded-lg px-3 py-2.5 text-start transition-colors', key === r.key ? 'bg-pine-50' : 'hover:bg-mist')}>
              <span className={clsx('block text-[length:calc(14px*var(--fs-scale,1))] font-medium', key === r.key && 'text-pine-800')}>{r.label}</span>
              <span className="block text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{r.sub}</span>
            </button>
          ))}
        </nav>
        <section className="panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="me-auto text-[length:calc(16px*var(--fs-scale,1))] font-semibold">{meta.label}</h2>
            {meta.ranged && (
              <>
                <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 w-auto text-[length:calc(13px*var(--fs-scale,1))]" aria-label="From" />
                <span className="text-ink-mute">to</span>
                <Input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className="h-8 w-auto text-[length:calc(13px*var(--fs-scale,1))]" aria-label="To" />
              </>
            )}
            <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled={!data} onClick={() => data && exporter.save(`${key}-${todayISO()}`, reportRows(key, data))}>{exporter.label.replace('Export ', '')}</Button>
          </div>
          {error ? <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div> : loading && !data ? <Skeleton className="m-4 h-72" /> : data ? <Body k={key} d={data} /> : null}
        </section>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function reportRows(k: Key, d: any): Record<string, unknown>[] {
  const rows = k === 'collections' ? d.daily : k === 'finance-postings' ? d.lines.map((l: any) => ({ ...l, debit: `${l.debit[0]} ${l.debit[1]}`, credit: `${l.credit[0]} ${l.credit[1]}` })) : d.rows;
  return rows || [];
}

function BarList({ items, total }: { items: { key: string; amount: number; count?: number }[]; total?: number }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.amount)));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1 flex justify-between text-[length:calc(13px*var(--fs-scale,1))]"><span>{i.key}{i.count !== undefined && <span className="text-ink-mute"> ({i.count})</span>}</span><Money value={i.amount} className="font-medium" /></div>
          <div className="h-2 rounded-full bg-mist-2"><div className={clsx('h-2 origin-left animate-fill-in rounded-full', i.amount < 0 ? 'bg-rose-500' : 'bg-pine-500')} style={{ width: `${(Math.abs(i.amount) / max) * 100}%` }} /></div>
          {total ? <p className="mt-0.5 text-[length:calc(11.5px*var(--fs-scale,1))] text-ink-mute">{Math.round((i.amount / total) * 100)}% of net</p> : null}
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'due' | 'rose' }) {
  return <div className="bg-panel px-4 py-3"><p className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-soft">{label}</p><p className={clsx('text-[length:calc(20px*var(--fs-scale,1))] font-semibold', tone === 'due' && 'text-marigold-800', tone === 'rose' && 'text-rose-600')}>{value}</p></div>;
}

function Body({ k, d }: { k: Key; d: any }) {
  const { money, date } = useFormat();
  if (k === 'collections') {
    const max = Math.max(1, ...d.daily.map((x: any) => x.inflow));
    return (
      <div className="space-y-5 p-4">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          <Stat label="Net collected" value={money(d.total)} /><Stat label="Entries" value={d.count} /><Stat label="Average per day" value={money(d.total / Math.max(1, d.daily.length))} />
        </div>
        <div>
          <p className="mb-2 text-[length:calc(13px*var(--fs-scale,1))] font-semibold">Daily money in</p>
          <div className="flex h-40 items-end gap-1 overflow-x-auto rounded-xl border border-line p-3">
            {d.daily.map((x: any) => (
              <div key={x.date} className="group relative flex h-full min-w-[14px] flex-1 flex-col justify-end">
                <div className="origin-bottom rounded-t bg-pine-500 transition-colors group-hover:bg-pine-700" style={{ height: `${(x.inflow / max) * 100}%` }} />
                {x.outflow < 0 && <div className="mt-px rounded-b bg-rose-300" style={{ height: `${Math.min(30, (Math.abs(x.outflow) / max) * 100)}%` }} />}
                <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[length:calc(11px*var(--fs-scale,1))] text-panel group-hover:block">{date(x.date)}: {money(x.inflow, { whole: true })}</span>
              </div>
            ))}
            {!d.daily.length && <p className="m-auto text-[length:calc(13px*var(--fs-scale,1))] text-ink-mute">No collections in this period.</p>}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div><p className="mb-3 text-[length:calc(13px*var(--fs-scale,1))] font-semibold">By mode</p><BarList items={d.byMode} total={d.total} /></div>
          <div><p className="mb-3 text-[length:calc(13px*var(--fs-scale,1))] font-semibold">By type</p><BarList items={d.byType} /></div>
          <div><p className="mb-3 text-[length:calc(13px*var(--fs-scale,1))] font-semibold">By counter</p><BarList items={d.byCounter} /></div>
          <div><p className="mb-3 text-[length:calc(13px*var(--fs-scale,1))] font-semibold">By user</p><BarList items={d.byUser} /></div>
        </div>
      </div>
    );
  }
  if (k === 'payment-consolidated') {
    return (
      <div className="overflow-x-auto">
        <SettleTable>
          <thead><TableRow><th>Date</th>{d.types.map((t: string) => <th key={t} className="num">{t}</th>)}<th className="num">Net</th></TableRow></thead>
          <tbody>
            {d.rows.map((r: any) => <TableRow key={r.date}><td className="whitespace-nowrap font-medium">{date(r.date)}</td>{d.types.map((t: string) => <td key={t} className="num"><Money value={r[t]} /></td>)}<td className="num font-semibold"><Money value={r.net} /></td></TableRow>)}
            <TableRow className="bg-mist/70 font-semibold"><td>Total</td>{d.types.map((t: string) => <td key={t} className="num"><Money value={d.totals[t]} /></td>)}<td className="num"><Money value={d.totals.net} /></td></TableRow>
          </tbody>
        </SettleTable>
      </div>
    );
  }
  if (k === 'patient-dues') {
    return (
      <div>
        <div className="grid gap-px border-b border-line bg-line sm:grid-cols-5">
          <Stat label="Total owed" value={money(d.total, { whole: true })} tone="due" />
          {d.buckets.map((b: any) => <Stat key={b.label} label={`${b.label} (${b.count})`} value={money(b.amount, { whole: true })} />)}
        </div>
        <ReportTable rows={d.rows} cols={[
          ['Bill', (r) => <Link href={`/bills/${r.bill_no}`} className="font-medium text-pine-700 hover:underline">{r.bill_no}</Link>],
          ['Patient', (r) => <>{r.patient_name}<div className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{r.phone}</div></>],
          ['Status', (r) => <StatusBadge status={r.status as BillStatus} />],
          ['Age', (r) => `${r.age_days} days`],
          ['Write-off', (r) => (r.patient_writeoff === 'M' ? 'Requested' : '—')],
          ['Owes', (r) => <Money value={r.patient_due} tone="due" />, true],
        ]} />
      </div>
    );
  }
  if (k === 'sponsor-dues') {
    return (
      <div>
        <div className="grid gap-px border-b border-line bg-line sm:grid-cols-4">
          <Stat label="Total sponsor dues" value={money(d.total, { whole: true })} />
          {d.bySponsor.slice(0, 3).map((s: any) => <Stat key={s.sponsor} label={`${s.sponsor} (${s.count})`} value={money(s.due, { whole: true })} />)}
        </div>
        <ReportTable rows={d.rows} cols={[
          ['Bill', (r) => <Link href={`/bills/${r.bill_no}`} className="font-medium text-pine-700 hover:underline">{r.bill_no}</Link>],
          ['Patient', (r) => r.patient_name], ['Sponsor', (r) => <>{r.sponsor_name}<div className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{r.plan_name}</div></>],
          ['Claim', (r) => claimStatusLabel(r.claim_status)], ['Claimed', (r) => <Money value={r.claim} />, true],
          ['Received', (r) => <Money value={r.sponsor_receipts} />, true], ['Due', (r) => <Money value={r.sponsor_due} className="font-semibold" />, true],
        ]} />
      </div>
    );
  }
  if (k === 'outstanding-deposits') {
    return (
      <div>
        <div className="grid gap-px border-b border-line bg-line sm:grid-cols-2"><Stat label="Held for patients" value={money(d.total)} /><Stat label="Patients" value={d.rows.length} /></div>
        <ReportTable rows={d.rows} cols={[
          ['Patient', (r) => <Link href={`/patients/${r.mr_no}`} className="font-medium text-pine-700 hover:underline">{r.name}</Link>], ['MR', (r) => r.mr_no],
          ['Deposits', (r) => r.deposits], ['Last deposit', (r) => date(r.last_deposit)], ['Collected', (r) => <Money value={r.collected} />, true],
          ['Balance', (r) => <Money value={r.balance} className="font-semibold text-pine-700" />, true],
        ]} />
      </div>
    );
  }
  if (k === 'reward-points') {
    return (
      <div>
        <div className="grid gap-px border-b border-line bg-line sm:grid-cols-2"><Stat label="Points liability" value={money(d.liability)} /><Stat label="Value of one point" value={money(d.rate)} /></div>
        <ReportTable rows={d.rows} cols={[
          ['Patient', (r) => <Link href={`/patients/${r.mr_no}`} className="font-medium text-pine-700 hover:underline">{r.name}</Link>], ['Earned', (r) => r.earned, true],
          ['Used', (r) => r.redeemed, true], ['Balance', (r) => r.balance, true], ['Worth', (r) => <Money value={r.value} />, true],
        ]} />
      </div>
    );
  }
  // finance postings
  return (
    <div>
      <div className="grid gap-px border-b border-line bg-line sm:grid-cols-4">
        {d.summary.map((s: any) => <Stat key={s.fin} label={`${s.fin} (${s.count} lines)`} value={money(s.amount, { whole: true })} />)}
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_360px]">
        <div className="max-h-[520px] overflow-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Ledger lines">
          <SettleTable>
            <thead><TableRow><th>Touchpoint</th><th>Date</th><th>Reference</th><th>Debit</th><th>Credit</th><th className="num">Amount</th></TableRow></thead>
            <tbody>{d.lines.map((l: any, i: number) => (
              <TableRow key={i}>
                <td className="whitespace-nowrap"><span className="font-medium">{l.fin}</span><div className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{l.category}</div></td>
                <td className="whitespace-nowrap text-ink-soft">{date(l.date)}</td><td className="font-medium">{l.ref}</td>
                <td className="text-[length:calc(12.5px*var(--fs-scale,1))]">{l.debit[1]}<div className="text-ink-mute">{l.debit[0]}</div></td>
                <td className="text-[length:calc(12.5px*var(--fs-scale,1))]">{l.credit[1]}<div className="text-ink-mute">{l.credit[0]}</div></td>
                <td className="num font-medium">{money(l.amount)}</td>
              </TableRow>
            ))}</tbody>
          </SettleTable>
          {!d.lines.length && <Empty title="No postings in this period" />}
        </div>
        <div className="rounded-xl border border-line">
          <p className="border-b border-line px-4 py-2.5 text-[length:calc(13px*var(--fs-scale,1))] font-semibold">Trial balance for the period</p>
          <SettleTable>
            <thead><TableRow><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></TableRow></thead>
            <tbody>{d.accounts.map((a: any) => (
              <TableRow key={a.code}><td className="text-[length:calc(12.5px*var(--fs-scale,1))]">{a.name}<div className="text-ink-mute">{a.code}</div></td><td className="num">{money(a.debit)}</td><td className="num">{money(a.credit)}</td></TableRow>
            ))}
              <TableRow className="bg-mist/70 font-semibold"><td>Total</td>
                <td className="num">{money(d.accounts.reduce((s: number, a: any) => s + a.debit, 0))}</td>
                <td className="num">{money(d.accounts.reduce((s: number, a: any) => s + a.credit, 0))}</td></TableRow>
            </tbody>
          </SettleTable>
        </div>
      </div>
    </div>
  );
}

function ReportTable({ rows, cols }: { rows: any[]; cols: [string, (r: any) => React.ReactNode, boolean?][] }) {
  if (!rows.length) return <Empty title="Nothing to report" body="There’s no data for this report yet." />;
  return (
    <div className="max-h-[560px] overflow-auto">
      <SettleTable>
        <thead><TableRow>{cols.map(([h, , n]) => <th key={h} className={n ? 'num' : ''}>{h}</th>)}</TableRow></thead>
        <tbody>{rows.map((r, i) => <TableRow key={i}>{cols.map(([h, fn, n]) => <td key={h} className={n ? 'num' : ''}>{fn(r)}</td>)}</TableRow>)}</tbody>
      </SettleTable>
    </div>
  );
}
