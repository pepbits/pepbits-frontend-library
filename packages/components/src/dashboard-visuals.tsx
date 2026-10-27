'use client';
import {useState, type ReactNode} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {Select} from '@pepbits/ui';
import {Card} from './card';
import type {ChartSeries} from './charts';

const finite = (value:number|undefined) => Number.isFinite(value) ? value! : 0;
const colors = ['var(--primary)', 'var(--warning)', 'var(--info)', 'var(--success)'];

/** Compact operational total. Formatting and units belong to the host. */
export function MetricTile({label,value,hint,color}: {label:string;value:ReactNode;hint?:string;color?:string}) {
 const {t}=useLocalization();
 return <Card shadow="none" data-metric-tile className="relative min-w-0 overflow-hidden px-3.5 py-2.5" style={{'--fs-scale':'var(--fs-result,1)'} as React.CSSProperties}>
  {color&&<span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{background:color}}/>}
  <div data-metric-label className="truncate text-[length:calc(12px*var(--fs-scale))] text-[var(--text-muted)]">{t(label)}</div>
  <div data-metric-value className="mt-0.5 truncate text-[length:calc(18px*var(--fs-scale))] font-semibold tracking-tight tabular-nums">{value}</div>
  {hint&&<div className="truncate text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t(hint)}</div>}
 </Card>;
}

/** Range-normalized spark with a filled baseline; decorative beside a named metric. */
export function RangeSparkline({values,color='var(--success)',fill='color-mix(in srgb, var(--success) 12%, var(--surface))'}:{values:readonly number[];color?:string;fill?:string}) {
 const safe=values.map(finite),min=Math.min(...safe),max=Math.max(...safe);
 const points=safe.map((value,index)=>`${safe.length>1?index/(safe.length-1)*96:48},${28-(value-min)/(max-min||1)*26}`).join(' ');
 return <svg aria-hidden width={96} height={30} viewBox="0 0 96 30" className="shrink-0 overflow-visible"><polygon points={`${points} 96,30 0,30`} fill={fill}/><polyline points={points} fill="none" stroke={color} strokeWidth={1.6}/></svg>;
}

/** Fixed-height plot with source-sized axes and a shared pointer/keyboard inspector. */
export function TrendPlot({label,labels,series,formatAxis,formatValue,height=230}:{label:string;labels:readonly string[];series:readonly ChartSeries[];formatAxis:(value:number)=>string;formatValue:(value:number)=>string;height?:number}) {
 const {t}=useLocalization(),[selected,setSelected]=useState<number|null>(null),index=selected===null?null:Math.min(selected,labels.length-1);
 const max=Math.max(1,...series.flatMap(item=>item.values.map(finite)))*1.1;
 const x=(i:number)=>48+(labels.length>1?i/(labels.length-1):.5)*660,y=(value:number)=>12+(1-finite(value)/max)*192;
 const line=(item:ChartSeries)=>labels.map((_,i)=>`${i?'L':'M'}${x(i)},${y(item.values[i]??0)}`).join(' ');
 return <div data-line-chart data-trend-plot className="relative w-full" style={{height}} onMouseLeave={()=>setSelected(null)}>
  <svg viewBox="0 0 720 230" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={t(label)} onMouseMove={event=>{const box=event.currentTarget.getBoundingClientRect();if(labels.length&&box.width)setSelected(Math.max(0,Math.min(labels.length-1,Math.round(((event.clientX-box.left)/box.width*720-48)/660*(labels.length-1)))));}}>
   {[0,.25,.5,.75,1].map(part=><g key={part}><line x1={48} x2={708} y1={y(part*max)} y2={y(part*max)} stroke="var(--border)" strokeDasharray={part?'3 4':undefined}/><text x={40} y={y(part*max)+4} textAnchor="end" fill="var(--text-muted)" style={{fontSize:'calc(10.5px * var(--fs-result,1))'}}>{formatAxis(part*max)}</text></g>)}
   {labels.map((value,i)=><text key={i} x={x(i)} y={224} textAnchor="middle" fill="var(--text-muted)" style={{fontSize:'calc(10.5px * var(--fs-result,1))'}}>{t(value)}</text>)}
   {series.map((item,i)=><g key={item.id}>{item.fill&&labels.length>0&&<path d={`${line(item)} L${x(labels.length-1)},204 L${x(0)},204 Z`} fill={item.color??colors[i%colors.length]} opacity={.1}/>}<path d={line(item)} fill="none" stroke={item.color??colors[i%colors.length]} strokeWidth={item.dashed?2:2.2} strokeDasharray={item.dashed?'5 4':undefined} vectorEffect="non-scaling-stroke"/></g>)}
   {index!==null&&index>=0&&<g><line x1={x(index)} x2={x(index)} y1={12} y2={204} stroke="var(--text-muted)" vectorEffect="non-scaling-stroke"/>{series.map((item,i)=><circle key={item.id} cx={x(index)} cy={y(item.values[index]??0)} r={4} fill={item.color??colors[i%colors.length]}/>)}</g>}
  </svg>
  {labels.length>0?<div className="absolute start-0 top-0 z-20"><div className="sr-only focus-within:not-sr-only"><Select label={label} value={String(index??0)} options={labels.map((label,value)=>({label,value:String(value)}))} onFocus={()=>setSelected(index??0)} onBlur={()=>setSelected(null)} onChange={event=>setSelected(Number(event.target.value))}/></div></div>:<p>{t('No data')}</p>}
  {index!==null&&index>=0&&<div role="status" data-chart-tooltip className="pointer-events-none absolute top-2 z-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 shadow-[var(--shadow-lg)]" style={{left:`clamp(8px, calc(${x(index)/720*100}% - 70px), calc(100% - 160px))`,fontSize:'calc(12px * var(--fs-result,1))'}}>
   <p className="font-semibold">{t(labels[index]!)}</p><dl>{series.map((item,i)=><div key={item.id} className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{background:item.color??colors[i%colors.length]}}/><dt>{t(item.label)}</dt><dd className="ms-auto ps-3 tabular-nums">{formatValue(finite(item.values[index]))}</dd></div>)}</dl>
  </div>}
 </div>;
}

