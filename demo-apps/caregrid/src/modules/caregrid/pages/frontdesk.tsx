'use client';
import React, {useEffect, useMemo, useState} from 'react';
import {Accessibility, AlertTriangle, CalendarPlus, Languages, LogIn, MessageSquare, Play, ShieldAlert, Square, Trash2, UserX} from '@pepbits/icons';
import {Badge, Button, IconButton, SearchInput, Segmented, Select, Skeleton} from '@pepbits/ui';
import {EmptyState, Tabs} from '@pepbits/components';
import {WorkflowBoard} from '@pepbits/patterns/board';
import {qs} from '../../../adapters/caregrid';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {ACTION_LABEL} from '../labels';
import {addDays, nowLocal, toMin} from '../time';
import {CatIcon, Chip, Panel, QueryError, StatusPill} from '../ui';
import {AppointmentDrawer} from '../booking/appointment-drawer';
import type {AppointmentDetail, AppointmentRow, Meta, Reminder} from '../types';

const COLUMNS = [{id: 'expected', label: 'Expected', statuses: ['booked', 'confirmed']}, {id: 'arrived', label: 'Arrived, waiting', statuses: ['checked_in']}, {id: 'session', label: 'In session', statuses: ['in_progress']}, {id: 'done', label: 'Finished', statuses: ['completed', 'no_show', 'cancelled']}];
const columnOf = (status: string) => COLUMNS.find(c => c.statuses.includes(status))?.id ?? 'expected';
/** Board moves map onto the server's lifecycle commands; any other move is refused locally. */
export function moveAction(status: string, column: string): string | null {
  const from = columnOf(status);
  if (from === 'expected' && column === 'arrived') return 'check_in';
  if (from === 'arrived' && column === 'session') return 'start';
  if (from === 'session' && column === 'done') return 'complete';
  if (from === 'expected' && column === 'done') return 'no_show';
  if (from === 'arrived' && column === 'expected') return 'undo';
  if (status === 'no_show' && column === 'expected') return 'undo';
  return null;
}
interface WaitlistEntry {id: number; patient_id: number; patient_name: string; mrn: string; type_id: number; type_name: string; category_icon: string; earliest: string; latest: string; priority: string; status: string; notes?: string | null}

