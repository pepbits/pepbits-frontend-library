'use client';
import clsx from 'clsx';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRightLeft, CalendarOff, CheckCircle2, ChevronDown, Plus, ShieldAlert, Trash2, Wand2, Wrench, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { EXCEPTION_LABEL } from '@/lib/meta';
import { addDays, niceDate, niceDateTime, time } from '@/lib/time';
import { CatIcon, Empty, KindIcon, Skeleton, Spinner } from '@/components/ui/primitives';
import { ResourcePicker } from '@/components/ui/ResourcePicker';
import { AppointmentDrawer } from '@/components/booking/AppointmentDrawer';

function QueueItem({ q, today, onOpen }: { q: any; today: string; onOpen: () => void }) {
  const { toast } = useLive();
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && !sug) api(`/queue/${q.id}/suggestions`).then(setSug).catch(e => setSug({ error: e.message })); }, [open, sug, q.id]);
  const move = async (s: any) => {
    setBusy(true);
    try { await api(`/appointments/${q.appointment_id}/reschedule`, { body: { start: s.start, assignments: s.assignments } }); }
    catch (e: any) { toast({ level: 'warning', title: 'Could not move', body: e.message }); setSug(null); }
    finally { setBusy(false); }
  };
  const dismiss = async () => { await api(`/queue/${q.id}/dismiss`, { body: {} }); toast({ level: 'info', title: 'Kept at the original time', body: `${q.patient_name}. The team will handle it manually.` }); };
  return (
    <div className={clsx('rounded-xl border bg-white transition', open ? 'border-teal-200 shadow-lift' : 'border-line')}>
      <div className="flex items-center gap-3 p-3">
        <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', q.planned ? 'bg-marigold-50 text-marigold-600' : 'bg-crimson-50 text-crimson-600')}>
          <CatIcon name={q.category_icon} className="h-4 w-4" />
        </div>
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex items-center gap-2 truncate text-sm font-medium text-ink">{q.patient_name}{q.priority === 'urgent' && <span className="rounded bg-crimson-50 px-1 text-[0.62rem] font-bold text-crimson-700">Urgent</span>}</div>
          <div className="truncate text-xs text-muted">{q.type_name}, {niceDateTime(q.start_at, today)}</div>
          <div className="truncate text-[0.72rem] text-marigold-700">{q.reason}</div>
        </button>
        <button className="btn-outline btn-sm" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'New times'}<ChevronDown className={clsx('h-3.5 w-3.5 transition', open && 'rotate-180')} /></button>
      </div>
      {open && (
        <div className="border-t border-line px-3 pb-3 pt-2.5">
          {!sug && <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Finding the closest free times</div>}
          {sug?.error && <div className="text-sm text-crimson-600">{sug.error}</div>}
          {sug?.suggestions && (
            sug.suggestions.length ? (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {sug.suggestions.map((s: any) => (
                  <button key={s.start} disabled={busy} onClick={() => move(s)} className="group flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left hover:border-teal-500 hover:bg-teal-50/50">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-ink">{niceDate(s.start, today)}, {time(s.start)}</div>
                      <div className="text-[0.7rem] text-muted">{s.kept ? `Keeps ${s.kept} of ${sug.keepCount} people and resources` : 'Different team'}{s.distance_min < 1440 ? ', same day' : ''}</div>
                    </div>
                    <span className="text-xs font-medium text-teal-700 opacity-0 transition group-hover:opacity-100">Move here</span>
                  </button>
                ))}
              </div>
            ) : <div className="text-sm text-muted">No free time in the next 14 days. {sug.blockers?.[0] && `Limited by ${sug.blockers[0].label}.`}</div>
          )}
          <div className="mt-2 flex justify-end"><button className="btn-ghost btn-xs" onClick={dismiss}>Keep original time</button></div>
        </div>
      )}
    </div>
  );
}

