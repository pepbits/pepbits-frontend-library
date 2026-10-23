"use client";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { useRcmFormat } from "../../lib/format";

/** Lightweight SVG/CSS charts: no chart library, readable at a glance. The categorical colours are the source's data palette and stay as they are. */

export function Spark({ values, className }: { values: { label: string; value: number }[]; className?: string }) {
  const fmt = useRcmFormat();
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <div className={cx("flex h-full items-end gap-[3px]", className)}>
      {values.map((v, i) => (
        <div key={i} className="group relative flex-1" style={{ height: "100%" }}>
          <div className={cx("absolute bottom-0 w-full rounded-t-[3px] transition-colors", i === values.length - 1 ? "bg-signal-400" : "bg-harbor-600 group-hover:bg-harbor-400")} style={{ height: `${Math.max((v.value / max) * 100, 3)}%` }} />
          <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-harbor-950 px-1.5 py-0.5 text-[10.5px] text-white group-hover:block">{v.label}: {fmt.money(v.value, null, { compact: true })}</span>
        </div>
      ))}
    </div>
  );
}

export function GroupedBars({ data, keys, colors, labels }: { data: Record<string, any>[]; keys: string[]; colors: string[]; labels: (d: Record<string, any>) => string }) {
  const fmt = useRcmFormat();
  const max = Math.max(...data.flatMap((d) => keys.map((k) => d[k] as number)), 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        {ticks.map((tick) => (
          <div key={tick} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${tick * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-muted">{fmt.money(max * tick, null, { compact: true })}</span>
          </div>
        ))}
        <div className="absolute inset-0 left-10 flex items-end gap-3">
          {data.map((d, i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center gap-1">
              {keys.map((k, j) => (
                <div key={k} className="group relative w-full max-w-[22px] rounded-t" style={{ height: `${Math.max((d[k] / max) * 100, 1)}%`, background: colors[j] }}>
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-harbor-950 px-1.5 py-0.5 text-[10.5px] text-white group-hover:block">{fmt.money(d[k], null, { compact: true })}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-10 mt-1.5 flex gap-3">
        {data.map((d, i) => <span key={i} className="flex-1 text-center text-[11px] font-medium text-muted">{labels(d)}</span>)}
      </div>
    </div>
  );
}

export function HBars({ items, color = "#2A4E7C", format }: { items: { label: string; value: number; sub?: string }[]; color?: string; format?: (n: number) => string }) {
  const fmt = useRcmFormat();
  const show = format ?? ((n: number) => fmt.money(n, null, { compact: true }));
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="truncate font-medium">{it.label}{it.sub && <span className="text-muted"> · {it.sub}</span>}</span>
            <span className="shrink-0 font-semibold tabular-nums">{show(it.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-mist"><div className="h-2 rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ items, colors, size = 132, center }: { items: { label: string; value: number }[]; colors: string[]; size?: number; center?: ReactNode }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 132 132" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx="66" cy="66" r={r} fill="none" style={{ stroke: "var(--rc-tint, #EEF2F8)" }} strokeWidth="16" />
        {items.map((it, i) => {
          const len = (it.value / total) * c;
          const el = <circle key={it.label} cx="66" cy="66" r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth="16" strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}

export const PALETTE = ["#1F3D63", "#22A6B3", "#E3A72F", "#2E8C6A", "#3E6CB8", "#C43D39", "#8FA6C4"];
