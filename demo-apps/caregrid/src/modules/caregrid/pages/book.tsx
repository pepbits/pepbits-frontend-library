'use client';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Accessibility, AlertTriangle, CalendarCheck, CheckCircle2, Clock, Hourglass, Languages, ListChecks, Repeat, Siren, UserPlus} from '@pepbits/icons';
import {Avatar, Badge, Button, DateInput, Input, SearchInput, Segmented, Select, Skeleton, TimeInput} from '@pepbits/ui';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {failureText, useScreen, type ScreenProps} from '../context';
import {SLOT_MODEL_LABEL} from '../labels';
import {addDays, age, hm} from '../time';
import {CatIcon, Chip, Panel, SegmentStrip} from '../ui';
import {SlotPicker} from '../booking/slot-picker';
import type {Availability, Meta, Patient, ServiceType, Slot} from '../types';

interface PatientDetail extends Patient {appointments: {id: number; status: string; start_at: string; type_name: string; category_icon: string; dept_color: string}[]}
interface Booked {ref: string; patient_name: string; type_name: string; start_at: string; resources: unknown[]; reminders: unknown[]}
interface SeriesResult {seriesId: string; booked: {id: number; start: string; shifted?: boolean}[]; skipped: {date: string; reason: string}[]}
type Done = {kind: 'one'; appointment: Booked} | ({kind: 'series'} & SeriesResult);
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function Step({n, title, done, children, aside, tour}: {n: number; title: string; done?: boolean; children: React.ReactNode; aside?: React.ReactNode; tour: string}) {
  return <section data-tour={tour} className="cg-panel flex h-full min-h-0 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="flex items-center gap-2.5"><span aria-hidden className="grid size-6 place-items-center rounded-full text-xs font-bold" style={done ? {background: 'var(--primary-fill)', color: '#fff'} : {background: 'var(--surface-3)'}}>{done ? <CheckCircle2 className="size-3.5"/> : n}</span><h2 className="text-sm font-semibold">{title}</h2></div>
      {aside}
    </div>
    <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
  </section>;
}

