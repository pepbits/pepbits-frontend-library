"use client";
import {SourceButton,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useMemo, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {STATUS,addDays,addMinutes,hhmm,labelHour,minutesOfDay,useMedslotFormat} from "../../lib/format";
import type { Appointment, Status } from "../../lib/types";
import { ResourceCategoryIcon } from "../icons";
import { cx } from "../ui";

export interface CalResource { id: number; name: string; title: string | null; slot_minutes: number; capacity: number; type_name: string; category: "person" | "room" | "bed" | "chair" | "equipment" | "other"; department_name: string; department_color: string; location: string | null }
export interface Grid { resource_id: number; holiday: string | null; windows: { start: string; end: string; slot_minutes: number }[]; blocks: { start: string; end: string }[] }
export interface CalData { from: string; to: string; resources: CalResource[]; grids: Record<string, Record<number, Grid>>; appointments: Appointment[]; holidays: { date: string; name: string; department_id: number | null }[] }

const PPM = 1.6; // pixels per minute: 96px per hour

/** Visible hour range: union of working hours across the shown columns, padded to whole hours. */
function hourRange(grids: Grid[], appts: Appointment[]) {
  let lo = 24 * 60, hi = 0;
  for (const g of grids) for (const w of g.windows) { lo = Math.min(lo, minutesOfDay(w.start)); hi = Math.max(hi, w.end.slice(0, 10) > w.start.slice(0, 10) ? 1440 : minutesOfDay(w.end)); }
  for (const a of appts) { lo = Math.min(lo, minutesOfDay(a.start_at)); hi = Math.max(hi, a.end_at.slice(0, 10) > a.start_at.slice(0, 10) ? 1440 : minutesOfDay(a.end_at)); }
  if (lo >= hi) { lo = 8 * 60; hi = 18 * 60; }
  return [Math.floor(lo / 60) * 60, Math.min(1440, Math.ceil(hi / 60) * 60)] as const;
}

/** Puts overlapping appointments side by side (needed for shared-capacity resources and cancelled ghosts). */
function lanes(items: Appointment[]) {
  const sorted = [...items].sort((a, b) => a.start_at.localeCompare(b.start_at) || b.end_at.localeCompare(a.end_at));
  const out: { a: Appointment; lane: number; of: number }[] = [];
  let cluster: { a: Appointment; lane: number }[] = [], clusterEnd = "";
  const flush = () => { const n = Math.max(1, ...cluster.map((c) => c.lane + 1)); cluster.forEach((c) => out.push({ ...c, of: n })); cluster = []; };
  for (const a of sorted) {
    if (cluster.length && a.start_at >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.a.end_at > a.start_at).map((c) => c.lane));
    let lane = 0; while (used.has(lane)) lane++;
    cluster.push({ a, lane });
    clusterEnd = cluster.length === 1 || a.end_at > clusterEnd ? a.end_at : clusterEnd;
  }
  flush();
  return out;
}

function TimeRail({ lo, hi }: { lo: number; hi: number }) {
  const hours = [];
  for (let m = lo; m < hi; m += 60) hours.push(m);
  return (
    <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-line bg-panel">
      {hours.map((m) => (
        <div key={m} style={{ height: 60 * PPM }} className="relative">
          <span className="tabular absolute -top-2 right-2 bg-panel px-0.5 text-[11px] text-mute">{m === lo ? "" : labelHour(m / 60)}</span>
        </div>
      ))}
    </div>
  );
}

