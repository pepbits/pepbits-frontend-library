"use client";
import { useLocalization } from "@pepbits/i18n/react";


import React from "react";
import { cn } from "./cn";

/**
 * Loading placeholders.
 *
 * A skeleton is not decoration: it is a promise about SHAPE. A grey block where
 * a table will be tells the reader the page is arriving and roughly what it will
 * be, so the wait feels shorter than the same wait spent on an empty screen or a
 * spinner that says only "something is happening".
 *
 * That promise is also the constraint. A skeleton that does not resemble what
 * lands is worse than none, because the layout jumps at the exact moment the
 * reader started to trust it — which is why these mirror the real components'
 * spacing rather than being generic bars.
 */
export function Skeleton({ className, rounded = "md" }: { className?: string; rounded?: "sm" | "md" | "full" }) {
  return (
    <span aria-hidden className={cn(
      "block animate-pulse bg-[var(--surface-3)]",
      rounded === "full" ? "rounded-full" : rounded === "sm" ? "rounded" : "rounded-md",
      className,
    )} />
  );
}

/** A worklist: toolbar, then rows. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  const {t: translateCopy} = useLocalization();
  return (
    <div className="grid gap-3 p-4" role="status" aria-label={translateCopy("ui.loading.dc380888")}>
      <div className="flex gap-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-8 w-24" /><span className="flex-1" /><Skeleton className="h-8 w-28" /></div>
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
        <div className="flex gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] p-2.5">
          {["w-36", "w-24", "w-20", "w-16"].map((w) => <Skeleton key={w} className={`h-3 ${w}`} />)}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-[var(--border)] p-2.5 last:border-b-0">
            <Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-44" /><Skeleton className="h-3 w-24" />
            <span className="flex-1" /><Skeleton className="h-5 w-16" rounded="full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A dashboard: KPI cards, then a chart. */
export function DashboardSkeleton() {
  const {t: translateCopy} = useLocalization();
  return (
    <div className="grid gap-3 p-4" role="status" aria-label={translateCopy("ui.loading.dc380888")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <Skeleton className="h-2.5 w-20" /><Skeleton className="mt-2 h-6 w-24" /><Skeleton className="mt-2 h-2 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <Skeleton className="h-3 w-40" /><Skeleton className="mt-3 h-48 w-full" />
      </div>
    </div>
  );
}

/** A record form: sections of label-and-field pairs. */
export function FormSkeleton() {
  const {t: translateCopy} = useLocalization();
  return (
    <div className="grid gap-3 p-4" role="status" aria-label={translateCopy("ui.loading.dc380888")}>
      {Array.from({ length: 3 }, (_, s) => (
        <div key={s} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
          <Skeleton className="h-3 w-36" />
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }, (_, f) => (
              <div key={f}><Skeleton className="h-2 w-20" /><Skeleton className="mt-1.5 h-8 w-full" /></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
