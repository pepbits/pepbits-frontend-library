'use client';
import {useState} from 'react';
import {Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {ChartSeries} from './charts';
const COLORS = ['var(--primary)','var(--success-ink)','var(--warning-ink)','var(--danger-ink)','var(--text-muted)'];
const finite = (value:number|undefined) => Number.isFinite(value) ? value! : 0;
function niceMax(value:number) {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value))), scaled = value / power;
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
}
/**
 * Grouped bar geometry with a per-mark title, a legend for several series and native-select inspection.
 * Negative values extend below the zero line. No animation, data fetching or formatting of its own.
 */
export function GroupedBarChart({label,labels,series,formatValue,height=280}: {label:string;labels:readonly string[];series:readonly ChartSeries[];formatValue:(value:number)=>string;height?:number}) {
  const {t} = useLocalization(), [selected,setSelected] = useState(0), index = Math.min(selected,Math.max(0,labels.length - 1));
  const values = series.flatMap(item => item.values.map(finite)), min = Math.min(0,...values), max = niceMax(Math.max(0,...values)), span = max - min || 1;
  const left = 64, right = 12, top = 12, bottom = 44, width = 720, plotWidth = width - left - right, plotHeight = height - top - bottom;
  const band = plotWidth / Math.max(1,labels.length), barWidth = Math.max(3,band * .72 / Math.max(1,series.length));
  const y = (value:number) => top + plotHeight * (1 - (finite(value) - min) / span), rotate = labels.length > 6, every = Math.max(1,Math.ceil(labels.length / 24));
  const color = (item:ChartSeries,i:number) => item.color ?? COLORS[i % COLORS.length];
  return <div className="space-y-2" data-bar-chart><svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={t(label)}>
    {[0,.25,.5,.75,1].map(fraction => {const value = min + fraction * span, at = y(value);return <g key={fraction}><line x1={left} x2={width - right} y1={at} y2={at} stroke="var(--border)" strokeDasharray={fraction ? '3 3' : undefined}/><text x={left - 8} y={at + 4} textAnchor="end" style={{fontSize:'calc(10px * var(--fs-result,1))'}} fill="var(--text-muted)">{formatValue(value)}</text></g>;})}
    {labels.length ? <rect x={left + band * index} y={top} width={band} height={plotHeight} fill="var(--primary-soft)" opacity=".5"/> : null}
    {labels.map((name,i) => {const start = left + band * i + (band - barWidth * series.length) / 2, center = left + band * i + band / 2, short = name.length > 14 ? name.slice(0,13) + '…' : name;
      return <g key={i}>{series.map((item,s) => {const value = finite(item.values[i]), from = y(Math.max(0,value));return <rect key={item.id} x={start + s * barWidth} y={from} width={Math.max(1,barWidth - 1)} height={Math.max(1,Math.abs(y(value) - y(0)))} rx="2" fill={color(item,s)}><title>{`${name} · ${t(item.label)}: ${formatValue(value)}`}</title></rect>;})}
        {i % every === 0 ? <text x={center} y={height - bottom + (rotate ? 14 : 16)} textAnchor={rotate ? 'end' : 'middle'} transform={rotate ? `rotate(-30 ${center} ${height - bottom + 14})` : undefined} style={{fontSize:'calc(11px * var(--fs-result,1))'}} fill="var(--text-muted)">{short}</text> : null}</g>;})}
  </svg>
  {series.length > 1 ? <ul className="flex flex-wrap gap-3" aria-label={t('Legend')}>{series.map((item,i) => <li key={item.id} className="flex items-center gap-1"><span aria-hidden style={{display:'inline-block',width:10,height:10,borderRadius:2,background:color(item,i)}}/>{t(item.label)}</li>)}</ul> : null}
  {labels.length ? <div className="flex flex-wrap items-end gap-3"><Select label={label} value={String(index)} options={labels.map((name,value) => ({value:String(value),label:name}))} onChange={event => setSelected(Number(event.target.value))}/><dl className="flex flex-wrap gap-3">{series.map(item => <div key={item.id}><dt>{t(item.label)}</dt><dd>{formatValue(finite(item.values[index]))}</dd></div>)}</dl></div> : <p>{t('No data')}</p>}</div>;
}
