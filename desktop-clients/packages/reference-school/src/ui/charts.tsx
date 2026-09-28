"use client";

import { useState } from "react";
import { cn } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization } from "@pepbits/ops-ui";
import { useFormat } from "../lib/format";

/* Specialized chart markup kept from the source. Values are shown in the host number format and labels, series names
   and legends through the host localization; geometry (heights, coordinates, percentages of the plot) stays numeric. */


/** Vertical bars drawn with CSS so they stay crisp at any width. */
export function BarChart({ data, height = 140, max, suffix = "", color = "var(--brand)", compare, className }: {
  data: { label: string; value: number; color?: string; compare?: number }[]; height?: number; max?: number; suffix?: string; color?: string; compare?: string; className?: string;
}) {
  const { fmtNum } = useFormat();
  const { t } = useLocalization();
  const top = max ?? Math.max(1, ...data.map((d) => Math.max(d.value, d.compare ?? 0))) * 1.1;
  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/70" style={{ bottom: `${g * 100}%` }} />
        ))}
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
            <div className="w-full max-w-7 rounded-t-sm transition-all group-hover:brightness-110" style={{ height: `${(d.value / top) * 100}%`, background: d.color ?? color }} />
            {d.compare !== undefined && <div className="w-full max-w-7 rounded-t-sm bg-line" style={{ height: `${(d.compare / top) * 100}%` }} />}
            <span className="pointer-events-none absolute -top-5 z-10 hidden rounded bg-fg px-1.5 py-0.5 text-[10px] whitespace-nowrap text-surface tabular group-hover:block">
              {fmtNum(d.value)}{suffix}{d.compare !== undefined ? ` · ${t(compare ?? "avg")} ${fmtNum(d.compare)}${suffix}` : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted"><ReferenceText message={d.label} /></span>)}
      </div>
    </div>
  );
}

/** Line/area chart: paths stretch to fill, labels stay in HTML. */
export function LineChart({ series, labels, height = 140, min, max, suffix = "", className }: {
  series: { name: string; values: number[]; color?: string; fill?: boolean }[]; labels: string[]; height?: number; min?: number; max?: number; suffix?: string; className?: string;
}) {
  const { fmtNum } = useFormat();
  const { t } = useLocalization();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  const lo = min ?? Math.floor(Math.min(...all) - 2);
  const hi = max ?? Math.ceil(Math.max(...all) + 2);
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 100;
  const step = Math.ceil(n / 7);
  return (
    <div className={cn("w-full", className)}>
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between text-[10px] text-faint tabular">
          <span>{fmtNum(hi)}{suffix}</span><span>{fmtNum(lo)}{suffix}</span>
        </div>
        <div className="absolute inset-y-1 right-0 left-8">
          {[0, 0.5, 1].map((g) => <div key={g} className="absolute inset-x-0 border-t border-dashed border-line/70" style={{ top: `${g * 100}%` }} />)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {series.map((s) => {
              const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
              const c = s.color ?? "var(--brand)";
              return (
                <g key={s.name}>
                  {s.fill !== false && <polygon points={`0,100 ${pts} 100,100`} fill={c} opacity={0.1} />}
                  <polyline points={pts} fill="none" stroke={c} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </g>
              );
            })}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={100} stroke="var(--faint)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="absolute inset-0 flex">
            {labels.map((l, i) => <div key={l + i} className="h-full flex-1" onMouseEnter={() => setHover(i)} />)}
          </div>
          {hover !== null && (
            <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded border border-line bg-surface px-2 py-1 text-[10px] shadow-md" style={{ left: `${x(hover)}%` }}>
              <p className="font-medium">{t(labels[hover] ?? "")}</p>
              {series.map((s) => <p key={s.name} className="tabular" style={{ color: s.color ?? "var(--brand)" }}>{t(s.name)}: {s.values[hover] === undefined ? "" : fmtNum(s.values[hover]!)}{suffix}</p>)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 ml-8 flex justify-between text-[10px] text-muted">
        {labels.map((l, i) => <span key={l + i} className={i % step === 0 || i === n - 1 ? "" : "invisible"}>{l}</span>)}
      </div>
    </div>
  );
}

export function Donut({ data, size = 120, thickness = 16, center, sub }: {
  data: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: string; sub?: string;
}) {
  const { fmtNum } = useFormat();
  const { t } = useLocalization();
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
          {data.map((d) => {
            const len = (d.value / total) * c;
            const el = <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        {center && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div><p className="text-base font-semibold tabular">{center}</p>{sub && <p className="text-[10px] text-muted">{t(sub)}</p>}</div>
          </div>
        )}
      </div>
      <ul className="min-w-0 space-y-1 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="truncate text-muted"><ReferenceText message={d.label} /></span>
            <span className="ml-auto pl-2 font-medium tabular">{fmtNum(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 6, color = "var(--brand)", label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const { fmtNum } = useFormat();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(Math.min(100, value) / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular">{label ?? `${fmtNum(Math.round(value))}%`}</span>
    </div>
  );
}

export function HBars({ data, suffix = "", max }: { data: { label: string; value: number; color?: string }[]; suffix?: string; max?: number }) {
  const { fmtNum } = useFormat();
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-xs">
          <span className="truncate text-muted"><ReferenceText message={d.label} /></span>
          <div className="h-2 overflow-hidden rounded-full bg-line/60"><div className="h-full rounded-full" style={{ width: `${(d.value / top) * 100}%`, background: d.color ?? "var(--brand)" }} /></div>
          <span className="w-12 text-right font-medium tabular">{fmtNum(d.value)}{suffix}</span>
        </li>
      ))}
    </ul>
  );
}
