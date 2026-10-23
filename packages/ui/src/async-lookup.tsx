'use client';
import React,{useEffect,useId,useRef,useState} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {SourceInput} from './source-controls';
import {cn} from './cn';
/** Host-loaded combobox. The caller owns the transport and record rendering; obsolete reads are aborted and fenced. */
export function AsyncLookup<T>({loadOptions,getKey,renderOption,onPick,label,placeholder=label,minChars=1,debounceMs=120,autoFocus,className,inputClassName,initialQuery=''}:{
 loadOptions:(query:string,signal:AbortSignal)=>Promise<T[]>;getKey:(item:T)=>string;renderOption:(item:T,active:boolean)=>React.ReactNode;onPick:(item:T)=>void;
 label:string;placeholder?:string;minChars?:number;debounceMs?:number;autoFocus?:boolean;className?:string;inputClassName?:string;initialQuery?:string;
}){
 const {t}=useLocalization(),id=useId(),box=useRef<HTMLDivElement>(null);
 const [query,setQuery]=useState(initialQuery),[items,setItems]=useState<T[]>([]),[open,setOpen]=useState(false),[active,setActive]=useState(0),[failed,setFailed]=useState(false);
 useEffect(()=>{
  setItems([]);setActive(0);setFailed(false);
  if(query.trim().length<minChars)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{void loadOptions(query.trim(),controller.signal).then(result=>{if(!controller.signal.aborted)setItems(result);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});},debounceMs);
  return()=>{controller.abort();clearTimeout(timer);};
 },[query,minChars,debounceMs,loadOptions]);
 useEffect(()=>{const dismiss=(event:MouseEvent)=>{if(!box.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('mousedown',dismiss);return()=>document.removeEventListener('mousedown',dismiss);},[]);
 const visible=open&&query.trim().length>=minChars&&items.length>0;
 const pick=(item:T|undefined)=>{if(item===undefined)return;onPick(item);setOpen(false);setQuery('');setItems([]);};
 return <div ref={box} className={cn('relative',className)}>
  <SourceInput autoFocus={autoFocus} value={query} placeholder={placeholder} aria-label={label} role="combobox" aria-expanded={!!visible} aria-autocomplete="list"
   aria-controls={visible?id:undefined} aria-activedescendant={visible&&items[active]!==undefined?id+'-'+active:undefined}
   onChange={event=>{setQuery(event.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onKeyDown={event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(index=>Math.max(0,Math.min(index+(event.key==='ArrowDown'?1:-1),items.length-1)));}
    else if(event.key==='Enter'&&visible){event.preventDefault();pick(items[active]);}
    else if(event.key==='Escape'&&open){event.stopPropagation();setOpen(false);}
    else if(event.key==='Tab')setOpen(false);
   }} className={cn('focus-ring h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]',inputClassName)}/>
  {visible?<ul id={id} role="listbox" aria-label={t(label)} className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
   {items.map((item,index)=><li id={id+'-'+index} key={getKey(item)} role="option" aria-selected={index===active} onMouseMove={()=>setActive(index)} onMouseDown={event=>{event.preventDefault();pick(item);}}
    className={cn('cursor-pointer rounded-[var(--radius)] px-2 py-1.5',index===active&&'bg-[var(--primary-soft)]')}>{renderOption(item,index===active)}</li>)}
  </ul>:null}
  {open&&failed?<span role="status" className="text-[var(--danger-ink)]">{t('Something went wrong')} · {t('Try again')}</span>:null}
 </div>;
}
