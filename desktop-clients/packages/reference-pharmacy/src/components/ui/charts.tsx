"use client";
import { useState } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";

/** Paired columns per bucket (e.g. received vs handed over by hour). HTML bars stay crisp at any width. `a` and `b` are the series names (catalog messages). */
export function PairedBars({ data, a, b, labels, height = 140 }: {
  data: { label: string; a: number; b: number }[]; a: string; b: string; labels?: (i: number) => boolean; height?: number;
}) {
  const { t } = useLocalization();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  return (
    <div className="relative" role="img" aria-label={t("{value0} and {value1} per bucket", { value0: t(a), value1: t(b) })}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((g) => <span key={g} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g * 100}%` }} aria-hidden />)}
        {data.map((d, i) => (
          <div key={i} className={cx("relative flex h-full flex-1 items-end justify-center gap-[3px] rounded-sm", hover === i && "bg-surface-3")}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="w-[38%] max-w-3 rounded-t-[2px] bg-line-strong" style={{ height: `${(d.a / max) * 100}%` }} />
            <span className="w-[38%] max-w-3 rounded-t-[2px] bg-cobalt" style={{ height: `${(d.b / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => <span key={i} className="num flex-1 text-center text-[10.5px] text-ink-3">{(labels ? labels(i) : true) ? d.label : ""}</span>)}
      </div>
      {hover !== null && (
        <div className="num pointer-events-none absolute -top-2 z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] shadow-pop" style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 70px), calc(100% - 170px))` }}>
          <span className="font-medium">{data[hover].label}:00</span> <span className="text-ink-3"><LocalizedText message={a} /></span> {data[hover].a}, <span className="text-ink-3"><LocalizedText message={b} /></span> {data[hover].b}
        </div>
      )}
    </div>
  );
}

/** Stacked daily columns, e.g. prescription vs counter revenue. */
export function StackedColumns({ data, height = 120, format }: { data: { label: string; a: number; b: number }[]; height?: number; format: (n: number) => string }) {
  const { t } = useLocalization();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.a + d.b));
  return (
    <div className="relative" role="img" aria-label={t("Daily revenue")}>
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {[0.5, 1].map((g) => <span key={g} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g * 100}%` }} aria-hidden />)}
        {data.map((d, i) => (
          <div key={i} className={cx("relative flex h-full flex-1 flex-col items-center justify-end rounded-sm", hover === i && "bg-surface-3")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="w-3/5 max-w-6 rounded-t-[2px] bg-amber-mark" style={{ height: `${(d.b / max) * 100}%` }} />
            <span className="w-3/5 max-w-6 bg-cobalt" style={{ height: `${(d.a / max) * 100}%` }} />
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="num pointer-events-none absolute -top-3 z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] shadow-pop" style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 90px), calc(100% - 220px))` }}>
          <span className="font-medium">{data[hover].label}</span> <span className="text-ink-3"><LocalizedText message="Rx" /></span> {format(data[hover].a)}, <span className="text-ink-3"><LocalizedText message="counter" /></span> {format(data[hover].b)}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, height = 32, className }: { values: number[]; height?: number; className?: string }) {
  if (values.length < 2) return <div style={{ height }} className={className} />;
  const max = Math.max(1, ...values);
  const W = 100;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${height - 2 - ((height - 4) * v) / max}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={className} style={{ height }} aria-hidden>
      <polygon points={`0,${height} ${pts} ${W},${height}`} fill="var(--cobalt-wash)" />
      <polyline points={pts} fill="none" stroke="var(--cobalt)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Horizontal proportional bar split into segments. Segment labels are catalog messages. */
export function SplitBar({ parts, className }: { parts: { value: number; color: string; label: string }[]; className?: string }) {
  const { t } = useLocalization();
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={cx("flex h-2 overflow-hidden rounded-full bg-surface-3", className)}>
      {parts.map((p) => p.value > 0 && <div key={p.label} title={t("{value0}: {value1}", { value0: t(p.label), value1: p.value })} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
    </div>
  );
}
