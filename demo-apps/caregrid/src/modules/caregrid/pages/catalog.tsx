'use client';
import React, {useEffect, useMemo, useState} from 'react';
import {CalendarPlus, Repeat, Save} from '@pepbits/icons';
import {Button, Input, SearchInput, Select, Skeleton, Textarea, TimeInput} from '@pepbits/ui';
import {Drawer} from '@pepbits/components';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {PATTERN_HINT, SLOT_MODEL_LABEL} from '../labels';
import {fromHM, hm} from '../time';
import {CatIcon, Chip, KindIcon, PagedCollection, QueryError, SegmentStrip} from '../ui';
import type {ServiceType} from '../types';

interface TypeDetail extends Omit<ServiceType, 'requirements'> {stats: {total: number; upcoming: number | null; no_show: number | null}; requirements: {id: number; label: string; kind: string; offset_min: number; duration_min: number | null; resource_count: number}[]}
interface RuleForm {duration_min: string; slot_step_min: string; min_notice_min: string; max_advance_days: string; window_start: string; window_end: string; prep_instructions: string}
const formFor = (t: TypeDetail): RuleForm => ({duration_min: String(t.duration_min), slot_step_min: String(t.slot_step_min), min_notice_min: String(t.min_notice_min), max_advance_days: String(t.max_advance_days), window_start: t.window_start != null ? hm(t.window_start) : '', window_end: t.window_end != null ? hm(t.window_end) : '', prep_instructions: t.prep_instructions ?? ''});
/** Client bounds mirror the API schema; the server still validates every value. */
export function ruleErrors(form: RuleForm): Partial<Record<keyof RuleForm, string>> {
  const errors: Partial<Record<keyof RuleForm, string>> = {}, n = (value: string) => Number(value);
  if (!Number.isInteger(n(form.duration_min)) || n(form.duration_min) < 5 || n(form.duration_min) > 10080) errors.duration_min = 'Use 5 to 10080 minutes.';
  if (!Number.isInteger(n(form.slot_step_min)) || n(form.slot_step_min) < 5 || n(form.slot_step_min) > 240) errors.slot_step_min = 'Use 5 to 240 minutes.';
  if (!Number.isInteger(n(form.min_notice_min)) || n(form.min_notice_min) < 0) errors.min_notice_min = 'Use zero or more minutes.';
  if (!Number.isInteger(n(form.max_advance_days)) || n(form.max_advance_days) < 1 || n(form.max_advance_days) > 365) errors.max_advance_days = 'Use 1 to 365 days.';
  return errors;
}