function PatientStep({patient, setPatient, meta}: {patient: Patient | null; setPatient: (patient: Patient | null) => void; meta: Meta}) {
  const {client, f, t, notify, writable} = useScreen();
  const [q, setQ] = useState(''), [adding, setAdding] = useState(false), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({full_name: '', gender: 'Female', dob: '', phone: '', language: 'English'});
  const {data: results} = useCaregridQuery<Patient[]>(!patient ? `/patients?q=${encodeURIComponent(q)}` : null, {live: false});
  const {data: detail} = useCaregridQuery<PatientDetail>(patient ? `/patients/${patient.id}` : null);
  if (patient) {
    const upcoming = (detail?.appointments ?? []).filter(a => ['booked', 'confirmed'].includes(a.status) && a.start_at >= meta.now).reverse().slice(0, 4);
    return <div className="space-y-3" data-selected-patient={patient.id}>
      <div className="flex items-start gap-3 rounded-[var(--radius)] bg-[var(--surface-2)] p-3">
        <Avatar name={patient.full_name} decorative/>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{patient.full_name}</p>
          <p className="text-xs text-[var(--text-muted)]">{[patient.mrn, patient.gender, patient.dob ? t('{n} y', {n: f.number(Number(age(patient.dob, meta.today)))}) : ''].filter(Boolean).join(', ')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {patient.interpreter_needed ? <Badge tone="info"><Languages aria-hidden className="me-1 inline size-3"/>{patient.language}</Badge> : null}
            {patient.mobility && patient.mobility !== 'Independent' ? <Badge><Accessibility aria-hidden className="me-1 inline size-3"/>{patient.mobility}</Badge> : null}
            {patient.allergies ? <Badge tone="danger"><AlertTriangle aria-hidden className="me-1 inline size-3"/>{patient.allergies}</Badge> : null}
          </div>
        </div>
        <Button size="xs" variant="ghost" onClick={() => setPatient(null)}>{t('Change')}</Button>
      </div>
      {detail ? <div><p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">{t('Upcoming for this patient')}</p>
        {upcoming.length ? <ul>{upcoming.map(a => <li key={a.id} className="flex items-center gap-2 border-b border-[var(--border)] py-1.5 text-xs last:border-0"><CatIcon name={a.category_icon} color={a.dept_color} className="size-3.5"/><span className="min-w-0 flex-1 truncate">{a.type_name}</span><span className="tabular-nums text-[var(--text-muted)]">{f.niceDateTime(a.start_at)}</span></li>)}</ul>
          : <p className="text-xs text-[var(--text-muted)]">{t('Nothing booked yet.')}</p>}
      </div> : null}
    </div>;
  }
  if (adding) return <form className="space-y-2.5" data-new-patient onSubmit={async event => {
    event.preventDefault(); if (saving || !writable) return; setSaving(true);
    try {const created = await client.request<Patient>('/patients', {body: form}); setPatient(created); setAdding(false);}
    catch (failure) {notify(`${t('Patient not saved')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setSaving(false);}
  }}>
    <Input label="Full name" required minLength={2} value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}/>
    <div className="grid grid-cols-2 gap-2">
      <Select label="Gender" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} options={['Female', 'Male', 'Other'].map(value => ({value, label: value}))}/>
      <DateInput label="Date of birth" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})}/>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Input label="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
      <Input label="Language" value={form.language} onChange={e => setForm({...form, language: e.target.value})}/>
    </div>
    <div className="flex justify-end gap-2 pt-1"><Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('Back to search')}</Button><Button type="submit" size="sm" disabled={saving || !writable}>{t('Register patient')}</Button></div>
  </form>;
  return <div className="flex h-full min-h-0 flex-col gap-2">
    <SearchInput aria-label="Search patients" placeholder="Name, MRN or phone" value={q} onChange={setQ}/>
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {!results ? <li className="space-y-1.5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11"/>)}</li> : null}
      {results?.slice(0, 30).map(p => <li key={p.id}><button type="button" data-patient-option={p.id} onClick={() => setPatient(p)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start hover:bg-[var(--surface-2)]">
        <Avatar name={p.full_name} size="sm" decorative/>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.full_name}</span><span className="block text-[0.72rem] text-[var(--text-muted)]">{[p.mrn, p.dob ? t('{n} y', {n: f.number(Number(age(p.dob, meta.today)))}) : '', p.phone].filter(Boolean).join(', ')}</span></span>
        {p.upcoming ? <Badge tone="success">{t('{n} upcoming', {n: f.number(p.upcoming)})}</Badge> : null}
      </button></li>)}
      {results && !results.length ? <li className="py-6 text-center text-sm text-[var(--text-muted)]">{t('No patient matches “{q}”.', {q})}</li> : null}
    </ul>
    <Button size="sm" variant="outline" disabled={!writable} leftIcon={<UserPlus className="size-4"/>} onClick={() => setAdding(true)}>{t('New patient')}</Button>
  </div>;
}

function ServiceStep({type, setType, meta}: {type: ServiceType | null; setType: (type: ServiceType | null) => void; meta: Meta}) {
  const {f, t} = useScreen();
  const [q, setQ] = useState(''), [category, setCategory] = useState<number | null>(null);
  const {data: types} = useCaregridQuery<ServiceType[]>('/types', {live: false});
  const list = useMemo(() => (types ?? []).filter(s => (!category || s.category_id === category) && (!q || `${s.name} ${s.category_name}`.toLowerCase().includes(q.toLowerCase()))), [types, category, q]);
  if (type) return <div className="space-y-3" data-selected-service={type.id}>
    <div className="flex items-start gap-3 rounded-[var(--radius)] bg-[var(--surface-2)] p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--surface)]"><CatIcon name={type.category_icon} color={type.dept_color} className="size-5"/></span>
      <div className="min-w-0 flex-1"><p className="font-semibold">{type.name}</p><p className="text-xs text-[var(--text-muted)]">{type.category_name}, {f.dur(type.duration_min)}, {t(SLOT_MODEL_LABEL[type.slot_model] ?? type.slot_model)}</p></div>
      <Button size="xs" variant="ghost" onClick={() => setType(null)}>{t('Change')}</Button>
    </div>
    <div><div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-[var(--text-muted)]">{t('What this booking reserves')}</span><span className="text-[var(--text-muted)]">{type.pattern}</span></div>
      <SegmentStrip detailed total={type.duration_min} segments={type.requirements.map(r => ({label: r.label, kind: r.kind, offset: r.offset, duration: r.duration}))}/></div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-[var(--text-muted)]">{t('Start times')}</p><p className="font-medium">{t('Every {n} min', {n: f.number(type.slot_step_min)})}{type.window_start != null && type.window_end != null ? `, ${t('{from} to {to}', {from: f.time(hm(type.window_start)), to: f.time(hm(type.window_end))})}` : ''}</p></div>
      <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-[var(--text-muted)]">{t('Notice')}</p><p className="font-medium">{type.min_notice_min ? t('At least {d} ahead', {d: f.dur(type.min_notice_min)}) : t('Same day allowed')}</p></div>
    </div>
    {type.prep_instructions ? <p className="rounded-lg p-2.5 text-xs cg-wash-warning"><b>{t('Patient preparation')}: </b>{type.prep_instructions}</p> : null}
  </div>;
  return <div className="flex h-full min-h-0 flex-col gap-2">
    <SearchInput aria-label="Search services" placeholder={t('Search {n} services, for example MRI, dialysis, refill', {n: f.number(types?.length ?? 185)})} value={q} onChange={setQ}/>
    <div role="group" aria-label={t('Categories')} className="flex max-h-[5.6rem] flex-wrap gap-1 overflow-y-auto">
      <Chip pressed={!category} onClick={() => setCategory(null)}>{t('All')}</Chip>
      {meta.categories.map(c => <Chip key={c.id} pressed={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}><CatIcon name={c.icon} color={category === c.id ? undefined : c.color} className="size-3.5"/>{c.name}</Chip>)}
    </div>
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {!types ? <li className="space-y-1.5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-11"/>)}</li> : null}
      {list.map(s => <li key={s.id}><button type="button" data-service-option={s.id} onClick={() => setType(s)} className="grid w-full grid-cols-[1.75rem_1fr_5.5rem] items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-[var(--surface-2)]">
        <CatIcon name={s.category_icon} color={s.dept_color}/>
        <span className="min-w-0"><span className="block truncate text-sm">{s.name}</span><span className="block truncate text-[0.7rem] text-[var(--text-muted)]">{f.dur(s.duration_min)}, {s.pattern}</span></span>
        <SegmentStrip total={s.duration_min} segments={s.requirements.map(r => ({label: r.label, kind: r.kind, offset: r.offset, duration: r.duration}))}/>
      </button></li>)}
      {types && !list.length ? <li className="py-6 text-center text-sm text-[var(--text-muted)]">{t('No service matches. Try a shorter word.')}</li> : null}
    </ul>
  </div>;
}

function WaitlistForm({today, onAdd, onClose, busy}: {today: string; onAdd: (from: string, until: string) => void; onClose: () => void; busy: boolean}) {
  const {t} = useScreen();
  const [from, setFrom] = useState(today), [until, setUntil] = useState(addDays(today, 7));
  return <div role="group" aria-label={t('Add to waitlist')} className="absolute bottom-11 end-0 z-20 w-72 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-md)]" data-waitlist-form>
    <div className="flex items-center justify-between"><p className="text-sm font-semibold">{t('Add to waitlist')}</p><Button size="xs" variant="ghost" onClick={onClose}>{t('Close')}</Button></div>
    <p className="mt-1 text-xs text-[var(--text-muted)]">{t('You will get an alert as soon as a matching slot frees up.')}</p>
    <div className="mt-2 grid grid-cols-2 gap-2"><DateInput label="From" value={from} onChange={e => setFrom(e.target.value)}/><DateInput label="Until" value={until} min={from} onChange={e => setUntil(e.target.value)}/></div>
    <Button size="sm" className="mt-3 w-full" disabled={busy || !from || !until || until < from} onClick={() => onAdd(from, until)}>{t('Add to waitlist')}</Button>
  </div>;
}

export function BookPage({meta, params}: ScreenProps) {
  const {client, f, t, notify, navigation, writable} = useScreen();
  const [patient, setPatient] = useState<Patient | null>(null), [type, setType] = useState<ServiceType | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null), [availability, setAvailability] = useState<Availability | null>(null);
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine'), [repeat, setRepeat] = useState(false);
  const [series, setSeries] = useState({weekdays: [1, 3, 5], time: '09:00', occurrences: 6, startDate: meta.today});
  const [notes, setNotes] = useState(''), [source, setSource] = useState('desk'), [busy, setBusy] = useState(false), [done, setDone] = useState<Done | null>(null), [waitlistOpen, setWaitlistOpen] = useState(false);
  const waitlistId = params.get('waitlist'), patientParam = params.get('patient'), typeParam = params.get('type');
  // Deep links (`?patient=&type=&date=&waitlist=`) preselect through HTTP, never from cached copies.
  useEffect(() => {
    const controller = new AbortController();
    if (patientParam) client.request<Patient>(`/patients/${encodeURIComponent(patientParam)}`, {signal: controller.signal}).then(setPatient, () => {});
    if (typeParam) client.request<ServiceType[]>('/types', {signal: controller.signal}).then(types => setType(types.find(item => String(item.id) === typeParam) ?? null), () => {});
    return () => controller.abort();
  }, [client, patientParam, typeParam]);
  const first = useRef(true);
  useEffect(() => {if (first.current) {first.current = false; return;} setSlot(null); setDone(null); setRepeat(false);}, [type, patient]);
  const bookOne = async () => {
    if (!patient || !type || !slot || busy || !writable) return;
    setBusy(true);
    try {
      const appointment = await client.request<Booked>('/appointments', {body: {patientId: patient.id, typeId: type.id, start: slot.start, assignments: slot.assignments.map(a => ({requirement_id: a.requirement_id, resource_id: a.resource_id})), priority, source, notes: notes || undefined, waitlistId: waitlistId ? Number(waitlistId) : undefined}});
      setDone({kind: 'one', appointment}); setSlot(null); setNotes('');
    } catch (failure) {
      const alternatives = ((failure as {detail?: {alternatives?: Slot[]}}).detail?.alternatives ?? []).slice(0, 3);
      notify(`${t('That time was just taken')}. ${alternatives.length ? t('Nearest free: {list}.', {list: alternatives.map(s => f.time(s.start)).join(', ')}) : failureText(failure)}`, {tone: 'warning'});
    } finally {setBusy(false);}
  };
  const bookSeries = async () => {
    if (!patient || !type || busy || !writable) return;
    setBusy(true);
    try {const result = await client.request<SeriesResult>('/appointments/series', {body: {patientId: patient.id, typeId: type.id, ...series, priority, notes: notes || undefined}}); setDone({kind: 'series', ...result});}
    catch (failure) {notify(`${t('Course not booked')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setBusy(false);}
  };
  const addWaitlist = async (earliest: string, latest: string) => {
    if (!patient || !type || busy || !writable) return;
    setBusy(true);
    try {await client.request('/waitlist', {body: {patientId: patient.id, typeId: type.id, earliest, latest, priority, notes: notes || undefined}}); setWaitlistOpen(false); notify(t('Added to waitlist'), {tone: 'success'});}
    catch (failure) {notify(`${t('Not added')}. ${failureText(failure)}`, {tone: 'warning'});}
    finally {setBusy(false);}
  };
  const ready = patient && type;
  return <div className="flex flex-col gap-2.5" data-book-page>
    <div className="flex flex-wrap items-end justify-between gap-2">
      <p className="text-sm text-[var(--text-muted)]">{t('Patient, service, time. Every person, machine, room and bed the service needs is checked for you.')}</p>
      {waitlistId ? <Badge tone="success">{t('Booking from the waitlist')}</Badge> : null}
    </div>
    {!writable ? <p className="rounded-[var(--radius)] p-2 text-sm cg-wash-info">{t('Your role can search availability but cannot book.')}</p> : null}
    <div className="grid gap-2.5 lg:grid-cols-[minmax(17rem,22rem)_1fr] 2xl:grid-cols-[minmax(17rem,21rem)_minmax(22rem,30rem)_1fr]">
      <div className="flex flex-col gap-2.5 2xl:contents">
        <div className="h-[22rem] lg:h-[calc((100vh-12rem)*0.42)] lg:min-h-[14rem] 2xl:h-[calc(100vh-11rem)]"><Step tour="cg-book-patient" n={1} title={t('Patient')} done={!!patient}><PatientStep patient={patient} setPatient={setPatient} meta={meta}/></Step></div>
        <div className="h-[30rem] lg:h-[calc((100vh-12rem)*0.58)] lg:min-h-[20rem] 2xl:h-[calc(100vh-11rem)]"><Step tour="cg-book-service" n={2} title={t('Service')} done={!!type}><ServiceStep type={type} setType={setType} meta={meta}/></Step></div>
      </div>
      <Step tour="cg-book-time" n={3} title={t('Time')} done={!!slot} aside={type ? <div className="flex items-center gap-2">
        <Segmented size="sm" label="Priority" value={priority} onChange={value => setPriority(value as 'routine' | 'urgent')} options={[{value: 'routine', label: 'Routine'}, {value: 'urgent', label: 'Urgent', icon: <Siren className="size-3"/>}]}/>
        <Chip pressed={repeat} onClick={() => setRepeat(value => !value)}><Repeat aria-hidden className="size-3.5"/>{t('Repeat')}</Chip>
      </div> : null}>
        {done ? <div className="flex flex-col items-center py-8 text-center" role="status" data-booking-done>
          <span className="grid size-14 place-items-center rounded-full cg-wash-success"><CalendarCheck aria-hidden className="size-7"/></span>
          {done.kind === 'one' ? <>
            <p className="mt-3 text-lg font-semibold">{t('Booked for {name}', {name: done.appointment.patient_name})}</p>
            <p className="text-[var(--text-muted)]">{done.appointment.type_name}, {f.niceDateTime(done.appointment.start_at, meta.today)}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t('Reference {ref}. {resources} resources reserved, {reminders} reminders scheduled by {channel}.', {ref: done.appointment.ref, resources: f.number(done.appointment.resources.length), reminders: f.number(done.appointment.reminders.length), channel: patient?.preferred_channel ?? 'SMS'})}</p>
          </> : <>
            <p className="mt-3 text-lg font-semibold">{t('{n} sessions booked', {n: f.number(done.booked.length)})}</p>
            <p className="text-sm text-[var(--text-muted)]">{t('Series {id}. {n} moved to the nearest free time.', {id: done.seriesId, n: f.number(done.booked.filter(b => b.shifted).length)})}</p>
            {done.skipped.length ? <p className="mt-2 max-w-md rounded-lg p-2 text-xs cg-wash-warning">{t('Skipped: {list}', {list: done.skipped.map(s => `${f.niceDate(s.date)} (${s.reason})`).join('; ')})}</p> : null}
            <ul className="mt-3 flex max-w-lg flex-wrap justify-center gap-1">{done.booked.map(b => <li key={b.id} className="cg-chip">{f.niceDate(b.start)} {f.time(b.start)}</li>)}</ul>
          </>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => {setType(null); setDone(null);}}>{t('Book another service for this patient')}</Button>
            <Button variant="outline" onClick={() => {setPatient(null); setType(null); setDone(null);}}>{t('New patient')}</Button>
            {done.kind === 'one' ? <Button variant="ghost" onClick={() => navigation.open(to('caregrid-schedule', {date: done.appointment.start_at.slice(0, 10)}))}>{t('View on schedule board')}</Button> : null}
          </div>
        </div> : !ready ? <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-2 text-center text-[var(--text-muted)]">
          <Clock aria-hidden className="size-8"/><p className="font-medium text-[var(--text)]">{t(!patient ? 'Start by choosing a patient' : 'Now choose a service')}</p>
          <p className="max-w-xs text-sm">{t('Free times appear here, already checked against working hours, leave, maintenance and every other booking.')}</p>
        </div> : repeat ? <div className="space-y-4" data-series-form>
          <p className="text-sm text-[var(--text-muted)]">{t('Book a whole course in one step. When the preferred time is taken on a day, CareGrid picks the nearest free time and keeps the same team where possible.')}</p>
          <div role="group" aria-label={t('Days')} className="flex flex-wrap gap-1">{WEEKDAYS.map(i => <Chip key={i} pressed={series.weekdays.includes(i)} onClick={() => setSeries(s => ({...s, weekdays: s.weekdays.includes(i) ? s.weekdays.filter(x => x !== i) : [...s.weekdays, i].sort()}))}>{f.wd(addDays('2026-10-04', i))}</Chip>)}</div>
          <div className="grid grid-cols-3 gap-2">
            <TimeInput label="Preferred time" value={series.time} onChange={e => setSeries({...series, time: e.target.value})}/>
            <Input label="Sessions" type="number" min={1} max={60} value={series.occurrences} onChange={e => setSeries({...series, occurrences: Math.min(60, Math.max(1, Number(e.target.value) || 1))})}/>
            <DateInput label="Starting" value={series.startDate} onChange={e => setSeries({...series, startDate: e.target.value})}/>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2 border-t border-[var(--border)] pt-3" data-tour="cg-book-confirm">
            <Input label="Note for the team (optional)" className="max-w-sm" value={notes} onChange={e => setNotes(e.target.value)}/>
            <Button disabled={busy || !series.weekdays.length || !writable} leftIcon={<ListChecks className="size-4"/>} onClick={bookSeries}>{t('Book {n} sessions', {n: f.number(series.occurrences)})}</Button>
          </div>
        </div> : <div className="flex h-full flex-col gap-3">
          <SlotPicker typeId={type.id} patientId={patient.id} priority={priority} startDate={params.get('date') ?? meta.today} selected={slot} onPick={setSlot} onData={setAvailability}/>
          <div className="mt-auto flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3" data-tour="cg-book-confirm">
            <Select label="Booking source" placeholder="" value={source} onChange={e => setSource(e.target.value)} options={[['desk', 'At the desk'], ['phone', 'By phone'], ['portal', 'Patient portal'], ['referral', 'Referral'], ['walkin', 'Walk-in']].map(([value, label]) => ({value: value!, label: label!}))}/>
            <Input label="Note for the team (optional)" className="min-w-[10rem] flex-1" value={notes} onChange={e => setNotes(e.target.value)}/>
            {availability ? <div className="relative"><Button variant="ghost" size="sm" aria-expanded={waitlistOpen} disabled={!writable} leftIcon={<Hourglass className="size-4"/>} onClick={() => setWaitlistOpen(value => !value)}>{t('Waitlist')}</Button>
              {waitlistOpen ? <WaitlistForm today={meta.today} busy={busy} onAdd={addWaitlist} onClose={() => setWaitlistOpen(false)}/> : null}</div> : null}
            <Button className="min-w-[9rem]" disabled={!slot || busy || !writable} leftIcon={<CalendarCheck className="size-4"/>} onClick={bookOne}>{slot ? t('Book {time}', {time: f.time(slot.start)}) : t('Pick a time')}</Button>
          </div>
        </div>}
      </Step>
    </div>
  </div>;
}
