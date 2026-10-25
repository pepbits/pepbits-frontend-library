'use client';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {CalendarOff, Copy, Plus, Save, Trash2, Undo2} from '@pepbits/icons';
import {Badge, Button, IconButton, Input, SearchInput, Select, Skeleton, TimeInput} from '@pepbits/ui';
import {EmptyState} from '@pepbits/components';
import {qs} from '../../../adapters/caregrid';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {EXCEPTION_LABEL, KIND_LABEL, KIND_TONE} from '../labels';
import {fromHM, hm} from '../time';
import {Chip, KindIcon, KindTag, Panel, QueryError} from '../ui';
import type {Meta, ResourceRow} from '../types';

export interface Win {weekday: number; start_min: number; end_min: number; tag: 'general' | 'urgent' | 'walkin'; release_hours: number; week_parity: number | null}
interface ResourceDetail {
  id: number; name: string; kind: string; role_label: string; department: string; department_id: number; capacity: number; turnover_min: number; always_on: number;
  templates: Win[]; exceptions: {id: number; type: string; start_at: string; end_at: string; recur_weeks: number | null; reason?: string | null}[];
  usedBy: {id: number; name: string}[]; week: {date: string; available_min: number; booked_min: number; pct: number}[];
}
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toHM = (minutes: number) => hm(minutes % 1440);
/** Copy Monday's windows onto Tuesday to Friday, replacing their existing windows. */
export const copyMonday = (rows: readonly Win[]) => [...rows.filter(x => ![2, 3, 4, 5].includes(x.weekday)), ...[2, 3, 4, 5].flatMap(day => rows.filter(r => r.weekday === 1).map(r => ({...r, weekday: day})))];

