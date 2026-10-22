'use client';
import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { EXCEPTION_LABEL, KIND_LABEL } from '@/lib/meta';
import { addDays, hm, niceDate, nowLocal, time, toMin } from '@/lib/time';
import { Avatar, Drawer, Empty, ErrorNote, KindIcon, Skeleton } from '@/components/ui/primitives';
import { AppointmentDrawer } from '@/components/booking/AppointmentDrawer';
import { Slot, SlotPicker } from '@/components/booking/SlotPicker';

interface Res {
  id: number; name: string; kind: string; role_code: string; role_label: string; department: string; color: string; capacity: number;
  windows: { start: string; end: string; tag: string }[]; exceptions: any[]; holds: any[];
}

function lanes(holds: any[]) {
  const sorted = holds.slice().sort((a, b) => a.hold_start.localeCompare(b.hold_start));
  const ends: string[] = []; const out = new Map<number, number>();
  for (const h of sorted) {
    let lane = ends.findIndex(e => e <= h.hold_start);
    if (lane < 0) { lane = ends.length; ends.push(h.hold_end); } else ends[lane] = h.hold_end;
    out.set(h.id, lane);
  }
  return { map: out, count: Math.max(1, ends.length) };
}

function QuickBook({ res, at, date, onClose }: { res: Res | null; at: string | null; date: string; onClose: () => void }) {
  const { toast } = useLive();
  const { data: types } = useApi<any[]>(res ? '/types' : null, { live: false });
  const [typeId, setTypeId] = useState<number | null>(null);
  const [pq, setPq] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const { data: patients } = useApi<any[]>(res && !patient ? `/patients?q=${encodeURIComponent(pq)}` : null, { live: false });
  useEffect(() => { setTypeId(null); setPatient(null); setSlot(null); setPq(''); }, [res, at]);
  const fitting = useMemo(() => (types ?? []).filter(t => t.requirements.some((r: any) => r.roles?.includes(res?.role_code))), [types, res]);
  const book = async () => {
    if (!slot || !patient || !typeId) return;
    try { await api('/appointments', { body: { patientId: patient.id, typeId, start: slot.start, assignments: slot.assignments } }); onClose(); }
    catch (e: any) { toast({ level: 'warning', title: 'Not booked', body: e.message }); }
  };
  return (
    <Drawer open={!!res} onClose={onClose} title={res ? `Book on ${res.name}` : ''} subtitle={res ? `${res.role_label}, around ${at ? time(at) : ''} on ${niceDate(date)}` : undefined}
      footer={<div className="flex justify-end"><button className="btn-primary" disabled={!slot || !patient} onClick={book}><CalendarCheck className="h-4 w-4" /> {slot ? `Book ${time(slot.start)}` : 'Pick a time'}</button></div>}>
      <div className="space-y-4">
        <div>
          <label className="label">Service using this resource</label>
          <select className="field" value={typeId ?? ''} onChange={e => { setTypeId(Number(e.target.value) || null); setSlot(null); }}>
            <option value="">Choose one of {fitting.length} services</option>
            {fitting.map(t => <option key={t.id} value={t.id}>{t.name} ({t.duration_min} min)</option>)}
          </select>
        </div>
        <div>
          <label className="label">Patient</label>
          {patient ? (
            <div className="flex items-center gap-2 rounded-lg bg-canvas p-2"><Avatar name={patient.full_name} /><div className="flex-1 text-sm font-medium">{patient.full_name} <span className="text-muted">{patient.mrn}</span></div><button className="btn-ghost btn-xs" onClick={() => setPatient(null)}>Change</button></div>
          ) : (
            <>
              <input className="field" placeholder="Search name or MRN" value={pq} onChange={e => setPq(e.target.value)} />
              <div className="mt-1 max-h-40 overflow-y-auto">
                {patients?.slice(0, 8).map(p => <button key={p.id} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-canvas" onClick={() => setPatient(p)}>{p.full_name} <span className="text-xs text-muted">{p.mrn}</span></button>)}
              </div>
            </>
          )}
        </div>
        {typeId && patient && (
          <div>
            <label className="label">Time ({res?.name} preferred)</label>
            <SlotPicker typeId={typeId} patientId={patient.id} startDate={date} preferred={res ? [res.id] : []} selected={slot} onPick={setSlot} compact />
          </div>
        )}
      </div>
    </Drawer>
  );
}

function ScheduleInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { meta } = useLive();
  const today = meta?.today ?? '';
  const date = sp.get('date') ?? today;
  const [dept, setDept] = useState<string>(sp.get('department') ?? '4');
  const [kind, setKind] = useState<string>('');
  const [q, setQ] = useState('');
  const [range, setRange] = useState<'work' | 'full'>('work');
  const [zoom, setZoom] = useState(1);
  const [openAppt, setOpenAppt] = useState<number | null>(sp.get('appt') ? Number(sp.get('appt')) : null);
  const [quick, setQuick] = useState<{ res: Res; at: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(nowLocal());
  useEffect(() => { const i = setInterval(() => setNow(nowLocal()), 30000); return () => clearInterval(i); }, []);
  const { data, error, reload } = useApi<{ date: string; holiday?: any; resources: Res[] }>(date ? '/schedule' + qs({ date, department: dept, kind, q }) : null);

  const setDate = (d: string) => router.replace(`/schedule?date=${d}&department=${dept}`);
  const [h0, h1] = range === 'work' ? [6, 22] : [0, 24];
  const d0 = date ? toMin(date + 'T00:00') : 0;
  const lo = d0 + h0 * 60, hi = d0 + h1 * 60, span = hi - lo;
  const pos = (s: string) => Math.max(0, Math.min(100, ((toMin(s) - lo) / span) * 100));
  const wid = (s: string, e: string) => Math.max(0.15, pos(e) - pos(s));
  const nowPct = date === now.slice(0, 10) && toMin(now) >= lo && toMin(now) <= hi ? pos(now) : null;

  const groups = useMemo(() => {
    const m = new Map<string, Res[]>();
    for (const r of data?.resources ?? []) { const k = `${r.department} / ${r.role_label}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
    return [...m.entries()];
  }, [data]);

  const clickTrack = (e: React.MouseEvent<HTMLDivElement>, r: Res) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const m = lo + Math.round((((e.clientX - rect.left) / rect.width) * span) / 15) * 15;
    const iso = new Date(m * 60000).toISOString().slice(0, 16);
    const inside = r.windows.some(w => toMin(w.start) <= m && toMin(w.end) > m);
    if (inside) setQuick({ res: r, at: iso });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold text-ink">Schedule board</h1>
        <div className="flex items-center rounded-lg border border-line bg-white">
          <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
          <input type="date" className="h-9 border-x border-line px-2 text-sm outline-none" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
          <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button className={clsx('chip', date === today && 'chip-on')} onClick={() => setDate(today)}>Today</button>
        <span className="text-sm font-medium text-ink">{date && niceDate(date)}</span>
        <select className="field ml-auto w-auto" value={dept} onChange={e => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {meta?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="relative"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="field w-44 pl-8" placeholder="Find resource" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={clsx('chip', !kind && 'chip-on')} onClick={() => setKind('')}>All types</button>
        {meta?.kinds.map(k => <button key={k} className={clsx('chip', kind === k && 'chip-on')} onClick={() => setKind(kind === k ? '' : k)}><KindIcon kind={k} className="h-3.5 w-3.5" />{KIND_LABEL[k]}</button>)}
        <div className="ml-auto flex items-center gap-2">
          <div className="seg"><button data-on={range === 'work'} onClick={() => setRange('work')}>06 to 22</button><button data-on={range === 'full'} onClick={() => setRange('full')}>24 hours</button></div>
          <div className="seg">{[1, 2, 3].map(z => <button key={z} data-on={zoom === z} onClick={() => setZoom(z)}>{z === 1 ? 'Fit' : `${z}x`}</button>)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[0.72rem] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-line bg-white" />Working time</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-ink-100/70" />Off duty</span>
        <span className="flex items-center gap-1.5"><span className="hatch-urgent h-3 w-5 rounded-sm" />Reserved for urgent</span>
        <span className="flex items-center gap-1.5"><span className="dots-walkin h-3 w-5 rounded-sm border border-line" />Walk-in time</span>
        <span className="flex items-center gap-1.5"><span className="hatch-block h-3 w-5 rounded-sm" />Blocked</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-ink-400/50" />Turnover or travel</span>
        <span className="ml-auto">Click empty working time to book that resource.</span>
      </div>

      {data?.holiday && <div className="rounded-xl bg-marigold-50 px-4 py-2 text-sm text-marigold-700">{data.holiday.name}: elective services are closed. 24x7 resources keep running.</div>}
      {error && <ErrorNote message={error} onRetry={reload} />}

      <div className="panel overflow-hidden">
        <div className="max-h-[calc(100vh-15.5rem)] overflow-auto">
          <div style={{ minWidth: `calc(14rem + ${zoom * 100}% - ${zoom > 1 ? 14 : 0}rem)` }} className="relative">
            <div className="sticky top-0 z-20 grid grid-cols-[14rem_1fr] border-b border-line bg-white">
              <div className="sticky left-0 z-10 border-r border-line bg-white px-3 py-2 text-xs font-medium text-muted">{data ? `${data.resources.length} resources` : 'Loading'}</div>
              <div className="relative h-8">
                {Array.from({ length: h1 - h0 }, (_, i) => (
                  <div key={i} className="absolute top-0 h-full border-l border-line pl-1 pt-2 text-[0.68rem] text-muted tabnum" style={{ left: `${(i / (h1 - h0)) * 100}%` }}>{hm((h0 + i) * 60)}</div>
                ))}
                {nowPct !== null && <div className="absolute -bottom-px top-1 z-10 -translate-x-1/2 rounded bg-marigold-500 px-1 text-[0.62rem] font-bold text-ink" style={{ left: `${nowPct}%` }}>{now.slice(11, 16)}</div>}
              </div>
            </div>

            {!data && !error && <div className="space-y-2 p-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>}
            {data && !data.resources.length && <Empty title="No resources match these filters" icon={<Search className="h-5 w-5" />}>Clear the search or pick another department.</Empty>}

            {groups.map(([g, rs]) => (
              <div key={g}>
                <button onClick={() => setCollapsed(c => ({ ...c, [g]: !c[g] }))} className="sticky left-0 flex w-full items-center gap-2 border-b border-line bg-canvas/80 px-3 py-1 text-left text-[0.72rem] font-semibold text-ink-600">
                  <ChevronDown className={clsx('h-3.5 w-3.5 transition', collapsed[g] && '-rotate-90')} />{g}<span className="font-normal text-muted">({rs.length})</span>
                </button>
                {!collapsed[g] && rs.map(r => {
                  const L = lanes(r.holds);
                  const rowH = Math.max(2.4, L.count * 1.9 + 0.5);
                  const booked = r.holds.reduce((s, h) => s + (toMin(h.hold_end) - toMin(h.hold_start)), 0);
                  const avail = r.windows.reduce((s, w) => s + (toMin(w.end) - toMin(w.start)), 0) * r.capacity;
                  return (
                    <div key={r.id} className="grid grid-cols-[14rem_1fr] border-b border-line/70" style={{ height: `${rowH}rem` }}>
                      <div className="sticky left-0 z-10 flex items-center gap-2 border-r border-line bg-white px-3">
                        <KindIcon kind={r.kind} className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[0.8rem] font-medium text-ink" title={r.name}>{r.name}</div>
                          <div className="flex items-center gap-1.5 text-[0.66rem] text-muted">
                            {avail ? <><span className="h-1 w-10 overflow-hidden rounded-full bg-ink-100"><span className="block h-full bg-teal-500" style={{ width: `${Math.min(100, (booked / avail) * 100)}%` }} /></span>{Math.round(Math.min(100, (booked / avail) * 100))}%</> : 'Off today'}
                            {r.capacity > 1 && <span>, {r.capacity} at once</span>}
                          </div>
                        </div>
                      </div>
                      <div className="grid-hours relative cursor-crosshair bg-ink-100/50" style={{ backgroundSize: `${100 / (h1 - h0)}% 100%` }} onClick={e => clickTrack(e, r)}>
                        {r.windows.map((w, i) => (
                          <div key={i} className={clsx('absolute inset-y-0', w.tag === 'urgent' ? 'hatch-urgent bg-white' : w.tag === 'walkin' ? 'dots-walkin bg-white' : 'bg-white')}
                            style={{ left: `${pos(w.start)}%`, width: `${wid(w.start, w.end)}%` }} />
                        ))}
                        {r.exceptions.map((x, i) => (
                          <div key={i} className="hatch-block absolute inset-y-0.5 flex items-center overflow-hidden rounded border border-crimson-100 px-1.5 text-[0.66rem] font-semibold text-crimson-700"
                            style={{ left: `${pos(x.start)}%`, width: `${wid(x.start, x.end)}%` }} title={`${EXCEPTION_LABEL[x.type]}${x.reason ? `: ${x.reason}` : ''}`}>
                            <span className="truncate">{EXCEPTION_LABEL[x.type]}{x.reason ? `: ${x.reason}` : ''}</span>
                          </div>
                        ))}
                        {r.holds.map(h => {
                          const lane = L.map.get(h.id) ?? 0;
                          const top = 0.25 + lane * 1.9;
                          const done = h.status === 'completed';
                          return (
                            <button key={h.id} onClick={e => { e.stopPropagation(); setOpenAppt(h.appointment_id); }}
                              className={clsx('group absolute z-[5] flex h-[1.65rem] overflow-hidden rounded-md text-left text-[0.68rem] font-medium text-white shadow-sm ring-1 ring-white/60 transition hover:z-10 hover:shadow-lift',
                                h.at_risk && 'outline outline-2 outline-offset-1 outline-marigold-500', done && 'opacity-60')}
                              style={{ top: `${top}rem`, left: `${pos(h.hold_start)}%`, width: `${wid(h.hold_start, h.hold_end)}%` }}
                              title={`${h.patient_name}, ${h.type_name}\n${time(h.start_at)} to ${time(h.end_at)}${h.hold_end > h.end_at ? ` (+${toMin(h.hold_end) - toMin(h.end_at)} min turnover)` : ''}`}>
                              {h.hold_start < h.start_at && <span className="h-full bg-ink-400/50" style={{ width: `${((toMin(h.start_at) - toMin(h.hold_start)) / (toMin(h.hold_end) - toMin(h.hold_start))) * 100}%` }} />}
                              <span className="flex min-w-0 flex-1 items-center gap-1 px-1.5" style={{ background: h.priority === 'urgent' ? '#B83A48' : h.color }}>
                                {h.status === 'checked_in' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-marigold-400" />}
                                {h.status === 'in_progress' && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white" />}
                                <span className="truncate">{h.patient_name}</span>
                              </span>
                              {h.hold_end > h.end_at && <span className="h-full bg-ink-400/50" style={{ width: `${((toMin(h.hold_end) - toMin(h.end_at)) / (toMin(h.hold_end) - toMin(h.hold_start))) * 100}%` }} />}
                            </button>
                          );
                        })}
                        {nowPct !== null && <div className="pointer-events-none absolute inset-y-0 z-[6] w-0.5 bg-marigold-500" style={{ left: `${nowPct}%` }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <AppointmentDrawer id={openAppt} onClose={() => setOpenAppt(null)} />
      <QuickBook res={quick?.res ?? null} at={quick?.at ?? null} date={date} onClose={() => setQuick(null)} />
    </div>
  );
}

export default function SchedulePage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><ScheduleInner /></Suspense>;
}
