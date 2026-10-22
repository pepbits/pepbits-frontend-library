'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Accessibility, AlertTriangle, CalendarPlus, Hourglass, Languages, LogIn, MessageSquare, Play, Search, ShieldAlert, Square, Trash2, UserX } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { addDays, niceDate, niceDateTime, nowLocal, time, toMin } from '@/lib/time';
import { CatIcon, Empty, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { AppointmentDrawer } from '@/components/booking/AppointmentDrawer';

const COLS = [
  { key: 'expected', title: 'Expected', statuses: ['booked', 'confirmed'], tone: 'border-t-ink-300' },
  { key: 'arrived', title: 'Arrived, waiting', statuses: ['checked_in'], tone: 'border-t-marigold-500' },
  { key: 'session', title: 'In session', statuses: ['in_progress'], tone: 'border-t-[#3D7BD9]' },
  { key: 'done', title: 'Finished', statuses: ['completed', 'no_show', 'cancelled'], tone: 'border-t-teal-500' },
];

function FlowCard({ a, now, onOpen, onAct }: { a: any; now: string; onOpen: () => void; onAct: (action: string) => void }) {
  const late = ['booked', 'confirmed'].includes(a.status) && toMin(now) - toMin(a.start_at) > 10;
  const waited = a.status === 'checked_in' && a.checked_in_at ? toMin(now) - toMin(a.checked_in_at) : null;
  const elapsed = a.status === 'in_progress' && a.actual_start ? toMin(now) - toMin(a.actual_start) : null;
  const over = elapsed !== null && elapsed > a.duration_min;
  return (
    <div className={clsx('group rounded-xl border bg-white p-2.5 shadow-sm transition hover:shadow-lift', a.at_risk ? 'border-marigold-400' : 'border-line')}>
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start gap-2">
          <div className="w-11 shrink-0">
            <div className="text-sm font-semibold text-ink tabnum">{time(a.start_at)}</div>
            {late && <div className="text-[0.65rem] font-semibold text-crimson-600">Late</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{a.patient_name}</div>
            <div className="flex items-center gap-1 truncate text-[0.72rem] text-muted"><CatIcon name={a.category_icon} className="h-3 w-3 shrink-0" style={{ color: a.dept_color }} /><span className="truncate">{a.type_name}</span></div>
            {a.primary_resource && <div className="truncate text-[0.68rem] text-muted">{a.primary_resource}</div>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {a.priority === 'urgent' && <span className="rounded bg-crimson-50 px-1 text-[0.62rem] font-bold text-crimson-700">Urgent</span>}
            {a.at_risk ? <ShieldAlert className="h-3.5 w-3.5 text-marigold-600" /> : null}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {a.interpreter_needed ? <span title="Interpreter needed"><Languages className="h-3.5 w-3.5 text-ink-400" /></span> : null}
          {a.mobility && a.mobility !== 'Independent' ? <span title={a.mobility}><Accessibility className="h-3.5 w-3.5 text-ink-400" /></span> : null}
          {a.allergies ? <span title={`Allergy: ${a.allergies}`}><AlertTriangle className="h-3.5 w-3.5 text-crimson-500" /></span> : null}
          {waited !== null && <span className={clsx('ml-auto rounded px-1.5 text-[0.68rem] font-semibold tabnum', waited > 20 ? 'bg-crimson-50 text-crimson-700' : 'bg-marigold-50 text-marigold-700')}>Waiting {waited} min</span>}
          {elapsed !== null && <span className={clsx('ml-auto rounded px-1.5 text-[0.68rem] font-semibold tabnum', over ? 'bg-crimson-50 text-crimson-700' : 'bg-[#E8EEFB] text-[#2C5FB0]')}>{elapsed} of {a.duration_min} min</span>}
          {['completed', 'no_show', 'cancelled'].includes(a.status) && <span className="ml-auto"><StatusPill status={a.status} /></span>}
        </div>
      </button>
      {['booked', 'confirmed', 'checked_in', 'in_progress'].includes(a.status) && (
        <div className="mt-2 flex gap-1.5">
          {['booked', 'confirmed'].includes(a.status) && <>
            <button className="btn-primary btn-xs flex-1" onClick={() => onAct('check_in')}><LogIn className="h-3.5 w-3.5" /> Check in</button>
            <button className="btn-ghost btn-xs" onClick={() => onAct('no_show')} title="Mark as no-show"><UserX className="h-3.5 w-3.5" /></button>
          </>}
          {a.status === 'checked_in' && <button className="btn-primary btn-xs flex-1" onClick={() => onAct('start')}><Play className="h-3.5 w-3.5" /> Start session</button>}
          {a.status === 'in_progress' && <button className="btn-ink btn-xs flex-1" onClick={() => onAct('complete')}><Square className="h-3.5 w-3.5" /> Complete</button>}
        </div>
      )}
    </div>
  );
}

function Flow() {
  const { meta, toast } = useLive();
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [now, setNow] = useState(nowLocal());
  useEffect(() => { const i = setInterval(() => setNow(nowLocal()), 20000); return () => clearInterval(i); }, []);
  const date = meta?.today;
  const { data, error, reload, setData } = useApi<any[]>(date ? '/appointments' + qs({ date, department: dept, q }) : null);
  const act = async (a: any, action: string) => {
    try {
      const x = await api(`/appointments/${a.id}/status`, { body: { action } });
      setData(d => d?.map(y => (y.id === a.id ? { ...y, status: x.status, checked_in_at: x.checked_in_at, actual_start: x.actual_start, actual_end: x.actual_end } : y)) ?? null);
      const label: Record<string, string> = { check_in: 'Checked in', start: 'Session started', complete: 'Completed', no_show: 'Marked as no-show' };
      toast({ level: action === 'no_show' ? 'info' : 'success', title: label[action], body: `${a.patient_name}, ${a.type_name}` });
    } catch (e: any) { toast({ level: 'warning', title: 'Not changed', body: e.message }); }
  };
  const cols = useMemo(() => COLS.map(c => ({ ...c, items: (data ?? []).filter(a => c.statuses.includes(a.status)) })), [data]);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-auto" value={dept} onChange={e => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {meta?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="relative"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="field w-56 pl-8" placeholder="Patient, MRN or reference" value={q} onChange={e => setQ(e.target.value)} /></div>
        <span className="text-sm text-muted">{data ? `${data.length} appointments today` : ''}</span>
        <button className={clsx('chip ml-auto', showDone && 'chip-on')} onClick={() => setShowDone(s => !s)}>Show finished</button>
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className={clsx('grid gap-2.5 md:grid-cols-2', showDone ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
        {cols.filter(c => showDone || c.key !== 'done').map(c => (
          <section key={c.key} className={clsx('flex flex-col rounded-xl border border-t-4 border-line bg-canvas/70', c.tone)}>
            <div className="flex items-center justify-between px-3 py-2">
              <h2 className="text-sm font-semibold text-ink">{c.title}</h2>
              <span className="rounded-full bg-white px-2 text-xs font-semibold text-ink tabnum">{c.items.length}</span>
            </div>
            <div className="max-h-[calc(100vh-14rem)] min-h-[10rem] space-y-1.5 overflow-y-auto px-2 pb-2">
              {!data && [0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}
              {c.items.map(a => <FlowCard key={a.id} a={a} now={now} onOpen={() => setOpen(a.id)} onAct={action => act(a, action)} />)}
              {data && !c.items.length && <div className="py-8 text-center text-xs text-muted">{c.key === 'arrived' ? 'Nobody is waiting.' : c.key === 'session' ? 'No sessions running.' : 'Nothing here.'}</div>}
            </div>
          </section>
        ))}
      </div>
      <AppointmentDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Waitlist() {
  const { meta } = useLive();
  const { data, reload } = useApi<any[]>('/waitlist');
  const remove = async (id: number) => { await api(`/waitlist/${id}`, { method: 'PATCH', body: { status: 'removed' } }); reload(); };
  if (!data) return <Skeleton className="h-60" />;
  if (!data.length) return <div className="panel"><Empty icon={<Hourglass className="h-5 w-5" />} title="The waitlist is empty">Add patients from the booking page when no time fits. They are offered freed slots automatically.</Empty></div>;
  return (
    <div className="panel divide-y divide-line">
      {data.map(w => (
        <div key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <CatIcon name={w.category_icon} className="h-4 w-4 text-teal-600" />
          <div className="min-w-[12rem] flex-1">
            <div className="text-sm font-medium text-ink">{w.patient_name} <span className="text-muted">{w.mrn}</span></div>
            <div className="text-xs text-muted">{w.type_name}, between {niceDate(w.earliest, meta?.today)} and {niceDate(w.latest, meta?.today)}{w.notes ? `. ${w.notes}` : ''}</div>
          </div>
          {w.priority === 'urgent' && <span className="rounded-full bg-crimson-50 px-2 py-0.5 text-[0.7rem] font-semibold text-crimson-700">Urgent</span>}
          {w.status === 'offered' && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.7rem] font-semibold text-teal-700">Slot offered</span>}
          <Link className="btn-primary btn-sm" href={`/book?patient=${w.patient_id}&type=${w.type_id}&date=${w.earliest < (meta?.today ?? '') ? meta?.today : w.earliest}&waitlist=${w.id}`}><CalendarPlus className="h-4 w-4" /> Find a slot</Link>
          <button className="btn-ghost btn-sm" onClick={() => remove(w.id)} aria-label="Remove from waitlist"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

function Reminders() {
  const { meta } = useLive();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const date = meta ? (day === 'today' ? meta.today : addDays(meta.today, 1)) : null;
  const { data } = useApi<any[]>(date ? `/reminders?date=${date}` : null);
  return (
    <div className="panel">
      <div className="panel-head"><h2 className="panel-title">Patient reminder outbox</h2><div className="seg"><button data-on={day === 'today'} onClick={() => setDay('today')}>Sending today</button><button data-on={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>Tomorrow</button></div></div>
      <div className="max-h-[calc(100vh-15rem)] divide-y divide-line overflow-y-auto">
        {data?.map(r => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{r.patient_name} <span className="font-normal text-muted">by {r.channel}, {niceDateTime(r.send_at, meta?.today)}</span></div>
              <div className="text-xs text-muted">{r.message}</div>
            </div>
            <span className={clsx('rounded px-1.5 py-0.5 text-[0.65rem] font-semibold', r.status === 'scheduled' ? 'bg-teal-50 text-teal-700' : r.status === 'sent' ? 'bg-ink-100 text-ink-600' : 'bg-crimson-50 text-crimson-700')}>{r.status}</span>
          </div>
        ))}
        {data && !data.length && <Empty title="No reminders for this day" />}
      </div>
    </div>
  );
}

function FrontDeskInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get('tab') ?? 'flow';
  const { data: wl } = useApi<any[]>('/waitlist');
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-ink">Front desk</h1>
        <div className="seg">
          <button data-on={tab === 'flow'} onClick={() => router.replace('/frontdesk')}>Patient flow</button>
          <button data-on={tab === 'waitlist'} onClick={() => router.replace('/frontdesk?tab=waitlist')}>Waitlist{wl?.length ? ` (${wl.length})` : ''}</button>
          <button data-on={tab === 'reminders'} onClick={() => router.replace('/frontdesk?tab=reminders')}>Reminders</button>
        </div>
        <Link href="/book" className="btn-primary ml-auto"><CalendarPlus className="h-4 w-4" /> Book</Link>
      </div>
      {tab === 'flow' && <Flow />}
      {tab === 'waitlist' && <Waitlist />}
      {tab === 'reminders' && <Reminders />}
    </div>
  );
}

export default function FrontDeskPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><FrontDeskInner /></Suspense>;
}
