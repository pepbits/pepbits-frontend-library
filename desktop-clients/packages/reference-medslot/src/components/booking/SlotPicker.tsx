"use client";
import {SourceButton,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Sunrise, Sun, Moon } from "lucide-react";
import { qs } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import {addDays,duration,minutesOfDay,useMedslotFormat} from "../../lib/format";
import type { Availability, Slot } from "../../lib/types";
import { ErrorNote, IconButton, Select, Skeleton, cx } from "../ui";

const SPAN = 14;

export interface SlotPickerProps {
  serviceId: number;
  value: Slot | null;
  onChange: (s: Slot | null) => void;
  resourceId?: number;
  onResourceChange?: (id: number | undefined) => void;
  durationMinutes?: number;
  onDurationChange?: (m: number) => void;
  excludeAppointmentId?: number;
  initialDate?: string;
  refreshKey?: number;
  /** Pre-select this start time once, if it's offered (used by click-to-book on the calendar). */
  autoSelect?: string;
}

/**
 * Two-week date strip with slot counts, then the day's times grouped by part of day.
 * Duration can be extended in steps of the resource's slot length; every change re-checks availability.
 */
export function SlotPicker(p: SlotPickerProps) {
  const { fmtDayNum, fmtLongDay, fmtTime, fmtWeekday } = useMedslotFormat();
  const { t: tr } = useLocalization();
  const [from, setFrom] = useState<string | null>(p.initialDate ?? null);
  const [day, setDay] = useState<string | null>(p.initialDate ?? null);
  const path = `/availability${qs({ service_id: p.serviceId, from: from ?? undefined, days: SPAN, resource_id: p.resourceId, duration_minutes: p.durationMinutes, exclude_appointment_id: p.excludeAppointmentId, _: p.refreshKey })}`;
  const { data, error, loading, reload } = useApi<Availability>(path);

  // First load: anchor the strip on the facility's today and jump to the first day with openings.
  useEffect(() => {
    if (!data) return;
    if (!from) setFrom(data.now.slice(0, 10));
    if (!day || !data.days.some((d) => d.date === day)) {
      const first = data.days.find((d) => d.slots.length) ?? data.days[0];
      if (first) setDay(first.date);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const [auto, setAuto] = useState(p.autoSelect);
  useEffect(() => {
    if (!data || !auto) return;
    const hit = data.days.flatMap((d) => d.slots).find((s) => s.start === auto && (!p.resourceId || s.resources[0].id === p.resourceId));
    if (hit) p.onChange(hit);
    setAuto(undefined);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop a selected slot that is no longer offered (duration or resource changed).
  useEffect(() => {
    if (!data || !p.value) return;
    const still = data.days.flatMap((d) => d.slots).some((s) => s.start === p.value!.start && s.resources[0].id === p.value!.resources[0].id);
    if (!still) p.onChange(null);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const primary = data?.requirements[0];
  const step = useMemo(() => {
    const c = primary?.candidates.find((x) => x.id === p.resourceId) ?? primary?.candidates[0];
    return c?.slot_minutes ?? 15;
  }, [primary, p.resourceId]);
  const base = data?.service.duration_minutes ?? 15;
  const dur = p.durationMinutes ?? base;
  const today = data?.now.slice(0, 10);
  const dayData = data?.days.find((d) => d.date === day);

  // With "any" resource, show each time once and pick the first free resource for it.
  const times = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of dayData?.slots ?? []) m.set(s.start, [...(m.get(s.start) ?? []), s]);
    return Array.from(m.entries());
  }, [dayData]);
  const groups: [string, typeof Sunrise, [string, Slot[]][]][] = [
    ["Morning", Sunrise, times.filter(([t]) => minutesOfDay(t) < 12 * 60)],
    ["Afternoon", Sun, times.filter(([t]) => minutesOfDay(t) >= 12 * 60 && minutesOfDay(t) < 17 * 60)],
    ["Evening", Moon, times.filter(([t]) => minutesOfDay(t) >= 17 * 60)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {primary && primary.candidates.length > 1 && p.onResourceChange && (
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            {primary.role}
            <Select value={p.resourceId ?? ""} onChange={(e) => p.onResourceChange!(e.target.value ? Number(e.target.value) : undefined)}>
              <option value=""><LocalizedText message="Any available" /></option>
              {primary.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </label>
        )}
        {p.onDurationChange && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2"><LocalizedText message="Length" /></span>
            <div className="flex h-10 items-center rounded-[var(--radius-ctl)] border border-line bg-panel">
              <IconButton label="Shorter" disabled={dur - step < Math.min(base, step)} onClick={() => p.onDurationChange!(dur - step)} className="size-10 rounded-r-none"><Minus className="size-4" /></IconButton>
              <span className="tabular w-24 text-center text-sm font-medium">{duration(dur)}</span>
              <IconButton label="Longer" disabled={dur + step > 720} onClick={() => p.onDurationChange!(dur + step)} className="size-10 rounded-l-none"><Plus className="size-4" /></IconButton>
            </div>
          </div>
        )}
        {data && data.requirements.length > 1 && (
          <p className="basis-full text-xs text-mute"><LocalizedText message={"Each time shown has every required resource free together: {value0}."} values={{ value0: (data.requirements.map((r) => r.type_name.toLowerCase()).join(", ")) ?? "" }} /></p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Previous two weeks" disabled={!from || !today || from <= today} onClick={() => from && setFrom(addDays(from, -SPAN) < today! ? today! : addDays(from, -SPAN))}><ChevronLeft className="size-5" /></IconButton>
        <div className="grid flex-1 grid-cols-7 gap-1 sm:grid-cols-14">
          {(data?.days ?? Array.from({ length: SPAN }, (_, i) => ({ date: addDays(from ?? "2000-01-01", i), closed: null, slots: [] }))).map((d) => {
            const n = new Set(d.slots.map((s) => s.start)).size;
            const on = d.date === day;
            return (
              <SourceButton key={d.date} onClick={() => setDay(d.date)} disabled={!data}
                className={cx("flex flex-col items-center rounded-lg border py-1.5 transition-colors",
                  on ? "border-ink bg-ink text-white" : n ? "border-line bg-panel hover:border-scrub" : "border-transparent bg-line-2/60 text-mute")}>
                <span className={cx("text-[11px]", on ? "text-white/70" : "text-mute")}>{fmtWeekday(d.date)}</span>
                <span className="tabular text-[15px] font-semibold leading-tight">{fmtDayNum(d.date)}</span>
                <span className={cx("tabular text-[10px] font-medium", on ? "text-[#7fe0c9]" : d.closed ? "text-triage" : n ? "text-scrub" : "")}>
                  {!data ? "\u00a0" : d.closed ? tr("Closed") : n ? tr("{value0} open", { value0: (n) ?? "" }) : tr("Full")}
                </span>
              </SourceButton>
            );
          })}
        </div>
        <IconButton label="Next two weeks" disabled={!from} onClick={() => from && setFrom(addDays(from, SPAN))}><ChevronRight className="size-5" /></IconButton>
      </div>

      <ErrorNote error={error} onRetry={reload} />

      <div className="min-h-40">
        {loading && !data ? <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{[...Array(16)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : dayData?.closed ? <p className="rounded-lg bg-triage-soft px-4 py-6 text-center text-sm text-triage"><LocalizedText message={"Closed on {value0}: {value1}."} values={{ value0: (fmtLongDay(dayData.date)) ?? "", value1: (dayData.closed) ?? "" }} /></p>
          : times.length === 0 ? <p className="rounded-lg bg-line-2/60 px-4 py-6 text-center text-sm text-mute"><LocalizedText message="No openings on" />{" "}{day ? fmtLongDay(day) : tr("this day")}<LocalizedText message=". Pick another day" />{p.resourceId ? tr(" or choose “Any available”") : ""}.</p>
          : (
            <div className={cx("flex flex-col gap-4 transition-opacity", loading && "opacity-50")}>
              {groups.filter(([, , g]) => g.length).map(([label, Icon, g]) => (
                <div key={label}>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-mute"><Icon className="size-3.5" />{label}<span className="tabular">({g.length})</span></p>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
                    {g.map(([t, opts]) => {
                      const sel = p.value?.start === t;
                      return (
                        <SourceButton key={t} onClick={() => p.onChange(sel ? null : opts[0])} aria-pressed={sel}
                          title={opts.map((o) => o.resources.map((r) => r.name).join(" + ")).join("\n")}
                          className={cx("tabular relative h-10 rounded-lg border text-sm font-medium transition-all",
                            sel ? "border-scrub bg-scrub text-white shadow-sm" : "border-line bg-panel hover:border-scrub hover:text-scrub")}>
                          {fmtTime(t)}
                          {!p.resourceId && opts.length > 1 && <span className={cx("absolute -right-1 -top-1 rounded-full px-1 text-[10px] leading-4", sel ? "bg-ink text-white" : "bg-line-2 text-ink-2")}>{opts.length}</span>}
                        </SourceButton>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