/** One schedulable column: shading for off-hours, blocks, appointments, click-to-book on open time. */
function Column({ date, lo, hi, grid, appts, slot, onOpen, onBook, now, holidayName, header }: {
  date: string; lo: number; hi: number; grid?: Grid; appts: Appointment[]; slot: number; now: string;
  onOpen: (a: Appointment) => void; onBook?: (startAt: string) => void; holidayName?: string | null; header?: ReactNode;
}) {
  const { fmtTime } = useMedslotFormat();
  const [hover, setHover] = useState<number | null>(null);
  const height = (hi - lo) * PPM;
  const y = (dt: string) => ((dt.slice(0, 10) > date ? 1440 : minutesOfDay(dt)) - lo) * PPM;
  const working = (grid?.windows ?? []).map((w) => [minutesOfDay(w.start), w.end.slice(0, 10) > date ? 1440 : minutesOfDay(w.end), w.slot_minutes] as const);
  const closed = holidayName ?? grid?.holiday;
  const laid = useMemo(() => lanes(appts), [appts]);

  const minuteAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = lo + (e.clientY - r.top) / PPM;
    const w = working.find(([s, en]) => m >= s && m < en);
    if (!w) return null;
    const snapped = w[0] + Math.floor((m - w[0]) / w[2]) * w[2];
    return snapped + slot <= w[1] ? snapped : null;
  };
  const free = (m: number) => {
    const s = `${date}T${hhmm(m)}`, e = addMinutes(s, slot);
    if (s < now) return false;
    if (grid?.blocks.some((b) => b.start < e && b.end > s)) return false;
    return appts.filter((a) => !["cancelled", "no_show", "rescheduled"].includes(a.status) && a.start_at < e && a.end_at > s).length === 0;
  };

  return (
    <div className="relative min-w-[168px] flex-1 border-r border-line-2 last:border-r-0">
      {header}
      <div className={cx("relative", onBook && !closed && "cursor-pointer")} style={{ height }}
        onMouseMove={(e) => { if (!onBook || closed) return; const m = minuteAt(e); setHover(m !== null && free(m) ? m : null); }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { if (!onBook || closed || (e.target as HTMLElement).closest("[data-appt]")) return; const m = minuteAt(e); if (m !== null && free(m)) onBook(`${date}T${hhmm(m)}`); }}>
        {/* Off-hours: everything not inside a working window */}
        <div className="hatch absolute inset-0 bg-line-2/40" />
        {!closed && working.map(([s, e], i) => <div key={i} className="absolute inset-x-0 bg-panel" style={{ top: (s - lo) * PPM, height: (e - s) * PPM }} />)}
        {/* Hour and half-hour lines */}
        {Array.from({ length: (hi - lo) / 30 }, (_, i) => <div key={i} className={cx("pointer-events-none absolute inset-x-0 border-t", i % 2 ? "border-dashed border-line-2" : "border-line")} style={{ top: i * 30 * PPM }} />)}
        {grid?.blocks.map((b, i) => (
          <div key={i} className="hatch absolute inset-x-1 rounded-md border border-dashed border-ink/20 bg-line-2/80 px-2 py-1 text-[11px] text-mute" style={{ top: Math.max(0, y(b.start)), height: Math.max(18, Math.min(height, y(b.end)) - Math.max(0, y(b.start))) }}><LocalizedText message="Blocked" /></div>
        ))}
        {closed && <div className="absolute inset-x-2 top-3 rounded-md bg-triage-soft px-2 py-1.5 text-center text-xs font-medium text-triage"><LocalizedText message={"Closed: {value0}"} values={{ value0: (closed) ?? "" }} /></div>}
        {hover !== null && (
          <div className="pointer-events-none absolute inset-x-1 flex items-center gap-1 rounded-md border border-dashed border-scrub bg-scrub-soft/70 px-2 text-[11px] font-medium text-scrub-dark" style={{ top: (hover - lo) * PPM, height: slot * PPM }}>
            <Plus className="size-3" /><LocalizedText message={"Book {value0}"} values={{ value0: (fmtTime(`${date}T${hhmm(hover)}`)) ?? "" }} />
          </div>
        )}
        {laid.map(({ a, lane, of }) => <ApptBlock key={a.id} a={a} top={y(a.start_at)} height={Math.max(20, y(a.end_at) - y(a.start_at))} lane={lane} of={of} onOpen={onOpen} />)}
        {now.slice(0, 10) === date && minutesOfDay(now) >= lo && minutesOfDay(now) <= hi && (
          <div className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-triage" style={{ top: (minutesOfDay(now) - lo) * PPM }}>
            <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-triage" />
          </div>
        )}
      </div>
    </div>
  );
}

