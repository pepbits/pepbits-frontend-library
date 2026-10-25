'use client';
import React, {useEffect, useMemo, useState} from 'react';
import {ArrowRightLeft, CalendarOff, CheckCircle2, ChevronDown, Plus, ShieldAlert, Trash2, Wand2, X} from '@pepbits/icons';
import {Badge, Button, DateInput, IconButton, Input, SearchSelect, Segmented, Skeleton, TimeInput} from '@pepbits/ui';
import {EmptyState} from '@pepbits/components';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {EXCEPTION_LABEL} from '../labels';
import {addDays} from '../time';
import {CatIcon, Chip, KindIcon, Panel, QueryError} from '../ui';
import {AppointmentDrawer} from '../booking/appointment-drawer';
import type {Meta, QueueItem, ResourceRow, Slot} from '../types';

interface Suggestions {suggestions?: (Slot & {kept: number; distance_min: number})[]; keepCount?: number; blockers?: {label: string}[]}
interface Impacted {id: number; patient_name: string; type_name: string; start_at: string}
interface BlockRow {id: number; resource_name: string; role_label: string; kind: string; type: string; reason?: string | null; start_at: string; end_at: string; recur_weeks: number | null; planned: number; source: string; pending: number}

function QueueEntry({q, today, onOpen}: {q: QueueItem; today: string; onOpen: () => void}) {
  const {client, f, t, notify, writable} = useScreen();
  const [open, setOpen] = useState(false), [options, setOptions] = useState<Suggestions | null>(null), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || options) return;
    const controller = new AbortController();
    client.request<Suggestions>(`/queue/${q.id}/suggestions`, {signal: controller.signal}).then(setOptions, failure => {if (!controller.signal.aborted) setError(failure);});
    return () => controller.abort();
  }, [client, open, options, q.id, attempt]);
  const move = async (slot: Slot) => {
    if (busy || !writable) return; setBusy(true);
    try {await client.request(`/appointments/${q.appointment_id}/reschedule`, {body: {start: slot.start, assignments: slot.assignments.map(a => ({requirement_id: a.requirement_id, resource_id: a.resource_id}))}}); notify(t('Moved: {name}', {name: q.patient_name}), {tone: 'success'});}
    catch (failure) {notify(`${t('Could not move')}. ${failureText(failure)}`, {tone: 'warning'}); setOptions(null);}
    finally {setBusy(false);}
  };
  const dismiss = async () => {
    if (!writable) return;
    try {await client.request(`/queue/${q.id}/dismiss`, {body: {}}); notify(t('Kept at the original time: {name}. The team will handle it manually.', {name: q.patient_name}), {tone: 'info'});}
    catch (failure) {notify(`${t('Not changed')}. ${failureText(failure)}`, {tone: 'warning'});}
  };
  return <li className={`rounded-[var(--radius)] border bg-[var(--surface)] ${open ? 'border-[var(--primary)]' : 'border-[var(--border)]'}`} data-queue-item={q.id}>
    <div className="flex items-center gap-3 p-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${q.planned ? 'cg-wash-warning' : 'cg-wash-danger'}`}><CatIcon name={q.category_icon}/></span>
      <button type="button" className="min-w-0 flex-1 text-start" onClick={onOpen}>
        <span className="flex items-center gap-2 truncate text-sm font-medium">{q.patient_name}{q.priority === 'urgent' ? <Badge tone="danger">{t('Urgent')}</Badge> : null}</span>
        <span className="block truncate text-xs text-[var(--text-muted)]">{q.type_name}, {f.niceDateTime(q.start_at, today)}</span>
        <span className="block truncate text-[0.72rem]" style={{color: 'var(--warning-ink)'}}>{q.reason}</span>
      </button>
      <Button size="sm" variant="outline" aria-expanded={open} rightIcon={<ChevronDown className={`size-3.5 ${open ? 'rotate-180' : ''}`}/>} onClick={() => setOpen(value => !value)}>{t(open ? 'Hide' : 'New times')}</Button>
    </div>
    {open ? <div className="border-t border-[var(--border)] px-3 pb-3 pt-2.5">
      <QueryError error={error} onRetry={() => {setError(null); setOptions(null); setAttempt(value => value + 1);}}/>
      {!options && !error ? <p className="text-sm text-[var(--text-muted)]" role="status">{t('Finding the closest free times')}</p> : null}
      {options?.suggestions ? options.suggestions.length ? <ul className="grid gap-1.5 sm:grid-cols-2">{options.suggestions.map(s => <li key={s.start}><button type="button" disabled={busy || !writable} onClick={() => void move(s)} className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 text-start hover:border-[var(--primary)] disabled:opacity-50" data-suggestion={s.start}>
        <span className="flex-1"><span className="block text-sm font-semibold">{f.niceDate(s.start, today)}, {f.time(s.start)}</span>
          <span className="block text-[0.7rem] text-[var(--text-muted)]">{s.kept ? t('Keeps {kept} of {all} people and resources', {kept: f.number(s.kept), all: f.number(options.keepCount ?? 0)}) : t('Different team')}{s.distance_min < 1440 ? `, ${t('same day')}` : ''}</span></span>
        <span className="text-xs font-medium" style={{color: 'var(--primary)'}}>{t('Move here')}</span>
      </button></li>)}</ul>
        : <p className="text-sm text-[var(--text-muted)]">{t('No free time in the next 14 days.')} {options.blockers?.[0] ? t('Limited by {label}.', {label: options.blockers[0].label}) : ''}</p> : null}
      <div className="mt-2 flex justify-end"><Button size="xs" variant="ghost" disabled={!writable} onClick={() => void dismiss()}>{t('Keep original time')}</Button></div>
    </div> : null}
  </li>;
}