/** Status distribution with a 140px ring, percentage legend and keyboard inspection. */
export function DonutSummary({label,parts,totalLabel='Total',formatValue,formatPercent}:{label:string;parts:readonly {label:string;value:number;color?:string}[];totalLabel?:string;formatValue:(value:number)=>string;formatPercent:(value:number)=>string}) {
 const {t}=useLocalization(),[focus,setFocus]=useState<number|null>(null),values=parts.map(part=>Math.max(0,finite(part.value))),total=values.reduce((a,b)=>a+b,0),c=2*Math.PI*52;
 let offset=0;
 const selected=focus!==null?parts[focus]:undefined;
 return <div data-donut-chart className="flex h-full flex-col items-center gap-3 sm:flex-row lg:flex-col xl:flex-row"><div className="relative shrink-0">
  <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label={t(label)}><circle cx={70} cy={70} r={52} fill="none" stroke="var(--surface-3)" strokeWidth={18}/>{parts.map((part,i)=>{const length=total?values[i]!/total*c:0,start=offset;offset+=length;return <circle key={part.label} cx={70} cy={70} r={52} fill="none" stroke={part.color??colors[i%colors.length]} strokeWidth={focus===i?22:18} strokeDasharray={`${length} ${c-length}`} strokeDashoffset={-start} transform="rotate(-90 70 70)" onMouseEnter={()=>setFocus(i)} onMouseLeave={()=>setFocus(null)}/>;})}</svg>
  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-live="polite"><div><div className="font-semibold tabular-nums" style={{fontSize:'calc(15px * var(--fs-result,1))'}}>{formatValue(selected?values[focus!]!:total)}</div><div className="text-[var(--text-muted)]" style={{fontSize:'calc(11px * var(--fs-result,1))'}}>{t(selected?.label??totalLabel)}</div></div></div>
 </div><ul className="w-full min-w-0 space-y-1.5" style={{fontSize:'calc(12.5px * var(--fs-result,1))'}}>{parts.map((part,i)=><li key={part.label}><button type="button" className="flex w-full items-center gap-2 rounded-[var(--radius)] px-1.5 py-0.5 text-start hover:bg-[var(--surface-2)] focus:bg-[var(--surface-2)]" onFocus={()=>setFocus(i)} onBlur={()=>setFocus(null)} onMouseEnter={()=>setFocus(i)} onMouseLeave={()=>setFocus(null)} onClick={()=>setFocus(i)} aria-description={formatValue(values[i]!)}><span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{background:part.color??colors[i%colors.length]}}/><span className="flex-1 text-[var(--text-muted)]">{t(part.label)}</span>{' '}<span className="tabular-nums">{formatPercent(total?values[i]!/total*100:0)}</span></button></li>)}</ul></div>;
}