function ApptBlock({ a, top, height, lane, of, onOpen }: { a: Appointment; top: number; height: number; lane: number; of: number; onOpen: (a: Appointment) => void }) {
  const { fmtTime } = useMedslotFormat();
  const { t: tr } = useLocalization();
  const s = STATUS[a.status];
  const short = height < 38;
  return (
    <SourceButton data-appt onClick={() => onOpen(a)} title={tr("{value0}–{value1} {value2} {value3}, {value4} ({value5})", { value0: (fmtTime(a.start_at)) ?? "", value1: (fmtTime(a.end_at)) ?? "", value2: (a.first_name) ?? "", value3: (a.last_name) ?? "", value4: (a.service_name) ?? "", value5: tr(s.label ?? "") })}
      className={cx("absolute z-[2] overflow-hidden rounded-md border border-l-[3px] px-1.5 text-left text-[12px] leading-tight shadow-[0_1px_0_rgb(20_33_43/0.04)] transition-shadow hover:z-[3] hover:shadow-md focus-visible:z-[3]", s.block, short ? "py-0.5" : "py-1")}
      style={{ top, height, left: `calc(${(lane / of) * 100}% + 3px)`, width: `calc(${100 / of}% - 6px)`, borderLeftColor: a.department_color }}>
      <span className="flex items-center gap-1">
        <span className="tabular shrink-0 font-semibold">{fmtTime(a.start_at)}</span>
        <span className="truncate font-medium">{a.first_name} {a.last_name}</span>
        {a.priority !== "routine" && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-triage" aria-label={a.priority} />}
      </span>
      {!short && <span className="block truncate text-[11px] opacity-75">{a.service_name}</span>}
      {height > 64 && <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium opacity-80"><span className={cx("size-1.5 rounded-full", s.dot)} /><LocalizedText message={s.label ?? ""} />{a.patient_kind === "new" ? tr(", new patient") : ""}</span>}
    </SourceButton>
  );
}

const ResourceHead = ({ r }: { r: CalResource }) => {
  const { t: tr } = useLocalization(); return (
  <div className="sticky top-0 z-[6] flex h-14 items-center gap-2 border-b border-line bg-panel px-2.5">
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md" style={{ background: r.department_color + "1a", color: r.department_color }}><ResourceCategoryIcon category={r.category} className="size-3.5" /></span>
    <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{r.name}</span><span className="block truncate text-[11px] text-mute"><LocalizedText message={"{value0}, {value1} min"} values={{ value0: (r.type_name) ?? "", value1: (r.slot_minutes) ?? "" }} />{r.capacity > 1 ? tr(", {value0} at once", { value0: (r.capacity) ?? "" }) : ""}</span></span>
  </div>
); };

export function DayView({ data, date, now, hideCancelled, onOpen, onBook }: { data: CalData; date: string; now: string; hideCancelled: boolean; onOpen: (a: Appointment) => void; onBook?: (r: CalResource, startAt: string) => void }) {
  const byRes = (id: number) => data.appointments.filter((a) => a.resources.some((r) => r.id === id) && a.start_at.slice(0, 10) === date && !(hideCancelled && ["cancelled", "no_show"].includes(a.status)));
  const grids = data.resources.map((r) => data.grids[date]?.[r.id]).filter(Boolean) as Grid[];
  const [lo, hi] = hourRange(grids, data.appointments.filter((a) => a.start_at.slice(0, 10) === date));
  return (
    <div className="flex overflow-auto scroll-thin" style={{ maxHeight: "calc(100dvh - 250px)" }}>
      <div className="flex min-w-full">
        <div className="sticky left-0 z-[7] shrink-0"><div className="sticky top-0 z-[8] h-14 w-14 border-b border-r border-line bg-panel" /><TimeRail lo={lo} hi={hi} /></div>
        {data.resources.map((r) => (
          <Column key={r.id} date={date} lo={lo} hi={hi} grid={data.grids[date]?.[r.id]} appts={byRes(r.id)} slot={r.slot_minutes} now={now}
            onOpen={onOpen} onBook={onBook ? (s) => onBook(r, s) : undefined} header={<ResourceHead r={r} />} />
        ))}
      </div>
    </div>
  );
}

export function WeekView({ data, resource, now, hideCancelled, onOpen, onBook }: { data: CalData; resource: CalResource; now: string; hideCancelled: boolean; onOpen: (a: Appointment) => void; onBook?: (r: CalResource, startAt: string) => void }) {
  const { fmtDayNum, fmtWeekday } = useMedslotFormat();
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.from, i));
  const grids = days.map((d) => data.grids[d]?.[resource.id]).filter(Boolean) as Grid[];
  const [lo, hi] = hourRange(grids, data.appointments);
  return (
    <div className="flex overflow-auto scroll-thin" style={{ maxHeight: "calc(100dvh - 250px)" }}>
      <div className="flex min-w-full">
        <div className="sticky left-0 z-[7] shrink-0"><div className="sticky top-0 z-[8] h-14 w-14 border-b border-r border-line bg-panel" /><TimeRail lo={lo} hi={hi} /></div>
        {days.map((d) => {
          const isToday = d === now.slice(0, 10);
          const appts = data.appointments.filter((a) => a.start_at.slice(0, 10) === d && a.resources.some((r) => r.id === resource.id) && !(hideCancelled && ["cancelled", "no_show"].includes(a.status)));
          return (
            <Column key={d} date={d} lo={lo} hi={hi} grid={data.grids[d]?.[resource.id]} appts={appts} slot={resource.slot_minutes} now={now} onOpen={onOpen}
              onBook={onBook ? (s) => onBook(resource, s) : undefined}
              header={
                <div className="sticky top-0 z-[6] flex h-14 items-center justify-center gap-2 border-b border-line bg-panel">
                  <span className="text-xs text-mute">{fmtWeekday(d)}</span>
                  <span className={cx("tabular flex size-8 items-center justify-center rounded-full text-[15px] font-semibold", isToday && "bg-ink text-white")}>{fmtDayNum(d)}</span>
                  <span className="tabular text-[11px] text-mute">{appts.filter((a) => !["cancelled", "no_show"].includes(a.status)).length || ""}</span>
                </div>
              } />
          );
        })}
      </div>
    </div>
  );
}

