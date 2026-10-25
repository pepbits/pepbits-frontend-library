'use client';
import React, {useMemo, useState} from 'react';
import {Minus, TrendingDown, TrendingUp} from '@pepbits/icons';
import {Button, DateInput, Segmented, Select, Skeleton} from '@pepbits/ui';
import {Tabs} from '@pepbits/components';
import {qs} from '../../../adapters/caregrid';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {KIND_LABEL, KIND_TONE} from '../labels';
import {CatIcon, KindIcon, Meter, PagedCollection, Panel, QueryError} from '../ui';
import type {Meta} from '../types';

export interface DurationAdvice {type_id: number; name: string; icon: string; samples: number; planned: number; median: number; p75: number; overrun_rate: number; median_wait: number; suggested: number; action: 'keep' | 'lengthen' | 'shorten'; histogram: {lo: number; hi: number; counts: number[]}}
interface Utilization {byKind: {kind: string; pct: number; booked: number; available: number}[]; resources: {id: number; name: string; kind: string; role_label: string; department: string; available_min: number; booked_min: number; pct: number}[]}

function Histogram({h, planned, p75}: {h: DurationAdvice['histogram']; planned: number; p75: number}) {
  const {f, t} = useScreen();
  const max = Math.max(1, ...h.counts), pos = (minute: number) => Math.max(0, Math.min(100, (minute - h.lo) / Math.max(1, h.hi - h.lo) * 100));
  return <div role="img" aria-label={t('Actual minutes from {lo} to {hi}; planned {planned}, 75th percentile {p75}', {lo: f.number(h.lo), hi: f.number(h.hi), planned: f.number(planned), p75: f.number(p75)})} className="relative h-10 w-full min-w-[8rem]">
    <div className="flex h-full items-end gap-[2px]">{h.counts.map((c, i) => <div key={i} className="flex-1 rounded-t-sm bg-[var(--surface-3)]" style={{height: `${c / max * 100}%`}}/>)}</div>
    <div aria-hidden className="absolute inset-y-0 w-0.5 bg-[var(--text)]" style={{insetInlineStart: `${pos(planned)}%`}}/>
    <div aria-hidden className="absolute inset-y-0 w-0.5 bg-[var(--warning)]" style={{insetInlineStart: `${pos(p75)}%`}}/>
  </div>;
}

