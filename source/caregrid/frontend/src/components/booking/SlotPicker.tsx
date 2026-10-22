'use client';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Lightbulb, Zap } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useLive } from '@/lib/live';
import { addDays, niceDate, time, toMin, wd } from '@/lib/time';
import { ErrorNote, KindIcon, Skeleton } from '@/components/ui/primitives';

export interface Assignment { requirement_id: number; resource_id: number; resource_name: string; role_code: string; kind: string; start: string; end: string; hold_start: string; hold_end: string }
export interface Slot { start: string; end: string; assignments: Assignment[]; reserved?: string; score: number }
export interface Availability {
  type: any; days: { date: string; slots: Slot[]; total: number }[]; firstAvailable: Slot | null;
  blockers: { role: string; label: string; count: number }[]; requirements: any[];
}

const PARTS = [['any', 'Any time'], ['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']] as const;
const inPart = (s: string, p: string) => {
  const h = Number(s.slice(11, 13));
  return p === 'any' || (p === 'morning' && h < 12) || (p === 'afternoon' && h >= 12 && h < 17) || (p === 'evening' && h >= 17);
};

export function SlotPicker({ typeId, patientId, priority = 'routine', excludeApptId, preferred, startDate, selected, onPick, onData, compact }: {
  typeId: number; patientId?: number; priority?: 'routine' | 'urgent'; excludeApptId?: number; preferred?: number[]; startDate?: string;
  selected: Slot | null; onPick: (s: Slot | null) => void; onData?: (a: Availability | null) => void; compact?: boolean;
}) {
  const { meta, version } = useLive();
  const today = meta?.today ?? startDate ?? '';
  const [from, setFrom] = useState(startDate ?? today);
  const [data, setData] = useState<Availability | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [part, setPart] = useState<string>('any');
  const [hover, setHover] = useState<Slot | null>(null);
  const span = compact ? 10 : 14;

  useEffect(() => { if (!from && today) setFrom(startDate ?? today); }, [today, from, startDate]);
  useEffect(() => {
    if (!typeId || !from) return;
    let alive = true; setLoading(true); setErr(null);
    api<Availability>('/availability' + qs({ typeId, from, days: span, priority, patientId, excludeAppt: excludeApptId, preferred: preferred?.join(','), limit: 400 }))
      .then(d => {
        if (!alive) return;
        setData(d); onData?.(d);
        const firstDay = d.days.find(x => x.total > 0)?.date ?? null;
        setDay(cur => (cur && d.days.some(x => x.date === cur && x.total > 0) ? cur : firstDay));
      })
      .catch(e => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, from, priority, patientId, excludeApptId, preferred?.join(','), version, span]);

  // keep selection valid after a live refresh
  useEffect(() => {
    if (!selected || !data) return;
    const still = data.days.some(d => d.slots.some(s => s.start === selected.start));
    if (!still) onPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const max = Math.max(1, ...(data?.days.map(d => d.total) ?? [1]));
  const daySlots = useMemo(() => (data?.days.find(d => d.date === day)?.slots ?? []).filter(s => inPart(s.start, part)), [data, day, part]);
  const byHour = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of daySlots) { const h = s.start.slice(11, 13); if (!m.has(h)) m.set(h, []); m.get(h)!.push(s); }
    return [...m.entries()];
  }, [daySlots]);
  const shown = hover ?? selected;

  if (err) return <ErrorNote message={err} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <button className="btn-ghost h-9 w-7 shrink-0 p-0" disabled={!from || from <= today} onClick={() => setFrom(addDays(from, -span))} aria-label="Earlier days"><ChevronLeft className="h-4 w-4" /></button>
        <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
          {(data?.days ?? Array.from({ length: span }, (_, i) => ({ date: from ? addDays(from, i) : String(i), total: -1, slots: [] }))).map(d => {
            const on = d.date === day; const none = d.total === 0;
            return (
              <button key={d.date} disabled={none || d.total < 0} onClick={() => { setDay(d.date); onPick(null); }}
                className={clsx('group flex flex-col items-center rounded-lg border px-0.5 pb-1.5 pt-1 transition',
                  on ? 'border-ink bg-ink text-white' : none ? 'border-transparent bg-canvas text-ink-300' : 'border-line bg-white hover:border-ink-300')}>
                <span className={clsx('text-[0.65rem]', on ? 'text-ink-200' : 'text-muted')}>{d.total >= 0 ? wd(d.date) : ''}</span>
                <span className="text-sm font-semibold tabnum">{d.total >= 0 ? Number(d.date.slice(8)) : ''}</span>
                <span className="mt-1 h-1 w-3/4 overflow-hidden rounded-full bg-ink-100/70">
                  {d.total > 0 && <span className={clsx('block h-full rounded-full', on ? 'bg-marigold-500' : 'bg-teal-500')} style={{ width: `${Math.max(12, (d.total / max) * 100)}%` }} />}
                </span>
              </button>
            );
          })}
        </div>
        <button className="btn-ghost h-9 w-7 shrink-0 p-0" disabled={!from} onClick={() => setFrom(addDays(from, span))} aria-label="Later days"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="seg">{PARTS.map(([k, l]) => <button key={k} data-on={part === k} onClick={() => setPart(k)}>{l}</button>)}</div>
        {data?.firstAvailable && (
          <button className="chip border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-500" onClick={() => { setDay(data.firstAvailable!.start.slice(0, 10)); setPart('any'); onPick(data.firstAvailable); }}>
            <Zap className="h-3.5 w-3.5" /> Next available: {niceDate(data.firstAvailable.start, today)} {time(data.firstAvailable.start)}
          </button>
        )}
      </div>

      {loading && !data ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : data && !data.firstAvailable ? (
        <div className="rounded-xl border border-marigold-100 bg-marigold-50 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-marigold-700"><CalendarClock className="h-4 w-4" /> No free time in these {span} days</div>
          {data.blockers.length > 0 && (
            <div className="mt-2 text-marigold-700">
              Most often blocked by: {data.blockers.map(b => b.label).join(', ')}. Try later dates, switch priority to urgent if clinically needed, or add the patient to the waitlist.
            </div>
          )}
        </div>
      ) : (
        <div className={clsx('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1fr_15rem]')}>
          <div className={clsx('space-y-1.5 overflow-y-auto pr-1', compact ? 'max-h-60' : 'max-h-[42vh]')}>
            {byHour.map(([h, slots]) => (
              <div key={h} className="flex items-start gap-2">
                <div className="w-9 shrink-0 pt-1.5 text-right text-[0.7rem] font-semibold text-muted tabnum">{h}:00</div>
                <div className="flex flex-1 flex-wrap gap-1">
                  {slots.map(s => {
                    const on = selected?.start === s.start;
                    return (
                      <button key={s.start} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)} onClick={() => onPick(on ? null : s)}
                        className={clsx('relative h-8 min-w-[3.6rem] rounded-md border px-2 text-[0.8rem] font-medium tabnum transition',
                          on ? 'border-teal-600 bg-teal-600 text-white shadow-lift' : 'border-line bg-white text-ink hover:border-teal-500 hover:text-teal-700')}>
                        {time(s.start)}
                        {s.reserved && <span className={clsx('absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white', s.reserved === 'urgent' ? 'bg-marigold-500' : 'bg-teal-500')} title={`Uses reserved ${s.reserved} time`} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {day && !byHour.length && <div className="py-6 text-center text-sm text-muted">No free times in this part of the day. Try “Any time”.</div>}
          </div>
          {!compact && (
            <div className="rounded-xl bg-canvas p-3">
              {shown ? (
                <>
                  <div className="text-xs text-muted">{niceDate(shown.start, today)}</div>
                  <div className="text-lg font-semibold text-ink tabnum">{time(shown.start)} to {time(shown.end)}</div>
                  <div className="mt-2 space-y-1.5">
                    {shown.assignments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <KindIcon kind={a.kind} className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-ink">{a.resource_name}</span>
                        <span className="text-muted tabnum">{time(a.start)}{toMin(a.end) - toMin(a.start) >= 1440 ? '+' : `–${time(a.end)}`}</span>
                      </div>
                    ))}
                  </div>
                  {shown.reserved && <div className="mt-2 rounded-lg bg-marigold-50 px-2 py-1.5 text-[0.72rem] text-marigold-700">Uses time reserved for {shown.reserved === 'urgent' ? 'urgent cases' : 'walk-ins'}, released for general booking.</div>}
                </>
              ) : (
                <div className="flex h-full flex-col items-start gap-2 text-xs text-muted">
                  <Lightbulb className="h-4 w-4 text-marigold-500" />
                  Hover a time to see exactly which people, machines and rooms will be reserved.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
