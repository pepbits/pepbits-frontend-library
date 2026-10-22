'use client';
import React,{useId} from 'react';
import {Radio,Input,RangeInput} from './form-controls';
import {useLocalization} from '@pepbits/i18n/react';
/** One value, accessible native radio navigation and a shared error relationship. */
export function RadioGroup({label,options,value,onChange,disabled,error,required}:{label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void;disabled?:boolean;error?:string;required?:boolean}){
 const id=useId(),{t}=useLocalization();return <fieldset aria-describedby={error?id:undefined} aria-invalid={!!error} aria-required={required} disabled={disabled} className="space-y-2"><legend className="text-sm font-semibold">{t(label)}{required?' *':''}</legend>{options.map(o=><Radio key={o.value} name={id} label={o.label} value={o.value} checked={value===o.value} disabled={disabled} onChange={()=>onChange(o.value)}/>)}{error&&<p id={id} className="text-sm text-[var(--danger-ink)]">{t(error)}</p>}</fieldset>;
}
/** Number entry remains available alongside the range, including keyboard entry and an empty value. */
export function RangeField({label,value,onChange,min,max,step=1,disabled,error,required}:{label:string;value:number|undefined;onChange:(value:number|undefined)=>void;min:number;max:number;step?:number;disabled?:boolean;error?:string;required?:boolean}){
 const {t}=useLocalization();return <div className="space-y-2"><Input type="number" label={label} value={value??''} min={min} max={max} step={step} disabled={disabled} error={error} required={required} onChange={e=>onChange(e.target.value===''?undefined:Number(e.target.value))}/><RangeInput label={label} value={value??min} min={min} max={max} step={step} disabled={disabled} onChange={onChange}/></div>;
}
