'use client';
import React, {useState} from 'react';
import {Accessibility, AlertTriangle, CalendarPlus, Hourglass, Languages, Mail, MessageSquare, Phone, ShieldAlert} from '@pepbits/icons';
import {Avatar, Badge, Button, SearchInput, Skeleton} from '@pepbits/ui';
import {EmptyState, Tabs} from '@pepbits/components';
import {to} from '../../../navigation';
import {useCaregridQuery} from '../live';
import {useScreen, type ScreenProps} from '../context';
import {age} from '../time';
import {CatIcon, Panel, QueryError, StatusPill} from '../ui';
import {AppointmentDrawer} from '../booking/appointment-drawer';
import type {Meta, Patient} from '../types';

interface ProfileAppointment {id: number; ref: string; status: string; start_at: string; type_name: string; category_icon: string; dept_color: string; at_risk: number; series_id?: string | null}
interface PatientProfile extends Patient {appointments: ProfileAppointment[]; waitlist: {id: number; type_name: string; earliest: string; latest: string}[]}
/** Source split: open, not-yet-past visits are upcoming; everything else is history. */
export function splitVisits(appointments: readonly ProfileAppointment[], now: string) {
  const upcoming = appointments.filter(a => a.start_at >= now.slice(0, 10) && !['cancelled', 'completed', 'no_show'].includes(a.status)).reverse();
  return {upcoming, past: appointments.filter(a => !upcoming.includes(a))};
}

function Profile({id, meta}: {id: number; meta: Meta}) {
  const {f, t, navigation} = useScreen();
  const {data: p, error, reload} = useCaregridQuery<PatientProfile>(`/patients/${id}`);
  const [tab, setTab] = useState('upcoming'), [open, setOpen] = useState<number | null>(null);
  if (error && !p) return <QueryError error={error} onRetry={reload}/>;
  if (!p) return <Skeleton className="h-96"/>;
  const {upcoming, past} = splitVisits(p.appointments, meta.now), list = tab === 'upcoming' ? upcoming : past;
  const completed = p.appointments.filter(a => a.status === 'completed').length, missed = p.appointments.filter(a => a.status === 'no_show').length;
  return <div className="space-y-2.5" data-patient-profile={p.id} data-tour="cg-patient-profile">
    <section className="cg-panel p-4" aria-label={p.full_name}>
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={p.full_name} size="lg" decorative/>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{p.full_name}</h2>
          <p className="text-sm text-[var(--text-muted)]">{[p.mrn, p.gender, p.dob ? t('{n} years (born {date})', {n: f.number(Number(age(p.dob, meta.today))), date: f.date(p.dob)}) : ''].filter(Boolean).join(', ')}</p>
          <p className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            {p.phone ? <span className="flex items-center gap-1"><Phone aria-hidden className="size-3.5"/>{p.phone}</span> : null}
            {p.email ? <span className="flex items-center gap-1"><Mail aria-hidden className="size-3.5"/>{p.email}</span> : null}
            <span className="flex items-center gap-1"><MessageSquare aria-hidden className="size-3.5"/>{t('Prefers {channel}', {channel: p.preferred_channel ?? ''})}</span><span>{p.payer}</span>
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={p.interpreter_needed ? 'warning' : 'neutral'}><Languages aria-hidden className="me-1 inline size-3.5"/>{p.language}{p.interpreter_needed ? `, ${t('interpreter needed')}` : ''}</Badge>
            <Badge tone={p.mobility !== 'Independent' ? 'warning' : 'neutral'}><Accessibility aria-hidden className="me-1 inline size-3.5"/>{p.mobility}</Badge>
            {p.allergies ? <Badge tone="danger"><AlertTriangle aria-hidden className="me-1 inline size-3.5"/>{t('Allergy: {name}', {name: p.allergies})}</Badge> : null}
          </p>
        </div>
        <span data-tour="cg-patient-book"><Button leftIcon={<CalendarPlus className="size-4"/>} onClick={() => navigation.open(to('caregrid-book', {patient: p.id}))}>{t('Book for {name}', {name: p.full_name.split(' ')[0]!})}</Button></span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">{[['Upcoming', upcoming.length], ['Completed', completed], ['Missed', missed]].map(([label, value]) => <div key={label as string} className="rounded-[var(--radius)] bg-[var(--surface-2)] p-2.5"><dt className="text-xs text-[var(--text-muted)]">{t(label as string)}</dt><dd className="text-lg font-semibold tabular-nums" style={label === 'Missed' && missed ? {color: 'var(--danger-ink)'} : undefined}>{f.number(value as number)}</dd></div>)}</dl>
    </section>
    {p.waitlist.length ? <Panel title={<span className="flex items-center gap-2"><Hourglass aria-hidden className="size-4"/>{t('On the waitlist')}</span>}>
      <ul>{p.waitlist.map(w => <li key={w.id} className="text-sm text-[var(--text-muted)]">{t('{service}, {from} to {until}', {service: w.type_name, from: f.niceDate(w.earliest), until: f.niceDate(w.latest)})}</li>)}</ul>
    </Panel> : null}
    <Panel aside={<Tabs variant="segmented" value={tab} onChange={setTab} items={[{id: 'upcoming', label: 'Upcoming', badge: f.number(upcoming.length)}, {id: 'past', label: 'History', badge: f.number(past.length)}]}/>} bodyClassName="px-2 pb-3">
      <div role="tabpanel" className="max-h-[calc(100vh-30rem)] min-h-[12rem] overflow-y-auto" data-visits={tab}><ul>{list.map(a => <li key={a.id}><button type="button" onClick={() => setOpen(a.id)} className="grid w-full grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-[var(--surface-2)]">
        <CatIcon name={a.category_icon} color={a.dept_color}/>
        <span className="min-w-0"><span className="block truncate text-sm">{a.type_name}</span><span className="block text-[0.72rem] text-[var(--text-muted)]">{a.ref}{a.series_id ? `, ${t('part of a course')}` : ''}</span></span>
        <span className="text-end text-xs tabular-nums text-[var(--text-muted)]">{f.niceDate(a.start_at, meta.today)}<br/>{f.time(a.start_at)}</span>
        <span className="flex items-center gap-1">{a.at_risk ? <ShieldAlert aria-label={t('At risk')} className="size-3.5" style={{color: 'var(--warning)'}}/> : null}<StatusPill status={a.status}/></span>
      </button></li>)}</ul></div>
      {!list.length ? <EmptyState title={tab === 'upcoming' ? 'Nothing booked' : 'No history yet'} description={tab === 'upcoming' ? 'Book from this profile when the patient needs a visit.' : 'Completed and missed visits appear here.'}/> : null}
    </Panel>
    <AppointmentDrawer id={open} onClose={() => setOpen(null)}/>
  </div>;
}

