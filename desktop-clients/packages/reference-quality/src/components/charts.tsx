"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocalization } from "@pepbits/ops-ui";
import { useQualityFormat } from "../lib/format";
import type { Unit } from "../lib/types";

export const SERIES_COLORS = ["#0e6b5c", "#2b6cb0", "#b7791f", "#805ad5", "#c05621", "#2c7a7b"];
/** Neutrals follow the host theme through the scoped --color-* tokens; series and status colors keep the source palette. */
const axis = { fontSize: 11, fill: "var(--color-ink-3)" };
const GRID = "var(--color-line)";
const tooltipStyle = { borderRadius: 6, border: "1px solid var(--color-line)", background: "var(--color-panel)", color: "var(--color-ink)", fontSize: 12 };

export function TrendChart({
  periods,
  series,
  unit,
  target,
  warning,
  height = 260,
}: {
  periods: string[];
  series: { name: string; values: (number | null)[]; color?: string; emphasis?: boolean }[];
  unit: Unit;
  target?: number;
  warning?: number;
  height?: number;
}) {
  const { fmtPeriod, fmtValue } = useQualityFormat();
  const { t } = useLocalization();
  const data = periods.map((p, i) => Object.fromEntries([["period", p], ...series.map((s) => [s.name, s.values[i]])]));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="period" tickFormatter={(p) => fmtPeriod(p).replace(" 20", " ’")} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} tickFormatter={(v) => (unit === "percent" ? `${v}%` : String(v))} />
          <Tooltip
            formatter={(v: number, name: string) => [fmtValue(v, unit), name]}
            labelFormatter={(p) => fmtPeriod(String(p))}
            contentStyle={tooltipStyle}
          />
          {target !== undefined && <ReferenceLine y={target} stroke="var(--color-ok)" strokeDasharray="4 4" label={{ value: t("Target"), position: "insideTopRight", fill: "var(--color-ok)", fontSize: 11 }} />}
          {warning !== undefined && <ReferenceLine y={warning} stroke="var(--color-warn)" strokeDasharray="2 4" label={{ value: t("Watch"), position: "insideBottomRight", fill: "var(--color-warn)", fontSize: 11 }} />}
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />}
          {series.map((s, i) => (
            <Line
              key={s.name}
              type="linear"
              dataKey={s.name}
              name={t(s.name)}
              stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={s.emphasis ? 2.5 : 1.5}
              dot={s.emphasis ? { r: 2.5 } : false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data,
  xKey,
  bars,
  height = 240,
  colorFor,
  yFormatter,
  reference,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; name: string; color?: string }[];
  height?: number;
  colorFor?: (row: Record<string, unknown>) => string;
  yFormatter?: (v: number) => string;
  reference?: { x?: string; y?: number; label: string };
}) {
  const { t } = useLocalization();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axis} axisLine={false} tickLine={false} width={44} tickFormatter={yFormatter} />
          <Tooltip cursor={{ fill: "color-mix(in srgb, var(--color-ink) 4%, transparent)" }} contentStyle={tooltipStyle} formatter={(v: number, n: string) => [yFormatter ? yFormatter(v) : v, n]} />
          {reference?.y !== undefined && <ReferenceLine y={reference.y} stroke="var(--color-ok)" strokeDasharray="4 4" label={{ value: t(reference.label), position: "insideTopRight", fill: "var(--color-ok)", fontSize: 11 }} />}
          {reference?.x !== undefined && <ReferenceLine x={reference.x} stroke="var(--color-ink)" strokeDasharray="3 3" label={{ value: t(reference.label), position: "top", fill: "var(--color-ink-2)", fontSize: 11 }} />}
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} name={t(b.name)} fill={b.color ?? SERIES_COLORS[i]} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {colorFor && bars.length === 1 && data.map((row, j) => <Cell key={j} fill={colorFor(row)} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
