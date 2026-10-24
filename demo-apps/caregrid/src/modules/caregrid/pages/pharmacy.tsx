'use client';
import React, {useMemo, useState} from 'react';
import {CheckCircle2, LogIn, Pill, Play, Square, Truck} from '@pepbits/icons';
import {Button, Segmented, Skeleton} from '@pepbits/ui';
import {EmptyState} from '@pepbits/components';
import {qs} from '../../../adapters/caregrid';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {toMin} from '../time';
import {KindIcon, Meter, Panel, QueryError, StatusPill} from '../ui';
import {AppointmentDrawer} from '../booking/appointment-drawer';
import type {AppointmentDetail, AppointmentRow, Schedule, ServiceType} from '../types';

/** Booked minutes (with turnover) against available capacity, per counter, booth or person. */
export function counterLoad(schedule: Schedule | null) {
  return (schedule?.resources ?? []).map(r => {
    const available = r.windows.reduce((sum, w) => sum + toMin(w.end) - toMin(w.start), 0) * r.capacity, booked = r.holds.reduce((sum, h) => sum + toMin(h.hold_end) - toMin(h.hold_start), 0);
    return {...r, available, pct: available ? Math.round(Math.min(100, booked / available * 100)) : 0};
  });
}
const PHARMACY_ACTION: Record<string, string> = {check_in: 'At the counter', start: 'Serving', complete: 'Handed over'};

