"use client";

import {useLocalization} from "@pepbits/i18n/react";
import React from "react";
import { TrendingDown, TrendingUp } from "@pepbits/icons";
import { cn } from "@pepbits/ui";

/**
 * A trend, and what it is a trend against.
 *
 * `comparedTo` is required. An arrow saying "+4.3%" with no period is the
 * complaint this component was written to answer: it looks precise and means
 * nothing, and every dashboard ends up guessing a different comparison.
 */
export interface StatTrend {
  direction: "up" | "down" | "flat";
  /** As it should read: "+4.3%", "-8%", "unchanged". */
  delta: string;
  /** "vs last month", "since Monday". Not optional, on purpose. */
  comparedTo: string;
}

/** A KPI tile: what it is, what it is now, and what it was measured against. */
export function StatCard({ label, value, hint, trend, icon, tone = "auto", className }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: StatTrend;
  icon?: React.ReactNode;
  /** "auto" reads up as good. Set it where up is bad — overdue, backlog, waste. */
  tone?: "auto" | "inverse" | "neutral";
  className?: string;
}) {
  const {t} = useLocalization();
  const good = tone === "neutral" ? null
    : tone === "inverse" ? trend?.direction === "down"
      : trend?.direction === "up";

  return (
    <div className={cn("min-w-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[length:calc(9px*var(--fs-scale))] font-black uppercase tracking-[.08em] text-[var(--text-subtle)]">{t(label)}</p>
          <p className="mt-1.5 truncate text-[length:calc(19px*var(--fs-scale))] font-black tracking-[-.02em] text-[var(--text)]">{value}</p>
          {hint ? <p className="mt-1 truncate text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]">{t(hint)}</p> : null}
        </div>
        {icon ? <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">{icon}</span> : null}
      </div>
      {trend ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
          {/* The direction is in the accessible name as a word. Green-good and
              red-bad is invisible to a substantial number of people, and to
              anyone hearing the page rather than seeing it. */}
          <span
            aria-label={`${trend.delta}, ${t(trend.direction === "flat" ? "unchanged" : trend.direction)}`}
            className={cn(
              "inline-flex items-center gap-1 text-[length:calc(9.5px*var(--fs-scale))] font-extrabold",
              good === null ? "text-[var(--text-muted)]" : good ? "text-[var(--success-ink)]" : "text-[var(--danger-ink)]",
            )}
          >
            {trend.direction === "up" ? <TrendingUp aria-hidden className="size-3.5" /> : trend.direction === "down" ? <TrendingDown aria-hidden className="size-3.5" /> : null}
            {trend.delta}
          </span>
          <span className="truncate text-right text-[length:calc(8.5px*var(--fs-scale))] font-semibold text-[var(--text-muted)]">{t(trend.comparedTo)}</span>
        </div>
      ) : null}
    </div>
  );
}
