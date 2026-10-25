'use client';
import React, {useEffect, useMemo, useState} from 'react';
import {CalendarCheck, ChevronLeft, ChevronRight} from '@pepbits/icons';
import {Avatar, Button, DateInput, IconButton, SearchInput, Segmented, Select, Skeleton} from '@pepbits/ui';
import {Drawer} from '@pepbits/components';
import {ResourceRowTimeline, minuteTime, type RowBand, type RowEvent} from '@pepbits/patterns/calendar';
import {qs} from '../../../adapters/caregrid';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {EXCEPTION_LABEL, KIND_LABEL, shade} from '../labels';
import {addDays, minuteOfDay, nowLocal, toMin} from '../time';
import {Chip, KindIcon, QueryError} from '../ui';
import {AppointmentDrawer} from '../booking/appointment-drawer';
import {SlotPicker} from '../booking/slot-picker';
import type {Patient, Schedule, ScheduleResource, ServiceType, Slot} from '../types';

interface HoldEvent extends RowEvent {appointment: number}

function QuickBook({resource, at, date, onClose}: {resource: ScheduleResource | null; at: number | null; date: string; onClose: () => void}) {
  const {client, f, t, notify, writable} = useScreen();
  const {data: types} = useCaregridQuery<ServiceType[]>(resource ? '/types' : null, {live: false});
  const [typeId, setTypeId] = useState(''), [query, setQuery] = useState(''), [patient, setPatient] = useState<Patient | null>(null), [slot, setSlot] = useState<Slot | null>(null), [busy, setBusy] = useState(false);
  const {data: patients} = useCaregridQuery<Patient[]>(resource && !patient ? `/patients?q=${encodeURIComponent(query)}` : null, {live: false});
  useEffect(() => {setTypeId(''); setPatient(null); setSlot(null); setQuery('');}, [resource, at]);
  const fitting = useMemo(() => (types ?? []).filter(s => s.requirements.some(r => r.roles?.includes(resource?.role_code ?? ''))), [types, resource]);
  const book = async () => {
    if (!slot || !patient || !typeId || busy || !writable) return;
    setBusy(true);
    try {await client.request('/appointments', {body: {patientId: patient.id, typeId: Number(typeId), start: slot.start, assignments: slot.assignments.map(a => ({requirement_id: a.requirement_id, resource_id: a.resource_id}))}}); notify(t('Booked'), {tone: 'success'}); onClose();}
    catch (failure) {notify(`${t('Not booked')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setBusy(false);}
  };
  return <Drawer open={!!resource} onClose={onClose} title={resource ? t('Book on {name}', {name: resource.name}) : 'Book'} subtitle={resource && at !== null ? t('{role}, around {time} on {date}', {role: resource.role_label, time: f.time(minuteTime(at % 1440)), date: f.niceDate(date)}) : undefined}
    footer={<Button disabled={!slot || !patient || busy || !writable} leftIcon={<CalendarCheck className="size-4"/>} onClick={book}>{slot ? t('Book {time}', {time: f.time(slot.start)}) : t('Pick a time')}</Button>}>
    <div className="space-y-4 px-5 py-4" data-quick-book>
      <Select label="Service using this resource" value={typeId} onChange={e => {setTypeId(e.target.value); setSlot(null);}} placeholder={t('Choose one of {n} services', {n: f.number(fitting.length)})} options={fitting.map(s => ({value: String(s.id), label: `${s.name} (${f.dur(s.duration_min)})`}))}/>
      <div><p className="mb-1 text-xs font-semibold">{t('Patient')}</p>
        {patient ? <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] p-2"><Avatar name={patient.full_name} size="sm" decorative/><p className="flex-1 text-sm font-medium">{patient.full_name} <span className="text-[var(--text-muted)]">{patient.mrn}</span></p><Button size="xs" variant="ghost" onClick={() => setPatient(null)}>{t('Change')}</Button></div>
          : <><SearchInput aria-label="Search name or MRN" placeholder="Search name or MRN" value={query} onChange={setQuery}/>
            <ul className="mt-1 max-h-40 overflow-y-auto">{patients?.slice(0, 8).map(p => <li key={p.id}><button type="button" className="block w-full rounded px-2 py-1.5 text-start text-sm hover:bg-[var(--surface-2)]" onClick={() => setPatient(p)}>{p.full_name} <span className="text-xs text-[var(--text-muted)]">{p.mrn}</span></button></li>)}</ul></>}
      </div>
      {typeId && patient && resource ? <div><p className="mb-1 text-xs font-semibold">{t('Time ({name} preferred)', {name: resource.name})}</p><SlotPicker typeId={Number(typeId)} patientId={patient.id} startDate={date} preferred={[resource.id]} selected={slot} onPick={setSlot} compact/></div> : null}
    </div>
  </Drawer>;
}

export function SchedulePage({meta, params}: ScreenProps) {
  const {f, t, navigation, writable} = useScreen();
  const date = params.get('date') ?? meta.today;
  const [department, setDepartment] = useState(params.get('department') ?? '4');
  const [kind, setKind] = useState(''), [q, setQ] = useState(''), [range, setRange] = useState('work'), [zoom, setZoom] = useState('1');
  const [openAppointment, setOpenAppointment] = useState<number | null>(params.get('appt') ? Number(params.get('appt')) : null);
  const [quick, setQuick] = useState<{resource: ScheduleResource; at: number} | null>(null), [now, setNow] = useState(nowLocal());
  useEffect(() => {const timer = setInterval(() => setNow(nowLocal()), 30000); return () => clearInterval(timer);}, []);
  useEffect(() => {setDepartment(params.get('department') ?? department);}, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const {data, error, reload} = useCaregridQuery<Schedule>('/schedule' + qs({date, department, kind, q}));
  const setDate = (next: string) => navigation.open(to('caregrid-schedule', {date: next, department}));
  const [h0, h1] = range === 'work' ? [6, 22] : [0, 24];
  const model = useMemo(() => {
    const rows = (data?.resources ?? []).map(r => {
      const booked = r.holds.reduce((sum, h) => sum + toMin(h.hold_end) - toMin(h.hold_start), 0), available = r.windows.reduce((sum, w) => sum + toMin(w.end) - toMin(w.start), 0) * r.capacity;
      const pct = available ? Math.round(Math.min(100, booked / available * 100)) : null;
      return {id: String(r.id), label: r.name, group: `${r.department} / ${r.role_label}`, icon: <KindIcon kind={r.kind} className="size-4 shrink-0"/>,
        detail: <span className="flex items-center gap-1.5 text-[0.66rem]">{pct === null ? t('Off today') : <><span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-[var(--surface-3)]"><span className="block h-full" style={{width: `${pct}%`, background: 'var(--success)'}}/></span>{f.percent(pct)}</>}{r.capacity > 1 ? `, ${t('{n} at once', {n: f.number(r.capacity)})}` : ''}</span>};
    });
    const bands: RowBand[] = (data?.resources ?? []).flatMap(r => [
      ...r.windows.map(w => ({row: String(r.id), start: minuteOfDay(w.start, date), end: minuteOfDay(w.end, date), tone: (w.tag === 'urgent' ? 'reserved' : w.tag === 'walkin' ? 'walk-in' : 'open') as RowBand['tone']})),
      ...r.exceptions.map(x => ({row: String(r.id), start: minuteOfDay(x.start, date), end: minuteOfDay(x.end, date), tone: 'blocked' as const, label: `${t(EXCEPTION_LABEL[x.type] ?? x.type)}${x.reason ? `: ${x.reason}` : ''}`})),
    ]);
    const events: HoldEvent[] = (data?.resources ?? []).flatMap(r => r.holds.map(h => ({
      id: `${r.id}-${h.id}`, row: String(r.id), appointment: h.appointment_id, start: minuteOfDay(h.start_at, date), end: minuteOfDay(h.end_at, date),
      lead: Math.max(0, toMin(h.start_at) - toMin(h.hold_start)), trail: Math.max(0, toMin(h.hold_end) - toMin(h.end_at)),
      label: h.patient_name, detail: `${h.type_name}, ${t('{from} to {to}', {from: f.time(h.start_at), to: f.time(h.end_at)})}${h.hold_end > h.end_at ? ` (+${t('{n} min turnover', {n: f.number(toMin(h.hold_end) - toMin(h.end_at))})})` : ''}`,
      color: h.priority === 'urgent' ? 'var(--danger-fill)' : shade(h.color), emphasis: h.at_risk ? 'warning' as const : 'none' as const, inactive: h.status === 'completed',
      marker: h.status === 'checked_in' ? <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{background: 'var(--warning)'}}/> : h.status === 'in_progress' ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-white"/> : undefined,
    })));
    return {rows, bands, events};
  }, [data, date, f, t]);
  const nowMinute = date === now.slice(0, 10) ? minuteOfDay(now, date) : undefined;
  return <div className="flex flex-col gap-2.5" data-schedule-page>
    <div className="flex flex-wrap items-center gap-2" data-tour="cg-schedule-filters">
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
        <IconButton label={t('Previous day')} onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="size-4 rtl:rotate-180"/></IconButton>
        <DateInput label="Day" className="w-40" value={date} onChange={e => e.target.value && setDate(e.target.value)}/>
        <IconButton label={t('Next day')} onClick={() => setDate(addDays(date, 1))}><ChevronRight className="size-4 rtl:rotate-180"/></IconButton>
      </div>
      <Chip pressed={date === meta.today} onClick={() => setDate(meta.today)}>{t('Today')}</Chip>
      <span className="text-sm font-medium">{f.niceDate(date)}</span>
      <span className="flex-1"/>
      <Select label="Department" value={department} onChange={e => setDepartment(e.target.value)} placeholder={t('All departments')} options={meta.departments.map(d => ({value: String(d.id), label: d.name}))}/>
      <SearchInput aria-label="Find resource" placeholder="Find resource" className="w-48" value={q} onChange={setQ}/>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={t('Resource types')} className="flex flex-wrap gap-1">
        <Chip pressed={!kind} onClick={() => setKind('')}>{t('All types')}</Chip>
        {meta.kinds.map(k => <Chip key={k} pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}><KindIcon kind={k} className="size-3.5"/>{t(KIND_LABEL[k] ?? k)}</Chip>)}
      </div>
      <span className="flex-1"/>
      <Segmented size="sm" label="Hours shown" value={range} onChange={setRange} options={[{value: 'work', label: '06 to 22'}, {value: 'full', label: '24 hours'}]}/>
      <Segmented size="sm" label="Zoom" value={zoom} onChange={setZoom} options={[{value: '1', label: 'Fit'}, {value: '2', label: '2x'}, {value: '3', label: '3x'}]}/>
    </div>
    <ul className="flex flex-wrap items-center gap-4 text-[0.72rem] text-[var(--text-muted)]" aria-label={t('Legend')} data-tour="cg-schedule-legend">
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-5 rounded-sm border border-[var(--border)] bg-[var(--surface)]"/>{t('Working time')}</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-5 rounded-sm" style={{background: 'color-mix(in srgb, var(--text-muted) 12%, var(--surface))'}}/>{t('Off duty')}</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-5 rounded-sm" style={{background: 'repeating-linear-gradient(135deg, var(--surface) 0 3px, color-mix(in srgb, var(--warning) 35%, var(--surface)) 3px 6px)'}}/>{t('Reserved for urgent')}</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-5 rounded-sm border border-[var(--border)]" style={{background: 'radial-gradient(color-mix(in srgb, var(--success) 60%, transparent) 1px, var(--surface) 1.5px) 0 0 / 5px 5px'}}/>{t('Walk-in time')}</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-5 rounded-sm" style={{background: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--danger) 12%, var(--surface)) 0 3px, color-mix(in srgb, var(--danger) 30%, var(--surface)) 3px 6px)'}}/>{t('Blocked')}</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-5 rounded-sm bg-black/30"/>{t('Turnover or travel')}</li>
      <li className="ms-auto">{t(writable ? 'Click empty working time, or a row’s add button, to book that resource.' : 'Your role can view the board but not book.')}</li>
    </ul>
    {data?.holiday ? <p role="note" className="rounded-[var(--radius)] px-4 py-2 text-sm cg-wash-warning">{t('{name}: elective services are closed. 24x7 resources keep running.', {name: data.holiday.name})}</p> : null}
    <QueryError error={error} onRetry={reload}/>
    <div data-tour="cg-schedule-board">
      {!data && !error ? <div className="space-y-2">{Array.from({length: 8}, (_, i) => <Skeleton key={i} className="h-8"/>)}</div>
        : data ? <ResourceRowTimeline label={t('Schedule board for {date}', {date: f.niceDate(date)})} rows={model.rows} bands={model.bands} events={model.events} start={h0 * 60} end={h1 * 60} zoom={Number(zoom)} now={nowMinute}
          emptyLabel={t('No resources match these filters. Clear the search or pick another department.')} disabled={!writable}
          onOpen={event => setOpenAppointment(event.appointment)} createLabel={row => t('Book on {name}', {name: row.label})}
          onCreate={(row, minute) => {const resource = data.resources.find(r => String(r.id) === row); if (resource) setQuick({resource, at: minute});}}/> : null}
    </div>
    <AppointmentDrawer id={openAppointment} onClose={() => setOpenAppointment(null)}/>
    <QuickBook resource={quick?.resource ?? null} at={quick?.at ?? null} date={date} onClose={() => setQuick(null)}/>
  </div>;
}