export function MonthView({ data, month, now, onDay, onOpen }: { data: CalData; month: string; now: string; onDay: (d: string) => void; onOpen: (a: Appointment) => void }) {
  const { fmtDayNum, fmtTime } = useMedslotFormat();
  const days: string[] = [];
  for (let d = data.from; d <= data.to; d = addDays(d, 1)) days.push(d);
  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of data.appointments) { const k = a.start_at.slice(0, 10); m.set(k, [...(m.get(k) ?? []), a]); }
    return m;
  }, [data.appointments]);
  const hol = new Map(data.holidays.filter((h) => !h.department_id).map((h) => [h.date, h.name]));
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="grid min-w-[760px] grid-cols-7 border-l border-t border-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-r border-line bg-paper px-2 py-1.5 text-xs font-medium text-mute">{d}</div>)}
        {days.map((d) => {
          const items = (byDay.get(d) ?? []).filter((a) => a.status !== "rescheduled");
          const active = items.filter((a) => !["cancelled", "no_show"].includes(a.status));
          const counts = active.reduce<Partial<Record<Status, number>>>((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {});
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const isToday = d === now.slice(0, 10);
          return (
            <div key={d} className={cx("group flex min-h-[118px] flex-col gap-1 border-b border-r border-line p-1.5", inMonth ? "bg-panel" : "bg-paper/70")}>
              <SourceButton onClick={() => onDay(d)} className="flex items-center justify-between rounded px-1 hover:bg-line-2">
                <span className={cx("tabular flex size-6 items-center justify-center rounded-full text-[13px] font-semibold", isToday ? "bg-ink text-white" : !inMonth && "text-mute")}>{fmtDayNum(d)}</span>
                {active.length > 0 && <span className="tabular text-[11px] text-mute">{active.length}</span>}
              </SourceButton>
              {hol.get(d) && <span className="truncate rounded bg-triage-soft px-1.5 py-0.5 text-[11px] font-medium text-triage">{hol.get(d)}</span>}
              {active.slice(0, 3).map((a) => (
                <SourceButton key={a.id} onClick={() => onOpen(a)} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-line-2">
                  <span className={cx("size-1.5 shrink-0 rounded-full", STATUS[a.status].dot)} /><span className="tabular text-mute">{fmtTime(a.start_at)}</span><span className="truncate">{a.first_name} {a.last_name[0]}.</span>
                </SourceButton>
              ))}
              {active.length > 3 && <SourceButton onClick={() => onDay(d)} className="px-1 text-left text-[11px] font-medium text-scrub hover:underline">+{active.length - 3} {" "}<LocalizedText message="more" /></SourceButton>}
              {active.length > 0 && (
                <div className="mt-auto flex h-1.5 overflow-hidden rounded-full bg-line-2" aria-hidden>
                  {(Object.keys(counts) as Status[]).map((s) => <span key={s} className={STATUS[s].dot} style={{ width: `${(counts[s]! / active.length) * 100}%` }} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
