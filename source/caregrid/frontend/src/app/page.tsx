'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarPlus, CalendarX2, ConciergeBell, Hourglass, ShieldAlert, Wrench } from 'lucide-react';
import { useApi, useLive } from '@/lib/live';
import { EXCEPTION_LABEL, KIND_COLOR, KIND_LABEL } from '@/lib/meta';
import { niceDate, niceDateTime, nowLocal, time } from '@/lib/time';
import { CatIcon, ErrorNote, KindIcon, Meter, Skeleton, StatusPill } from '@/components/ui/primitives';
import { AppointmentDrawer } from '@/components/booking/AppointmentDrawer';

function greeting(h: number) { return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

export default function CommandCenter() {
  const { meta } = useLive();
  const { data: s, error, reload } = useApi<any>('/analytics/summary');
  const { data: queue } = useApi<any[]>('/queue');
  const [open, setOpen] = useState<number | null>(null);
  const [now, setNow] = useState('');
  useEffect(() => { setNow(nowLocal()); const i = setInterval(() => setNow(nowLocal()), 30000); return () => clearInterval(i); }, []);
  const hourNow = now ? Number(now.slice(11, 13)) : 9;

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  const c = s?.counts ?? {};
  const active = (c.checked_in ?? 0) + (c.in_progress ?? 0);
  const hours = (s?.hours ?? []).filter((h: any) => h.hour >= 6 && h.hour <= 22);
  const maxH = Math.max(1, ...hours.map((h: any) => h.count));

  const kpis = [
    { label: 'Appointments today', value: s?.total ?? '–', sub: `${c.completed ?? 0} completed, ${(c.booked ?? 0) + (c.confirmed ?? 0)} still to come`, href: '/frontdesk' },
    { label: 'Arrived or in session', value: active, sub: `${c.checked_in ?? 0} waiting, ${c.in_progress ?? 0} with clinicians`, href: '/frontdesk' },
    { label: 'Need a new time', value: s?.queuePending ?? '–', sub: s?.queuePending ? 'Affected by leave or breakdowns' : 'Nothing waiting', href: '/exceptions', warn: (s?.queuePending ?? 0) > 0 },
    { label: 'No-show rate, 30 days', value: s ? `${s.noShowRate}%` : '–', sub: 'Of completed plus missed visits', href: '/insights' },
    { label: 'Median wait after arrival', value: s ? `${s.medianWait} min` : '–', sub: 'Check-in to session start, 14 days', href: '/insights' },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">{greeting(hourNow)}</h1>
          <p className="text-sm text-muted">{meta ? niceDate(meta.today) : ''}. Here is where today stands across every department.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/book" className="btn-primary"><CalendarPlus className="h-4 w-4" /> Book</Link>
          <Link href="/exceptions" className="btn-outline"><CalendarX2 className="h-4 w-4" /> Block a resource</Link>
          <Link href="/frontdesk" className="btn-outline"><ConciergeBell className="h-4 w-4" /> Front desk</Link>
        </div>
      </div>

      <div className="panel grid grid-cols-2 divide-line md:grid-cols-3 xl:grid-cols-5 xl:divide-x">
        {kpis.map(k => (
          <Link key={k.label} href={k.href} className={clsx('group px-4 py-3.5 transition hover:bg-canvas', k.warn && 'bg-marigold-50/70')}>
            <div className="text-xs text-muted">{k.label}</div>
            <div className={clsx('mt-0.5 text-[1.7rem] font-semibold leading-none tabnum', k.warn ? 'text-marigold-700' : 'text-ink')}>{k.value}</div>
            <div className="mt-1.5 text-[0.72rem] text-muted">{k.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-2.5 xl:grid-cols-12">
        <section className="panel xl:col-span-8">
          <div className="panel-head"><h2 className="panel-title">Arrivals by hour</h2><span className="text-xs text-muted">Booked starts per hour, excluding cancellations</span></div>
          <div className="px-4 pb-4">
            {!s ? <Skeleton className="h-44" /> : (
              <div className="flex h-44 items-end gap-1">
                {hours.map((h: any) => {
                  const past = h.hour < hourNow; const cur = h.hour === hourNow;
                  return (
                    <div key={h.hour} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                      <div className="mb-1 text-[0.65rem] font-semibold text-ink opacity-0 transition group-hover:opacity-100 tabnum">{h.count}</div>
                      <div className={clsx('w-full rounded-t-md transition-all', cur ? 'bg-marigold-500' : past ? 'bg-ink-200' : 'bg-teal-500')} style={{ height: `${Math.max(2, (h.count / maxH) * 100)}%` }} />
                      <div className={clsx('mt-1 text-[0.62rem] tabnum', cur ? 'font-bold text-marigold-700' : 'text-muted')}>{String(h.hour).padStart(2, '0')}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid gap-x-6 gap-y-2.5 border-t border-line px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {(s?.utilization ?? []).map((u: any) => (
              <div key={u.kind}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-ink"><KindIcon kind={u.kind} className="h-3.5 w-3.5" />{KIND_LABEL[u.kind]}</span>
                  <span className="text-muted tabnum">{u.pct}% booked</span>
                </div>
                <Meter pct={u.pct} color={KIND_COLOR[u.kind]} className="mt-1.5" />
              </div>
            ))}
          </div>
        </section>

        <section className="panel flex flex-col xl:col-span-4">
          <div className="panel-head"><h2 className="panel-title">Needs a decision</h2>{(queue?.length ?? 0) > 0 && <Link href="/exceptions" className="btn-ghost btn-xs">Open queue <ArrowRight className="h-3 w-3" /></Link>}</div>
          <div className="flex-1 space-y-2 px-4 pb-4">
            {queue?.slice(0, 4).map(q => (
              <button key={q.id} onClick={() => setOpen(q.appointment_id)} className="flex w-full items-start gap-2.5 rounded-xl border border-marigold-100 bg-marigold-50/60 p-2.5 text-left hover:border-marigold-400">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{q.patient_name}, {q.type_name}</div>
                  <div className="truncate text-[0.72rem] text-muted">{niceDateTime(q.start_at, meta?.today)}. {q.reason}</div>
                </div>
              </button>
            ))}
            {queue && queue.length > 4 && <div className="text-xs text-muted">and {queue.length - 4} more in the reschedule queue.</div>}
            {s?.exceptionsToday?.map((x: any) => (
              <div key={x.id} className="flex items-start gap-2.5 rounded-xl border border-line p-2.5">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-crimson-500" />
                <div className="min-w-0 flex-1 text-sm"><span className="font-medium text-ink">{x.resource_name}</span> <span className="text-muted">{EXCEPTION_LABEL[x.type]} {time(x.start_at)} to {time(x.end_at)}</span></div>
              </div>
            ))}
            {(s?.waitlist ?? 0) > 0 && (
              <Link href="/frontdesk?tab=waitlist" className="flex items-center gap-2.5 rounded-xl border border-line p-2.5 text-sm hover:bg-canvas">
                <Hourglass className="h-4 w-4 text-teal-600" /><span className="flex-1"><b className="text-ink">{s.waitlist}</b> patients on the waitlist</span><ArrowRight className="h-3.5 w-3.5 text-muted" />
              </Link>
            )}
            {queue && !queue.length && !s?.exceptionsToday?.length && <div className="py-6 text-center text-sm text-muted">Nothing needs a decision right now.</div>}
          </div>
        </section>

        <section className="panel xl:col-span-5">
          <div className="panel-head"><h2 className="panel-title">Next up</h2><Link href="/frontdesk" className="btn-ghost btn-xs">Front desk <ArrowRight className="h-3 w-3" /></Link></div>
          <div className="px-2 pb-3">
            {!s && <div className="space-y-1.5 px-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>}
            {s?.next.map((a: any) => (
              <button key={a.id} onClick={() => setOpen(a.id)} className="grid w-full grid-cols-[3rem_1.5rem_1fr_auto] items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-canvas">
                <span className="text-sm font-semibold text-ink tabnum">{time(a.start_at)}</span>
                <CatIcon name={a.icon} className="h-4 w-4" style={{ color: a.color }} />
                <span className="min-w-0"><span className="block truncate text-sm text-ink">{a.patient_name}</span><span className="block truncate text-[0.72rem] text-muted">{a.type_name}</span></span>
                <span className="flex items-center gap-1">{a.at_risk ? <ShieldAlert className="h-3.5 w-3.5 text-marigold-600" /> : null}<StatusPill status={a.status} /></span>
              </button>
            ))}
            {s && !s.next.length && <div className="py-6 text-center text-sm text-muted">No more appointments today.</div>}
          </div>
        </section>

        <section className="panel xl:col-span-4">
          <div className="panel-head"><h2 className="panel-title">Busiest resources today</h2><Link href="/insights" className="btn-ghost btn-xs">Utilization <ArrowRight className="h-3 w-3" /></Link></div>
          <div className="space-y-3 px-4 pb-4">
            {s?.busiest.map((r: any) => (
              <Link key={r.id} href={`/resources?id=${r.id}`} className="block">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><KindIcon kind={r.kind} className="h-3.5 w-3.5 shrink-0" /><span className="truncate text-ink">{r.name}</span></span>
                  <span className={clsx('text-xs font-semibold tabnum', r.pct >= 85 ? 'text-crimson-600' : 'text-muted')}>{r.pct}%</span>
                </div>
                <div className="mt-1 text-[0.7rem] text-muted">{r.role_label}</div>
                <Meter pct={r.pct} color={r.pct >= 85 ? '#D04A58' : KIND_COLOR[r.kind]} className="mt-1" />
              </Link>
            ))}
            {!s && <Skeleton className="h-40" />}
          </div>
        </section>

        <section className="panel xl:col-span-3">
          <div className="panel-head"><h2 className="panel-title">Service mix today</h2></div>
          <div className="space-y-2 px-4 pb-4">
            {s?.mix.slice(0, 9).map((m: any) => {
              const max = s.mix[0]?.c ?? 1;
              return (
                <div key={m.name} className="grid grid-cols-[1.25rem_1fr_2rem] items-center gap-2 text-xs">
                  <CatIcon name={m.icon} className="h-3.5 w-3.5" style={{ color: m.color }} />
                  <div><div className="truncate text-ink">{m.name}</div><div className="mt-0.5 h-1 rounded-full" style={{ width: `${(m.c / max) * 100}%`, background: m.color }} /></div>
                  <span className="text-right font-semibold text-ink tabnum">{m.c}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <AppointmentDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
