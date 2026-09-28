'use client';
import { useRouter, cx, statusTone, todayISO, toISO, useFormat, listUrl, useFetch, useEntityApi, Avatar, Button, Drawer, IconButton, Input, Segmented, Spinner, StatusBadge, useToast, DateInput, missingRequired, RecordForm, WorkList, Card, Frame, nounOf, type ListResponse, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useEffect, useMemo, useState } from 'react';
import { newPath, recordPath } from '../../lib/registry';
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Save } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const START = 8 * 60;
const SLOTS = 21; // 08:00 to 18:30
const H = 30; // px per 30 minutes
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const shift = (iso: string, d: number) => { const x = new Date(`${iso}T00:00:00`); x.setDate(x.getDate() + d); return toISO(x); };

const TONE_BG: Record<string, string> = {
  ok: 'bg-ok-soft border-ok/50 text-ok', warn: 'bg-warn-soft border-warn/50 text-warn', info: 'bg-info-soft border-info/50 text-info',
  danger: 'bg-surface-3 border-line-strong text-ink-3 line-through', neutral: 'bg-surface-3 border-line text-ink-2', brand: 'bg-brand-soft border-brand/40 text-brand-ink', violet: 'bg-violet-soft border-violet/40 text-violet',
};

/** Calendar-style booking: resources across, time down, click a free slot to book. */
export default function BookingTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtLocale } = useFormat();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<'day' | 'list'>('day');
  const [hidden, setHidden] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const { data, loading } = useFetch<ListResponse>(`${listUrl(def.entity, { size: 1000, filters: { date: [date] }, sort: 'start', dir: 'asc' })}&_r=${tick}`);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const resources = (def.resources ?? []).filter((r) => !hidden.includes(r));
  const resLabel = def.fields.find((f) => f.key === 'resource')?.label ?? 'Resource';
  const personLabel = def.fields.find((f) => f.key === 'person')?.label ?? 'Person';
  const isToday = date === todayISO();
  const nowTop = ((now.getHours() * 60 + now.getMinutes() - START) / 30) * H;
  const counts = useMemo(() => { const m: Record<string, number> = {}; rows.forEach((r) => (m[r.status] = (m[r.status] ?? 0) + 1)); return m; }, [rows]);
  const upcoming = rows.filter((r) => r.status === 'Booked' && (!isToday || toMin(r.start) >= now.getHours() * 60 + now.getMinutes())).slice(0, 6);

  const refresh = () => setTick((t) => t + 1);
  const book = (resource: string, slot: number) => router.push(newPath(def, { resource, date, start: toTime(START + slot * 30) }));
  const openBooking = (r: Row) => router.push(recordPath(def, r.id));
  const clash = (d: Partial<Row>) => rows.some((r) => r.resource === d.resource && r.status !== 'Cancelled' && r.date === d.date && toMin(String(d.start)) < toMin(r.start) + Number(r.duration) && toMin(r.start) < toMin(String(d.start)) + Number(d.duration || 30));



  const dayLabel = new Date(`${date}T00:00:00`).toLocaleDateString(fmtLocale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Frame>
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label={referenceT("Previous day")} onClick={() => setDate(shift(date, -1))} />
            <Button size="sm" onClick={() => setDate(todayISO())} variant={isToday ? 'subtle' : 'secondary'}><ReferenceText message="Today" /></Button>
            <IconButton icon={ChevronRight} label={referenceT("Next day")} onClick={() => setDate(shift(date, 1))} />
          </div>
          <DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-36" aria-label={referenceT("Date")} />
          <span className="hidden text-[length:calc(14px*var(--fs-scale))] font-semibold md:inline">{dayLabel}</span>
          {loading && <Spinner className="h-4 w-4" />}
          <span className="flex-1" />
          <div className="hidden items-center gap-3 text-[length:calc(12.5px*var(--fs-scale))] text-ink-2 lg:flex">
            {['Booked', 'Checked in', 'Completed', 'Cancelled'].map((s) => (
              <span key={s} className="flex items-center gap-1.5"><span className={cx('h-2.5 w-2.5 rounded-sm border', TONE_BG[statusTone(s)])} />{s} <span className="text-ink-3 tnum">{counts[s] ?? 0}</span></span>
            ))}
          </div>
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'day', icon: CalendarDays, label: 'Schedule' }, { value: 'list', icon: List, label: 'List' }]} />
          <Button variant="primary" icon={Plus} onClick={() => book(resources[0] ?? '', 2)}>{referenceT("New {type}", { type: referenceT(nounOf(def)) })}</Button>
        </div>
        {mode === 'day' && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-line px-3 py-2">
            <span className="mr-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3">{referenceT("{resourceType} availability", { resourceType: referenceT(resLabel) })}</span>
            {(def.resources ?? []).map((r) => {
              const on = !hidden.includes(r);
              return (
                <button key={r} onClick={() => setHidden(on ? [...hidden, r] : hidden.filter((x) => x !== r))} className={cx('flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[length:calc(12.5px*var(--fs-scale))]', on ? 'border-brand/40 bg-brand-soft text-brand-ink' : 'border-line text-ink-3')}>
                  <Avatar name={r} size={16} />{r}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {mode === 'list' ? (
        <Card className="min-h-[420px] flex-1">
          <WorkList def={def} reloadKey={tick} newLabel={referenceT("New {type}", { type: referenceT(nounOf(def)) })} />
        </Card>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          <Card className="min-h-[480px] min-w-0 flex-1">
            <div className="h-full overflow-auto">
              <div className="relative" style={{ minWidth: 56 + resources.length * 170 }}>
                <div className="sticky top-0 z-20 flex border-b border-line bg-surface-2">
                  <div className="sticky left-0 z-10 w-14 shrink-0 bg-surface-2" />
                  {resources.map((r) => (
                    <div key={r} className="flex min-w-[170px] flex-1 items-center gap-2 border-l border-line px-2.5 py-2">
                      <Avatar name={r} size={24} />
                      <div className="min-w-0">
                        <div className="truncate text-[length:calc(12.5px*var(--fs-scale))] font-medium">{r}</div>
                        <div className="text-[length:calc(11px*var(--fs-scale))] text-ink-3 tnum">{rows.filter((b) => b.resource === r && b.status !== 'Cancelled').length} <ReferenceText message="booked" /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="relative flex">
                  <div className="sticky left-0 z-10 w-14 shrink-0 bg-surface">
                    {Array.from({ length: SLOTS }, (_, i) => (
                      <div key={i} style={{ height: H }} className="relative border-b border-line/60 pr-2 text-right text-[length:calc(11px*var(--fs-scale))] text-ink-3 tnum">
                        {i % 2 === 0 && <span className={i ? 'relative -top-1.5' : 'relative top-0.5'}>{toTime(START + i * 30)}</span>}
                      </div>
                    ))}
                  </div>
                  {resources.map((r) => (
                    <div key={r} className="relative min-w-[170px] flex-1 border-l border-line">
                      {Array.from({ length: SLOTS }, (_, i) => (
                        <button key={i} onClick={() => book(r, i)} style={{ height: H }} className={cx('group block w-full border-b text-left', i % 2 ? 'border-line/60' : 'border-line/30')} aria-label={referenceT("Book {value0} at {value1}", {value0: r, value1: toTime(START + i * 30)})}>
                          <span className="hidden pl-2 text-[length:calc(11.5px*var(--fs-scale))] text-brand group-hover:inline">+ {toTime(START + i * 30)}</span>
                        </button>
                      ))}
                      {rows.filter((b) => b.resource === r).map((b) => {
                        const top = ((toMin(b.start) - START) / 30) * H;
                        const height = (Number(b.duration || 30) / 30) * H - 3;
                        return (
                          <button key={b.id} onClick={() => openBooking(b)} className={cx('absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-0.5 text-left shadow-sm transition-transform hover:z-10 hover:scale-[1.02]', TONE_BG[statusTone(b.status)])} style={{ top: top + 1, height }}>
                            <div className="truncate text-[length:calc(12px*var(--fs-scale))] font-semibold">{b.person}</div>
                            {height > 34 && <div className="truncate text-[length:calc(11px*var(--fs-scale))] opacity-80">{b.start} {b.type}</div>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {isToday && nowTop > 0 && nowTop < SLOTS * H && (
                    <div className="pointer-events-none absolute left-14 right-0 z-10 border-t-2 border-accent" style={{ top: nowTop }}>
                      <span className="absolute -left-1.5 -top-[5px] h-2 w-2 rounded-full bg-accent" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
          <Card className="hidden w-64 shrink-0 flex-col xl:flex">
            <div className="border-b border-line px-3.5 py-2.5">
              <div className="text-[length:calc(13px*var(--fs-scale))] font-semibold">{isToday ? referenceT("Up next today") : `Booked on ${fmtDate(date, false)}`}</div>
              <div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{referenceT(resources.length === 1 ? "{count} {bookingType}; {resourceCount} resource" : "{count} {bookingType}; {resourceCount} resources", { count: rows.filter((r) => r.status !== 'Cancelled').length, bookingType: referenceT(def.title), resourceCount: resources.length })}</div>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {upcoming.map((b) => (
                <li key={b.id}>
                  <button onClick={() => openBooking(b)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-surface-2">
                    <span className="w-11 shrink-0 text-[length:calc(13px*var(--fs-scale))] font-semibold tnum">{b.start}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[length:calc(13px*var(--fs-scale))]">{b.person}</span>
                      <span className="block truncate text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{b.resource}</span>
                    </span>
                  </button>
                </li>
              ))}
              {!upcoming.length && <li className="px-3.5 py-6 text-center text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing else booked. Click any free slot to add one." /></li>}
            </ul>
          </Card>
        </div>
      )}

    </Frame>
  );
}
