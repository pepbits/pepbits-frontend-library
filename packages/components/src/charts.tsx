'use client';
import {useState} from 'react';
import {Button, Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
export interface ChartSeries {id:string; label:string; values:readonly number[]; color?:string; dashed?:boolean}
const COLORS = ['var(--primary)','var(--success-ink)','var(--warning-ink)','var(--danger-ink)','var(--text-muted)'];
const finite = (value:number|undefined) => Number.isFinite(value) ? value! : 0;
export function Sparkline({values}: {values:readonly number[]}) {
  const safe = values.map(finite), min = Math.min(0,...safe), max = Math.max(1,...safe);
  const points = safe.map((value,index) => `${safe.length > 1 ? index / (safe.length - 1) * 96 : 48},${28 - (value - min) / (max - min) * 26}`).join(' ');
  return <svg aria-hidden width="96" height="30" viewBox="0 0 96 30"><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="1.6"/></svg>;
}
/** Responsive trend geometry with pointer and native-select inspection. No animation. */
export function LineChart({label,labels,series,formatValue}: {label:string;labels:readonly string[];series:readonly ChartSeries[];formatValue:(value:number)=>string}) {
  const {t} = useLocalization(), [selected,setSelected] = useState(0), index = Math.min(selected,Math.max(0,labels.length - 1));
  const values = series.flatMap(item => item.values.map(finite)), min = Math.min(0,...values), max = Math.max(1,...values), span = max - min;
  const x = (i:number) => 64 + (labels.length > 1 ? i / (labels.length - 1) : .5) * 636, y = (value:number) => 196 - (finite(value) - min) / span * 180;
  return <div className="space-y-2" data-line-chart><svg viewBox="0 0 720 230" className="w-full" role="img" aria-label={t(label)} onMouseMove={event => {if (!labels.length) return;const box = event.currentTarget.getBoundingClientRect();if (box.width) setSelected(Math.max(0,Math.min(labels.length - 1,Math.round(((event.clientX - box.left) / box.width * 720 - 64) / 636 * (labels.length - 1)))));}}>
    {[0,.25,.5,.75,1].map(fraction => {const value = min + fraction * span;return <g key={fraction}><line x1="64" x2="700" y1={y(value)} y2={y(value)} stroke="var(--border)"/><text x="60" y={y(value) + 4} textAnchor="end" style={{fontSize:"calc(10px * var(--fs-result,1))"}} fill="var(--text-muted)">{formatValue(value)}</text></g>;})}
    {labels.map((value,i) => <text key={i} x={x(i)} y="218" textAnchor="middle" style={{fontSize:"calc(11px * var(--fs-result,1))"}} fill="var(--text-muted)">{value}</text>)}
    {series.map((item,i) => <polyline key={item.id} points={labels.map((_,j) => `${x(j)},${y(item.values[j] ?? 0)}`).join(' ')} fill="none" stroke={item.color ?? COLORS[i % COLORS.length]} strokeWidth="2" strokeDasharray={item.dashed ? '5 4' : undefined}/>)}
    {labels.length ? <line x1={x(index)} x2={x(index)} y1="16" y2="196" stroke="var(--text-muted)" strokeDasharray="2 3"/> : null}
  </svg>{labels.length ? <div className="flex flex-wrap items-end gap-3"><Select label={label} value={String(index)} options={labels.map((label,value) => ({value:String(value),label}))} onChange={event => setSelected(Number(event.target.value))}/><dl className="flex flex-wrap gap-3">{series.map(item => <div key={item.id}><dt>{t(item.label)}</dt><dd>{formatValue(finite(item.values[index]))}</dd></div>)}</dl></div> : <p>{t('No data')}</p>}</div>;
}
export function DonutChart({label,parts,formatValue,totalLabel='Total'}: {label:string;totalLabel?:string;parts:readonly {label:string;value:number}[];formatValue:(value:number)=>string}) {
  const {t} = useLocalization(), [focus,setFocus] = useState<number|null>(null), values = parts.map(part => Math.max(0,finite(part.value))), total = values.reduce((sum,value) => sum + value,0), circumference = 2 * Math.PI * 52;
  let offset = 0;
  return <div data-donut-chart className="flex flex-wrap items-center gap-3"><svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={t(label)}><circle cx="70" cy="70" r="52" fill="none" stroke="var(--border)" strokeWidth="18"/>{values.map((value,index) => {const length = total ? value / total * circumference : 0, start = offset;offset += length;return <circle key={index} cx="70" cy="70" r="52" fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={focus === index ? 22 : 18} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 70 70)"/>;})}</svg><div><p aria-live="polite">{formatValue(focus === null ? total : values[focus] ?? total)} · {t(focus === null ? totalLabel : parts[focus]?.label ?? '')}</p><ul>{parts.map((part,index) => <li key={part.label}><Button variant="ghost" onMouseEnter={() => setFocus(index)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(index)} onBlur={() => setFocus(null)} onClick={() => setFocus(index)}>{t(part.label)} · {formatValue(part.value)}</Button></li>)}</ul></div></div>;
}
