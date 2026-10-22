'use client';
import React,{useEffect,useRef} from 'react';
import {Button} from '@pepbits/ui';
export interface FormErrorItem {id:string;label:string;message:string}
/** Accessible error navigation; the host owns field paths and focus resolution. */
export function FormErrorSummary({title,errors,onFocus}:{title:string;errors:FormErrorItem[];onFocus?:(id:string)=>void}){
 const heading=useRef<HTMLDivElement>(null);const signature=JSON.stringify(errors);
 useEffect(()=>{if(errors.length)heading.current?.focus();},[signature]);
 if(!errors.length)return null;
 return <div ref={heading} tabIndex={-1} role="alert" className="space-y-2 rounded-[var(--radius)] border border-[var(--danger-ink)] p-3 text-[var(--danger-ink)]"><p className="font-semibold">{title}</p><ul className="space-y-1">{errors.map((e,i)=><li key={e.id+':'+i}>{onFocus?<Button variant="ghost" onClick={()=>onFocus(e.id)}>{e.label?e.label+': ':''}{e.message}</Button>:<span>{e.label?e.label+': ':''}{e.message}</span>}</li>)}</ul></div>;
}
