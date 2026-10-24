'use client';
import {useState, type ReactNode} from 'react';
import {Button, Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
export interface ChartSeries {id:string; label:string; values:readonly number[]; color?:string; dashed?:boolean; fill?:boolean}
const COLORS = ['var(--primary)','var(--success-ink)','var(--warning-ink)','var(--danger-ink)','var(--text-muted)'];
const finite = (value:number|undefined) => Number.isFinite(value) ? value! : 0;
export function Sparkline({values}: {values:readonly number[]}) {
  const safe = values.map(finite), min = Math.min(0,...safe), max = Math.max(1,...safe);
  const points = safe.map((value,index) => `${safe.length > 1 ? index / (safe.length - 1) * 96 : 48},${28 - (value - min) / (max - min) * 26}`).join(' ');
  return <svg aria-hidden width="96" height="30" viewBox="0 0 96 30"><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="1.6"/></svg>;
}
/** Responsive trend geometry with pointer and native-select inspection. No animation. */
export function LineChart({label,labels,series,formatValue,layout='standard',height=140,min:lower,max:upper}: {label:string;labels:readonly string[];series:readonly ChartSeries[];formatValue:(value:number)=>string;layout?:'standard'|'compact';height?:number;min?:number;max?:number}) {
  const {t,direction} = useLocalization(), [selected,setSelected] = useState(0), index = Math.min(selected,Math.max(0,labels.length - 1));
  const [inspecting,setInspecting] = useState(false);
  if (layout === 'compact') {
    const values = series.flatMap(item => item.values.map(finite));
    const lo = Number.isFinite(lower) ? lower! : Math.floor(Math.min(...(values.length ? values : [0])) - 2);
    const hi = Number.isFinite(upper) ? upper! : Math.ceil(Math.max(...(values.length ? values : [0])) + 2);
    const span = hi - lo || 1, position = (i:number) => labels.length <= 1 ? 50 : i / (labels.length - 1) * 100;
    const x = (i:number) => direction === 'rtl' ? 100 - position(i) : position(i);
    const y = (value:number) => 100 - (finite(value) - lo) / span * 100, step = Math.max(1,Math.ceil(labels.length / 7));
    return <div className="w-full" data-line-chart data-chart-layout="compact">
      <div className="relative" data-chart-plot style={{height:Math.max(1,finite(height))}} onMouseLeave={()=>setInspecting(false)}>
        <div className="pointer-events-none absolute inset-y-0 start-0 flex flex-col justify-between tabular-nums" style={{fontSize:'calc(10px * var(--fs-result,1))',color:'var(--text-subtle)'}}><span>{formatValue(hi)}</span><span>{formatValue(lo)}</span></div>
        <div className="absolute inset-y-1 end-0 start-8">
          {[0,.5,1].map(fraction=><div key={fraction} className="absolute inset-x-0 border-t border-dashed" style={{top:`${fraction*100}%`,borderColor:'color-mix(in oklab, var(--border) 70%, transparent)'}}/>)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={t(label)}>
            {series.map((item,i)=>{const points=item.values.map((value,j)=>`${x(j)},${y(value)}`).join(' '),color=item.color??COLORS[i%COLORS.length];return <g key={item.id}>
              {item.fill!==false&&<polygon points={`${direction==='rtl'?'100,100':'0,100'} ${points} ${direction==='rtl'?'0,100':'100,100'}`} fill={color} opacity={.1}/>}
              <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray={item.dashed?'5 4':undefined}/>
            </g>;})}
            {inspecting&&labels.length>0&&<line x1={x(index)} x2={x(index)} y1="0" y2="100" stroke="var(--text-subtle)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"/>}
          </svg>
          <div className="absolute inset-0 flex" aria-hidden>{labels.map((value,i)=><div key={i} className="h-full flex-1" onMouseEnter={()=>{setSelected(i);setInspecting(true);}}/>)}</div>
          {labels.length>0&&<div className="absolute start-0 top-0 z-10">
            <div className="sr-only focus-within:not-sr-only"><Select className="[--fs-scale:var(--fs-form)]" label={label} value={String(index)} options={labels.map((label,value)=>({value:String(value),label}))} onFocus={()=>setInspecting(true)} onBlur={()=>setInspecting(false)} onChange={event=>{setSelected(Number(event.target.value));setInspecting(true);}}/></div>
          </div>}
          {inspecting&&labels.length>0&&<div role="status" className="pointer-events-none absolute top-0 z-10 rounded border px-2 py-1 shadow-md" style={{insetInlineStart:`${Math.min(75,position(index))}%`,borderColor:'var(--border)',background:'var(--surface)',fontSize:'calc(10px * var(--fs-result,1))'}}><p className="font-medium">{t(labels[index]??'')}</p><dl>{series.map(item=><div key={item.id} className="flex gap-1 tabular-nums"><dt>{t(item.label)}:</dt><dd>{formatValue(finite(item.values[index]))}</dd></div>)}</dl></div>}
        </div>
      </div>
      <div className="mt-1 ms-8 flex justify-between" style={{fontSize:'calc(10px * var(--fs-result,1))',color:'var(--text-muted)'}}>{labels.map((value,i)=><span key={i} className={i%step===0||i===labels.length-1?'':'invisible'}>{t(value)}</span>)}</div>
      {!labels.length&&<p>{t('No data')}</p>}
    </div>;
  }
  const values = series.flatMap(item => item.values.map(finite)), min = Math.min(0,...values), max = Math.max(1,...values), span = max - min;
  const x = (i:number) => 64 + (labels.length > 1 ? i / (labels.length - 1) : .5) * 636, y = (value:number) => 196 - (finite(value) - min) / span * 180;
  return <div className="space-y-2" data-line-chart><svg viewBox="0 0 720 230" className="w-full" role="img" aria-label={t(label)} onMouseMove={event => {if (!labels.length) return;const box = event.currentTarget.getBoundingClientRect();if (box.width) setSelected(Math.max(0,Math.min(labels.length - 1,Math.round(((event.clientX - box.left) / box.width * 720 - 64) / 636 * (labels.length - 1)))));}}>
    {[0,.25,.5,.75,1].map(fraction => {const value = min + fraction * span;return <g key={fraction}><line x1="64" x2="700" y1={y(value)} y2={y(value)} stroke="var(--border)"/><text x="60" y={y(value) + 4} textAnchor="end" style={{fontSize:"calc(10px * var(--fs-result,1))"}} fill="var(--text-muted)">{formatValue(value)}</text></g>;})}
    {labels.map((value,i) => <text key={i} x={x(i)} y="218" textAnchor="middle" style={{fontSize:"calc(11px * var(--fs-result,1))"}} fill="var(--text-muted)">{value}</text>)}
    {series.map((item,i) => <polyline key={item.id} points={labels.map((_,j) => `${x(j)},${y(item.values[j] ?? 0)}`).join(' ')} fill="none" stroke={item.color ?? COLORS[i % COLORS.length]} strokeWidth="2" strokeDasharray={item.dashed ? '5 4' : undefined}/>)}
    {labels.length ? <line x1={x(index)} x2={x(index)} y1="16" y2="196" stroke="var(--text-muted)" strokeDasharray="2 3"/> : null}
  </svg>{labels.length ? <div className="flex flex-wrap items-end gap-3"><Select label={label} value={String(index)} options={labels.map((label,value) => ({value:String(value),label}))} onChange={event => setSelected(Number(event.target.value))}/><dl className="flex flex-wrap gap-3">{series.map(item => <div key={item.id}><dt>{t(item.label)}</dt><dd>{formatValue(finite(item.values[index]))}</dd></div>)}</dl></div> : <p>{t('No data')}</p>}</div>;
}
export function DonutChart({label,parts,formatValue,totalLabel='Total',layout='standard',size=120,thickness=16,center}: {label:string;totalLabel?:string;parts:readonly {label:string;value:number;color?:string}[];formatValue:(value:number)=>string;layout?:'standard'|'compact';size?:number;thickness?:number;center?:ReactNode}) {
  const {t} = useLocalization(), [focus,setFocus] = useState<number|null>(null), values = parts.map(part => Math.max(0,finite(part.value))), total = values.reduce((sum,value) => sum + value,0), circumference = 2 * Math.PI * 52;
  if (layout === 'compact') {
    const diameter=Math.max(1,finite(size)),stroke=Math.min(diameter,Math.max(0,finite(thickness))),radius=(diameter-stroke)/2,c=2*Math.PI*radius;
    let offset=0;
    return <div data-donut-chart data-chart-layout="compact" className="flex items-center gap-4">
      <div className="relative shrink-0" style={{width:diameter,height:diameter}}><svg width={diameter} height={diameter} className="-rotate-90" role="img" aria-label={t(label)}>
        <circle cx={diameter/2} cy={diameter/2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
        {values.map((value,i)=>{const length=total?value/total*c:0,start=offset;offset+=length;return <circle key={i} cx={diameter/2} cy={diameter/2} r={radius} fill="none" stroke={parts[i]?.color??COLORS[i%COLORS.length]} strokeWidth={stroke} strokeDasharray={`${length} ${c-length}`} strokeDashoffset={-start}/>;})}
      </svg>{center!==undefined&&<div className="absolute inset-0 grid place-items-center text-center"><div><p className="font-semibold tabular-nums" style={{fontSize:'calc(16px * var(--fs-result,1))'}}>{center}</p><p style={{fontSize:'calc(10px * var(--fs-result,1))',color:'var(--text-muted)'}}>{t(totalLabel)}</p></div></div>}</div>
      <ul className="min-w-0 space-y-1" style={{fontSize:'calc(12px * var(--fs-result,1))'}}>{parts.map((part,i)=><li key={part.label}><button type="button" className="flex w-full items-center gap-2 text-start" onFocus={()=>setFocus(i)} onBlur={()=>setFocus(null)} onMouseEnter={()=>setFocus(i)} onMouseLeave={()=>setFocus(null)} onClick={()=>setFocus(i)}>
        <span className="size-2.5 shrink-0 rounded-sm" style={{background:part.color??COLORS[i%COLORS.length]}} aria-hidden/><span className="truncate" style={{color:'var(--text-muted)'}}>{t(part.label)}</span><span className="ms-auto ps-2 font-medium tabular-nums">{formatValue(values[i]??0)}</span>
      </button></li>)}</ul><span className="sr-only" aria-live="polite">{focus===null?'':`${t(parts[focus]?.label??'')}: ${formatValue(values[focus]??0)}`}</span>
    </div>;
  }
  let offset = 0;
  return <div data-donut-chart className="flex flex-wrap items-center gap-3"><svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={t(label)}><circle cx="70" cy="70" r="52" fill="none" stroke="var(--border)" strokeWidth="18"/>{values.map((value,index) => {const length = total ? value / total * circumference : 0, start = offset;offset += length;return <circle key={index} cx="70" cy="70" r="52" fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={focus === index ? 22 : 18} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 70 70)"/>;})}</svg><div><p aria-live="polite">{formatValue(focus === null ? total : values[focus] ?? total)} · {t(focus === null ? totalLabel : parts[focus]?.label ?? '')}</p><ul>{parts.map((part,index) => <li key={part.label}><Button variant="ghost" onMouseEnter={() => setFocus(index)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(index)} onBlur={() => setFocus(null)} onClick={() => setFocus(index)}><span>{t(part.label)}</span> · {formatValue(part.value)}</Button></li>)}</ul></div></div>;
}
