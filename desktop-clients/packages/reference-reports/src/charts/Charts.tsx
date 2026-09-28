"use client";
/*
 * Port of lumen-reports src/components/charts/Charts.tsx (dependency-free SVG bar, line and donut charts).
 * Kept as specialised markup (CMP-04): ops-ui has no chart primitive. Colours are semantic theme tokens,
 * values use the preference formatter, every mark carries a <title> and each chart an accessible name.
 */
import React from 'react';
import { useLocalization } from '@pepbits/ops-ui';
import type { ChartData, ColumnType } from '../types';
import { useReportFormat } from '../ui/preferences';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export const PALETTE = ['var(--primary)', 'var(--info)', 'var(--warning)', 'var(--text-subtle)', 'var(--danger)', 'var(--success)'];
const color = (i: number) => PALETTE[i % PALETTE.length];

interface Props {
  data: ChartData;
  types: Record<string, ColumnType>;
  height?: number;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Legend({ data }: { data: ChartData }) {
  if (data.series.length < 2) return null;
  return (
    <div className="lr-chart-legend">
      {data.series.map((s, i) => (
        <span key={s.key} className="lr-inline">
          <span className="lr-swatch" style={{ background: color(i) }} />
          <ReferenceText message={s.label} />
        </span>
      ))}
    </div>
  );
}

const W = 720;
const PAD = { l: 64, r: 12, t: 12, b: 44 };

function Axis({ max, min, h, type }: { max: number; min: number; h: number; type: ColumnType }) {
  const fmt = useReportFormat();
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.t + (h - PAD.t - PAD.b) * (1 - t);
        const v = min + (max - min) * t;
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} style={{ stroke: 'var(--border)' }} strokeDasharray={t === 0 ? undefined : '3 3'} />
            <text x={PAD.l - 8} y={y + 4} textAnchor="end" className="lr-chart-text">{fmt.value(v, type, true)}</text>
          </g>
        );
      })}
    </g>
  );
}

function xLabel(label: string, x: number, h: number, rotate: boolean) {
  const short = label.length > 14 ? `${label.slice(0, 13)}…` : label;
  return rotate ? (
    <text key={x} x={x} y={h - PAD.b + 14} transform={`rotate(-30 ${x} ${h - PAD.b + 14})`} textAnchor="end" className="lr-chart-text">{short}</text>
  ) : (
    <text key={x} x={x} y={h - PAD.b + 16} textAnchor="middle" className="lr-chart-text">{short}</text>
  );
}

export function BarChart({ data, types, height = 280 }: Props) {
 const referenceT = useReferenceLocalization().t;

  const fmt = useReportFormat();
  const { t } = useLocalization();
  const n = data.labels.length;
  const all = data.series.flatMap((s) => s.values);
  const min = Math.min(0, ...all);
  const max = niceMax(Math.max(...all, 0));
  const plotW = W - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const band = plotW / Math.max(1, n);
  const barW = Math.max(3, (band * 0.72) / data.series.length);
  const y = (v: number) => PAD.t + plotH * (1 - (v - min) / (max - min || 1));
  const rotate = n > 6;
  const t0 = types[data.series[0]?.key] ?? 'number';
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="lr-chart" role="img" aria-label={t('Bar chart of {series}', { series: data.series.map((s) => s.label).join(', ') })}>
        <Axis max={max} min={min} h={height} type={t0} />
        {data.labels.map((label, i) => {
          const x0 = PAD.l + band * i + (band - barW * data.series.length) / 2;
          return (
            <g key={i}>
              {data.series.map((s, si) => {
                const v = s.values[i];
                const top = y(Math.max(0, v));
                const h = Math.abs(y(v) - y(0));
                return (
                  <rect key={s.key} x={x0 + si * barW} y={top} width={barW - 1} height={Math.max(1, h)} rx={2} style={{ fill: color(si) }}>
                    <title>{referenceT("{value0} · {value1}: {value2}", {value0: label, value1: referenceT(s.label), value2: fmt.value(v, types[s.key] ?? 'number')})}</title>
                  </rect>
                );
              })}
              {(n <= 24 || i % Math.ceil(n / 24) === 0) && xLabel(label, PAD.l + band * i + band / 2, height, rotate)}
            </g>
          );
        })}
      </svg>
      <Legend data={data} />
    </div>
  );
}