function Flow({meta}: {meta: Meta}) {
  const {client, f, t, notify, writable} = useScreen();
  const [department, setDepartment] = useState(''), [q, setQ] = useState(''), [open, setOpen] = useState<number | null>(null), [showDone, setShowDone] = useState(false), [pending, setPending] = useState(false), [now, setNow] = useState(nowLocal());
  useEffect(() => {const timer = setInterval(() => setNow(nowLocal()), 20000); return () => clearInterval(timer);}, []);
  const {data, error, reload, setData} = useCaregridQuery<AppointmentRow[]>('/appointments' + qs({date: meta.today, department, q}));
  const act = async (a: AppointmentRow, action: string) => {
    if (pending || !writable) return;
    setPending(true);
    try {
      const next = await client.request<AppointmentDetail>(`/appointments/${a.id}/status`, {body: {action}});
      setData(list => list?.map(item => item.id === a.id ? {...item, status: next.status, checked_in_at: next.checked_in_at, actual_start: next.actual_start, actual_end: next.actual_end} : item) ?? null);
      notify(`${t(ACTION_LABEL[action] ?? action)}: ${a.patient_name}, ${a.type_name}`, {tone: action === 'no_show' ? 'info' : 'success'});
    } catch (failure) {notify(`${t('Not changed')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setPending(false);}
  };
  const columns = COLUMNS.filter(c => showDone || c.id !== 'done');
  const items = useMemo(() => (data ?? []).filter(a => showDone || columnOf(a.status) !== 'done'), [data, showDone]);
  const card = (a: AppointmentRow) => {
    const late = ['booked', 'confirmed'].includes(a.status) && toMin(now) - toMin(a.start_at) > 10;
    const waited = a.status === 'checked_in' && a.checked_in_at ? toMin(now) - toMin(a.checked_in_at) : null;
    const elapsed = a.status === 'in_progress' && a.actual_start ? toMin(now) - toMin(a.actual_start) : null, over = elapsed !== null && elapsed > a.duration_min;
    return <div className="space-y-1.5 text-start" data-flow-card={a.id}>
      <div className="flex items-start gap-2">
        <div className="w-14 shrink-0"><p className="text-sm font-semibold tabular-nums">{f.time(a.start_at)}</p>{late ? <p className="text-[0.65rem] font-semibold" style={{color: 'var(--danger-ink)'}}>{t('Late')}</p> : null}</div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[0.72rem] text-[var(--text-muted)]"><CatIcon name={a.category_icon} color={a.dept_color} className="size-3 shrink-0"/><span className="truncate">{a.type_name}</span></p>
          {a.primary_resource ? <p className="truncate text-[0.68rem] text-[var(--text-muted)]">{a.primary_resource}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-1">{a.priority === 'urgent' ? <Badge tone="danger">{t('Urgent')}</Badge> : null}{a.at_risk ? <ShieldAlert aria-label={t('At risk')} className="size-3.5" style={{color: 'var(--warning)'}}/> : null}</div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {a.interpreter_needed ? <Languages aria-label={t('Interpreter needed')} className="size-3.5 text-[var(--text-muted)]"/> : null}
        {a.mobility && a.mobility !== 'Independent' ? <Accessibility aria-label={a.mobility} className="size-3.5 text-[var(--text-muted)]"/> : null}
        {a.allergies ? <AlertTriangle aria-label={t('Allergy: {name}', {name: a.allergies})} className="size-3.5" style={{color: 'var(--danger)'}}/> : null}
        {waited !== null ? <span className={`ms-auto rounded px-1.5 text-[0.68rem] font-semibold tabular-nums ${waited > 20 ? 'cg-wash-danger' : 'cg-wash-warning'}`}>{t('Waiting {n} min', {n: f.number(waited)})}</span> : null}
        {elapsed !== null ? <span className={`ms-auto rounded px-1.5 text-[0.68rem] font-semibold tabular-nums ${over ? 'cg-wash-danger' : 'cg-wash-info'}`}>{t('{n} of {total} min', {n: f.number(elapsed), total: f.number(a.duration_min)})}</span> : null}
        {['completed', 'no_show', 'cancelled'].includes(a.status) ? <span className="ms-auto"><StatusPill status={a.status}/></span> : null}
      </div>
      {['booked', 'confirmed', 'checked_in', 'in_progress'].includes(a.status) ? <div className="flex gap-1.5">
        {['booked', 'confirmed'].includes(a.status) ? <><Button size="xs" className="flex-1" disabled={pending || !writable} leftIcon={<LogIn className="size-3.5"/>} onClick={() => act(a, 'check_in')}>{t('Check in')}</Button>
          <IconButton label={t('Mark {name} as no-show', {name: a.patient_name})} disabled={pending || !writable} onClick={() => act(a, 'no_show')}><UserX className="size-3.5"/></IconButton></> : null}
        {a.status === 'checked_in' ? <Button size="xs" className="flex-1" disabled={pending || !writable} leftIcon={<Play className="size-3.5"/>} onClick={() => act(a, 'start')}>{t('Start session')}</Button> : null}
        {a.status === 'in_progress' ? <Button size="xs" variant="secondary" className="flex-1" disabled={pending || !writable} leftIcon={<Square className="size-3.5"/>} onClick={() => act(a, 'complete')}>{t('Complete')}</Button> : null}
      </div> : null}
    </div>;
  };
  return <div className="space-y-2.5">
    <div className="flex flex-wrap items-end gap-2">
      <Select label="Department" value={department} onChange={e => setDepartment(e.target.value)} placeholder="All departments" options={meta.departments.map(d => ({value: String(d.id), label: d.name}))}/>
      <SearchInput aria-label="Patient, MRN or reference" placeholder="Patient, MRN or reference" className="w-60" value={q} onChange={setQ}/>
      <span className="text-sm text-[var(--text-muted)]">{data ? t('{n} appointments today', {n: f.number(data.length)}) : ''}</span>
      <span className="ms-auto"><Chip pressed={showDone} onClick={() => setShowDone(value => !value)}>{t('Show finished')}</Chip></span>
    </div>
    <QueryError error={error} onRetry={reload}/>
    <div data-tour="cg-flow">
      {!data ? <div className="grid gap-2.5 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40"/>)}</div>
        : <WorkflowBoard label={t('Patient flow')} columns={columns.map(c => ({id: c.id, label: t(c.label)}))} items={items} itemId={a => String(a.id)} itemLabel={a => a.patient_name} columnId={a => columnOf(a.status)} disabled={pending || !writable}
          renderItem={card} onOpen={a => setOpen(a.id)} onMove={(a, column) => {const action = moveAction(a.status, column); if (action) void act(a, action); else notify(t('That move is not a step in the patient flow. Use the card buttons instead.'), {tone: 'warning'});}}/>}
      {data && !items.length ? <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('Nothing here.')}</p> : null}
    </div>
    <AppointmentDrawer id={open} onClose={() => setOpen(null)}/>
  </div>;
}

function Waitlist({meta}: {meta: Meta}) {
  const {client, f, t, navigation, notify, writable} = useScreen();
  const {data, error, reload} = useCaregridQuery<WaitlistEntry[]>('/waitlist');
  const remove = async (id: number) => {
    if (!writable) return;
    try {await client.request(`/waitlist/${id}`, {method: 'PATCH', body: {status: 'removed'}}); reload();}
    catch (failure) {notify(`${t('Not removed')}. ${failureText(failure)}`, {tone: 'warning'});}
  };
  if (error && !data) return <QueryError error={error} onRetry={reload}/>;
  if (!data) return <Skeleton className="h-60"/>;
  if (!data.length) return <Panel><EmptyState title="The waitlist is empty" description="Add patients from the booking page when no time fits. They are offered freed slots automatically."/></Panel>;
  return <ul className="cg-panel divide-y divide-[var(--border)]" data-waitlist>{data.map(w => <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
    <CatIcon name={w.category_icon} color="var(--primary)"/>
    <div className="min-w-[12rem] flex-1"><p className="text-sm font-medium">{w.patient_name} <span className="text-[var(--text-muted)]">{w.mrn}</span></p>
      <p className="text-xs text-[var(--text-muted)]">{t('{service}, between {from} and {until}', {service: w.type_name, from: f.niceDate(w.earliest, meta.today), until: f.niceDate(w.latest, meta.today)})}{w.notes ? `. ${w.notes}` : ''}</p></div>
    {w.priority === 'urgent' ? <Badge tone="danger">{t('Urgent')}</Badge> : null}
    {w.status === 'offered' ? <Badge tone="success">{t('Slot offered')}</Badge> : null}
    <Button size="sm" leftIcon={<CalendarPlus className="size-4"/>} onClick={() => navigation.open(to('caregrid-book', {patient: w.patient_id, type: w.type_id, date: w.earliest < meta.today ? meta.today : w.earliest, waitlist: w.id}))}>{t('Find a slot')}</Button>
    <IconButton label={t('Remove {name} from waitlist', {name: w.patient_name})} disabled={!writable} onClick={() => void remove(w.id)}><Trash2 className="size-4"/></IconButton>
  </li>)}</ul>;
}

function Reminders({meta}: {meta: Meta}) {
  const {f, t} = useScreen();
  const [day, setDay] = useState('today');
  const {data, error, reload} = useCaregridQuery<Reminder[]>(`/reminders?date=${day === 'today' ? meta.today : addDays(meta.today, 1)}`);
  return <Panel title={t('Patient reminder outbox')} aside={<Segmented size="sm" label="Reminder day" value={day} onChange={setDay} options={[{value: 'today', label: 'Sending today'}, {value: 'tomorrow', label: 'Tomorrow'}]}/>} bodyClassName="">
    <QueryError error={error} onRetry={reload}/>
    <ul tabIndex={0} aria-label={t('Patient reminder outbox')} className="max-h-[calc(100vh-17rem)] divide-y divide-[var(--border)] overflow-y-auto" data-reminders>
      {data?.map(r => <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-sm"><MessageSquare aria-hidden className="mt-0.5 size-4 shrink-0" style={{color: 'var(--primary)'}}/>
        <div className="min-w-0 flex-1"><p className="font-medium">{r.patient_name} <span className="font-normal text-[var(--text-muted)]">{t('by {channel}, {when}', {channel: r.channel, when: f.niceDateTime(r.send_at, meta.today)})}</span></p><p className="text-xs text-[var(--text-muted)]">{r.message}</p></div>
        <Badge tone={r.status === 'scheduled' ? 'success' : r.status === 'sent' ? 'neutral' : 'danger'}>{t(r.status)}</Badge></li>)}
    </ul>
    {data && !data.length ? <EmptyState title="No reminders for this day" description="Reminders are scheduled 24 hours and 2 hours before each visit."/> : null}
  </Panel>;
}

export function FrontDeskPage({meta, params}: ScreenProps) {
  const {f, t, navigation} = useScreen();
  const tab = params.get('tab') ?? 'flow';
  const {data: waitlist} = useCaregridQuery<WaitlistEntry[]>('/waitlist');
  return <div className="space-y-2.5" data-frontdesk>
    <div className="flex flex-wrap items-center gap-3">
      <div data-tour="cg-frontdesk-tabs"><Tabs variant="segmented" value={tab} onChange={value => navigation.open(to('caregrid-frontdesk', {tab: value === 'flow' ? null : value}))}
        items={[{id: 'flow', label: 'Patient flow'}, {id: 'waitlist', label: 'Waitlist', badge: waitlist?.length ? f.number(waitlist.length) : undefined}, {id: 'reminders', label: 'Reminders'}]}/></div>
      <Button className="ms-auto" leftIcon={<CalendarPlus className="size-4"/>} onClick={() => navigation.open(to('caregrid-book'))}>{t('Book')}</Button>
    </div>
    <div role="tabpanel" aria-label={t(tab === 'waitlist' ? 'Waitlist' : tab === 'reminders' ? 'Reminders' : 'Patient flow')}>
      {tab === 'waitlist' ? <Waitlist meta={meta}/> : tab === 'reminders' ? <Reminders meta={meta}/> : <Flow meta={meta}/>}
    </div>
  </div>;
}
