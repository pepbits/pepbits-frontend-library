'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, LogIn, Pill, Play, Square, Truck } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { dur, time, toMin } from '@/lib/time';
import { Empty, KindIcon, Meter, Skeleton, StatusPill } from '@/components/ui/primitives';
import { AppointmentDrawer } from '@/components/booking/AppointmentDrawer';

export default function PharmacyPage() {
  const { meta, toast } = useLive();
  const pharm = meta?.departments.find(d => d.code === 'PHARM');
  const cat = meta?.categories.find(c => c.name === 'Pharmacy');
  const date = meta?.today;
  const { data: appts, setData } = useApi<any[]>(pharm && date ? '/appointments' + qs({ date, department: pharm.id }) : null);
  const { data: board } = useApi<any>(pharm && date ? '/schedule' + qs({ date, department: pharm.id }) : null);
  const { data: types } = useApi<any[]>(cat ? `/types?category=${cat.id}` : null, { live: false });
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const act = async (a: any, action: string) => {
    try {
      const x = await api(`/appointments/${a.id}/status`, { body: { action } });
      setData(d => d?.map(y => (y.id === a.id ? { ...y, status: x.status } : y)) ?? null);
      toast({ level: 'success', title: action === 'complete' ? 'Handed over' : action === 'check_in' ? 'At the counter' : 'Serving', body: `${a.patient_name}, ${a.type_name}` });
    } catch (e: any) { toast({ level: 'warning', title: 'Not changed', body: e.message }); }
  };
  const list = useMemo(() => (appts ?? []).filter(a => filter === 'all' || !['completed', 'cancelled', 'no_show'].includes(a.status)), [appts, filter]);
  const count = (s: string[]) => (appts ?? []).filter(a => s.includes(a.status)).length;
  const deliveries = (appts ?? []).filter(a => a.type_name === 'Home delivery slot').length;
  const load = (board?.resources ?? []).map((r: any) => {
    const avail = r.windows.reduce((s: number, w: any) => s + (toMin(w.end) - toMin(w.start)), 0) * r.capacity;
    const booked = r.holds.reduce((s: number, h: any) => s + (toMin(h.hold_end) - toMin(h.hold_start)), 0);
    return { ...r, pct: avail ? Math.round(Math.min(100, (booked / avail) * 100)) : 0, avail };
  });

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold text-ink">Pharmacy desk</h1><p className="text-sm text-muted">Pickups, refills, counseling, INR checks, compounding and home deliveries for today.</p></div>
        <Link href={`/schedule?date=${date}&department=${pharm?.id ?? ''}`} className="btn-outline">Counter timeline</Link>
      </div>
      <div className="panel grid grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-line">
        {[['Pharmacy visits today', appts?.length ?? '–'], ['At the counter now', count(['checked_in', 'in_progress'])], ['Handed over', count(['completed'])], ['Home deliveries', deliveries]].map(([l, v]) => (
          <div key={l as string} className="px-4 py-3"><div className="text-xs text-muted">{l}</div><div className="text-2xl font-semibold text-ink tabnum">{v}</div></div>
        ))}
      </div>
      <div className="grid gap-2.5 xl:grid-cols-[1fr_24rem]">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">Today’s pharmacy queue</h2><div className="seg"><button data-on={filter === 'open'} onClick={() => setFilter('open')}>Still to serve</button><button data-on={filter === 'all'} onClick={() => setFilter('all')}>All</button></div></div>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-2 pb-3">
            {!appts && <div className="space-y-1.5 px-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>}
            {list.map(a => (
              <div key={a.id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
                <button onClick={() => setOpen(a.id)} className="text-left text-sm font-semibold text-ink tabnum">{time(a.start_at)}</button>
                <button onClick={() => setOpen(a.id)} className="min-w-0 text-left">
                  <div className="truncate text-sm text-ink">{a.patient_name} <span className="text-muted">{a.mrn}</span></div>
                  <div className="truncate text-[0.72rem] text-muted">{a.type_name}{a.primary_resource ? `, ${a.primary_resource}` : ''}{a.allergies ? `. Allergy: ${a.allergies}` : ''}</div>
                </button>
                <div className="flex items-center gap-1.5">
                  <StatusPill status={a.status} />
                  {['booked', 'confirmed'].includes(a.status) && <button className="btn-outline btn-xs" onClick={() => act(a, 'check_in')}><LogIn className="h-3.5 w-3.5" /> Arrived</button>}
                  {a.status === 'checked_in' && <button className="btn-primary btn-xs" onClick={() => act(a, 'start')}><Play className="h-3.5 w-3.5" /> Serve</button>}
                  {a.status === 'in_progress' && <button className="btn-ink btn-xs" onClick={() => act(a, 'complete')}><Square className="h-3.5 w-3.5" /> Handed over</button>}
                </div>
              </div>
            ))}
            {appts && !list.length && <Empty icon={<CheckCircle2 className="h-5 w-5" />} title="Everyone has been served">New pharmacy bookings appear here instantly.</Empty>}
          </div>
        </section>
        <div className="space-y-2.5">
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Book in one click</h2></div>
            <div className="grid grid-cols-2 gap-1.5 px-4 pb-4">
              {types?.map(t => (
                <Link key={t.id} href={`/book?type=${t.id}`} className="flex items-start gap-2 rounded-lg border border-line p-2 text-left hover:border-teal-500 hover:bg-teal-50/40">
                  {t.name.includes('delivery') ? <Truck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> : <Pill className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />}
                  <span className="min-w-0"><span className="block text-xs font-medium leading-tight text-ink">{t.name}</span><span className="text-[0.68rem] text-muted">{dur(t.duration_min)}</span></span>
                </Link>
              ))}
              {!types && <Skeleton className="col-span-2 h-40" />}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Counters, booths and staff</h2></div>
            <div className="space-y-2.5 px-4 pb-4">
              {load.filter((r: any) => r.avail > 0).map((r: any) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-ink"><KindIcon kind={r.kind} className="h-3.5 w-3.5" />{r.name}</span><span className={clsx('tabnum', r.pct > 85 ? 'font-semibold text-crimson-600' : 'text-muted')}>{r.pct}%</span></div>
                  <Meter pct={r.pct} className="mt-1" color={r.pct > 85 ? '#D04A58' : '#1F7A6D'} />
                </div>
              ))}
              {!board && <Skeleton className="h-32" />}
            </div>
          </section>
        </div>
      </div>
      <AppointmentDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
