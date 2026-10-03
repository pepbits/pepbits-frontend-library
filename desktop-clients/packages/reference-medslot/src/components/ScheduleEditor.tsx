"use client";
import {LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { Copy, Plus, X } from "lucide-react";
import type { ScheduleRow } from "../lib/types";
import { Button, IconButton, Input, Select, cx , TimeInput} from "./ui";

const DAYS = [[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [0, "Sunday"]] as const;
const PRESETS: [string, (slot: number) => ScheduleRow[]][] = [
  ["Weekdays 9–5, lunch 1–2", () => [1, 2, 3, 4, 5].flatMap((d) => [{ weekday: d, start_time: "09:00", end_time: "13:00" }, { weekday: d, start_time: "14:00", end_time: "17:00" }])],
  ["Mon–Sat 8 am–8 pm", () => [1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, start_time: "08:00", end_time: "20:00" }))],
  ["Every day 7 am–10 pm", () => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, start_time: "07:00", end_time: "22:00" }))],
  ["Round the clock", () => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, start_time: "00:00", end_time: "24:00" }))],
];

/** Weekly working hours. Several shifts per day are allowed; each shift may use its own slot length. */
export function ScheduleEditor({ value, onChange, slotMinutes }: { value: ScheduleRow[]; onChange: (rows: ScheduleRow[]) => void; slotMinutes: number }) {
  const { t: tr } = useLocalization();
  const rows = (d: number) => value.filter((r) => r.weekday === d);
  const replaceDay = (d: number, next: ScheduleRow[]) => onChange([...value.filter((r) => r.weekday !== d), ...next]);
  const overlaps = (d: number) => {
    const s = [...rows(d)].sort((a, b) => a.start_time.localeCompare(b.start_time));
    return s.some((r, i) => i > 0 && r.start_time < s[i - 1].end_time) || s.some((r) => r.start_time >= r.end_time);
  };
  const copyMonday = () => {
    const mon = rows(1);
    onChange([...value.filter((r) => ![1, 2, 3, 4, 5].includes(r.weekday)), ...[1, 2, 3, 4, 5].flatMap((d) => mon.map((r) => ({ ...r, id: undefined, weekday: d })))]);
  };
  const hours = value.reduce((m, r) => {
    const [a, b] = [r.start_time, r.end_time].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
    return m + Math.max(0, b - a);
  }, 0) / 60;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-mute"><LocalizedText message="Start from" /></span>
        {PRESETS.map(([l, f]) => <Button key={l} size="sm" variant="secondary" onClick={() => onChange(f(slotMinutes))}>{l}</Button>)}
        <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={copyMonday} disabled={!rows(1).length}><LocalizedText message="Copy Monday to weekdays" /></Button>
      </div>
      <div className="divide-y divide-line-2 rounded-lg border border-line">
        {DAYS.map(([d, name]) => {
          const list = rows(d);
          const bad = overlaps(d);
          return (
            <div key={d} className={cx("flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start", bad && "bg-triage-soft/40")}>
              <div className="flex w-32 shrink-0 items-center justify-between pt-1.5 sm:justify-start">
                <span className="text-sm font-medium">{name}</span>
                {!list.length && <span className="ml-2 text-xs text-mute"><LocalizedText message="Closed" /></span>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {list.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <TimeInput  value={r.start_time} onChange={(e) => replaceDay(d, list.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))} className="h-9 w-[7.25rem]" aria-label={tr("{value0} start", { value0: (name) ?? "" })} />
                    <span className="text-sm text-mute"><LocalizedText message="to" /></span>
                    <TimeInput  value={r.end_time === "24:00" ? "23:59" : r.end_time} onChange={(e) => replaceDay(d, list.map((x, j) => j === i ? { ...x, end_time: e.target.value === "23:59" ? "24:00" : e.target.value } : x))} className="h-9 w-[7.25rem]" aria-label={tr("{value0} end", { value0: (name) ?? "" })} />
                    <span className="flex items-center gap-1">
                    <Select value={r.slot_minutes ?? ""} onChange={(e) => replaceDay(d, list.map((x, j) => j === i ? { ...x, slot_minutes: e.target.value ? Number(e.target.value) : null } : x))} className="h-9 w-40" aria-label="Slot length for this shift">
                      <option value=""><LocalizedText message={"{value0} min (default)"} values={{ value0: (slotMinutes) ?? "" }} /></option>
                      {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}><LocalizedText message={"{value0} min slots"} values={{ value0: (m) ?? "" }} /></option>)}
                    </Select>
                    <IconButton label="Remove shift" onClick={() => replaceDay(d, list.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                    </span>
                  </div>
                ))}
                {bad && <p className="text-xs text-triage"><LocalizedText message={"Shifts on {value0} overlap or end before they start."} values={{ value0: (name) ?? "" }} /></p>}
              </div>
              <Button size="sm" variant="quiet" icon={<Plus className="size-3.5" />} onClick={() => {
                const last = list[list.length - 1];
                replaceDay(d, [...list, last ? { weekday: d, start_time: last.end_time === "24:00" ? "23:00" : last.end_time, end_time: "24:00" } : { weekday: d, start_time: "09:00", end_time: "17:00" }]);
              }}><LocalizedText message="Add shift" /></Button>
            </div>
          );
        })}
      </div>
      <p className="tabular text-xs text-mute"><LocalizedText message={"{value0} working hours a week. Holidays and leave are subtracted automatically."} values={{ value0: (hours.toFixed(1)) ?? "" }} /></p>
    </div>
  );
}

export const scheduleValid = (rows: ScheduleRow[]) => [0, 1, 2, 3, 4, 5, 6].every((d) => {
  const s = rows.filter((r) => r.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
  return s.every((r, i) => r.start_time < r.end_time && (i === 0 || r.start_time >= s[i - 1].end_time));
});
