"use client";
import {LineChart as SharedLineChart,DonutChart,BarChart as SharedBarChart,ProgressRing,HorizontalBars,type MetricPoint} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormat} from "../lib/format";
/** School units and labels configure public chart engines; no renderer is copied here. */
export function BarChart({data,height,max,suffix="",color,compare,className}:{data:MetricPoint[];height?:number;max?:number;suffix?:string;color?:string;compare?:string;className?:string}){const {fmtNum}=useFormat();return <SharedBarChart data={data} height={height} max={max} color={color} compareLabel={compare} className={className} formatValue={value=>fmtNum(value)+suffix}/>;}
/** School chart labels and units configure the public accessible renderers. */
export function LineChart({series,labels,suffix="",className}:{series:{name:string;values:number[];color?:string;fill?:boolean}[];labels:string[];height?:number;min?:number;max?:number;suffix?:string;className?:string}){
 const {fmtNum}=useFormat();const {t}=useLocalization();return <div className={className}><SharedLineChart label={series.map(s=>t(s.name)).join(' / ')} labels={labels.map(t=>t)} series={series.map((s,i)=>({id:String(i),label:s.name,values:s.values,color:s.color}))} formatValue={n=>fmtNum(n)+suffix}/></div>;
}
export function Donut({data,center,sub}:{data:{label:string;value:number;color:string}[];size?:number;thickness?:number;center?:string;sub?:string}){const {fmtNum}=useFormat();return <DonutChart label={sub??'Distribution'} parts={data} formatValue={fmtNum} totalLabel={sub??'Total'}/>;}


export function Ring({value,size,stroke,color,label}:{value:number;size?:number;stroke?:number;color?:string;label?:string}){const {fmtNum}=useFormat();return <ProgressRing value={value} size={size} stroke={stroke} color={color} label={label} formatValue={value=>fmtNum(Math.round(value))+"%"}/>;}
export function HBars({data,suffix="",max}:{data:MetricPoint[];suffix?:string;max?:number}){const {fmtNum}=useFormat();return <HorizontalBars data={data} max={max} formatValue={value=>fmtNum(value)+suffix}/>;}
