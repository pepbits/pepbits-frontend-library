"use client";
import {useSourceFormat} from "../lib/format";
import {LocalizedText} from "@pepbits/ops-ui";
import {createContext,useContext,useState,useEffect,type ReactNode} from 'react';
import {useReferenceHost,ReferenceLink} from '@pepbits/reference-host';
import {useClient,useApi} from '../lib/api';
import {Button,Modal,ErrorNote} from './ui';
import {BookCaseDrawer} from './BookCase';
import {SourceInput} from '@pepbits/ops-ui';
const BookCtx=createContext<(prefill?:{theatreId?:number;start?:string})=>void>(()=>{});
export const useUser=()=>useClient().user!;
export const useBookCase=()=>useContext(BookCtx);
export function Shell({children}:{children:ReactNode}){
 const {time}=useSourceFormat();
 const host=useReferenceHost(),client=useClient(),[book,setBook]=useState<{theatreId?:number;start?:string}|null>(null),[search,setSearch]=useState(false),[q,setQ]=useState(''),[clock,setClock]=useState(new Date());
 const {data:found}=useApi<any>(search&&q.trim().length>1?'/search?q='+encodeURIComponent(q):null);
 const {data:health}=useApi<{ok:boolean}>('/health',60000);
 useEffect(()=>{const t=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(!host.preferences.keyboardShortcuts)return;const fn=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopImmediatePropagation();setSearch(true);}};window.addEventListener('keydown',fn,true);return()=>window.removeEventListener('keydown',fn,true);},[host.preferences.keyboardShortcuts]);
 if(!client.user)return client.bootstrapError?<div className="p-6"><ErrorNote error={client.bootstrapError}/><Button onClick={client.retry}><LocalizedText message="Retry"/></Button></div>:<p role="status"><LocalizedText message="Loading SurgiSuite"/></p>;
 return <BookCtx.Provider value={prefill=>setBook(prefill??{})}><div className="flex h-full min-h-0 flex-col">
  <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-scrub px-4 text-white" data-tour="surgisuite-toolbar"><span className="font-cond text-[18px] font-semibold"><LocalizedText message="SurgiSuite"/></span><Button size="sm" onClick={()=>setSearch(true)}><LocalizedText message="Search"/></Button><span className="ml-auto text-[12px]">{time(clock.toISOString())}</span><span className="text-[12px]">{client.user?.name}</span>{client.user?.role!=='VIEWER'&&<Button variant="primary" size="sm" onClick={()=>setBook({})}><LocalizedText message="Book case"/></Button>}</div>
  <main className="min-h-0 flex-1 overflow-hidden" data-tour="surgisuite-workspace">{children}</main>
  <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-white px-4 text-[11px] text-muted"><span><LocalizedText message="SurgiSuite"/></span><span><LocalizedText message={health?.ok?'Server connected':'Connecting to server'}/></span></footer>
  <BookCaseDrawer open={book!==null} prefill={book??undefined} onClose={()=>setBook(null)}/>
  <Modal open={search} onClose={()=>setSearch(false)} title="Search"><SourceInput aria-label="Search" className="input" value={q} onChange={e=>setQ(e.target.value)}/>{found&&<div className="mt-3">{(found.cases??[]).map((c:any)=><ReferenceLink className="block p-2" key={c.id} href={'/cases/'+c.id} onClick={()=>setSearch(false)}>{c.case_no} {c.patient_name??c.name}</ReferenceLink>)}{(found.patients??[]).map((p:any)=><p key={p.id}>{p.mrn} {p.name}</p>)}</div>}</Modal>
 </div></BookCtx.Provider>;
}
