'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Repeat, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { PATTERN_HINT, SLOT_MODEL_LABEL } from '@/lib/meta';
import { dur, hm } from '@/lib/time';
import { CatIcon, Drawer, KindIcon, SegmentStrip, Skeleton } from '@/components/ui/primitives';

function TypeDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { toast } = useLive();
  const { data: t, reload } = useApi<any>(id ? `/types/${id}` : null, { live: false });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (t) setF({ duration_min: t.duration_min, slot_step_min: t.slot_step_min, min_notice_min: t.min_notice_min, max_advance_days: t.max_advance_days,
    window_start: t.window_start != null ? hm(t.window_start) : '', window_end: t.window_end != null ? hm(t.window_end) : '', prep_instructions: t.prep_instructions ?? '' }); }, [t]);
  const save = async () => {
    const toM = (s: string) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null);
    try {
      await api(`/types/${id}`, { method: 'PATCH', body: { duration_min: Number(f.duration_min), slot_step_min: Number(f.slot_step_min), min_notice_min: Number(f.min_notice_min),
        max_advance_days: Number(f.max_advance_days), window_start: toM(f.window_start), window_end: toM(f.window_end), prep_instructions: f.prep_instructions || null } });
      reload(); toast({ level: 'success', title: 'Rules saved', body: 'New bookings use these settings straight away.' });
    } catch (e: any) { toast({ level: 'warning', title: 'Not saved', body: e.message }); }
  };
  return (
    <Drawer open={!!id} onClose={onClose} width="max-w-[42rem]"
      title={t ? <span className="flex items-center gap-2"><CatIcon name={t.category_icon} className="h-5 w-5" style={{ color: t.dept_color }} />{t.name}</span> : 'Service'}
      subtitle={t ? `${t.category_name}, ${t.setting}, ${t.mode}` : undefined}
      footer={t && <div className="flex justify-between gap-2"><Link href={`/book?type=${t.id}`} className="btn-outline"><CalendarPlus className="h-4 w-4" /> Book this service</Link><button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> Save rules</button></div>}>
      {!t || !f ? <Skeleton className="h-80" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-canvas p-3"><div className="text-xs text-muted">Booked in total</div><div className="text-lg font-semibold text-ink tabnum">{t.stats.total}</div></div>
            <div className="rounded-xl bg-canvas p-3"><div className="text-xs text-muted">Upcoming</div><div className="text-lg font-semibold text-ink tabnum">{t.stats.upcoming ?? 0}</div></div>
            <div className="rounded-xl bg-canvas p-3"><div className="text-xs text-muted">No-shows</div><div className="text-lg font-semibold text-ink tabnum">{t.stats.no_show ?? 0}</div></div>
          </div>
          <section>
            <div className="mb-1 text-sm font-semibold text-ink">Resource segments</div>
            <p className="mb-3 text-xs text-muted">{t.pattern}: {PATTERN_HINT[t.pattern]}. Each bar is held only for its minutes, so other patients can use the resource the rest of the time.</p>
            <SegmentStrip detailed total={t.duration_min} segments={t.requirements.map((r: any) => ({ label: r.label, kind: r.kind, offset: r.offset_min, duration: r.duration_min }))} />
            <div className="mt-3 space-y-1">
              {t.requirements.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 text-xs"><KindIcon kind={r.kind} className="h-3.5 w-3.5" /><span className="flex-1 text-ink">{r.label}</span><span className="text-muted">{r.resource_count} available to choose from</span></div>
              ))}
            </div>
          </section>
          <section className="grid grid-cols-2 gap-3">
            <div><label className="label">Patient duration (min)</label><input type="number" className="field" value={f.duration_min} onChange={e => setF({ ...f, duration_min: e.target.value })} /></div>
            <div><label className="label">Start times every (min)</label><input type="number" className="field" value={f.slot_step_min} onChange={e => setF({ ...f, slot_step_min: e.target.value })} /></div>
            <div><label className="label">Minimum notice (min)</label><input type="number" className="field" value={f.min_notice_min} onChange={e => setF({ ...f, min_notice_min: e.target.value })} /></div>
            <div><label className="label">Book up to (days ahead)</label><input type="number" className="field" value={f.max_advance_days} onChange={e => setF({ ...f, max_advance_days: e.target.value })} /></div>
            <div><label className="label">Earliest start</label><input type="time" className="field" value={f.window_start} onChange={e => setF({ ...f, window_start: e.target.value })} /></div>
            <div><label className="label">Latest start</label><input type="time" className="field" value={f.window_end} onChange={e => setF({ ...f, window_end: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Patient preparation (sent in reminders)</label><textarea className="field h-20 py-2" value={f.prep_instructions} onChange={e => setF({ ...f, prep_instructions: e.target.value })} /></div>
          </section>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="chip">{SLOT_MODEL_LABEL[t.slot_model]}</span>
            {t.recurring ? <span className="chip"><Repeat className="h-3 w-3" /> Usually a course</span> : null}
            {t.requires_consent ? <span className="chip">Consent required</span> : null}
            {t.travel_min ? <span className="chip">{t.travel_min} min travel each way</span> : null}
          </div>
          {t.notes && <p className="text-sm text-muted">{t.notes}</p>}
        </div>
      )}
    </Drawer>
  );
}

function CatalogInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { meta } = useLive();
  const { data: types } = useApi<any[]>('/types');
  const [cat, setCat] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [pattern, setPattern] = useState('');
  const open = sp.get('type') ? Number(sp.get('type')) : null;
  const list = useMemo(() => (types ?? []).filter(t => (!cat || t.category_id === cat) && (!pattern || t.pattern === pattern) && (!q || `${t.name} ${t.category_name} ${t.notes ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [types, cat, q, pattern]);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto"><h1 className="text-xl font-semibold text-ink">Service catalog</h1><p className="text-sm text-muted">{types?.length ?? 185} appointment types, each with the exact people, machines and spaces it holds.</p></div>
        <select className="field w-auto" value={pattern} onChange={e => setPattern(e.target.value)} aria-label="Resource pattern"><option value="">All resource patterns</option>{Object.keys(PATTERN_HINT).map(p => <option key={p}>{p}</option>)}</select>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="field w-60 pl-9" placeholder="Search services" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-1">
        <button className={clsx('chip', !cat && 'chip-on')} onClick={() => setCat(null)}>All categories</button>
        {meta?.categories.map(c => <button key={c.id} className={clsx('chip', cat === c.id && 'chip-on')} onClick={() => setCat(cat === c.id ? null : c.id)}><CatIcon name={c.icon} className="h-3.5 w-3.5" style={{ color: cat === c.id ? undefined : c.color }} />{c.name}<span className="opacity-60">{c.type_count}</span></button>)}
      </div>
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[1.5rem_minmax(12rem,2fr)_minmax(8rem,1fr)_5rem_6rem_minmax(9rem,1.2fr)_minmax(8rem,1fr)] items-center gap-3 border-b border-line bg-canvas px-4 py-2 text-[0.72rem] font-medium text-muted">
          <span /><span>Service</span><span className="hidden md:block">Pattern</span><span>Duration</span><span>Starts every</span><span>Resources held</span><span className="hidden lg:block">Slot model</span>
        </div>
        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto">
          {!types && <div className="space-y-1.5 p-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>}
          {list.map(t => (
            <button key={t.id} onClick={() => router.replace(`/catalog?type=${t.id}`)} className="grid w-full grid-cols-[1.5rem_minmax(12rem,2fr)_minmax(8rem,1fr)_5rem_6rem_minmax(9rem,1.2fr)_minmax(8rem,1fr)] items-center gap-3 border-b border-line/60 px-4 py-2 text-left text-sm hover:bg-canvas">
              <CatIcon name={t.category_icon} className="h-4 w-4" style={{ color: t.dept_color }} />
              <span className="min-w-0"><span className="block truncate text-ink">{t.name}</span><span className="block truncate text-[0.7rem] text-muted">{t.category_name}</span></span>
              <span className="hidden truncate text-xs text-muted md:block">{t.pattern}</span>
              <span className="tabnum">{dur(t.duration_min)}</span>
              <span className="tabnum text-muted">{t.slot_step_min} min</span>
              <span className="flex items-center gap-2"><SegmentStrip total={t.duration_min} segments={t.requirements.map((r: any) => ({ label: r.label, kind: r.kind, offset: r.offset, duration: r.duration }))} /><span className="text-xs text-muted tabnum">{t.requirements.length}</span></span>
              <span className="hidden text-xs text-muted lg:block">{SLOT_MODEL_LABEL[t.slot_model]}</span>
            </button>
          ))}
          {types && !list.length && <div className="p-8 text-center text-sm text-muted">No service matches these filters.</div>}
        </div>
      </div>
      <TypeDrawer id={open} onClose={() => router.replace('/catalog')} />
    </div>
  );
}

export default function CatalogPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><CatalogInner /></Suspense>;
}
