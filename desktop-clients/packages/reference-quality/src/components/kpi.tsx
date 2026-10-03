"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge, type Tone } from "./ui";
import { STATUS_LABEL, cls, delta } from "../lib/format";
import { useQualityFormat } from "../lib/format";
import type { KpiStatus, Unit } from "../lib/types";

export const STATUS_TONE: Record<KpiStatus, Tone> = { on_target: "ok", warning: "warn", breach: "bad", no_data: "neutral" };
export const STATUS_COLOR: Record<KpiStatus, string> = {
  on_target: "var(--color-ok)",
  warning: "var(--color-warn)",
  breach: "var(--color-bad)",
  no_data: "var(--color-ink-3)",
};

export function KpiStatusBadge({ status }: { status: KpiStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      <LocalizedText message={STATUS_LABEL[status]} />
    </Badge>
  );
}

/**
 * The target band: shows where a value sits relative to the breach, watch and target zones.
 * The scale zooms around the thresholds so a 97.5% vs 98% target is still legible.
 */
export function TargetBand({
  value,
  target,
  warning,
  direction,
  unit,
  compact,
}: {
  value: number | null;
  target: number;
  warning: number;
  direction: "higher" | "lower";
  unit: Unit;
  compact?: boolean;
}) {
  const { t } = useLocalization();
  const { fmtValue } = useQualityFormat();
  const gap = Math.max(Math.abs(target - warning), Math.abs(target) * 0.05, 0.01);
  let lo = Math.min(target, warning, value ?? target) - gap * 1.4;
  let hi = Math.max(target, warning, value ?? target) + gap * 1.4;
  if (unit === "percent") {
    lo = Math.max(0, lo);
    hi = Math.min(100, hi);
  } else lo = Math.max(0, lo);
  const pos = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * 100;
  const tPos = pos(target);
  const wPos = pos(warning);
  const zones =
    direction === "higher"
      ? [
          { from: 0, to: wPos, color: "var(--color-bad)" },
          { from: wPos, to: tPos, color: "var(--color-warn)" },
          { from: tPos, to: 100, color: "var(--color-ok)" },
        ]
      : [
          { from: 0, to: tPos, color: "var(--color-ok)" },
          { from: tPos, to: wPos, color: "var(--color-warn)" },
          { from: wPos, to: 100, color: "var(--color-bad)" },
        ];
  const label = value === null ? t("No data") : t(direction === "higher" ? "{value0} against a target of at least {value1}" : "{value0} against a target of at most {value1}", { value0: fmtValue(value, unit), value1: fmtValue(target, unit) });
  return (
    <div className={cls("relative w-full", compact ? "h-3" : "h-5")} role="img" aria-label={label} title={label}>
      <div className={cls("absolute inset-x-0 overflow-hidden rounded-full", compact ? "top-1 h-1" : "top-2 h-1.5")}>
        {zones.map((z, i) => (
          <span key={i} className="absolute inset-y-0" style={{ left: `${z.from}%`, width: `${Math.max(0, z.to - z.from)}%`, background: z.color, opacity: 0.22 }} />
        ))}
      </div>
      <span className={cls("absolute w-px bg-ink/50", compact ? "top-0 h-3" : "top-0.5 h-4")} style={{ left: `${tPos}%` }} />
      {value !== null && (
        <span
          className={cls("absolute -translate-x-1/2 rounded-full border-2 border-panel shadow-sm", compact ? "top-0 size-3" : "top-1 size-3.5")}
          style={{
            left: `${pos(value)}%`,
            background:
              direction === "higher"
                ? value >= target ? "var(--color-ok)" : value >= warning ? "var(--color-warn)" : "var(--color-bad)"
                : value <= target ? "var(--color-ok)" : value <= warning ? "var(--color-warn)" : "var(--color-bad)",
          }}
        />
      )}
    </div>
  );
}

export function Sparkline({ values, width = 96, height = 28, color = "var(--color-ink-2)", target }: { values: (number | null)[]; width?: number; height?: number; color?: string; target?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden />;
  const all = [...pts.map((p) => p.v), ...(target !== undefined ? [target] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      {target !== undefined && <line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke="var(--color-ink-3)" strokeDasharray="2 3" strokeWidth={1} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.5} fill={color} />
    </svg>
  );
}

export function Delta({ current, previous, direction, unit }: { current: number | null; previous: number | null; direction: "higher" | "lower"; unit: Unit }) {
  const d = delta(current, previous, direction);
  if (!d) return <span className="text-xs text-ink-3"><LocalizedText message="No comparison" /></span>;
  const Icon = d.flat ? Minus : d.d > 0 ? ArrowUpRight : ArrowDownRight;
  const abs = Math.abs(d.d);
  const text = unit === "percent" ? `${abs.toFixed(1)} pts` : unit === "minutes" ? `${abs.toFixed(1)} min` : abs.toFixed(2);
  return (
    <span className={cls("num inline-flex items-center gap-0.5 text-xs font-medium", d.flat ? "text-ink-3" : d.improving ? "text-ok" : "text-bad")}>
      <Icon className="size-3.5" />
      {text}
    </span>
  );
}
