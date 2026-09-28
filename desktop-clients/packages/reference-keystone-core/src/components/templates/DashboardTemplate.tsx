'use client';
import { Card as SharedCard, CardGrid, Table, TableContainer } from '@pepbits/ops-ui';
import Link from '../../lib/navigation';
import { useState } from 'react';
import { useRouter } from '../../lib/navigation';
import { useKeystoneVariant } from '../../lib/variant';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { PageDef } from '../../lib/types';
import { cx, relativeDays, statusTone, useFormat } from '../../lib/format';
import { useFetch } from '../../lib/client';
import { Avatar, Badge, ErrorNote, Panel, Skeleton, StatusBadge } from '../ui';
import { Frame } from './shared';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


interface Kpi { key: string; label: string; value: number; format: 'currency' | 'number'; delta: number; spark: number[]; note?: string }
interface Dash {
  kpis: Kpi[];
  months: string[];
  sales: number[];
  purchases: number[];
  statusSplit: { label: string; value: number }[];
  topCustomers: { name: string; value: number; group: string }[];
  recentOrders: { id: string; code: string; customer: string; date: string; total: number; status: string }[];
  approvals: { id: string; code: string; type: string; requester: string; amount: number; days?: number; priority: string; submitted: string }[];
  pendingApprovals: number;
  openTickets: number;
  purchaseValue: number;
}

function Spark({ values, up }: { values: number[]; up: boolean }) {
  const w = 96, h = 30;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} aria-hidden className="overflow-visible">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={up ? 'var(--ok-soft)' : 'var(--danger-soft)'} />
      <path d={d} fill="none" stroke={up ? 'var(--ok)' : 'var(--danger)'} strokeWidth={1.6} />
    </svg>
  );
}

