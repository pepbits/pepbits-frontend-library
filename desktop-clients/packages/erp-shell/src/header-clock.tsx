"use client";

import {useShellHost} from "./shell-host";
import React, { useMemo } from "react";
import { timezoneForBranch } from "@pepbits/erp-config";
import { useERP } from "./erp-context";
import { useClock } from "./use-clock";

/* Weekday and zone come from Intl rather than from a table: the shell already
   ships Arabic, Hindi and Malayalam, and a hand-written weekday list would be
   English in all four. `language` and not `numberLocale` is the right tag here
   -- one is what the user reads, the other is how digits are grouped. */
function useZoneLabel(language: string, now: Date | null, timeZone: string | undefined): string {
  return useMemo(() => {
    if (!now) return "";
    try {
      const parts = new Intl.DateTimeFormat(language, { timeZoneName: "short", timeZone }).formatToParts(now);
      return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    } catch {
      // An unexpected tag or zone must not take the header down over a label.
      return "";
    }
  }, [language, now, timeZone]);
}

/* The wall-clock reading in `timeZone`, as the "YYYY-MM-DDTHH:MM:SS" string the
   shared formatter already understands. Going through a string is deliberate:
   a Date has no zone of its own, so the only way to hand the formatter Kochi's
   09:15 while the browser sits in Dubai is to spell it out. */
function zonedIso(now: Date, timeZone: string | undefined): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  } catch {
    return now.toISOString().slice(0, 19);
  }
}

/**
 * Header clock: running time, and the date beside it.
 *
 * Both halves render through the shared formatter, so the 12h/24h and date
 * format preferences drive this exactly as they drive every table cell -- a
 * clock that ignored them would be the one place in the app showing a different
 * convention from the rest.
 */
export function HeaderClock() {
  const { preferences, format, branch } = useERP();
  /* One second only when seconds are shown; otherwise the display has minute
     resolution and a per-second timer is 59 wasted renders a minute. */
  const now = useClock(preferences.clockSeconds ? 1000 : 15_000);
  const language = preferences.language;
  /* undefined means "the browser's own zone", which is what Intl does with it. */
  const host=useShellHost();
  const timeZone = preferences.clockZone === "branch" ? (host ? host.branches.find(b=>b.value===branch)?.timezone : timezoneForBranch(branch)) : undefined;
  const zone = useZoneLabel(language, now, timeZone);

  const weekday = useMemo(() => {
    if (!now) return "";
    try {
      return new Intl.DateTimeFormat(language, { weekday: "short", timeZone }).format(now);
    } catch {
      return "";
    }
  }, [language, now, timeZone]);

  const stamp = now ? zonedIso(now, timeZone) : null;
  /* Same character count as a real reading, so the header does not reflow on
     the first tick after hydration. */
  const clock = stamp ? format.time(stamp, { seconds: preferences.clockSeconds }) : (preferences.clockSeconds ? "--:--:--" : "--:--");
  const day = stamp ? format.date(stamp) : "----------";
  const title = stamp ? `${weekday} ${format.dateTime(stamp)}${zone ? ` (${zone})` : ""}${timeZone ? " • branch time" : ""}` : undefined;

  return (
    <div
      title={title}
      aria-label={title}
      className="hidden shrink-0 items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 xl:flex"
    >
      <span className="relative flex size-1.5 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-[var(--success)]" />
        {/* animate-ping, not the shell's .help-pulse: that one draws a box-shadow
            ring sized for a button and reads as a smudge at 6px. Both are
            silenced by [data-reduced-motion="true"] in tokens.css. */}
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--success)] opacity-70" />
      </span>
      <div className="min-w-0 leading-tight">
        {/* tabular-nums is what stops the width jittering as digits change. */}
        <div className="tabular-nums text-[length:calc(11.5px*var(--fs-scale))] font-black tracking-[-.02em] text-[var(--text)]">{clock}</div>
        <div className="truncate text-[length:calc(8.5px*var(--fs-scale))] font-bold text-[var(--text-muted)]">
          {weekday ? `${weekday} • ` : ""}{day}{zone ? ` • ${zone}` : ""}
        </div>
      </div>
    </div>
  );
}
