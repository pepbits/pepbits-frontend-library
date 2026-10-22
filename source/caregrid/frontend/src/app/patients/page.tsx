'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Accessibility, AlertTriangle, CalendarPlus, Hourglass, Languages, Mail, MessageSquare, Phone, Search, ShieldAlert } from 'lucide-react';
import { useApi, useLive } from '@/lib/live';
import { age, niceDate, niceDateTime, time } from '@/lib/time';
import { Avatar, CatIcon, Empty, Skeleton, StatusPill } from '@/components/ui/primitives';
import { AppointmentDrawer } from '@/components/booking/AppointmentDrawer';

function Profile({ id }: { id: number }) {
  const { meta } = useLive();
  const { data: p } = useApi<any>(`/patients/${id}`);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [open, setOpen] = useState<number | null>(null);
  if (!p) return <Skeleton className="h-96" />;
  const now = meta?.now ?? '';
  const upcoming = p.appointments.filter((a: any) => a.start_at >= now.slice(0, 10) && !['cancelled', 'completed', 'no_show'].includes(a.status)).reverse();
  const past = p.appointments.filter((a: any) => !upcoming.includes(a));
  const list = tab === 'upcoming' ? upcoming : past;
  const completed = p.appointments.filter((a: any) => a.status === 'completed').length;
  const noShow = p.appointments.filter((a: any) => a.status === 'no_show').length;
  return (
    <div className="space-y-2.5">
      <section className="panel p-4">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={p.full_name} className="h-14 w-14 text-lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-ink">{p.full_name}</h2>
            <div className="text-sm text-muted">{p.mrn}, {p.gender}, {age(p.dob)} years (born {p.dob})</div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              {p.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{p.phone}</span>}
              {p.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{p.email}</span>}
              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />Prefers {p.preferred_channel}</span>
              <span>{p.payer}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs', p.interpreter_needed ? 'bg-marigold-50 text-marigold-700' : 'bg-canvas text-muted')}><Languages className="h-3.5 w-3.5" />{p.language}{p.interpreter_needed ? ', interpreter needed' : ''}</span>
              <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs', p.mobility !== 'Independent' ? 'bg-marigold-50 text-marigold-700' : 'bg-canvas text-muted')}><Accessibility className="h-3.5 w-3.5" />{p.mobility}</span>
              {p.allergies && <span className="inline-flex items-center gap-1 rounded-md bg-crimson-50 px-2 py-0.5 text-xs text-crimson-700"><AlertTriangle className="h-3.5 w-3.5" />Allergy: {p.allergies}</span>}
            </div>
          </div>
          <Link href={`/book?patient=${p.id}`} className="btn-primary"><CalendarPlus className="h-4 w-4" /> Book for {p.full_name.split(' ')[0]}</Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-canvas p-2.5"><div className="text-xs text-muted">Upcoming</div><div className="text-lg font-semibold text-ink tabnum">{upcoming.length}</div></div>
          <div className="rounded-xl bg-canvas p-2.5"><div className="text-xs text-muted">Completed</div><div className="text-lg font-semibold text-ink tabnum">{completed}</div></div>
          <div className="rounded-xl bg-canvas p-2.5"><div className="text-xs text-muted">Missed</div><div className={clsx('text-lg font-semibold tabnum', noShow ? 'text-crimson-600' : 'text-ink')}>{noShow}</div></div>
        </div>
      </section>
      {p.waitlist.length > 0 && (
        <section className="panel p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Hourglass className="h-4 w-4 text-teal-600" /> On the waitlist</div>
          {p.waitlist.map((w: any) => <div key={w.id} className="text-sm text-muted">{w.type_name}, {niceDate(w.earliest)} to {niceDate(w.latest)}</div>)}
        </section>
      )}
      <section className="panel">
        <div className="panel-head"><div className="seg"><button data-on={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</button><button data-on={tab === 'past'} onClick={() => setTab('past')}>History ({past.length})</button></div></div>
        <div className="max-h-[calc(100vh-27rem)] min-h-[12rem] overflow-y-auto px-2 pb-3">
          {list.map((a: any) => (
            <button key={a.id} onClick={() => setOpen(a.id)} className="grid w-full grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-canvas">
              <CatIcon name={a.category_icon} className="h-4 w-4" style={{ color: a.dept_color }} />
              <span className="min-w-0"><span className="block truncate text-sm text-ink">{a.type_name}</span><span className="block text-[0.72rem] text-muted">{a.ref}{a.series_id ? ', part of a course' : ''}</span></span>
              <span className="text-right text-xs text-muted tabnum">{niceDate(a.start_at, meta?.today)}<br />{time(a.start_at)}</span>
              <span className="flex items-center gap-1">{a.at_risk ? <ShieldAlert className="h-3.5 w-3.5 text-marigold-600" /> : null}<StatusPill status={a.status} /></span>
            </button>
          ))}
          {!list.length && <Empty title={tab === 'upcoming' ? 'Nothing booked' : 'No history yet'} action={tab === 'upcoming' ? <Link href={`/book?patient=${p.id}`} className="btn-primary btn-sm">Book now</Link> : undefined} />}
        </div>
      </section>
      <AppointmentDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function PatientsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data } = useApi<any[]>(`/patients?q=${encodeURIComponent(q)}`, { live: false });
  const id = sp.get('id') ? Number(sp.get('id')) : null;
  useEffect(() => { if (!id && data?.length) router.replace(`/patients?id=${data[0].id}`); }, [id, data, router]);
  return (
    <div className="grid gap-2.5 lg:grid-cols-[19rem_1fr] 2xl:grid-cols-[22rem_1fr]">
      <section className="panel flex max-h-[calc(100vh-6.5rem)] flex-col">
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between"><h1 className="text-lg font-semibold text-ink">Patients</h1><span className="rounded bg-marigold-50 px-2 py-0.5 text-[0.68rem] font-medium text-marigold-700">Demo records</span></div>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="field pl-9" placeholder="Name, MRN or phone" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <div className="flex-1 overflow-y-auto border-t border-line px-1.5 py-1.5">
          {!data && <div className="space-y-1.5 p-1.5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11" />)}</div>}
          {data?.map(p => (
            <Link key={p.id} href={`/patients?id=${p.id}`} className={clsx('flex items-center gap-2.5 rounded-lg px-2 py-1.5', id === p.id ? 'bg-teal-50' : 'hover:bg-canvas')}>
              <Avatar name={p.full_name} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm text-ink">{p.full_name}</div><div className="truncate text-[0.7rem] text-muted">{p.mrn}{p.next_at ? `, next ${niceDateTime(p.next_at)}` : ''}</div></div>
              {p.upcoming > 0 && <span className="rounded-full bg-teal-50 px-1.5 text-[0.68rem] font-semibold text-teal-700">{p.upcoming}</span>}
            </Link>
          ))}
        </div>
      </section>
      {id ? <Profile id={id} /> : <Skeleton className="h-96" />}
    </div>
  );
}

export default function PatientsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><PatientsInner /></Suspense>;
}
