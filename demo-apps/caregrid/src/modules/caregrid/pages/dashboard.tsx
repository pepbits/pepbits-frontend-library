'use client';
import React, {useEffect, useState} from 'react';
import {ArrowRight, CalendarPlus, CalendarX2, ConciergeBell, Hourglass, ShieldAlert, Wrench} from '@pepbits/icons';
import {Button, Skeleton} from '@pepbits/ui';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {useScreen, type ScreenProps} from '../context';
import {EXCEPTION_LABEL, KIND_LABEL, KIND_TONE} from '../labels';
import {nowLocal} from '../time';
import {CatIcon, KindIcon, Meter, Panel, QueryError, StatusPill} from '../ui';
import {AppointmentDrawer} from '../booking/appointment-drawer';
import type {QueueItem, Summary} from '../types';

const greeting = (hour: number) => hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

export function CommandCenter({meta}: ScreenProps) {
  const {f, t, navigation} = useScreen();
  const {data: s, error, reload} = useCaregridQuery<Summary>('/analytics/summary');
  const {data: queue} = useCaregridQuery<QueueItem[]>('/queue');
  const [open, setOpen] = useState<number | null>(null), [now, setNow] = useState(nowLocal());
  useEffect(() => {const timer = setInterval(() => setNow(nowLocal()), 30000); return () => clearInterval(timer);}, []);
  const hourNow = Number(now.slice(11, 13));
  if (error && !s) return <QueryError error={error} onRetry={reload}/>;
  const c = s?.counts ?? {}, active = (c.checked_in ?? 0) + (c.in_progress ?? 0);
  const hours = (s?.hours ?? []).filter(h => h.hour >= 6 && h.hour <= 22), maxHour = Math.max(1, ...hours.map(h => h.count));
  const kpis = [
    {label: 'Appointments today', value: s ? f.number(s.total) : '–', sub: t('{done} completed, {left} still to come', {done: f.number(c.completed ?? 0), left: f.number((c.booked ?? 0) + (c.confirmed ?? 0))}), go: 'caregrid-frontdesk'},
    {label: 'Arrived or in session', value: f.number(active), sub: t('{waiting} waiting, {with} with clinicians', {waiting: f.number(c.checked_in ?? 0), with: f.number(c.in_progress ?? 0)}), go: 'caregrid-frontdesk'},
    {label: 'Need a new time', value: s ? f.number(s.queuePending) : '–', sub: t(s?.queuePending ? 'Affected by leave or breakdowns' : 'Nothing waiting'), go: 'caregrid-exceptions', warn: (s?.queuePending ?? 0) > 0},
    {label: 'No-show rate, 30 days', value: s ? f.percent(s.noShowRate) : '–', sub: t('Of completed plus missed visits'), go: 'caregrid-insights'},
    {label: 'Median wait after arrival', value: s ? t('{n} min', {n: f.number(s.medianWait)}) : '–', sub: t('Check-in to session start, 14 days'), go: 'caregrid-insights'},
  ];
  return <div className="space-y-2.5" data-command-center>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-[1.4rem] font-semibold leading-tight">{t(greeting(hourNow))}</h2><p className="text-sm text-[var(--text-muted)]">{t('{date}. Here is where today stands across every department.', {date: f.niceDate(meta.today)})}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button leftIcon={<CalendarPlus className="size-4"/>} onClick={() => navigation.open(to('caregrid-book'))}>{t('Book')}</Button>
        <Button variant="outline" leftIcon={<CalendarX2 className="size-4"/>} onClick={() => navigation.open(to('caregrid-exceptions'))}>{t('Block a resource')}</Button>
        <Button variant="outline" leftIcon={<ConciergeBell className="size-4"/>} onClick={() => navigation.open(to('caregrid-frontdesk'))}>{t('Front desk')}</Button>
      </div>
    </div>
    <div data-tour="cg-kpis" className="cg-panel grid grid-cols-2 overflow-hidden md:grid-cols-3 xl:grid-cols-5">
      {kpis.map(k => <button key={k.label} type="button" onClick={() => navigation.open(to(k.go))} className={`border-[var(--border)] px-4 py-3.5 text-start hover:bg-[var(--surface-2)] xl:border-e xl:last:border-e-0 ${k.warn ? 'cg-wash-warning' : ''}`}>
        <span className="block text-xs text-[var(--text-muted)]">{t(k.label)}</span>
        <span className="mt-0.5 block text-[1.6rem] font-semibold leading-none tabular-nums">{k.value}</span>
        <span className="mt-1.5 block text-[0.72rem] text-[var(--text-muted)]">{k.sub}</span>
      </button>)}
    </div>
    <div className="grid gap-2.5 xl:grid-cols-12">
      <Panel id="arrivals" className="xl:col-span-8" title={t('Arrivals by hour')} aside={<span className="text-xs text-[var(--text-muted)]">{t('Booked starts per hour, excluding cancellations')}</span>} bodyClassName="">
        <div className="px-4 pb-4" data-tour="cg-arrivals">
          {!s ? <Skeleton className="h-44"/> : <>
            <div role="img" aria-label={t('Arrivals by hour: {list}', {list: hours.map(h => `${f.time(`${String(h.hour).padStart(2, '0')}:00`)} ${f.number(h.count)}`).join(', ')})} className="flex h-44 items-end gap-1">
              {hours.map(h => {const current = h.hour === hourNow, past = h.hour < hourNow; return <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end" title={`${f.time(`${String(h.hour).padStart(2, '0')}:00`)}: ${f.number(h.count)}`}>
                <div className="w-full rounded-t-md" style={{height: `${Math.max(2, h.count / maxHour * 100)}%`, background: current ? 'var(--warning)' : past ? 'var(--surface-3)' : 'var(--success)'}}/>
                <div className={`mt-1 text-[0.62rem] tabular-nums ${current ? 'font-bold' : 'text-[var(--text-muted)]'}`}>{String(h.hour).padStart(2, '0')}</div>
              </div>;})}
            </div>
          </>}
        </div>
        <div className="grid gap-x-6 gap-y-2.5 border-t border-[var(--border)] px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {(s?.utilization ?? []).map(u => <div key={u.kind}>
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><KindIcon kind={u.kind} className="size-3.5"/>{t(KIND_LABEL[u.kind] ?? u.kind)}</span><span className="tabular-nums text-[var(--text-muted)]">{t('{pct} booked', {pct: f.percent(u.pct)})}</span></div>
            <Meter pct={u.pct} color={KIND_TONE[u.kind]} className="mt-1.5"/>
          </div>)}
        </div>
      </Panel>
      <Panel className="xl:col-span-4" title={t('Needs a decision')} aside={queue?.length ? <Button size="xs" variant="ghost" rightIcon={<ArrowRight className="size-3 rtl:rotate-180"/>} onClick={() => navigation.open(to('caregrid-exceptions'))}>{t('Open queue')}</Button> : null}>
        <div className="space-y-2" data-tour="cg-decisions">
          {queue?.slice(0, 4).map(q => <button key={q.id} type="button" onClick={() => setOpen(q.appointment_id)} className="flex w-full items-start gap-2.5 rounded-[var(--radius)] p-2.5 text-start cg-wash-warning">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0"/>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[var(--text)]">{q.patient_name}, {q.type_name}</span><span className="block truncate text-[0.72rem]">{f.niceDateTime(q.start_at, meta.today)}. {q.reason}</span></span>
          </button>)}
          {queue && queue.length > 4 ? <p className="text-xs text-[var(--text-muted)]">{t('and {n} more in the reschedule queue.', {n: f.number(queue.length - 4)})}</p> : null}
          {s?.exceptionsToday?.map(x => <div key={x.id} className="flex items-start gap-2.5 rounded-[var(--radius)] border border-[var(--border)] p-2.5">
            <Wrench aria-hidden className="mt-0.5 size-4 shrink-0" style={{color: 'var(--danger)'}}/>
            <p className="min-w-0 flex-1 text-sm"><span className="font-medium">{x.resource_name}</span> <span className="text-[var(--text-muted)]">{t(EXCEPTION_LABEL[x.type] ?? x.type)} {t('{from} to {to}', {from: f.time(x.start_at), to: f.time(x.end_at)})}</span></p>
          </div>)}
          {(s?.waitlist ?? 0) > 0 ? <button type="button" onClick={() => navigation.open(to('caregrid-frontdesk', {tab: 'waitlist'}))} className="flex w-full items-center gap-2.5 rounded-[var(--radius)] border border-[var(--border)] p-2.5 text-start text-sm hover:bg-[var(--surface-2)]">
            <Hourglass aria-hidden className="size-4" style={{color: 'var(--primary)'}}/><span className="flex-1">{t('{n} patients on the waitlist', {n: f.number(s!.waitlist)})}</span><ArrowRight aria-hidden className="size-3.5 rtl:rotate-180"/>
          </button> : null}
          {queue && !queue.length && !s?.exceptionsToday?.length ? <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('Nothing needs a decision right now.')}</p> : null}
        </div>
      </Panel>
      <Panel className="xl:col-span-5" title={t('Next up')} aside={<Button size="xs" variant="ghost" rightIcon={<ArrowRight className="size-3 rtl:rotate-180"/>} onClick={() => navigation.open(to('caregrid-frontdesk'))}>{t('Front desk')}</Button>} bodyClassName="px-2 pb-3">
        {!s ? <div className="space-y-1.5 px-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10"/>)}</div> : null}
        <ul>{s?.next.map(a => <li key={a.id}><button type="button" onClick={() => setOpen(a.id)} className="grid w-full grid-cols-[3.5rem_1.5rem_1fr_auto] items-center gap-2 rounded-lg px-2 py-2 text-start hover:bg-[var(--surface-2)]">
          <span className="text-sm font-semibold tabular-nums">{f.time(a.start_at)}</span><CatIcon name={a.icon} color={a.color}/>
          <span className="min-w-0"><span className="block truncate text-sm">{a.patient_name}</span><span className="block truncate text-[0.72rem] text-[var(--text-muted)]">{a.type_name}</span></span>
          <span className="flex items-center gap-1">{a.at_risk ? <ShieldAlert aria-label={t('At risk')} className="size-3.5" style={{color: 'var(--warning)'}}/> : null}<StatusPill status={a.status}/></span>
        </button></li>)}</ul>
        {s && !s.next.length ? <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('No more appointments today.')}</p> : null}
      </Panel>
      <Panel className="xl:col-span-4" title={t('Busiest resources today')} aside={<Button size="xs" variant="ghost" rightIcon={<ArrowRight className="size-3 rtl:rotate-180"/>} onClick={() => navigation.open(to('caregrid-insights', {tab: 'util'}))}>{t('Utilization')}</Button>}>
        <ul className="space-y-3" data-tour="cg-busiest">{s?.busiest.map(r => <li key={r.id}><button type="button" className="block w-full text-start" onClick={() => navigation.open(to('caregrid-resources', {id: r.id}))}>
          <span className="flex items-center justify-between gap-2 text-sm"><span className="flex min-w-0 items-center gap-2"><KindIcon kind={r.kind} className="size-3.5 shrink-0"/><span className="truncate">{r.name}</span></span>
            <span className="text-xs font-semibold tabular-nums" style={r.pct >= 85 ? {color: 'var(--danger-ink)'} : {color: 'var(--text-muted)'}}>{f.percent(r.pct)}</span></span>
          <span className="mt-1 block text-[0.7rem] text-[var(--text-muted)]">{r.role_label}</span>
          <Meter pct={r.pct} color={r.pct >= 85 ? 'var(--danger)' : KIND_TONE[r.kind]} className="mt-1"/>
        </button></li>)}</ul>
        {!s ? <Skeleton className="h-40"/> : null}
      </Panel>
      <Panel className="xl:col-span-3" title={t('Service mix today')}>
        <ul className="space-y-2">{s?.mix.slice(0, 9).map(m => <li key={m.name} className="grid grid-cols-[1.25rem_1fr_2.5rem] items-center gap-2 text-xs">
          <CatIcon name={m.icon} color={m.color} className="size-3.5"/>
          <div><p className="truncate">{m.name}</p><div aria-hidden className="mt-0.5 h-1 rounded-full" style={{width: `${m.c / (s.mix[0]?.c || 1) * 100}%`, background: m.color}}/></div>
          <span className="text-end font-semibold tabular-nums">{f.number(m.c)}</span>
        </li>)}</ul>
      </Panel>
    </div>
    <AppointmentDrawer id={open} onClose={() => setOpen(null)}/>
  </div>;
}
