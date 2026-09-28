"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button, Skeleton } from "../../ui";
import { useApi } from "../../lib/api";
import type { StudentAttendanceMonth } from "../../lib/contract";
import { useFormat } from "../../lib/format";
import { cn, isoDay } from "../../lib/utils";
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const STYLE: Record<string, string> = { P: "bg-ok/15 text-ok", A: "bg-bad/15 text-bad", L: "bg-warn/15 text-warn", E: "bg-info/15 text-info" };
export const ATT_LABEL: Record<string, string> = { P: "Present", A: "Absent", L: "Late", E: "Excused" };

export function AttendanceCalendar({ studentId, compact }: { studentId: string; compact?: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtMonthYear, locale } = useFormat();
  const [month, setMonth] = useState(() => isoDay(new Date()).slice(0, 7));
  const { data, loading } = useApi<StudentAttendanceMonth["data"]>(`/attendance?studentId=${encodeURIComponent(studentId)}&month=${month}`);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const counts = (data ?? []).reduce<Record<string, number>>((a, d) => { if (d.status) a[d.status] = (a[d.status] ?? 0) + 1; return a; }, {});

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Button size="xs" variant="ghost" icon={ChevronLeft} onClick={() => shift(-1)} aria-label={referenceT("Previous month")} />
        <p className="w-28 text-center text-xs font-semibold">{fmtMonthYear(new Date(y, m - 1))}</p>
        <Button size="xs" variant="ghost" icon={ChevronRight} onClick={() => shift(1)} aria-label={referenceT("Next month")} />
        <div className="ml-auto flex flex-wrap gap-2 text-[11px] text-muted">
          {(["P", "A", "L", "E"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1"><span className={cn("size-2.5 rounded-sm", STYLE[k])} />{ATT_LABEL[k]} {counts[k] ?? 0}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
        {Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i))).map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: first }).map((_, i) => <span key={"e" + i} />)}
        {loading && !data
          ? Array.from({ length: 30 }).map((_, i) => <Skeleton key={i} className={compact ? "h-7" : "h-10"} />)
          : (data ?? []).map((d) => (
              <div key={d.date} title={d.status ? ATT_LABEL[d.status] : "No school"}
                className={cn("flex flex-col items-center justify-center rounded text-[11px] tabular", compact ? "h-7" : "h-10", d.status ? STYLE[d.status] : "bg-subtle text-faint")}>
                <span className="font-medium">{Number(d.date.slice(8))}</span>
                {!compact && d.status && <span className="text-[9px]">{ATT_LABEL[d.status]}</span>}
              </div>
            ))}
      </div>
    </div>
  );
}