function AddBlock({ preset }: { preset: number | null }) {
  const { meta, toast } = useLive();
  const today = meta?.today ?? '';
  const [resourceId, setResourceId] = useState<number | null>(preset);
  const [type, setType] = useState('leave');
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [t1, setT1] = useState('09:00'); const [t2, setT2] = useState('13:00');
  const [repeat, setRepeat] = useState<number | null>(null);
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (today && !from) { setFrom(today); setTo(today); setUntil(addDays(today, 90)); } }, [today, from]);
  useEffect(() => { if (preset) setResourceId(preset); }, [preset]);
  const body = resourceId && from && to ? {
    resource_id: resourceId, type, start_at: `${from}T${allDay ? '00:00' : t1}`, end_at: allDay ? `${addDays(to, 1)}T00:00` : `${to}T${t2}`,
    recur_weeks: repeat, recur_until: repeat ? until : null, reason: reason || undefined,
  } : null;
  const key = JSON.stringify(body);
  useEffect(() => {
    if (!body) { setImpact(null); return; }
    const t = setTimeout(() => api('/exceptions/preview', { body }).then(r => setImpact(r.impacted)).catch(() => setImpact(null)), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = async () => {
    if (!body) return; setBusy(true);
    try { await api('/exceptions', { body }); setReason(''); setImpact(null); }
    catch (e: any) { toast({ level: 'warning', title: 'Block not saved', body: e.message }); }
    finally { setBusy(false); }
  };
  const TYPES = meta?.exceptionTypes ?? Object.keys(EXCEPTION_LABEL);
  return (
    <section className="panel">
      <div className="panel-head"><h2 className="panel-title">Block a resource</h2><span className="text-xs text-muted">Leave, maintenance, breakdowns</span></div>
      <div className="space-y-3 px-4 pb-4">
        <div><label className="label">Resource</label><ResourcePicker value={resourceId} onChange={id => setResourceId(id)} /></div>
        <div>
          <label className="label">Reason</label>
          <div className="flex flex-wrap gap-1">{TYPES.map(t => <button key={t} className={clsx('chip', type === t && 'chip-on')} onClick={() => setType(t)}>{EXCEPTION_LABEL[t]}</button>)}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="seg"><button data-on={allDay} onClick={() => setAllDay(true)}>Whole days</button><button data-on={!allDay} onClick={() => setAllDay(false)}>Part of a day</button></div>
          <div className="seg"><button data-on={!repeat} onClick={() => setRepeat(null)}>Once</button><button data-on={repeat === 1} onClick={() => setRepeat(1)}>Weekly</button><button data-on={repeat === 2} onClick={() => setRepeat(2)}>Fortnightly</button><button data-on={repeat === 4} onClick={() => setRepeat(4)}>Every 4 weeks</button></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">From</label><div className="flex gap-1"><input type="date" className="field" value={from} onChange={e => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} />{!allDay && <input type="time" className="field w-28" value={t1} onChange={e => setT1(e.target.value)} />}</div></div>
          <div><label className="label">Until</label><div className="flex gap-1"><input type="date" className="field" value={to} min={from} onChange={e => setTo(e.target.value)} />{!allDay && <input type="time" className="field w-28" value={t2} onChange={e => setT2(e.target.value)} />}</div></div>
        </div>
        {repeat && <div className="grid grid-cols-2 gap-2"><div><label className="label">Repeat until</label><input type="date" className="field" value={until} onChange={e => setUntil(e.target.value)} /></div></div>}
        <div><label className="label">Note (optional)</label><input className="field" placeholder="For example: engineer visit, annual leave" value={reason} onChange={e => setReason(e.target.value)} /></div>

        <div className={clsx('rounded-xl p-3 text-sm', !impact ? 'bg-canvas text-muted' : impact.length ? 'bg-marigold-50 text-marigold-700' : 'bg-teal-50 text-teal-700')}>
          {!impact ? 'Choose a resource and dates to see who would be affected.' : impact.length ? (
            <>
              <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> {impact.length} booked appointment{impact.length > 1 ? 's' : ''} would need a new time</div>
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                {impact.map(a => <div key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.patient_name}, {a.type_name}</span><span className="shrink-0 tabnum">{niceDateTime(a.start_at, today)}</span></div>)}
              </div>
            </>
          ) : <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> No booked appointments are affected</div>}
        </div>
        <button className="btn-primary w-full" disabled={!body || busy} onClick={save}>
          <CalendarOff className="h-4 w-4" />{impact?.length ? `Block and queue ${impact.length} for rescheduling` : 'Save block'}
        </button>
      </div>
    </section>
  );
}

function Upcoming() {
  const { meta, toast } = useLive();
  const { data } = useApi<any[]>('/exceptions');
  const { data: hol } = useApi<any[]>('/holidays');
  const [hd, setHd] = useState(''); const [hn, setHn] = useState('');
  const remove = async (id: number) => { try { await api(`/exceptions/${id}`, { method: 'DELETE' }); } catch (e: any) { toast({ level: 'warning', title: 'Not removed', body: e.message }); } };
  return (
    <div className="grid gap-2.5 2xl:grid-cols-[1fr_22rem]">
      <section className="panel">
        <div className="panel-head"><h2 className="panel-title">Upcoming and repeating blocks</h2><span className="text-xs text-muted">{data?.length ?? 0} active</span></div>
        <div className="max-h-[22rem] divide-y divide-line overflow-y-auto">
          {!data && <div className="p-4"><Skeleton className="h-32" /></div>}
          {data?.map(x => (
            <div key={x.id} className="flex items-center gap-3 px-4 py-2.5">
              <KindIcon kind={x.kind} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{x.resource_name} <span className="font-normal text-muted">{x.role_label}</span></div>
                <div className="truncate text-xs text-muted">{EXCEPTION_LABEL[x.type]}{x.reason ? `: ${x.reason}` : ''}. {niceDateTime(x.start_at, meta?.today)} to {niceDateTime(x.end_at, meta?.today)}{x.recur_weeks ? `, repeats every ${x.recur_weeks === 1 ? 'week' : `${x.recur_weeks} weeks`}` : ''}</div>
              </div>
              <span className={clsx('rounded px-1.5 py-0.5 text-[0.65rem] font-semibold', x.planned ? 'bg-ink-100 text-ink-600' : 'bg-crimson-50 text-crimson-700')}>{x.planned ? 'Planned' : 'Unplanned'}</span>
              <span className="hidden text-[0.68rem] text-muted md:inline">from {x.source.replace('_', ' ')}</span>
              {x.pending > 0 && <span className="rounded-full bg-marigold-50 px-2 text-[0.68rem] font-semibold text-marigold-700">{x.pending} to move</span>}
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => remove(x.id)} aria-label="Remove block" title="Remove block"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {data && !data.length && <Empty title="No blocks planned" icon={<Wrench className="h-5 w-5" />} />}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2 className="panel-title">Facility holidays</h2></div>
        <div className="space-y-2 px-4 pb-4">
          {hol?.map(h => (
            <div key={h.id} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
              <span className="flex-1"><b className="text-ink">{niceDate(h.date, meta?.today)}</b> <span className="text-muted">{h.name}</span></span>
              <button onClick={() => api(`/holidays/${h.id}`, { method: 'DELETE' })} aria-label="Remove holiday"><X className="h-4 w-4 text-muted" /></button>
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <input type="date" className="field w-36" value={hd} onChange={e => setHd(e.target.value)} />
            <input className="field" placeholder="Holiday name" value={hn} onChange={e => setHn(e.target.value)} />
            <button className="btn-outline px-2.5" disabled={!hd || hn.length < 2} onClick={async () => { await api('/holidays', { body: { date: hd, name: hn } }); setHd(''); setHn(''); }} aria-label="Add holiday"><Plus className="h-4 w-4" /></button>
          </div>
          <p className="text-[0.72rem] text-muted">Elective services close; 24x7 resources such as wards, emergency and CT keep running.</p>
        </div>
      </section>
    </div>
  );
}

function ExceptionsInner() {
  const sp = useSearchParams();
  const { meta, toast } = useLive();
  const { data: queue } = useApi<any[]>('/queue');
  const [open, setOpen] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const fixAll = async () => {
    setAuto(true);
    try { const r = await api('/queue/auto', { body: {} }); if (r.failed.length) toast({ level: 'warning', title: `${r.failed.length} need your decision`, body: r.failed.map((f: any) => `${f.patient}: ${f.reason}`).join('; ') }); }
    finally { setAuto(false); }
  };
  return (
    <div className="space-y-2.5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Availability and blocks</h1>
        <p className="text-sm text-muted">Record an absence or breakdown once. Affected bookings come to this queue with ready-made alternatives, so nobody has to check calendars every day.</p>
      </div>
      <div className="grid gap-2.5 xl:grid-cols-[1fr_minmax(24rem,30rem)]">
        <section className="panel flex flex-col">
          <div className="panel-head">
            <div className="flex items-center gap-2"><h2 className="panel-title">Reschedule queue</h2><span className={clsx('rounded-full px-2 text-xs font-semibold', queue?.length ? 'bg-marigold-500 text-ink' : 'bg-teal-50 text-teal-700')}>{queue?.length ?? 0}</span></div>
            {(queue?.length ?? 0) > 0 && <button className="btn-ink btn-sm" disabled={auto} onClick={fixAll}>{auto ? <Spinner className="h-4 w-4 text-white" /> : <Wand2 className="h-4 w-4" />} Fix all automatically</button>}
          </div>
          <div className="max-h-[calc(100vh-14rem)] flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {!queue && [0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}
            {queue?.map(q => <QueueItem key={q.id} q={q} today={meta?.today ?? ''} onOpen={() => setOpen(q.appointment_id)} />)}
            {queue && !queue.length && <Empty icon={<ArrowRightLeft className="h-5 w-5" />} title="Nothing to reschedule">When a block hits a booked appointment it appears here with the closest alternatives.</Empty>}
          </div>
        </section>
        <AddBlock preset={sp.get('resource') ? Number(sp.get('resource')) : null} />
      </div>
      <Upcoming />
      <AppointmentDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export default function ExceptionsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><ExceptionsInner /></Suspense>;
}