function HoursEditor({resource, onSaved}: {resource: ResourceDetail; onSaved: () => void}) {
  const {client, f, t, notify, writable} = useScreen();
  const original = useMemo<Win[]>(() => resource.templates.map(w => ({weekday: w.weekday, start_min: w.start_min, end_min: w.end_min, tag: w.tag, release_hours: w.release_hours, week_parity: w.week_parity})), [resource]);
  const [rows, setRows] = useState<Win[]>(original), [busy, setBusy] = useState(false);
  const baseline = useRef(original);
  useEffect(() => {
    const previous = baseline.current;
    // Live load/booking updates must not discard a working-hours edit in progress.
    setRows(current => JSON.stringify(current) === JSON.stringify(previous) ? original : current);
    baseline.current = original;
  }, [original]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(original), invalid = rows.some(r => r.end_min <= r.start_min);
  const update = (index: number, patch: Partial<Win>) => setRows(list => list.map((row, i) => i === index ? {...row, ...patch} : row));
  const total = rows.reduce((sum, r) => sum + (r.end_min - r.start_min) * (r.week_parity === null ? 1 : 0.5), 0);
  const save = async () => {
    if (!dirty || busy || invalid || !writable) return; setBusy(true);
    try {const result = await client.request<{flagged: number}>(`/resources/${resource.id}/templates`, {method: 'PUT', body: rows}); notify(result.flagged ? t('Working hours saved. {n} booked appointments were added to the reschedule queue.', {n: f.number(result.flagged)}) : t('Working hours saved'), {tone: result.flagged ? 'warning' : 'success'}); onSaved();}
    catch (failure) {notify(`${t('Hours not saved')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setBusy(false);}
  };
  return <Panel id="hours" title={<span>{t('Weekly working hours')}<span className="block text-xs font-normal text-[var(--text-muted)]">{t('About {d} a week', {d: f.dur(Math.round(total))})}{resource.capacity > 1 ? `, ${t('{n} patients at once', {n: f.number(resource.capacity)})}` : ''}</span></span>}
    aside={<div className="flex flex-wrap gap-1.5" data-tour="cg-hours-save">
      <Button size="sm" variant="ghost" disabled={!writable} leftIcon={<Copy className="size-4"/>} onClick={() => setRows(copyMonday)}>{t('Copy Monday to weekdays')}</Button>
      {dirty ? <Button size="sm" variant="ghost" leftIcon={<Undo2 className="size-4"/>} onClick={() => setRows(original)}>{t('Undo')}</Button> : null}
      <Button size="sm" disabled={!dirty || busy || invalid || !writable} leftIcon={<Save className="size-4"/>} onClick={() => void save()}>{t('Save hours')}</Button>
    </div>}>
    {invalid ? <p role="alert" className="mb-2 rounded-lg p-2 text-sm cg-wash-danger">{t('Each working window must end after it starts.')}</p> : null}
    <div className="divide-y divide-[var(--border)]" data-tour="cg-hours" data-hours-editor>
      {ORDER.map(day => {const items = rows.map((row, index) => ({row, index})).filter(x => x.row.weekday === day), dayName = f.wd(`2026-10-${String(4 + day).padStart(2, '0')}`);
        return <div key={day} role="group" aria-label={dayName} className="grid grid-cols-[3.5rem_1fr] gap-3 py-2">
          <p className="pt-1.5 text-sm font-semibold">{dayName}</p>
          <div className="space-y-1.5">
            <div aria-hidden className="relative h-2 rounded-full bg-[var(--surface-3)]">{items.map(({row, index}) => <div key={index} className="absolute h-full rounded-full" style={{insetInlineStart: `${row.start_min / 1440 * 100}%`, width: `${(Math.min(row.end_min, 1440) - row.start_min) / 14.4}%`, background: row.tag === 'urgent' ? 'var(--warning)' : row.tag === 'walkin' ? 'color-mix(in srgb, var(--success) 45%, var(--surface))' : 'var(--success)'}}/>)}</div>
            {items.map(({row, index}) => <div key={index} className="flex flex-wrap items-end gap-1.5" data-window={`${day}-${index}`}>
              <TimeInput label="Start" className="w-[7.5rem]" disabled={!writable} value={toHM(row.start_min)} onChange={e => e.target.value && update(index, {start_min: fromHM(e.target.value)})}/>
              <TimeInput label="End" className="w-[7.5rem]" disabled={!writable} value={row.end_min >= 1440 && row.end_min % 1440 === 0 ? '23:59' : toHM(row.end_min)} onChange={e => {if (!e.target.value) return; let minute = fromHM(e.target.value); if (minute === 1439) minute = 1440; if (minute <= row.start_min) minute += 1440; update(index, {end_min: minute});}}/>
              {row.end_min > 1440 ? <span className="pb-2 text-[0.68rem] text-[var(--text-muted)]">{t('next day')}</span> : null}
              <Select label="Use" disabled={!writable} value={row.tag} onChange={e => update(index, {tag: e.target.value as Win['tag'], release_hours: e.target.value === 'general' ? 0 : row.release_hours || 2})} placeholder="" options={[{value: 'general', label: 'Open to all'}, {value: 'urgent', label: 'Reserved: urgent'}, {value: 'walkin', label: 'Reserved: walk-in'}]}/>
              {row.tag !== 'general' ? <Input label="Opens to all (hours before)" type="number" min={0} className="w-40" disabled={!writable} value={row.release_hours} onChange={e => update(index, {release_hours: Math.max(0, Number(e.target.value) || 0)})}/> : null}
              <Select label="Weeks" disabled={!writable} value={row.week_parity === null ? '' : String(row.week_parity)} onChange={e => update(index, {week_parity: e.target.value === '' ? null : Number(e.target.value)})} placeholder="Every week" options={[{value: '0', label: 'Even weeks'}, {value: '1', label: 'Odd weeks'}]}/>
              <IconButton label={t('Remove window')} disabled={!writable} onClick={() => setRows(list => list.filter((_, i) => i !== index))}><Trash2 className="size-3.5"/></IconButton>
            </div>)}
            <Button size="xs" variant="ghost" disabled={!writable} leftIcon={<Plus className="size-3.5"/>} onClick={() => setRows(list => [...list, {weekday: day, start_min: 540, end_min: 1020, tag: 'general', release_hours: 0, week_parity: null}])}>{t(items.length ? 'Add window' : 'Add working time')}</Button>
          </div>
        </div>;})}
    </div>
  </Panel>;
}

function Detail({id, meta}: {id: number; meta: Meta}) {
  const {f, t, navigation} = useScreen();
  const {data: r, error, reload} = useCaregridQuery<ResourceDetail>(`/resources/${id}`);
  if (error && !r) return <QueryError error={error} onRetry={reload}/>;
  if (!r) return <div className="space-y-2.5"><Skeleton className="h-28"/><Skeleton className="h-96"/></div>;
  return <div className="space-y-2.5" data-resource-detail={r.id}>
    <section className="cg-panel p-4" aria-label={r.name}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-12 place-items-center rounded-xl bg-[var(--surface-2)]"><KindIcon kind={r.kind} className="size-6"/></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{r.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]"><KindTag kind={r.kind}/> {r.role_label}, {r.department}</p>
          <p className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
            <span>{t('Capacity {n} at once', {n: f.number(r.capacity)})}</span><span>{t('Turnover after each use {n} min', {n: f.number(r.turnover_min)})}</span>
            <span>{t(r.always_on ? 'Runs 24x7, ignores facility holidays' : 'Closes on facility holidays')}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigation.open(to('caregrid-schedule', {date: meta.today, department: r.department_id}))}>{t('Open on board')}</Button>
          <Button size="sm" leftIcon={<CalendarOff className="size-4"/>} onClick={() => navigation.open(to('caregrid-exceptions', {resource: r.id}))}>{t('Block time')}</Button>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label={t('Next 7 days')}>{r.week.map(w => <li key={w.date} className="rounded-lg bg-[var(--surface-2)] p-2 text-center">
        <p className="text-[0.68rem] text-[var(--text-muted)]">{f.niceDate(w.date, meta.today)}</p>
        <div aria-hidden className="mx-auto mt-1.5 flex h-14 w-6 items-end overflow-hidden rounded bg-[var(--surface-3)]"><div className="w-full rounded" style={{height: `${Math.min(100, w.pct)}%`, background: w.pct >= 85 ? 'var(--danger)' : KIND_TONE[r.kind]}}/></div>
        <p className="mt-1 text-xs font-semibold tabular-nums">{w.available_min ? f.percent(w.pct) : t('Off')}</p>
      </li>)}</ol>
    </section>
    <div className="grid gap-2.5 2xl:grid-cols-[1fr_20rem]">
      <HoursEditor resource={r} onSaved={reload}/>
      <div className="space-y-2.5">
        <Panel title={t('Blocks')}><ul className="space-y-1.5">{r.exceptions.map(x => <li key={x.id} className="rounded-lg px-3 py-2 text-xs cg-wash-danger">
          <p className="font-semibold">{t(EXCEPTION_LABEL[x.type] ?? x.type)}{x.recur_weeks ? `, ${x.recur_weeks === 1 ? t('every week') : t('every {n} weeks', {n: f.number(x.recur_weeks)})}` : ''}</p>
          <p className="text-[var(--text)]">{t('{from} to {to}', {from: f.niceDateTime(x.start_at, meta.today), to: f.niceDateTime(x.end_at, meta.today)})}{x.reason ? `. ${x.reason}` : ''}</p>
        </li>)}</ul>{!r.exceptions.length ? <p className="text-sm text-[var(--text-muted)]">{t('No upcoming blocks.')}</p> : null}</Panel>
        <Panel title={t('Services that use it')} aside={<span className="text-xs text-[var(--text-muted)]">{f.number(r.usedBy.length)}</span>} bodyClassName="px-2 pb-3">
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">{r.usedBy.map(s => <li key={s.id}><button type="button" className="block w-full truncate rounded px-2 py-1 text-start text-sm hover:bg-[var(--surface-2)]" onClick={() => navigation.open(to('caregrid-catalog', {type: s.id}))}>{s.name}</button></li>)}</ul>
        </Panel>
      </div>
    </div>
  </div>;
}

export function ResourcesPage({meta, params}: ScreenProps) {
  const {f, t, navigation} = useScreen();
  const [department, setDepartment] = useState(''), [kind, setKind] = useState(''), [q, setQ] = useState('');
  const {data, error, reload} = useCaregridQuery<ResourceRow[]>('/resources' + qs({department, kind, q}));
  // Without an explicit id the first listed resource is shown, as in the source, without adding history entries.
  const id = params.get('id') ? Number(params.get('id')) : data?.[0]?.id ?? null;
  return <div className="grid gap-2.5 lg:grid-cols-[19rem_1fr] 2xl:grid-cols-[22rem_1fr]" data-resources-page>
    <section className="cg-panel flex max-h-[calc(100vh-8rem)] flex-col" aria-label={t('Resource directory')} data-tour="cg-resource-list">
      <div className="space-y-2 p-3">
        <SearchInput aria-label="Name or role" placeholder="Name or role" value={q} onChange={setQ}/>
        <Select label="Department" value={department} onChange={e => setDepartment(e.target.value)} placeholder="All departments" options={meta.departments.map(d => ({value: String(d.id), label: d.name}))}/>
        <div role="group" aria-label={t('Resource types')} className="flex flex-wrap gap-1"><Chip pressed={!kind} onClick={() => setKind('')}>{t('All')}</Chip>
          {meta.kinds.map(k => <Chip key={k} pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}><KindIcon kind={k} className="size-3.5"/>{t(KIND_LABEL[k] ?? k)}</Chip>)}</div>
        <p className="text-xs text-[var(--text-muted)]" role="status">{t('{n} resources', {n: f.number(data?.length ?? 0)})}</p>
      </div>
      <QueryError error={error} onRetry={reload}/>
      <ul className="flex-1 overflow-y-auto border-t border-[var(--border)] px-1.5 py-1.5">
        {!data && !error ? <li className="space-y-1.5 p-1.5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10"/>)}</li> : null}
        {data?.map(r => <li key={r.id}><button type="button" aria-current={id === r.id ? 'true' : undefined} onClick={() => navigation.open(to('caregrid-resources', {id: r.id}))} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start ${id === r.id ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-2)]'}`} data-resource-option={r.id}>
          <KindIcon kind={r.kind} className="size-4 shrink-0"/>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.name}</span><span className="block truncate text-[0.7rem] text-[var(--text-muted)]">{r.role_label}</span></span>
          {r.current_exception ? <Badge tone="danger">{t(EXCEPTION_LABEL[r.current_exception] ?? r.current_exception)}</Badge> : r.exception_count > 0 ? <span className="size-1.5 rounded-full bg-[var(--warning)]" title={t('Has upcoming blocks')} role="img" aria-label={t('Has upcoming blocks')}/> : null}
        </button></li>)}
      </ul>
      {data && !data.length ? <EmptyState title="No resources match" description="Clear the search or pick another department."/> : null}
    </section>
    <div>{id ? <Detail key={id} id={id} meta={meta}/> : <Skeleton className="h-96"/>}</div>
  </div>;
}
