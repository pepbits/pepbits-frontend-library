'use client';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { Ban, Plus, UserRoundX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { minutes , useFormat} from '../../lib/format';
import { APPT_TONE, PickedSlot, ResourceDay, Slot, SlotBoardData } from './types';

const PPM = 1.7; // pixels per minute: a 15 minute slot is ~26px tall
const PAD = 10; // keeps the first hour hc-label clear of the sticky header

/** Consecutive blocked slots with the same reason render as one block. */
function mergeBlocks(slots: Slot[]): Slot[] {
  const out: Slot[] = [];
  for (const s of slots) {
    const prev = out[out.length - 1];
    if (prev && s.status === 'blocked' && prev.status === 'blocked' && prev.reason === s.reason && prev.end === s.start) out[out.length - 1] = { ...prev, end: s.end };
    else out.push(s);
  }
  return out;
}

/** Time-aligned columns, one per resource. Each resource keeps its own slot length. */
export function SlotBoard({ data, isToday, picked, selectedApptId, onPickSlot, onPickAppointment, rescheduling }: {
  data: SlotBoardData; isToday: boolean; picked: PickedSlot | null; selectedApptId: string | null; rescheduling: boolean;
  onPickSlot: (r: ResourceDay, s: Slot) => void; onPickAppointment: (a: NonNullable<Slot['appointment']>) => void;
}) {
 const {fmtTime}=useFormat();
 const {t}=useLocalization();
  const start = minutes(data.dayStart);
  const end = minutes(data.dayEnd);
  const height = (end - start) * PPM + PAD * 2;
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    // Scroll to the first booking (or "now") so the useful part of the day is on screen.
    const first = data.resources.flatMap((r) => r.slots.filter((s) => s.status !== 'past')).map((s) => minutes(s.start)).sort((a, b) => a - b)[0];
    const target = isToday ? Math.max(start, nowMin - 30) : first ?? start;
    scroller.current?.scrollTo({ top: Math.max(0, (target - start) * PPM - 8) });
  }, [data.date, data.resources.length]); // eslint-disable-hc-line react-hooks/exhaustive-deps

  const hours = useMemo(() => { const h: number[] = []; for (let m = Math.ceil(start / 60) * 60; m <= end; m += 60) h.push(m); return h; }, [start, end]);

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
      <div className="sticky top-0 z-20 flex min-w-max border-b border-hc-line bg-hc-surface">
        <div className="sticky left-0 z-10 w-14 shrink-0 bg-hc-surface" />
        {data.resources.map((r) => (
          <div key={r.id} className="w-[176px] shrink-0 border-l border-hc-line px-2.5 py-1.5">
            <p className="truncate text-hc-sm font-medium" title={r.name}>{r.name}</p>
            <p className="hc-num truncate text-hc-2xs text-hc-ink-mute">{r.departmentName} · {r.slotMinutes} <LocalizedText message="min ·" /> <span className="text-hc-ok-700">{r.free} <LocalizedText message="free" /></span></p>
          </div>
        ))}
      </div>
      <div className="relative flex min-w-max" style={{ height }}>
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-hc-line bg-hc-surface">
          {hours.map((m) => (
            <span key={m} className="hc-num absolute right-2 -translate-y-1/2 text-hc-2xs text-hc-ink-mute" style={{ top: (m - start) * PPM + PAD }}>{fmtTime(`${String(m / 60).padStart(2,'0')}:00`)}</span>
          ))}
        </div>
        {hours.map((m) => <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-hc-line/70" style={{ top: (m - start) * PPM + PAD }} />)}
        {data.resources.map((r) => (
          <div key={r.id} className="relative w-[176px] shrink-0 border-l border-hc-line">
            {r.slots.length === 0 && <div className="hc-hatch absolute inset-0 grid place-items-center text-hc-2xs text-hc-ink-mute"><LocalizedText message="Not working" /></div>}
            {mergeBlocks(r.slots).map((s) => {
              const top = (minutes(s.start) - start) * PPM + PAD;
              const h = Math.max(14, (minutes(s.end) - minutes(s.start)) * PPM - 2);
              const a = s.appointment;
              const isPicked = picked?.resource.id === r.id && picked.slot.start === s.start;
              if (s.status === 'booked' && a) {
                const guest = a.patientType !== 'Registered' || !a.patientId;
                return (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => onPickAppointment(a)}
                    title={t("{v0} {v1} · {v2}",{v0:fmtTime(a.startTime),v1:a.patientName || a.guestName,v2:a.reason})}
                    className={clsx('absolute inset-x-1 flex items-center gap-1 overflow-hidden rounded border-l-[3px] border px-1.5 text-left text-hc-2xs shadow-hc-panel transition-transform hover:z-10 hover:-translate-y-px',
                      APPT_TONE[a.status] ?? 'border-hc-line bg-hc-surface', selectedApptId === a.id && 'ring-2 ring-hc-petrol-500 ring-offset-1')}
                    style={{ top: top + 1, height: h }}
                  >
                    {guest && <UserRoundX className="h-3 w-3 shrink-0 text-hc-selfpay-600" aria-label="No MRN" />}
                    <span className="hc-num shrink-0 font-medium">{fmtTime(a.startTime)}</span>
                    <span className="truncate font-medium">{a.patientName || a.guestName}</span>
                  </button>
                );
              }
              if (s.status === 'blocked') {
                return <div key={s.start} className="hc-hatch absolute inset-x-1 flex items-center gap-1 rounded px-1.5 text-hc-2xs text-hc-ink-mute" style={{ top: top + 1, height: h }} title={s.reason}><Ban className="h-3 w-3" />{s.reason}</div>;
              }
              if (s.status === 'past') return <div key={s.start} className="absolute inset-x-1 rounded bg-hc-canvas/70" style={{ top: top + 1, height: h }} />;
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onPickSlot(r, s)}
                  aria-label={t("{v0} {v1} at {v2}",{v0:rescheduling ? 'Move to' : 'Book',v1:r.name,v2:fmtTime(s.start)})}
                  className={clsx('group absolute inset-x-1 flex items-center gap-1 rounded border border-dashed px-1.5 text-hc-2xs transition-colors',
                    isPicked ? 'border-hc-petrol-500 bg-hc-petrol-100 text-hc-petrol-800' : rescheduling ? 'border-hc-warn-100 bg-hc-warn-50/50 text-hc-warn-700 hover:border-hc-warn-600' : 'border-transparent text-transparent hover:border-hc-petrol-300 hover:bg-hc-petrol-50 hover:text-hc-petrol-700')}
                  style={{ top: top + 1, height: h }}
                >
                  <Plus className="h-3 w-3" /><span className="hc-num">{fmtTime(s.start)}</span>
                </button>
              );
            })}
          </div>
        ))}
        {isToday && nowMin >= start && nowMin <= end && (
          <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMin - start) * PPM + PAD }}>
            <span className="sticky left-0 w-14 pr-1 text-right text-hc-2xs font-semibold text-hc-danger-600"><LocalizedText message="now" /></span>
            <span className="h-px flex-1 bg-hc-danger-600" />
          </div>
        )}
      </div>
    </div>
  );
}