function Durations() {
  const {client, f, t, notify, writable} = useScreen();
  const {data, error, reload} = useCaregridQuery<DurationAdvice[]>('/analytics/durations', {live: false});
  const [only, setOnly] = useState('act'), [busy, setBusy] = useState<number | null>(null);
  const list = useMemo(() => (data ?? []).filter(d => only === 'all' || d.action !== 'keep'), [data, only]);
  const apply = async (d: DurationAdvice) => {
    if (busy || !writable) return; setBusy(d.type_id);
    try {await client.request(`/types/${d.type_id}`, {method: 'PATCH', body: {duration_min: d.suggested}}); notify(t('Slot length for {name} set to {d}.', {name: d.name, d: f.dur(d.suggested)}), {tone: 'success'}); reload();}
    catch (failure) {notify(`${t('Not applied')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setBusy(null);}
  };
  return <Panel title={<span>{t('Slot length advice')}<span className="block text-xs font-normal text-[var(--text-muted)]">{t('From real start and finish times over the last 60 days. Suggested length = 75th percentile, rounded to 5 minutes.')}</span></span>}
    aside={<div className="flex items-center gap-3"><span className="hidden items-center gap-3 text-[0.7rem] text-[var(--text-muted)] md:flex"><span className="flex items-center gap-1"><span aria-hidden className="h-3 w-0.5 bg-[var(--text)]"/>{t('Planned')}</span><span className="flex items-center gap-1"><span aria-hidden className="h-3 w-0.5 bg-[var(--warning)]"/>{t('75th percentile')}</span></span>
      <Segmented size="sm" label="Services shown" value={only} onChange={setOnly} options={[{value: 'act', label: 'Needs change'}, {value: 'all', label: 'All services'}]}/></div>}>
    <QueryError error={error} onRetry={reload}/>
    {!data && !error ? <div className="space-y-1.5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12"/>)}</div> : null}
    {data ? <PagedCollection resetKey={only} rows={list} rowKey={d => String(d.type_id)} empty={<p className="p-8 text-center text-sm text-[var(--text-muted)]">{t('Every planned length matches reality. Nothing to change.')}</p>} columns={[
      {key: 'name', header: 'Service', render: d => <span className="flex min-w-0 items-center gap-2"><CatIcon name={d.icon} color="var(--text-muted)"/><span className="min-w-0"><span className="block truncate">{d.name}</span><span className="block text-[0.68rem] text-[var(--text-muted)]">{t('Median wait after arrival {n} min', {n: f.number(d.median_wait)})}</span></span></span>},
      {key: 'samples', header: 'Visits', align: 'right', render: d => f.number(d.samples)},
      {key: 'spread', header: 'Actual time spread', render: d => <Histogram h={d.histogram} planned={d.planned} p75={d.p75}/>},
      {key: 'planned', header: 'Planned', align: 'right', render: d => t('{n} min', {n: f.number(d.planned)})},
      {key: 'median', header: 'Median', align: 'right', render: d => t('{n} min', {n: f.number(d.median)})},
      {key: 'p75', header: '75th pct', align: 'right', render: d => <b>{t('{n} min', {n: f.number(d.p75)})}</b>},
      {key: 'overrun', header: 'Overran', align: 'right', render: d => <span style={d.overrun_rate > 50 ? {color: 'var(--danger-ink)', fontWeight: 600} : undefined}>{f.percent(d.overrun_rate)}</span>},
      {key: 'suggestion', header: 'Suggestion', align: 'right', render: d => d.action === 'keep' ? <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Minus aria-hidden className="size-3.5"/>{t('Keep {d}', {d: f.dur(d.planned)})}</span>
        : <Button size="xs" variant={d.action === 'lengthen' ? 'outline' : 'secondary'} disabled={busy !== null || !writable} leftIcon={d.action === 'lengthen' ? <TrendingUp className="size-3.5"/> : <TrendingDown className="size-3.5"/>} onClick={event => {event.stopPropagation(); void apply(d);}}>{t('Set {d}', {d: f.dur(d.suggested)})}</Button>},
    ]}/> : null}
  </Panel>;
}

function UtilizationView({meta}: {meta: Meta}) {
  const {f, t} = useScreen();
  const [date, setDate] = useState(meta.today), [department, setDepartment] = useState('');
  const {data, error, reload} = useCaregridQuery<Utilization>('/analytics/utilization' + qs({date: date || meta.today, department}));
  const working = (data?.resources ?? []).filter(r => r.available_min > 0), sorted = working.slice().sort((a, b) => b.pct - a.pct);
  const hot = sorted.filter(r => r.pct >= 85), idle = working.filter(r => r.pct < 10);
  return <div className="space-y-2.5" data-utilization>
    <div className="flex flex-wrap items-end gap-2">
      <DateInput label="Day" value={date} onChange={e => setDate(e.target.value)}/>
      <Select label="Department" value={department} onChange={e => setDepartment(e.target.value)} placeholder="All departments" options={meta.departments.map(d => ({value: String(d.id), label: d.name}))}/>
      <span className="text-sm text-[var(--text-muted)]" role="status">{t('{n} resources working on this day', {n: f.number(working.length)})}</span>
    </div>
    <QueryError error={error} onRetry={reload}/>
    <div className="cg-panel grid grid-cols-2 gap-x-6 gap-y-3 p-4 md:grid-cols-3 2xl:grid-cols-6">
      {(data?.byKind ?? []).map(k => <div key={k.kind}><p className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><KindIcon kind={k.kind} className="size-3.5"/>{t(KIND_LABEL[k.kind] ?? k.kind)}</span><span className="font-semibold tabular-nums">{f.percent(k.pct)}</span></p>
        <Meter pct={k.pct} color={KIND_TONE[k.kind]} className="mt-1.5"/><p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">{t('{booked} of {available}', {booked: f.dur(k.booked), available: f.dur(k.available)})}</p></div>)}
      {!data && !error ? <Skeleton className="col-span-full h-12"/> : null}
    </div>
    <div className="grid gap-2.5 xl:grid-cols-[1fr_22rem]">
      <Panel title={t('Every working resource')} aside={<span className="text-xs text-[var(--text-muted)]">{t('Booked minutes including turnover, against available minutes')}</span>}>
        <ul tabIndex={0} aria-label={t('Every working resource')} className="max-h-[calc(100vh-22rem)] overflow-y-auto">{sorted.map(r => <li key={r.id} className="grid grid-cols-[1.25rem_minmax(10rem,1fr)_minmax(8rem,1.5fr)_3.5rem] items-center gap-3 border-b border-[var(--border)] py-1.5 text-sm">
          <KindIcon kind={r.kind} className="size-3.5"/><span className="min-w-0"><span className="block truncate">{r.name}</span><span className="block truncate text-[0.68rem] text-[var(--text-muted)]">{r.role_label}, {r.department}</span></span>
          <Meter pct={r.pct} color={r.pct >= 85 ? 'var(--danger)' : KIND_TONE[r.kind]}/><span className="text-end text-xs font-semibold tabular-nums">{f.percent(r.pct)}</span>
        </li>)}</ul>
      </Panel>
      <div className="space-y-2.5">
        <Panel title={<span style={{color: 'var(--danger-ink)'}}>{t('Over 85% booked ({n})', {n: f.number(hot.length)})}</span>}>
          <p className="mb-2 text-xs text-[var(--text-muted)]">{t('Any delay here spreads to the rest of the day. Consider extra hours or moving routine work.')}</p>
          <ul>{hot.slice(0, 8).map(r => <li key={r.id} className="flex justify-between py-0.5 text-sm"><span className="truncate">{r.name}</span><span className="font-semibold tabular-nums" style={{color: 'var(--danger-ink)'}}>{f.percent(r.pct)}</span></li>)}</ul>
          {!hot.length ? <p className="text-sm text-[var(--text-muted)]">{t('None.')}</p> : null}
        </Panel>
        <Panel title={t('Under 10% booked ({n})', {n: f.number(idle.length)})}>
          <p className="mb-2 text-xs text-[var(--text-muted)]">{t('Capacity you could offer to the waitlist or open for walk-ins.')}</p>
          <ul tabIndex={0} aria-label={t('Under 10% booked ({n})', {n: f.number(idle.length)})} className="max-h-56 overflow-y-auto">{idle.slice(0, 30).map(r => <li key={r.id} className="flex justify-between py-0.5 text-sm"><span className="truncate">{r.name}</span><span className="text-xs text-[var(--text-muted)]">{r.role_label}</span></li>)}</ul>
        </Panel>
      </div>
    </div>
  </div>;
}

export function InsightsPage({meta, params}: ScreenProps) {
  const {navigation} = useScreen();
  const tab = params.get('tab') === 'util' ? 'util' : 'dur';
  return <div className="space-y-2.5" data-insights-page>
    <div data-tour="cg-insights-tabs"><Tabs variant="segmented" value={tab} onChange={value => navigation.open(to('caregrid-insights', {tab: value === 'util' ? 'util' : null}))} items={[{id: 'dur', label: 'Slot length advice'}, {id: 'util', label: 'Utilization'}]}/></div>
    <div role="tabpanel" data-tour="cg-insights-body">{tab === 'dur' ? <Durations/> : <UtilizationView meta={meta}/>}</div>
  </div>;
}
