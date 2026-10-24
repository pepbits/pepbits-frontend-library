'use client';
import React from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {cn} from '@pepbits/ui';
export interface MetricPoint {label:string;value:number;color?:string;compare?:number}
const positive=(value:number|undefined)=>Number.isFinite(value)?Math.max(0,value!):0;
const scale=(max:number|undefined,values:readonly number[])=>Math.max(1,positive(max??Math.max(1,...values)));
/** Nonnegative metrics. Hosts supply units, localized labels and effective number formatting. */
export function BarChart({data,height=140,max,color='var(--primary)',compareLabel='Average',formatValue,className}:{data:readonly MetricPoint[];height?:number;max?:number;color?:string;compareLabel?:string;formatValue:(value:number)=>string;className?:string}){
 const {t}=useLocalization();const top=scale(max,data.flatMap(point=>[positive(point.value),positive(point.compare)]));
 return <div className={cn('flex w-full flex-col',className)} data-bar-chart>
  <div className="relative flex items-end gap-1.5" style={{height:Math.max(1,height)}}>
   {[.25,.5,.75,1].map(part=><div key={part} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--border)]" style={{bottom:`${part*100}%`}}/>)}
   {data.map((point,index)=>{const value=positive(point.value),comparison=positive(point.compare),text=`${t(point.label)}: ${formatValue(value)}${point.compare!==undefined?` · ${t(compareLabel)} ${formatValue(comparison)}`:''}`;return <div key={index} role="img" tabIndex={0} aria-label={text} className="focus-ring group relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
    <div data-metric-bar aria-hidden className="w-full max-w-7 rounded-t-sm" style={{height:`${Math.min(100,value/top*100)}%`,background:point.color??color}}/>
    {point.compare!==undefined&&<div aria-hidden className="w-full max-w-7 rounded-t-sm bg-[var(--border)]" style={{height:`${Math.min(100,comparison/top*100)}%`}}/>}
    <span aria-hidden className="pointer-events-none absolute -top-5 z-10 hidden rounded bg-[var(--text)] px-1.5 py-0.5 whitespace-nowrap text-[var(--surface)] tabular-nums group-hover:block group-focus:block" style={{fontSize:'calc(10px * var(--fs-result,1))'}}>{text}</span>
   </div>;})}
  </div>
  <div className="mt-1 flex gap-1.5">{data.map((point,index)=><span key={index} className="min-w-0 flex-1 truncate text-center text-[var(--text-muted)]" style={{fontSize:'calc(10px * var(--fs-result,1))'}}>{t(point.label)}</span>)}</div>
 </div>;
}
/** Percentage indicator; geometry clamps to 0–100 and the visible label remains host-owned. */
export function ProgressRing({value,size=56,stroke=6,color='var(--primary)',label,formatValue}:{value:number;size?:number;stroke?:number;color?:string;label?:string;formatValue:(value:number)=>string}){
 const diameter=Math.max(1,positive(size)),line=Math.min(diameter,positive(stroke)),radius=(diameter-line)/2,circumference=2*Math.PI*radius,percentage=Math.min(100,positive(value));
 return <div className="relative shrink-0" style={{width:diameter,height:diameter}}><svg aria-hidden width={diameter} height={diameter} className="-rotate-90"><circle cx={diameter/2} cy={diameter/2} r={radius} fill="none" stroke="var(--border)" strokeWidth={line}/><circle data-progress-ring cx={diameter/2} cy={diameter/2} r={radius} fill="none" stroke={color} strokeWidth={line} strokeLinecap="round" strokeDasharray={`${percentage/100*circumference} ${circumference}`}/></svg><span className="absolute inset-0 grid place-items-center font-semibold tabular-nums" style={{fontSize:'calc(11px * var(--fs-result,1))'}}>{label??formatValue(percentage)}</span></div>;
}
export function HorizontalBars({data,max,formatValue}:{data:readonly MetricPoint[];max?:number;formatValue:(value:number)=>string}){
 const {t}=useLocalization();const top=scale(max,data.map(point=>positive(point.value)));
 return <ul className="space-y-1.5">{data.map((point,index)=><li key={index} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2" style={{fontSize:'calc(12px * var(--fs-result,1))'}}><span className="truncate text-[var(--text-muted)]">{t(point.label)}</span><div aria-hidden className="h-2 overflow-hidden rounded-full bg-[var(--border)]"><div data-metric-bar className="h-full rounded-full" style={{width:`${Math.min(100,positive(point.value)/top*100)}%`,background:point.color??'var(--primary)'}}/></div><span className="w-12 text-right font-medium tabular-nums">{formatValue(positive(point.value))}</span></li>)}</ul>;
}