export function PharmacyPage({meta}: ScreenProps) {
  const {client, f, t, notify, navigation, writable} = useScreen();
  const pharmacy = meta.departments.find(d => d.code === 'PHARM'), category = meta.categories.find(c => c.name === 'Pharmacy');
  const {data: appointments, error, reload, setData} = useCaregridQuery<AppointmentRow[]>(pharmacy ? '/appointments' + qs({date: meta.today, department: pharmacy.id}) : null);
  const {data: board} = useCaregridQuery<Schedule>(pharmacy ? '/schedule' + qs({date: meta.today, department: pharmacy.id}) : null);
  const {data: types} = useCaregridQuery<ServiceType[]>(category ? `/types?category=${category.id}` : null, {live: false});
  const [open, setOpen] = useState<number | null>(null), [filter, setFilter] = useState('open'), [pending, setPending] = useState(false);
  const act = async (a: AppointmentRow, action: string) => {
    if (pending || !writable) return; setPending(true);
    try {const next = await client.request<AppointmentDetail>(`/appointments/${a.id}/status`, {body: {action}}); setData(list => list?.map(item => item.id === a.id ? {...item, status: next.status} : item) ?? null); notify(`${t(PHARMACY_ACTION[action] ?? action)}: ${a.patient_name}, ${a.type_name}`, {tone: 'success'});}
    catch (failure) {notify(`${t('Not changed')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setPending(false);}
  };
  const list = useMemo(() => (appointments ?? []).filter(a => filter === 'all' || !['completed', 'cancelled', 'no_show'].includes(a.status)), [appointments, filter]);
  const count = (statuses: string[]) => (appointments ?? []).filter(a => statuses.includes(a.status)).length;
  const load = counterLoad(board ?? null).filter(r => r.available > 0);
  if (!pharmacy) return <EmptyState title="No pharmacy department" description="The scheduling API did not return a pharmacy department."/>;
  return <div className="space-y-2.5" data-pharmacy-page>
    <div className="flex flex-wrap items-end justify-between gap-2"><p className="text-sm text-[var(--text-muted)]">{t('Pickups, refills, counseling, INR checks, compounding and home deliveries for today.')}</p>
      <Button variant="outline" onClick={() => navigation.open(to('caregrid-schedule', {date: meta.today, department: pharmacy.id}))}>{t('Counter timeline')}</Button></div>
    <dl className="cg-panel grid grid-cols-2 xl:grid-cols-4">{[['Pharmacy visits today', appointments ? f.number(appointments.length) : '–'], ['At the counter now', f.number(count(['checked_in', 'in_progress']))], ['Handed over', f.number(count(['completed']))], ['Home deliveries', f.number((appointments ?? []).filter(a => a.type_name === 'Home delivery slot').length)]].map(([label, value]) => <div key={label} className="px-4 py-3"><dt className="text-xs text-[var(--text-muted)]">{t(label!)}</dt><dd className="text-2xl font-semibold tabular-nums">{value}</dd></div>)}</dl>
    <div className="grid gap-2.5 xl:grid-cols-[1fr_24rem]">
      <Panel title={t('Today’s pharmacy queue')} aside={<Segmented size="sm" label="Queue filter" value={filter} onChange={setFilter} options={[{value: 'open', label: 'Still to serve'}, {value: 'all', label: 'All'}]}/>} bodyClassName="px-2 pb-3">
        <div data-tour="cg-pharmacy-queue">
          <QueryError error={error} onRetry={reload}/>
          {!appointments && !error ? <div className="space-y-1.5 px-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12"/>)}</div> : null}
          <ul className="max-h-[calc(100vh-18rem)] overflow-y-auto" data-pharmacy-queue>{list.map(a => <li key={a.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--surface-2)]">
            <span className="text-sm font-semibold tabular-nums">{f.time(a.start_at)}</span>
            <button type="button" onClick={() => setOpen(a.id)} className="min-w-0 text-start"><span className="block truncate text-sm">{a.patient_name} <span className="text-[var(--text-muted)]">{a.mrn}</span></span>
              <span className="block truncate text-[0.72rem] text-[var(--text-muted)]">{a.type_name}{a.primary_resource ? `, ${a.primary_resource}` : ''}{a.allergies ? `. ${t('Allergy: {name}', {name: a.allergies})}` : ''}</span></button>
            <span className="flex items-center gap-1.5"><StatusPill status={a.status}/>
              {['booked', 'confirmed'].includes(a.status) ? <Button size="xs" variant="outline" disabled={pending || !writable} leftIcon={<LogIn className="size-3.5"/>} onClick={() => void act(a, 'check_in')}>{t('Arrived')}</Button> : null}
              {a.status === 'checked_in' ? <Button size="xs" disabled={pending || !writable} leftIcon={<Play className="size-3.5"/>} onClick={() => void act(a, 'start')}>{t('Serve')}</Button> : null}
              {a.status === 'in_progress' ? <Button size="xs" variant="secondary" disabled={pending || !writable} leftIcon={<Square className="size-3.5"/>} onClick={() => void act(a, 'complete')}>{t('Handed over')}</Button> : null}
            </span>
          </li>)}</ul>
          {appointments && !list.length ? <div className="flex flex-col items-center gap-1 py-8 text-center"><CheckCircle2 aria-hidden className="size-5 text-[var(--text-muted)]"/><p className="font-semibold">{t('Everyone has been served')}</p><p className="text-sm text-[var(--text-muted)]">{t('New pharmacy bookings appear here instantly.')}</p></div> : null}
        </div>
      </Panel>
      <div className="space-y-2.5">
        <Panel title={t('Book in one click')}><ul className="grid grid-cols-2 gap-1.5" data-tour="cg-pharmacy-book">
          {types?.map(s => <li key={s.id}><button type="button" onClick={() => navigation.open(to('caregrid-book', {type: s.id}))} className="flex w-full items-start gap-2 rounded-lg border border-[var(--border)] p-2 text-start hover:border-[var(--primary)]">
            {s.name.toLowerCase().includes('delivery') ? <Truck aria-hidden className="mt-0.5 size-4 shrink-0" style={{color: 'var(--primary)'}}/> : <Pill aria-hidden className="mt-0.5 size-4 shrink-0" style={{color: 'var(--primary)'}}/>}
            <span className="min-w-0"><span className="block text-xs font-medium leading-tight">{s.name}</span><span className="text-[0.68rem] text-[var(--text-muted)]">{f.dur(s.duration_min)}</span></span>
          </button></li>)}
          {!types ? <li className="col-span-2"><Skeleton className="h-40"/></li> : null}
        </ul></Panel>
        <Panel title={t('Counters, booths and staff')}><ul className="space-y-2.5" data-tour="cg-counters">
          {load.map(r => <li key={r.id}><p className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><KindIcon kind={r.kind} className="size-3.5"/>{r.name}</span><span className="tabular-nums" style={{color: r.pct > 85 ? 'var(--danger-ink)' : 'var(--text-muted)', fontWeight: r.pct > 85 ? 600 : undefined}}>{f.percent(r.pct)}</span></p><Meter pct={r.pct} className="mt-1" color={r.pct > 85 ? 'var(--danger)' : 'var(--success)'}/></li>)}
          {!board ? <li><Skeleton className="h-32"/></li> : null}
        </ul></Panel>
      </div>
    </div>
    <AppointmentDrawer id={open} onClose={() => setOpen(null)}/>
  </div>;
}