function TypeDrawer({id, onClose}: {id: number | null; onClose: () => void}) {
  const {client, f, t, notify, navigation, writable} = useScreen();
  const {data: detail, error, reload} = useCaregridQuery<TypeDetail>(id ? `/types/${id}` : null, {live: false});
  const [form, setForm] = useState<RuleForm | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => {if (detail && detail.id === id) setForm(formFor(detail));}, [detail, id]);
  const errors = form ? ruleErrors(form) : {};
  const save = async () => {
    if (!form || !id || busy || !writable || Object.keys(errors).length) return; setBusy(true);
    try {
      await client.request(`/types/${id}`, {method: 'PATCH', body: {duration_min: Number(form.duration_min), slot_step_min: Number(form.slot_step_min), min_notice_min: Number(form.min_notice_min), max_advance_days: Number(form.max_advance_days),
        window_start: form.window_start ? fromHM(form.window_start) : null, window_end: form.window_end ? fromHM(form.window_end) : null, prep_instructions: form.prep_instructions || null}});
      reload(); notify(`${t('Rules saved')}. ${t('New bookings use these settings straight away.')}`, {tone: 'success'});
    } catch (failure) {notify(`${t('Not saved')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setBusy(false);}
  };
  const d = detail && detail.id === id ? detail : null;
  const field = (key: keyof RuleForm, label: string) => <Input label={label} type="number" disabled={!writable} value={form![key]} error={errors[key] ? t(errors[key]!) : undefined} onChange={e => setForm({...form!, [key]: e.target.value})}/>;
  return <Drawer open={!!id} onClose={onClose} width="lg" title={d ? d.name : 'Service'} subtitle={d ? [d.category_name, d.setting, d.mode].filter(Boolean).join(', ') : undefined}
    footer={d ? <div className="flex w-full justify-between gap-2"><Button variant="outline" leftIcon={<CalendarPlus className="size-4"/>} onClick={() => navigation.open(to('caregrid-book', {type: d.id}))}>{t('Book this service')}</Button><Button disabled={busy || !writable || !!Object.keys(errors).length} leftIcon={<Save className="size-4"/>} onClick={() => void save()}>{t('Save rules')}</Button></div> : undefined}>
    <div className="space-y-5 px-5 py-4" data-type-drawer={id ?? undefined}>
      <QueryError error={error} onRetry={reload}/>
      {!d || !form ? (!error ? <Skeleton className="h-80"/> : null) : <>
        <dl className="grid grid-cols-3 gap-2 text-center">{[['Booked in total', d.stats.total], ['Upcoming', d.stats.upcoming ?? 0], ['No-shows', d.stats.no_show ?? 0]].map(([label, value]) => <div key={label as string} className="rounded-[var(--radius)] bg-[var(--surface-2)] p-3"><dt className="text-xs text-[var(--text-muted)]">{t(label as string)}</dt><dd className="text-lg font-semibold tabular-nums">{f.number(value as number)}</dd></div>)}</dl>
        <section><h3 className="mb-1 text-sm font-semibold">{t('Resource segments')}</h3>
          <p className="mb-3 text-xs text-[var(--text-muted)]">{d.pattern}: {t(PATTERN_HINT[d.pattern] ?? '')}. {t('Each bar is held only for its minutes, so other patients can use the resource the rest of the time.')}</p>
          <SegmentStrip detailed total={d.duration_min} segments={d.requirements.map(r => ({label: r.label, kind: r.kind, offset: r.offset_min, duration: r.duration_min}))}/>
          <ul className="mt-3 space-y-1">{d.requirements.map(r => <li key={r.id} className="flex items-center gap-2 text-xs"><KindIcon kind={r.kind} className="size-3.5"/><span className="flex-1">{r.label}</span><span className="text-[var(--text-muted)]">{t('{n} available to choose from', {n: f.number(r.resource_count)})}</span></li>)}</ul>
        </section>
        <section className="grid grid-cols-2 gap-3" aria-label={t('Rules')}>
          {field('duration_min', 'Patient duration (min)')}{field('slot_step_min', 'Start times every (min)')}{field('min_notice_min', 'Minimum notice (min)')}{field('max_advance_days', 'Book up to (days ahead)')}
          <TimeInput label="Earliest start" disabled={!writable} value={form.window_start} onChange={e => setForm({...form, window_start: e.target.value})}/>
          <TimeInput label="Latest start" disabled={!writable} value={form.window_end} onChange={e => setForm({...form, window_end: e.target.value})}/>
          <Textarea label="Patient preparation (sent in reminders)" className="col-span-2" disabled={!writable} value={form.prep_instructions} onChange={e => setForm({...form, prep_instructions: e.target.value})}/>
        </section>
        <ul className="flex flex-wrap gap-2 text-xs"><li className="cg-chip">{t(SLOT_MODEL_LABEL[d.slot_model] ?? d.slot_model)}</li>{d.recurring ? <li className="cg-chip"><Repeat aria-hidden className="size-3"/>{t('Usually a course')}</li> : null}{d.requires_consent ? <li className="cg-chip">{t('Consent required')}</li> : null}{d.travel_min ? <li className="cg-chip">{t('{n} min travel each way', {n: f.number(d.travel_min)})}</li> : null}</ul>
        {d.notes ? <p className="text-sm text-[var(--text-muted)]">{d.notes}</p> : null}
      </>}
    </div>
  </Drawer>;
}

export function CatalogPage({meta, params}: ScreenProps) {
  const {f, t, navigation} = useScreen();
  const {data: types, error, reload} = useCaregridQuery<ServiceType[]>('/types');
  const [category, setCategory] = useState<number | null>(null), [q, setQ] = useState(''), [pattern, setPattern] = useState('');
  const open = params.get('type') ? Number(params.get('type')) : null;
  const list = useMemo(() => (types ?? []).filter(s => (!category || s.category_id === category) && (!pattern || s.pattern === pattern) && (!q || `${s.name} ${s.category_name} ${s.notes ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [types, category, q, pattern]);
  return <div className="space-y-2.5" data-catalog-page>
    <div className="flex flex-wrap items-end gap-3" data-tour="cg-catalog-filters">
      <p className="me-auto text-sm text-[var(--text-muted)]">{t('{n} appointment types, each with the exact people, machines and spaces it holds.', {n: f.number(types?.length ?? 185)})}</p>
      <Select label="Resource pattern" value={pattern} onChange={e => setPattern(e.target.value)} placeholder="All resource patterns" options={Object.keys(PATTERN_HINT).map(p => ({value: p, label: p}))}/>
      <SearchInput aria-label="Search services" placeholder="Search services" className="w-60" value={q} onChange={setQ}/>
    </div>
    <div role="group" aria-label={t('Categories')} className="flex flex-wrap gap-1">
      <Chip pressed={!category} onClick={() => setCategory(null)}>{t('All categories')}</Chip>
      {meta.categories.map(c => <Chip key={c.id} pressed={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}><CatIcon name={c.icon} color={category === c.id ? undefined : c.color} className="size-3.5"/>{c.name}<span className="opacity-70">{f.number(c.type_count)}</span></Chip>)}
    </div>
    <QueryError error={error} onRetry={reload}/>
    <div data-tour="cg-catalog-list">
      {!types && !error ? <div className="space-y-1.5">{Array.from({length: 8}, (_, i) => <Skeleton key={i} className="h-10"/>)}</div> : null}
      {types ? <PagedCollection resetKey={`${category}|${q}|${pattern}`} rows={list} rowKey={s => String(s.id)} selectedKey={open ? String(open) : null} onRowClick={s => navigation.open(to('caregrid-catalog', {type: s.id}))}
        empty={<p className="p-8 text-center text-sm text-[var(--text-muted)]">{t('No service matches these filters.')}</p>}
        columns={[
          {key: 'name', header: 'Service', render: s => <span className="flex min-w-0 items-center gap-2"><CatIcon name={s.category_icon} color={s.dept_color}/><span className="min-w-0"><span className="block truncate">{s.name}</span><span className="block truncate text-[0.7rem] text-[var(--text-muted)]">{s.category_name}</span></span></span>},
          {key: 'pattern', header: 'Pattern', render: s => <span className="text-xs text-[var(--text-muted)]">{s.pattern}</span>},
          {key: 'duration', header: 'Duration', render: s => <span className="tabular-nums">{f.dur(s.duration_min)}</span>},
          {key: 'step', header: 'Starts every', render: s => <span className="tabular-nums text-[var(--text-muted)]">{t('{n} min', {n: f.number(s.slot_step_min)})}</span>},
          {key: 'resources', header: 'Resources held', render: s => <span className="flex items-center gap-2"><span className="w-24"><SegmentStrip total={s.duration_min} segments={s.requirements.map(r => ({label: r.label, kind: r.kind, offset: r.offset, duration: r.duration}))}/></span><span className="text-xs tabular-nums text-[var(--text-muted)]">{f.number(s.requirements.length)}</span></span>},
          {key: 'model', header: 'Slot model', render: s => <span className="text-xs text-[var(--text-muted)]">{t(SLOT_MODEL_LABEL[s.slot_model] ?? s.slot_model)}</span>},
        ]}/> : null}
    </div>
    <TypeDrawer id={open} onClose={() => navigation.open(to('caregrid-catalog'))}/>
  </div>;
}
