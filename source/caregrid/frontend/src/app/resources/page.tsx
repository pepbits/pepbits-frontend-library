'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarOff, Copy, Plus, Save, Search, Trash2, Undo2 } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { EXCEPTION_LABEL, KIND_COLOR, KIND_LABEL } from '@/lib/meta';
import { dur, hm, niceDate, niceDateTime, WEEKDAYS } from '@/lib/time';
import { Empty, KindIcon, KindTag, Skeleton } from '@/components/ui/primitives';

interface Win { weekday: number; start_min: number; end_min: number; tag: 'general' | 'urgent' | 'walkin'; release_hours: number; week_parity: number | null }
const toHM = (m: number) => hm(m % 1440);
const fromHM = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

function HoursEditor({ resource, onSaved }: { resource: any; onSaved: () => void }) {
  const { toast } = useLive();
  const original: Win[] = useMemo(() => resource.templates.map((t: any) => ({ weekday: t.weekday, start_min: t.start_min, end_min: t.end_min, tag: t.tag, release_hours: t.release_hours, week_parity: t.week_parity })), [resource]);
  const [rows, setRows] = useState<Win[]>(original);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRows(original), [original]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(original);
  const upd = (i: number, patch: Partial<Win>) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const total = rows.reduce((s, r) => s + (r.end_min - r.start_min) * (r.week_parity === null ? 1 : 0.5), 0);
  const save = async () => {
    setBusy(true);
    try { await api(`/resources/${resource.id}/templates`, { method: 'PUT', body: rows }); onSaved(); }
    catch (e: any) { toast({ level: 'warning', title: 'Hours not saved', body: e.message }); }
    finally { setBusy(false); }
  };
  const copyMonday = () => {
    const mon = rows.filter(r => r.weekday === 1);
    setRows(r => [...r.filter(x => ![2, 3, 4, 5].includes(x.weekday)), ...[2, 3, 4, 5].flatMap(d => mon.map(m => ({ ...m, weekday: d })))]);
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2 className="panel-title">Weekly working hours</h2><div className="text-xs text-muted">About {dur(Math.round(total))} a week{resource.capacity > 1 ? `, ${resource.capacity} patients at once` : ''}</div></div>
        <div className="flex gap-1.5">
          <button className="btn-ghost btn-sm" onClick={copyMonday}><Copy className="h-4 w-4" /> Copy Monday to weekdays</button>
          {dirty && <button className="btn-ghost btn-sm" onClick={() => setRows(original)}><Undo2 className="h-4 w-4" /> Undo</button>}
          <button className="btn-primary btn-sm" disabled={!dirty || busy} onClick={save}><Save className="h-4 w-4" /> Save hours</button>
        </div>
      </div>
      <div className="divide-y divide-line px-4 pb-3">
        {order.map(d => {
          const items = rows.map((r, i) => ({ r, i })).filter(x => x.r.weekday === d);
          return (
            <div key={d} className="grid grid-cols-[3rem_1fr] gap-3 py-2">
              <div className="pt-1.5 text-sm font-semibold text-ink">{WEEKDAYS[d]}</div>
              <div className="space-y-1.5">
                <div className="relative h-2 rounded-full bg-ink-100/70">
                  {items.map(({ r, i }) => (
                    <div key={i} className={clsx('absolute h-full rounded-full', r.tag === 'urgent' ? 'bg-marigold-500' : r.tag === 'walkin' ? 'bg-teal-200' : 'bg-teal-500')}
                      style={{ left: `${(r.start_min / 1440) * 100}%`, width: `${(Math.min(r.end_min, 1440) - r.start_min) / 14.4}%` }} />
                  ))}
                </div>
                {items.map(({ r, i }) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <input type="time" className="field h-8 w-[6.5rem]" value={toHM(r.start_min)} onChange={e => upd(i, { start_min: fromHM(e.target.value) })} aria-label="Start" />
                    <span className="text-xs text-muted">to</span>
                    <input type="time" className="field h-8 w-[6.5rem]" value={r.end_min >= 1440 && r.end_min % 1440 === 0 ? '23:59' : toHM(r.end_min)}
                      onChange={e => { let m = fromHM(e.target.value); if (m === 1439) m = 1440; if (m <= r.start_min) m += 1440; upd(i, { end_min: m }); }} aria-label="End" />
                    {r.end_min > 1440 && <span className="text-[0.68rem] text-muted">next day</span>}
                    <select className="field h-8 w-auto text-xs" value={r.tag} onChange={e => upd(i, { tag: e.target.value as Win['tag'], release_hours: e.target.value === 'general' ? 0 : r.release_hours || 2 })}>
                      <option value="general">Open to all</option><option value="urgent">Reserved: urgent</option><option value="walkin">Reserved: walk-in</option>
                    </select>
                    {r.tag !== 'general' && (
                      <label className="flex items-center gap-1 text-xs text-muted">opens to all <input type="number" min={0} className="field h-8 w-14 px-1.5" value={r.release_hours} onChange={e => upd(i, { release_hours: Number(e.target.value) })} /> h before</label>
                    )}
                    <select className="field h-8 w-auto text-xs" value={r.week_parity ?? ''} onChange={e => upd(i, { week_parity: e.target.value === '' ? null : Number(e.target.value) })}>
                      <option value="">Every week</option><option value="0">Even weeks</option><option value="1">Odd weeks</option>
                    </select>
                    <button className="btn-ghost h-8 w-8 p-0" onClick={() => setRows(x => x.filter((_, j) => j !== i))} aria-label="Remove window"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button className="btn-ghost btn-xs text-teal-700" onClick={() => setRows(x => [...x, { weekday: d, start_min: 540, end_min: 1020, tag: 'general', release_hours: 0, week_parity: null }])}>
                  <Plus className="h-3.5 w-3.5" /> {items.length ? 'Add window' : 'Add working time'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Detail({ id }: { id: number }) {
  const { meta } = useLive();
  const { data: r, reload } = useApi<any>(`/resources/${id}`);
  if (!r) return <div className="space-y-2.5"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  const maxPct = 100;
  return (
    <div className="space-y-2.5">
      <section className="panel p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: KIND_COLOR[r.kind] + '18' }}><KindIcon kind={r.kind} className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink">{r.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted"><KindTag kind={r.kind} /> {r.role_label}, {r.department}</div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
              <span>Capacity <b className="text-ink">{r.capacity}</b> at once</span>
              <span>Turnover after each use <b className="text-ink">{r.turnover_min} min</b></span>
              <span>{r.always_on ? 'Runs 24x7, ignores facility holidays' : 'Closes on facility holidays'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link className="btn-outline btn-sm" href={`/schedule?date=${meta?.today}&department=${r.department_id}`}>Open on board</Link>
            <Link className="btn-primary btn-sm" href={`/exceptions?resource=${r.id}`}><CalendarOff className="h-4 w-4" /> Block time</Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {r.week.map((w: any) => (
            <div key={w.date} className="rounded-lg bg-canvas p-2 text-center">
              <div className="text-[0.68rem] text-muted">{niceDate(w.date, meta?.today)}</div>
              <div className="mx-auto mt-1.5 flex h-14 w-6 items-end overflow-hidden rounded bg-ink-100">
                <div className="w-full rounded" style={{ height: `${Math.min(maxPct, w.pct)}%`, background: w.pct >= 85 ? '#D04A58' : KIND_COLOR[r.kind] }} />
              </div>
              <div className="mt-1 text-xs font-semibold text-ink tabnum">{w.available_min ? `${w.pct}%` : 'Off'}</div>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-2.5 2xl:grid-cols-[1fr_20rem]">
        <HoursEditor resource={r} onSaved={reload} />
        <div className="space-y-2.5">
          <section className="panel">
            <div className="panel-head"><h3 className="panel-title">Blocks</h3></div>
            <div className="space-y-1.5 px-4 pb-4">
              {r.exceptions.map((x: any) => (
                <div key={x.id} className="rounded-lg bg-crimson-50/60 px-3 py-2 text-xs">
                  <div className="font-semibold text-crimson-700">{EXCEPTION_LABEL[x.type]}{x.recur_weeks ? `, every ${x.recur_weeks === 1 ? 'week' : `${x.recur_weeks} weeks`}` : ''}</div>
                  <div className="text-muted">{niceDateTime(x.start_at, meta?.today)} to {niceDateTime(x.end_at, meta?.today)}{x.reason ? `. ${x.reason}` : ''}</div>
                </div>
              ))}
              {!r.exceptions.length && <div className="text-sm text-muted">No upcoming blocks.</div>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h3 className="panel-title">Services that use it</h3><span className="text-xs text-muted">{r.usedBy.length}</span></div>
            <div className="max-h-72 space-y-0.5 overflow-y-auto px-2 pb-3">
              {r.usedBy.map((t: any) => <Link key={t.id} href={`/catalog?type=${t.id}`} className="block truncate rounded px-2 py-1 text-sm hover:bg-canvas">{t.name}</Link>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ResourcesInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { meta } = useLive();
  const [dept, setDept] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const { data } = useApi<any[]>('/resources' + qs({ department: dept, kind, q }));
  const id = sp.get('id') ? Number(sp.get('id')) : null;
  useEffect(() => { if (!id && data?.length) router.replace(`/resources?id=${data[0].id}`); }, [id, data, router]);
  return (
    <div className="grid gap-2.5 lg:grid-cols-[19rem_1fr] 2xl:grid-cols-[22rem_1fr]">
      <section className="panel flex max-h-[calc(100vh-6.5rem)] flex-col">
        <div className="space-y-2 p-3">
          <h1 className="text-lg font-semibold text-ink">Resources</h1>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="field pl-9" placeholder="Name or role" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select className="field" value={dept} onChange={e => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{meta?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <div className="flex flex-wrap gap-1">
            <button className={clsx('chip', !kind && 'chip-on')} onClick={() => setKind('')}>All</button>
            {meta?.kinds.map(k => <button key={k} className={clsx('chip', kind === k && 'chip-on')} onClick={() => setKind(kind === k ? '' : k)} title={KIND_LABEL[k]}><KindIcon kind={k} className="h-3.5 w-3.5" />{KIND_LABEL[k]}</button>)}
          </div>
          <div className="text-xs text-muted">{data?.length ?? 0} resources</div>
        </div>
        <div className="flex-1 overflow-y-auto border-t border-line px-1.5 py-1.5">
          {!data && <div className="space-y-1.5 p-1.5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}</div>}
          {data?.map(r => (
            <Link key={r.id} href={`/resources?id=${r.id}`} className={clsx('flex items-center gap-2.5 rounded-lg px-2 py-1.5', id === r.id ? 'bg-teal-50' : 'hover:bg-canvas')}>
              <KindIcon kind={r.kind} className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1"><div className="truncate text-sm text-ink">{r.name}</div><div className="truncate text-[0.7rem] text-muted">{r.role_label}</div></div>
              {r.current_exception && <span className="rounded bg-crimson-50 px-1.5 text-[0.65rem] font-semibold text-crimson-700">{EXCEPTION_LABEL[r.current_exception]}</span>}
              {!r.current_exception && r.exception_count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-marigold-500" title="Has upcoming blocks" />}
            </Link>
          ))}
          {data && !data.length && <Empty title="No resources match" />}
        </div>
      </section>
      <div>{id ? <Detail id={id} /> : <Skeleton className="h-96" />}</div>
    </div>
  );
}

export default function ResourcesPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><ResourcesInner /></Suspense>;
}