function AddBlock({preset, meta}: {preset: number | null; meta: Meta}) {
  const {client, f, t, notify, writable} = useScreen();
  const today = meta.today;
  const {data: resources} = useCaregridQuery<ResourceRow[]>('/resources', {live: false});
  const [resourceId, setResourceId] = useState(preset ? String(preset) : ''), [type, setType] = useState('leave'), [whole, setWhole] = useState('days');
  const [from, setFrom] = useState(today), [until, setUntil] = useState(today), [t1, setT1] = useState('09:00'), [t2, setT2] = useState('13:00');
  const [repeat, setRepeat] = useState('once'), [repeatUntil, setRepeatUntil] = useState(addDays(today, 90)), [reason, setReason] = useState('');
  const [impact, setImpact] = useState<Impacted[] | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => {if (preset) setResourceId(String(preset));}, [preset]);
  const recur = repeat === 'once' ? null : Number(repeat), allDay = whole === 'days';
  const body = resourceId && from && until && until >= from ? {resource_id: Number(resourceId), type, start_at: `${from}T${allDay ? '00:00' : t1}`, end_at: allDay ? `${addDays(until, 1)}T00:00` : `${until}T${t2}`, recur_weeks: recur, recur_until: recur ? repeatUntil : null, reason: reason || undefined} : null;
  const key = JSON.stringify(body);
  useEffect(() => {
    if (!body) {setImpact(null); return;}
    const controller = new AbortController();
    const timer = setTimeout(() => client.request<{impacted: Impacted[]}>('/exceptions/preview', {body, signal: controller.signal}).then(r => setImpact(r.impacted), () => {if (!controller.signal.aborted) setImpact(null);}), 300);
    return () => {clearTimeout(timer); controller.abort();};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key]);
  const options = useMemo(() => (resources ?? []).map(r => ({value: String(r.id), label: r.name, description: `${r.role_label}, ${r.department}`, icon: <KindIcon kind={r.kind}/>})), [resources]);
  const save = async () => {
    if (!body || busy || !writable) return; setBusy(true);
    try {await client.request('/exceptions', {body}); setReason(''); setImpact(null); notify(t('Block saved'), {tone: 'success'});}
    catch (failure) {notify(`${t('Block not saved')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setBusy(false);}
  };
  return <Panel title={t('Block a resource')} aside={<span className="text-xs text-[var(--text-muted)]">{t('Leave, maintenance, breakdowns')}</span>} id="block">
    <div className="space-y-3" data-tour="cg-block" data-add-block>
      <SearchSelect label="Resource" placeholder="Choose a person, machine, room, chair, bed or vehicle" searchPlaceholder="Search by name, role or department" emptyMessage="No resource matches." options={options} value={resourceId} onChange={setResourceId}/>
      <div role="group" aria-label={t('Reason')} className="flex flex-wrap gap-1">{meta.exceptionTypes.map(x => <Chip key={x} pressed={type === x} onClick={() => setType(x)}>{t(EXCEPTION_LABEL[x] ?? x)}</Chip>)}</div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented size="sm" label="Block length" value={whole} onChange={setWhole} options={[{value: 'days', label: 'Whole days'}, {value: 'part', label: 'Part of a day'}]}/>
        <Segmented size="sm" label="Repeat" value={repeat} onChange={setRepeat} options={[{value: 'once', label: 'Once'}, {value: '1', label: 'Weekly'}, {value: '2', label: 'Fortnightly'}, {value: '4', label: 'Every 4 weeks'}]}/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex gap-1"><DateInput label="From" value={from} onChange={e => {setFrom(e.target.value); if (e.target.value > until) setUntil(e.target.value);}}/>{!allDay ? <TimeInput label="Start" value={t1} onChange={e => setT1(e.target.value)}/> : null}</div>
        <div className="flex gap-1"><DateInput label="Until" value={until} min={from} onChange={e => setUntil(e.target.value)}/>{!allDay ? <TimeInput label="End" value={t2} onChange={e => setT2(e.target.value)}/> : null}</div>
      </div>
      {recur ? <DateInput label="Repeat until" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)}/> : null}
      <Input label="Note (optional)" placeholder="For example: engineer visit, annual leave" value={reason} onChange={e => setReason(e.target.value)}/>
      <div data-tour="cg-impact" role="status" className={`rounded-[var(--radius)] p-3 text-sm ${!impact ? 'bg-[var(--surface-2)] text-[var(--text-muted)]' : impact.length ? 'cg-wash-warning' : 'cg-wash-success'}`} data-impact={impact?.length ?? ''}>
        {!impact ? t('Choose a resource and dates to see who would be affected.') : impact.length ? <>
          <p className="flex items-center gap-2 font-semibold"><ShieldAlert aria-hidden className="size-4"/>{t('{n} booked appointments would need a new time', {n: f.number(impact.length)})}</p>
          <ul tabIndex={0} aria-label={t('Affected appointments')} className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">{impact.map(a => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.patient_name}, {a.type_name}</span><span className="shrink-0 tabular-nums">{f.niceDateTime(a.start_at, today)}</span></li>)}</ul>
        </> : <p className="flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden className="size-4"/>{t('No booked appointments are affected')}</p>}
      </div>
      <Button className="w-full" disabled={!body || busy || !writable} leftIcon={<CalendarOff className="size-4"/>} onClick={() => void save()}>{impact?.length ? t('Block and queue {n} for rescheduling', {n: f.number(impact.length)}) : t('Save block')}</Button>
    </div>
  </Panel>;
}

function Upcoming({meta}: {meta: Meta}) {
  const {client, f, t, notify, writable} = useScreen();
  const {data, error, reload} = useCaregridQuery<BlockRow[]>('/exceptions');
  const {data: holidays} = useCaregridQuery<{id: number; date: string; name: string}[]>('/holidays');
  const [date, setDate] = useState(''), [name, setName] = useState('');
  const call = async (run: () => Promise<unknown>, failureTitle: string) => {if (!writable) return false; try {await run(); return true;} catch (failure) {notify(`${t(failureTitle)}. ${failureText(failure)}`, {tone: 'warning'}); return false;}};
  return <div className="grid gap-2.5 2xl:grid-cols-[1fr_22rem]">
    <Panel title={t('Upcoming and repeating blocks')} aside={<span className="text-xs text-[var(--text-muted)]">{t('{n} active', {n: f.number(data?.length ?? 0)})}</span>} bodyClassName="">
      <QueryError error={error} onRetry={reload}/>
      <ul className="max-h-[22rem] divide-y divide-[var(--border)] overflow-y-auto" data-blocks>
        {!data && !error ? <li className="p-4"><Skeleton className="h-32"/></li> : null}
        {data?.map(x => <li key={x.id} className="flex items-center gap-3 px-4 py-2.5" data-block={x.id}>
          <KindIcon kind={x.kind}/>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{x.resource_name} <span className="font-normal text-[var(--text-muted)]">{x.role_label}</span></p>
            <p className="truncate text-xs text-[var(--text-muted)]">{t(EXCEPTION_LABEL[x.type] ?? x.type)}{x.reason ? `: ${x.reason}` : ''}. {t('{from} to {to}', {from: f.niceDateTime(x.start_at, meta.today), to: f.niceDateTime(x.end_at, meta.today)})}{x.recur_weeks ? `, ${x.recur_weeks === 1 ? t('repeats every week') : t('repeats every {n} weeks', {n: f.number(x.recur_weeks)})}` : ''}</p></div>
          <Badge tone={x.planned ? 'neutral' : 'danger'}>{t(x.planned ? 'Planned' : 'Unplanned')}</Badge>
          <span className="hidden text-[0.68rem] text-[var(--text-muted)] md:inline">{t('from {source}', {source: x.source.replace('_', ' ')})}</span>
          {x.pending > 0 ? <Badge tone="warning">{t('{n} to move', {n: f.number(x.pending)})}</Badge> : null}
          <IconButton label={t('Remove block for {name}', {name: x.resource_name})} disabled={!writable} onClick={() => void call(() => client.request(`/exceptions/${x.id}`, {method: 'DELETE'}), 'Not removed')}><Trash2 className="size-4"/></IconButton>
        </li>)}
      </ul>
      {data && !data.length ? <EmptyState title="No blocks planned" description="Blocks you add appear here until they end."/> : null}
    </Panel>
    <Panel title={t('Facility holidays')} id="holidays">
      <div className="space-y-2" data-tour="cg-holidays" data-holidays>
        <ul className="space-y-2">{holidays?.map(h => <li key={h.id} className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm">
          <span className="flex-1"><b>{f.niceDate(h.date, meta.today)}</b> <span className="text-[var(--text-muted)]">{h.name}</span></span>
          <IconButton label={t('Remove holiday {name}', {name: h.name})} disabled={!writable} onClick={() => void call(() => client.request(`/holidays/${h.id}`, {method: 'DELETE'}), 'Not removed')}><X className="size-4"/></IconButton>
        </li>)}</ul>
        <div className="flex items-end gap-1.5 pt-1">
          <DateInput label="Holiday date" className="w-40" value={date} onChange={e => setDate(e.target.value)}/>
          <Input label="Holiday name" value={name} onChange={e => setName(e.target.value)}/>
          <IconButton label={t('Add holiday')} disabled={!date || name.trim().length < 2 || !writable} onClick={() => void call(() => client.request('/holidays', {body: {date, name: name.trim()}}), 'Holiday not added').then(ok => {if (ok) {setDate(''); setName('');}})}><Plus className="size-4"/></IconButton>
        </div>
        <p className="text-[0.72rem] text-[var(--text-muted)]">{t('Elective services close; 24x7 resources such as wards, emergency and CT keep running.')}</p>
      </div>
    </Panel>
  </div>;
}

export function ExceptionsPage({meta, params}: ScreenProps) {
  const {client, f, t, notify, writable} = useScreen();
  const {data: queue, error, reload} = useCaregridQuery<QueueItem[]>('/queue');
  const [open, setOpen] = useState<number | null>(null), [auto, setAuto] = useState(false);
  const fixAll = async () => {
    if (auto || !writable) return; setAuto(true);
    try {
      const result = await client.request<{failed: {patient: string; reason: string}[]}>('/queue/auto', {body: {}});
      if (result.failed.length) notify(`${t('{n} need your decision', {n: f.number(result.failed.length)})}: ${result.failed.map(x => `${x.patient}: ${x.reason}`).join('; ')}`, {tone: 'warning'});
      else notify(t('Every queued appointment was moved to its best alternative.'), {tone: 'success'});
    } catch (failure) {notify(`${t('Not changed')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setAuto(false);}
  };
  return <div className="space-y-2.5" data-exceptions-page>
    <p className="text-sm text-[var(--text-muted)]">{t('Record an absence or breakdown once. Affected bookings come to this queue with ready-made alternatives, so nobody has to check calendars every day.')}</p>
    <div className="grid gap-2.5 xl:grid-cols-[1fr_minmax(24rem,30rem)]">
      <Panel id="queue" title={<span className="flex items-center gap-2">{t('Reschedule queue')}<Badge tone={queue?.length ? 'warning' : 'success'}>{f.number(queue?.length ?? 0)}</Badge></span>}
        aside={(queue?.length ?? 0) > 0 ? <Button size="sm" variant="secondary" disabled={auto || !writable} leftIcon={<Wand2 className="size-4"/>} onClick={() => void fixAll()}>{t('Fix all automatically')}</Button> : null}>
        <div data-tour="cg-queue">
          <QueryError error={error} onRetry={reload}/>
          {!queue && !error ? <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20"/>)}</div> : null}
          <ul className="max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto" data-queue>{queue?.map(q => <QueueEntry key={q.id} q={q} today={meta.today} onOpen={() => setOpen(q.appointment_id)}/>)}</ul>
          {queue && !queue.length ? <div className="flex flex-col items-center gap-2 py-6 text-center"><ArrowRightLeft aria-hidden className="size-5 text-[var(--text-muted)]"/><p className="font-semibold">{t('Nothing to reschedule')}</p><p className="max-w-sm text-sm text-[var(--text-muted)]">{t('When a block hits a booked appointment it appears here with the closest alternatives.')}</p></div> : null}
        </div>
      </Panel>
      <AddBlock meta={meta} preset={params.get('resource') ? Number(params.get('resource')) : null}/>
    </div>
    <Upcoming meta={meta}/>
    <AppointmentDrawer id={open} onClose={() => setOpen(null)}/>
  </div>;
}
