"use client";

import { useEffect, useState } from "react";
import { useFormat } from "../../lib/format";
import { cn } from "../../lib/utils";

import type { ScheduleSlot } from "../../lib/contract";
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';

export type { ScheduleSlot };

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h! * 60 + m!; };

export function ScheduleList({ slots, show = "teacher", isToday = true }: { slots: ScheduleSlot[]; show?: "teacher" | "class"; isToday?: boolean }) {
  const { fmtTime } = useFormat();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()); };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <ol className="divide-y divide-line/70">
      {slots.map((s) => {
        const state = !isToday || now === null ? "next" : now >= toMin(s.end) ? "done" : now >= toMin(s.start) ? "now" : "next";
        return (
          <li key={s.id} className={cn("flex items-center gap-2.5 px-3 py-1.5", state === "now" && "bg-brand/[0.06]", state === "done" && "opacity-55")}>
            <span className="w-10 shrink-0 text-[11px] text-muted tabular">{fmtTime(s.start)}</span>
            <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: s.color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium">{s.subject}</p>
              <p className="truncate text-[11px] text-muted">{show === "teacher" ? s.teacher : s.className} · {s.room}</p>
            </div>
            <span className="text-[10px] text-faint"><ReferenceText message={s.label} /></span>
            {state === "now" && <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-fg"><ReferenceText message="Now" /></span>}
          </li>
        );
      })}
    </ol>
  );
}