export function PatientsPage({meta, params}: ScreenProps) {
  const {f, t, navigation} = useScreen();
  const [q, setQ] = useState('');
  const {data, error, reload} = useCaregridQuery<Patient[]>(`/patients?q=${encodeURIComponent(q)}`, {live: false});
  const id = params.get('id') ? Number(params.get('id')) : data?.[0]?.id ?? null;
  return <div className="grid gap-2.5 lg:grid-cols-[19rem_1fr] 2xl:grid-cols-[22rem_1fr]" data-patients-page>
    <section className="cg-panel flex max-h-[calc(100vh-8rem)] flex-col" aria-label={t('Patient list')}>
      <div className="space-y-2 p-3" data-tour="cg-patient-search">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold">{t('Patients')}</p><Badge tone="warning">{t('Demo records')}</Badge></div>
        <SearchInput aria-label="Name, MRN or phone" placeholder="Name, MRN or phone" value={q} onChange={setQ}/>
      </div>
      <QueryError error={error} onRetry={reload}/>
      <ul className="flex-1 overflow-y-auto border-t border-[var(--border)] px-1.5 py-1.5">
        {!data && !error ? <li className="space-y-1.5 p-1.5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11"/>)}</li> : null}
        {data?.map(p => <li key={p.id}><button type="button" aria-current={id === p.id ? 'true' : undefined} onClick={() => navigation.open(to('caregrid-patients', {id: p.id}))} data-patient-option={p.id} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start ${id === p.id ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-2)]'}`}>
          <Avatar name={p.full_name} size="sm" decorative/>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm">{p.full_name}</span><span className="block truncate text-[0.7rem] text-[var(--text-muted)]">{p.mrn}{p.next_at ? `, ${t('next {when}', {when: f.niceDateTime(p.next_at)})}` : ''}</span></span>
          {p.upcoming ? <Badge tone="success">{f.number(p.upcoming)}</Badge> : null}
        </button></li>)}
      </ul>
      {data && !data.length ? <EmptyState title="No patient matches" description="Try a name, MRN or phone number."/> : null}
    </section>
    {id ? <Profile key={id} id={id} meta={meta}/> : <Skeleton className="h-96"/>}
  </div>;
}
