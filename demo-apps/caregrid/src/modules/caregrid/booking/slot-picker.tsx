'use client';
import React, {useEffect, useMemo, useState} from 'react';
import {CalendarClock, ChevronLeft, ChevronRight, Lightbulb, Zap} from '@pepbits/icons';
import {IconButton, Segmented, Skeleton} from '@pepbits/ui';
import {qs} from '../../../adapters/caregrid';
import {useLive} from '../live';
import {useCaregridFormat} from '../format';
import {addDays, toMin} from '../time';
import {KindIcon, QueryError} from '../ui';
import type {Availability, Slot} from '../types';

const PARTS = [['any', 'Any time'], ['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']] as const;
const inPart = (start: string, part: string) => {
  const hour = Number(start.slice(11, 13));
  return part === 'any' || (part === 'morning' && hour < 12) || (part === 'afternoon' && hour >= 12 && hour < 17) || (part === 'evening' && hour >= 17);
};

/** Free times from the server's availability engine; every refresh revalidates the selection. */
export function SlotPicker({typeId, patientId, priority = 'routine', excludeApptId, preferred, startDate, selected, onPick, onData, compact = false}: {
  typeId: number; patientId?: number; priority?: 'routine' | 'urgent'; excludeApptId?: number; preferred?: number[]; startDate?: string;
  selected: Slot | null; onPick: (slot: Slot | null) => void; onData?: (availability: Availability | null) => void; compact?: boolean;
}) {
  const {client, meta, version} = useLive(), f = useCaregridFormat(), {t} = f;
  const today = meta?.today ?? startDate ?? '';
  const span = compact ? 10 : 14;
  const [from, setFrom] = useState(startDate ?? today);
  const [data, setData] = useState<Availability | null>(null), [error, setError] = useState<unknown>(null), [attempt, setAttempt] = useState(0);
  const [day, setDay] = useState<string | null>(null), [part, setPart] = useState('any'), [hover, setHover] = useState<Slot | null>(null);
  const preferredKey = preferred?.join(',');
  useEffect(() => {
    if (!typeId || !from) return;
    const controller = new AbortController();
    setError(null);
    client.request<Availability>('/availability' + qs({typeId, from, days: span, priority, patientId, excludeAppt: excludeApptId, preferred: preferredKey, limit: 400}), {signal: controller.signal}).then(next => {
      if (controller.signal.aborted) return;
      setData(next); onData?.(next);
      const first = next.days.find(d => d.total > 0)?.date ?? null;
      setDay(current => current && next.days.some(d => d.date === current && d.total > 0) ? current : first);
    }, failure => {if (!controller.signal.aborted) setError(failure);});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, typeId, from, priority, patientId, excludeApptId, preferredKey, version, span, attempt]);
  // A live refresh may remove the chosen time; the selection must never outlive availability.
  useEffect(() => {
    if (selected && data && !data.days.some(d => d.slots.some(s => s.start === selected.start))) onPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const max = Math.max(1, ...(data?.days.map(d => d.total) ?? [1]));
  const daySlots = useMemo(() => (data?.days.find(d => d.date === day)?.slots ?? []).filter(s => inPart(s.start, part)), [data, day, part]);
  const byHour = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of daySlots) map.set(slot.start.slice(11, 13), [...(map.get(slot.start.slice(11, 13)) ?? []), slot]);
    return [...map.entries()];
  }, [daySlots]);
  const shown = hover ?? selected;
  if (error) return <QueryError error={error} onRetry={() => setAttempt(n => n + 1)}/>;
  const days = data?.days ?? Array.from({length: span}, (_, i) => ({date: from ? addDays(from, i) : String(i), total: -1, slots: []}));
  return <div className="space-y-3" data-slot-picker>
    <div className="flex items-center gap-1.5">
      <IconButton label={t('Earlier days')} disabled={!from || from <= today} onClick={() => setFrom(addDays(from, -span))}><ChevronLeft className="size-4 rtl:rotate-180"/></IconButton>
      <div role="group" aria-label={t('Days')} className="grid flex-1 gap-1" style={{gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))`}}>
        {days.map(d => {const on = d.date === day, none = d.total === 0; return <button key={d.date} type="button" aria-pressed={on} disabled={none || d.total < 0} onClick={() => {setDay(d.date); onPick(null);}}
          className={`flex flex-col items-center rounded-lg border px-0.5 pb-1.5 pt-1 ${on ? 'border-[var(--primary-fill)] bg-[var(--primary-fill)] text-white' : none ? 'border-transparent bg-[var(--surface-2)] text-[var(--text-muted)]' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'}`}>
          <span className="text-[0.65rem]">{d.total >= 0 ? f.wd(d.date) : ''}</span>
          <span className="text-sm font-semibold tabular-nums">{d.total >= 0 ? f.number(Number(d.date.slice(8))) : ''}</span>
          <span aria-hidden className="mt-1 h-1 w-3/4 overflow-hidden rounded-full bg-[var(--surface-3)]">{d.total > 0 ? <span className="block h-full rounded-full" style={{width: `${Math.max(12, d.total / max * 100)}%`, background: on ? 'var(--warning)' : 'var(--success)'}}/> : null}</span>
          {d.total >= 0 ? <span className="sr-only">{f.niceDate(d.date)}, {t('{count} free times', {count: f.number(d.total)})}</span> : null}
        </button>;})}
      </div>
      <IconButton label={t('Later days')} disabled={!from} onClick={() => setFrom(addDays(from, span))}><ChevronRight className="size-4 rtl:rotate-180"/></IconButton>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Segmented size="sm" label="Part of the day" value={part} onChange={setPart} options={PARTS.map(([value, label]) => ({value, label}))}/>
      {data?.firstAvailable ? <button type="button" className="cg-chip cg-wash-success" onClick={() => {setDay(data.firstAvailable!.start.slice(0, 10)); setPart('any'); onPick(data.firstAvailable);}}>
        <Zap aria-hidden className="size-3.5"/>{t('Next available: {when}', {when: `${f.niceDate(data.firstAvailable.start, today)} ${f.time(data.firstAvailable.start)}`})}
      </button> : null}
    </div>
    {!data ? <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-8"/>)}</div>
      : !data.firstAvailable ? <div className="rounded-[var(--radius)] p-4 text-sm cg-wash-warning" data-no-availability>
        <p className="flex items-center gap-2 font-semibold"><CalendarClock aria-hidden className="size-4"/>{t('No free time in these {count} days', {count: f.number(span)})}</p>
        {data.blockers.length ? <p className="mt-2">{t('Most often blocked by: {list}. Try later dates, switch priority to urgent if clinically needed, or add the patient to the waitlist.', {list: data.blockers.map(b => b.label).join(', ')})}</p> : null}
      </div>
      : <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1fr_15rem]'}`}>
        <div className={`space-y-1.5 overflow-y-auto pe-1 ${compact ? 'max-h-60' : 'max-h-[42vh]'}`}>
          {byHour.map(([hour, slots]) => <div key={hour} className="flex items-start gap-2">
            <div aria-hidden className="w-12 shrink-0 pt-1.5 text-end text-[0.7rem] font-semibold tabular-nums text-[var(--text-muted)]">{f.time(`${hour}:00`)}</div>
            <div role="group" aria-label={f.time(`${hour}:00`)} className="flex flex-1 flex-wrap gap-1">
              {slots.map(slot => {const on = selected?.start === slot.start; return <button key={slot.start} type="button" aria-pressed={on} data-slot={slot.start} onMouseEnter={() => setHover(slot)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(slot)} onBlur={() => setHover(null)} onClick={() => onPick(on ? null : slot)}
                className={`relative h-8 min-w-[3.6rem] rounded-md border px-2 text-[0.8rem] font-medium tabular-nums ${on ? 'border-[var(--primary-fill)] bg-[var(--primary-fill)] text-white' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]'}`}>
                {f.time(slot.start)}
                {slot.reserved ? <><span aria-hidden className="absolute -end-1 -top-1 size-2.5 rounded-full ring-2 ring-[var(--surface)]" style={{background: slot.reserved === 'urgent' ? 'var(--warning)' : 'var(--success)'}}/><span className="sr-only">{t(slot.reserved === 'urgent' ? 'Uses reserved urgent time' : 'Uses reserved walk-in time')}</span></> : null}
              </button>;})}
            </div>
          </div>)}
          {day && !byHour.length ? <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('No free times in this part of the day. Try “Any time”.')}</p> : null}
        </div>
        {!compact ? <div className="rounded-[var(--radius)] bg-[var(--surface-2)] p-3" aria-live="polite">
          {shown ? <>
            <p className="text-xs text-[var(--text-muted)]">{f.niceDate(shown.start, today)}</p>
            <p className="text-lg font-semibold tabular-nums">{t('{from} to {to}', {from: f.time(shown.start), to: f.time(shown.end)})}</p>
            <ul className="mt-2 space-y-1.5">{shown.assignments.map((a, i) => <li key={i} className="flex items-center gap-2 text-xs">
              <KindIcon kind={a.kind} className="size-3.5 shrink-0"/><span className="min-w-0 flex-1 truncate">{a.resource_name}</span>
              <span className="tabular-nums text-[var(--text-muted)]">{f.time(a.start)}{toMin(a.end) - toMin(a.start) >= 1440 ? '+' : `–${f.time(a.end)}`}</span>
            </li>)}</ul>
            {shown.reserved ? <p className="mt-2 rounded-lg px-2 py-1.5 text-[0.72rem] cg-wash-warning">{t(shown.reserved === 'urgent' ? 'Uses time reserved for urgent cases, released for general booking.' : 'Uses time reserved for walk-ins, released for general booking.')}</p> : null}
          </> : <p className="flex flex-col items-start gap-2 text-xs text-[var(--text-muted)]"><Lightbulb aria-hidden className="size-4" style={{color: 'var(--warning)'}}/>{t('Hover or focus a time to see exactly which people, machines and rooms will be reserved.')}</p>}
        </div> : null}
      </div>}
  </div>;
}
