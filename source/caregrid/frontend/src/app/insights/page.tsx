'use client';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { KIND_COLOR, KIND_LABEL } from '@/lib/meta';
import { dur } from '@/lib/time';
import { CatIcon, KindIcon, Meter, Skeleton } from '@/components/ui/primitives';

function Histogram({ h, planned, p75 }: { h: any; planned: number; p75: number }) {
  const max = Math.max(1, ...h.counts);
  const pos = (m: number) => Math.max(0, Math.min(100, ((m - h.lo) / Math.max(1, h.hi - h.lo)) * 100));
  return (
    <div className="relative h-10 w-full">
      <div className="flex h-full items-end gap-[2px]">
        {h.counts.map((c: number, i: number) => <div key={i} className="flex-1 rounded-t-sm bg-ink-200" style={{ height: `${(c / max) * 100}%` }} />)}
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${pos(planned)}%` }} title={`Planned ${planned} min`} />
      <div className="absolute inset-y-0 w-0.5 bg-marigold-500" style={{ left: `${pos(p75)}%` }} title={`75th percentile ${p75} min`} />
    </div>
  );
}

function Durations() {
  const { toast } = useLive();
  const { data, reload } = useApi<any[]>('/analytics/durations', { live: false });
  const [only, setOnly] = useState<'act' | 'all'>('act');
  const list = useMemo(() => (data ?? []).filter(d => only === 'all' || d.action !== 'keep'), [data, only]);
  const apply = async (d: any) => {
    try { await api(`/types/${d.type_id}`, { method: 'PATCH', body: { duration_min: d.suggested } }); reload(); }
    catch (e: any) { toast({ level: 'warning', title: 'Not applied', body: e.message }); }
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2 className="panel-title">Slot length advice</h2><p className="text-xs text-muted">From real start and finish times over the last 60 days. Suggested length = 75th percentile, rounded to 5 minutes.</p></div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-3 text-[0.7rem] text-muted md:flex"><span className="flex items-center gap-1"><span className="h-3 w-0.5 bg-ink" />Planned</span><span className="flex items-center gap-1"><span className="h-3 w-0.5 bg-marigold-500" />75th percentile</span></span>
          <div className="seg"><button data-on={only === 'act'} onClick={() => setOnly('act')}>Needs change</button><button data-on={only === 'all'} onClick={() => setOnly('all')}>All services</button></div>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(12rem,1.6fr)_4rem_minmax(8rem,1fr)_repeat(3,4.5rem)_5rem_9rem] items-center gap-3 border-y border-line bg-canvas px-4 py-2 text-[0.7rem] font-medium text-muted">
        <span>Service</span><span>Visits</span><span>Actual time spread</span><span>Planned</span><span>Median</span><span>75th pct</span><span>Overran</span><span className="text-right">Suggestion</span>
      </div>
      <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
        {!data && <div className="space-y-1.5 p-3">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}</div>}
        {list.map(d => (
          <div key={d.type_id} className="grid grid-cols-[minmax(12rem,1.6fr)_4rem_minmax(8rem,1fr)_repeat(3,4.5rem)_5rem_9rem] items-center gap-3 border-b border-line/60 px-4 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2"><CatIcon name={d.icon} className="h-4 w-4 shrink-0 text-ink-400" /><span className="min-w-0"><span className="block truncate text-ink">{d.name}</span><span className="block text-[0.68rem] text-muted">Median wait after arrival {d.median_wait} min</span></span></span>
            <span className="tabnum text-muted">{d.samples}</span>
            <Histogram h={d.histogram} planned={d.planned} p75={d.p75} />
            <span className="tabnum">{d.planned}′</span>
            <span className="tabnum">{d.median}′</span>
            <span className="font-semibold tabnum">{d.p75}′</span>
            <span className={clsx('tabnum', d.overrun_rate > 50 ? 'font-semibold text-crimson-600' : 'text-muted')}>{d.overrun_rate}%</span>
            <span className="flex justify-end">
              {d.action === 'keep' ? <span className="flex items-center gap-1 text-xs text-muted"><Minus className="h-3.5 w-3.5" />Keep {d.planned}′</span> : (
                <button onClick={() => apply(d)} className={clsx('btn-xs btn', d.action === 'lengthen' ? 'bg-marigold-50 text-marigold-700 hover:bg-marigold-100' : 'bg-teal-50 text-teal-700 hover:bg-teal-100')}>
                  {d.action === 'lengthen' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}Set {dur(d.suggested)}
                </button>
              )}
            </span>
          </div>
        ))}
        {data && !list.length && <div className="p-8 text-center text-sm text-muted">Every planned length matches reality. Nothing to change.</div>}
      </div>
    </section>
  );
}

function Utilization() {
  const { meta } = useLive();
  const [date, setDate] = useState('');
  const [dept, setDept] = useState('');
  const d = date || meta?.today || '';
  const { data } = useApi<any>(d ? '/analytics/utilization' + qs({ date: d, department: dept }) : null);
  const working = (data?.resources ?? []).filter((r: any) => r.available_min > 0);
  const hot = working.filter((r: any) => r.pct >= 85).sort((a: any, b: any) => b.pct - a.pct);
  const idle = working.filter((r: any) => r.pct < 10);
  const sorted = working.slice().sort((a: any, b: any) => b.pct - a.pct);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className="field w-auto" value={d} onChange={e => setDate(e.target.value)} />
        <select className="field w-auto" value={dept} onChange={e => setDept(e.target.value)}><option value="">All departments</option>{meta?.departments.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <span className="text-sm text-muted">{working.length} resources working on this day</span>
      </div>
      <div className="panel grid grid-cols-2 gap-x-6 gap-y-3 p-4 md:grid-cols-3 2xl:grid-cols-6">
        {(data?.byKind ?? []).map((k: any) => (
          <div key={k.kind}>
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium text-ink"><KindIcon kind={k.kind} className="h-3.5 w-3.5" />{KIND_LABEL[k.kind]}</span><span className="font-semibold text-ink tabnum">{k.pct}%</span></div>
            <Meter pct={k.pct} color={KIND_COLOR[k.kind]} className="mt-1.5" />
            <div className="mt-1 text-[0.68rem] text-muted">{dur(k.booked)} of {dur(k.available)}</div>
          </div>
        ))}
        {!data && <Skeleton className="col-span-full h-12" />}
      </div>
      <div className="grid gap-2.5 xl:grid-cols-[1fr_22rem]">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">Every working resource</h2><span className="text-xs text-muted">Booked minutes including turnover, against available minutes</span></div>
          <div className="max-h-[calc(100vh-20rem)] overflow-y-auto px-4 pb-4">
            {sorted.map((r: any) => (
              <div key={r.id} className="grid grid-cols-[1.25rem_minmax(10rem,1fr)_minmax(8rem,1.5fr)_3rem] items-center gap-3 border-b border-line/50 py-1.5 text-sm">
                <KindIcon kind={r.kind} className="h-3.5 w-3.5" />
                <span className="min-w-0"><span className="block truncate text-ink">{r.name}</span><span className="block truncate text-[0.68rem] text-muted">{r.role_label}, {r.department}</span></span>
                <Meter pct={r.pct} color={r.pct >= 85 ? '#D04A58' : KIND_COLOR[r.kind]} />
                <span className="text-right text-xs font-semibold tabnum">{r.pct}%</span>
              </div>
            ))}
          </div>
        </section>
        <div className="space-y-2.5">
          <section className="panel p-4">
            <h3 className="text-sm font-semibold text-crimson-700">Over 85% booked ({hot.length})</h3>
            <p className="mb-2 text-xs text-muted">Any delay here spreads to the rest of the day. Consider extra hours or moving routine work.</p>
            {hot.slice(0, 8).map((r: any) => <div key={r.id} className="flex justify-between py-0.5 text-sm"><span className="truncate">{r.name}</span><span className="font-semibold tabnum text-crimson-600">{r.pct}%</span></div>)}
            {!hot.length && <div className="text-sm text-muted">None.</div>}
          </section>
          <section className="panel p-4">
            <h3 className="text-sm font-semibold text-ink">Under 10% booked ({idle.length})</h3>
            <p className="mb-2 text-xs text-muted">Capacity you could offer to the waitlist or open for walk-ins.</p>
            <div className="max-h-56 overflow-y-auto">{idle.slice(0, 30).map((r: any) => <div key={r.id} className="flex justify-between py-0.5 text-sm"><span className="truncate">{r.name}</span><span className="text-xs text-muted">{r.role_label}</span></div>)}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [tab, setTab] = useState<'dur' | 'util'>('dur');
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-ink">Insights</h1>
        <div className="seg"><button data-on={tab === 'dur'} onClick={() => setTab('dur')}>Slot length advice</button><button data-on={tab === 'util'} onClick={() => setTab('util')}>Utilization</button></div>
      </div>
      {tab === 'dur' ? <Durations /> : <Utilization />}
    </div>
  );
}