function TrendChart({ months, a, b }: { months: string[]; a: number[]; b: number[] }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCompact, fmtCurrency } = useFormat();
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 230, L = 48, R = 12, T = 12, B = 26;
  const max = Math.max(...a, ...b) * 1.1;
  const x = (i: number) => L + (i / (months.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <div className="relative h-full min-h-[230px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(months.length - 1, Math.round(((px - L) / (W - L - R)) * (months.length - 1)))));
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={referenceT("Monthly sales and purchases for the last twelve months")}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? '3 4' : undefined} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={10.5} fill="var(--ink-3)">{fmtCompact(t).replace(/\.0(?=[A-Z])/, '')}</text>
          </g>
        ))}
        {months.map((m, i) => <text key={m + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">{m}</text>)}
        <path d={`${line(a)} L${x(a.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--brand)" opacity={0.1} />
        <path d={line(a)} fill="none" stroke="var(--brand)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        <path d={line(b)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--ink-3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(a[hover])} r={4} fill="var(--brand)" />
            <circle cx={x(hover)} cy={y(b[hover])} r={4} fill="var(--accent)" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[length:calc(12px*var(--fs-scale))] shadow-pop" style={{ left: `clamp(8px, calc(${(x(hover) / W) * 100}% - 70px), calc(100% - 160px))` }}>
          <div className="font-semibold">{months[hover]}</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /><ReferenceText message="Sales" /> <span className="ml-auto pl-3 tnum">{fmtCurrency(a[hover])}</span></div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /><ReferenceText message="Purchases" /> <span className="ml-auto pl-3 tnum">{fmtCurrency(b[hover])}</span></div>
        </div>
      )}
    </div>
  );
}

const DONUT_TONE: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--accent)', danger: 'var(--danger)', info: 'var(--info)', neutral: 'var(--line-strong)', brand: 'var(--brand)', violet: 'var(--violet)' };
const colorOf = (label: string, i: number) => (label === 'Partially paid' ? 'var(--info)' : label === 'Unpaid' ? 'var(--violet)' : DONUT_TONE[statusTone(label)] ?? ['var(--brand)', 'var(--info)'][i % 2]);
function Donut({ parts }: { parts: { label: string; value: number }[] }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCompact } = useFormat();
  const [hover, setHover] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  const focus = hover !== null ? parts[hover] : null;
  return (
    <div className="flex h-full flex-col items-center gap-3 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative shrink-0">
        <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label={referenceT("Invoice value by status")}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={18} />
          {parts.map((p, i) => {
            const len = (p.value / total) * c;
            const el = (
              <circle key={p.label} cx={70} cy={70} r={r} fill="none" stroke={colorOf(p.label, i)} strokeWidth={hover === i ? 22 : 18}
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer transition-[stroke-width]" />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[length:calc(15px*var(--fs-scale))] font-semibold tnum">{fmtCompact(focus?.value ?? total)}</div>
            <div className="text-[length:calc(11px*var(--fs-scale))] text-ink-3"><ReferenceText message={focus?.label ?? 'All invoices'} /></div>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-[length:calc(12.5px*var(--fs-scale))]">
        {parts.map((p, i) => (
          <li key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cx('flex items-center gap-2 rounded px-1.5 py-0.5', hover === i && 'bg-surface-2')}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(p.label, i) }} />
            <span className="flex-1 text-ink-2"><ReferenceText message={p.label} /></span>
            <span className="tnum">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Home screen: the four numbers that matter, trends, and what is waiting on you. */
export default function DashboardTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCompact, fmtCurrency, fmtDate, fmtNumber } = useFormat();
  void def;
  const router = useRouter();
  const { records } = useKeystoneVariant();
  const { data, loading, error, reload } = useFetch<Dash>('/api/dashboard');
  if (error) return <Frame><ErrorNote message={error} onRetry={reload} /></Frame>;
  const d = data;
  const maxTop = d ? Math.max(...d.topCustomers.map((c) => c.value)) : 1;

  return (
    <CardGrid data-reference-result className="grid grid-cols-1 gap-3 p-2 md:p-3 lg:grid-cols-12">
      {(d?.kpis ?? Array.from({ length: 4 }, () => null)).map((k, i) => (
        <SharedCard key={k?.key ?? i} shadow="none" className="px-4 py-3 lg:col-span-3">
          {!k ? (<><Skeleton className="mb-3 w-28" /><Skeleton className="h-6 w-32" /></>) : (
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message={k.label} /></div>
                <div className="mt-1 text-[length:calc(24px*var(--fs-scale))] font-semibold leading-7 tracking-tight tnum">{k.format === 'currency' ? fmtCompact(k.value) : fmtNumber(k.value)}</div>
                <div className={cx('mt-1 flex items-center gap-1 text-[length:calc(12px*var(--fs-scale))]', k.delta >= 0 ? 'text-ok' : 'text-danger')}>
                  {k.delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span className="tnum">{k.delta > 0 ? '+' : ''}{k.delta}%</span>
                  <span className="text-ink-3"><ReferenceText message={k.note ?? 'vs last period'} /></span>
                </div>
              </div>
              <Spark values={k.spark} up={k.delta >= 0} />
            </div>
          )}
        </SharedCard>
      ))}

      <Panel className="lg:col-span-8" title={referenceT("Sales and purchases, last 12 months")} bodyClass="p-3"
        actions={<div className="flex items-center gap-3 text-[length:calc(12px*var(--fs-scale))] text-ink-2"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" /><ReferenceText message="Sales" /></span><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-accent" /><ReferenceText message="Purchases" /></span></div>}>
        {d ? <TrendChart months={d.months} a={d.sales} b={d.purchases} /> : <Skeleton className="h-[230px] w-full" />}
      </Panel>
      <Panel className="lg:col-span-4" title={referenceT("Invoice value by status")} bodyClass="p-4" actions={<Link href="/reports/sales-register" className="text-[length:calc(12px*var(--fs-scale))] text-brand hover:underline"><ReferenceText message="Register" /></Link>}>
        {d ? <Donut parts={d.statusSplit} /> : <Skeleton className="h-36 w-full" />}
      </Panel>

      <Panel className="lg:col-span-5" title={referenceT("Recent sales orders")} actions={<Link href="/transactions/sales-orders" className="flex items-center gap-1 text-[length:calc(12px*var(--fs-scale))] text-brand hover:underline"><ReferenceText message="All orders" /><ArrowRight size={12} /></Link>}>
        <TableContainer overflow="horizontal" className="overflow-x-auto">
          <Table className="w-full text-[length:calc(13px*var(--fs-scale))]">
            <tbody>
              {(d?.recentOrders ?? []).map((o) => (
                <tr key={o.id} onClick={records ? () => router.push(`/transactions/sales-orders/${o.id}`) : undefined} className={records ? 'cursor-pointer border-b border-line last:border-0 hover:bg-surface-2' : 'border-b border-line last:border-0'}>
                  <td className="px-3.5 py-2 font-medium text-brand-ink tnum">{o.code}</td>
                  <td className="max-w-[180px] truncate px-2 py-2">{o.customer}</td>
                  <td className="px-2 py-2 text-ink-3 tnum">{fmtDate(o.date, false)}</td>
                  <td className="px-2 py-2 text-right tnum">{fmtCurrency(o.total)}</td>
                  <td className="px-3.5 py-2 text-right"><StatusBadge value={o.status} /></td>
                </tr>
              ))}
              {loading && !d && Array.from({ length: 6 }, (_, i) => <tr key={i}><td className="px-3.5 py-2.5"><Skeleton className="w-full" /></td></tr>)}
            </tbody>
          </Table>
        </TableContainer>
      </Panel>

      <Panel className="lg:col-span-4" title={referenceT("Waiting on you{value0}", {value0: d ? ` (${d.pendingApprovals})` : ''})} actions={<Link href="/workspace/approvals" className="flex items-center gap-1 text-[length:calc(12px*var(--fs-scale))] text-brand hover:underline"><ReferenceText message="Open inbox" /><ArrowRight size={12} /></Link>}>
        <ul className="divide-y divide-line">
          {(d?.approvals ?? []).map((a) => (
            <li key={a.id}>
              <Link href={records ? `/workspace/approvals/${a.id}` : '/workspace/approvals'} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-surface-2">
                <Avatar name={a.requester} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:calc(13px*var(--fs-scale))]">{a.type} <ReferenceText message="from" /> {a.requester}</span>
                  <span className="block text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{a.code}, {relativeDays(a.submitted)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[length:calc(12.5px*var(--fs-scale))] font-medium tnum">{a.type === 'Leave' ? `${a.days} days` : fmtCompact(a.amount)}</span>
                  {a.priority !== 'Normal' && <Badge tone={a.priority === 'Urgent' ? 'danger' : 'warn'}>{a.priority}</Badge>}
                </span>
              </Link>
            </li>
          ))}
          {loading && !d && Array.from({ length: 5 }, (_, i) => <li key={i} className="px-3.5 py-3"><Skeleton className="w-full" /></li>)}
        </ul>
      </Panel>

      <Panel className="lg:col-span-3" title={referenceT("Largest receivables")} bodyClass="p-3.5">
        <ul className="space-y-3">
          {(d?.topCustomers ?? []).map((c) => (
            <li key={c.name}>
              <div className="flex items-baseline justify-between gap-2 text-[length:calc(12.5px*var(--fs-scale))]">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 font-medium tnum">{fmtCompact(c.value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(c.value / maxTop) * 100}%` }} />
              </div>
            </li>
          ))}
          {d && (
            <li className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-[length:calc(12px*var(--fs-scale))]">
              <Link href="/transactions/support-tickets" className="rounded-md bg-surface-2 px-2.5 py-2 hover:bg-surface-3"><div className="text-ink-3"><ReferenceText message="Open tickets" /></div><div className="text-[length:calc(16px*var(--fs-scale))] font-semibold tnum">{d.openTickets}</div></Link>
              <Link href="/reports/purchase-register" className="rounded-md bg-surface-2 px-2.5 py-2 hover:bg-surface-3"><div className="text-ink-3"><ReferenceText message="Purchases" /></div><div className="text-[length:calc(16px*var(--fs-scale))] font-semibold tnum">{fmtCompact(d.purchaseValue)}</div></Link>
            </li>
          )}
        </ul>
      </Panel>
    </CardGrid>
  );
}