export function LineChart({ data, types, height = 280 }: Props) {
 const referenceT = useReferenceLocalization().t;

  const fmt = useReportFormat();
  const { t } = useLocalization();
  const n = data.labels.length;
  const all = data.series.flatMap((s) => s.values);
  const lo = Math.min(...all);
  const min = lo >= 0 ? 0 : -niceMax(-lo);
  const max = niceMax(Math.max(...all, 0));
  const plotW = W - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => PAD.t + plotH * (1 - (v - min) / (max - min || 1));
  const every = Math.max(1, Math.ceil(n / 10));
  const t0 = types[data.series[0]?.key] ?? 'number';
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="lr-chart" role="img" aria-label={t('Line chart of {series}', { series: data.series.map((s) => s.label).join(', ') })}>
        <Axis max={max} min={min} h={height} type={t0} />
        {data.series.map((s, si) => (
          <g key={s.key}>
            <polyline fill="none" style={{ stroke: color(si) }} strokeWidth={2} strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {n <= 60 && s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} style={{ fill: 'var(--surface)', stroke: color(si) }} strokeWidth={1.5}>
                <title>{referenceT("{value0} · {value1}: {value2}", {value0: data.labels[i], value1: referenceT(s.label), value2: fmt.value(v, types[s.key] ?? 'number')})}</title>
              </circle>
            ))}
          </g>
        ))}
        {data.labels.map((l, i) => (i % every === 0 || i === n - 1 ? xLabel(l, x(i), height, false) : null))}
      </svg>
      <Legend data={data} />
    </div>
  );
}

export function DonutChart({ data, types }: Props) {
 const referenceT = useReferenceLocalization().t;

  const fmt = useReportFormat();
  const { t } = useLocalization();
  const s = data.series[0];
  if (!s) return null;
  const total = s.values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  let acc = 0;
  const R = 70;
  const r = 44;
  const arcs = s.values.map((v, i) => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += Math.max(0, v);
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => `${90 + rad * Math.cos(a)},${90 + rad * Math.sin(a)}`;
    const d = `M${p(a0, R)} A${R},${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r)} A${r},${r} 0 ${large} 0 ${p(a0, r)} Z`;
    return { d, i, v };
  });
  return (
    <div className="lr-donut">
      <svg viewBox="0 0 180 180" className="lr-donut-svg" role="img" aria-label={t('Donut chart of {series}', { series: s.label })}>
        {arcs.map((a) => (
          <path key={a.i} d={a.d} style={{ fill: color(a.i), stroke: 'var(--surface)' }} strokeWidth={1.5}>
            <title>{referenceT("{value0}: {value1}", {value0: data.labels[a.i], value1: fmt.value(a.v, types[s.key] ?? 'number')})}</title>
          </path>
        ))}
        <text x={90} y={86} textAnchor="middle" className="lr-chart-text lr-chart-text-sm">{t('Total')}</text>
        <text x={90} y={102} textAnchor="middle" className="lr-chart-total">{fmt.value(total, types[s.key] ?? 'number', true)}</text>
      </svg>
      <ul className="lr-donut-legend">
        {data.labels.map((l, i) => (
          <li key={l} className="lr-row lr-nowrap">
            <span className="lr-swatch" style={{ background: color(i) }} />
            <span className="lr-grow lr-truncate">{l}</span>
            <span className="lr-num lr-muted">{fmt.value(Math.round((Math.max(0, s.values[i]) / total) * 1000) / 10, 'percent')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartRenderer({ data, ...rest }: Props) {
  const { t } = useLocalization();
  if (!data.labels.length) return <p className="lr-empty-text lr-center">{t('No data to chart for this period.')}</p>;
  if (data.type === 'line') return <LineChart data={data} {...rest} />;
  if (data.type === 'donut') return <DonutChart data={data} {...rest} />;
  return <BarChart data={data} {...rest} />;
}
