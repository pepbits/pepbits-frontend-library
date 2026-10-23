"use client";
import React,{useContext,useEffect,useMemo,useRef,useState} from 'react';
import {useDraftHost} from './draft-host';
import {usePreferences} from '@pepbits/preferences/react';
import {PresentationProvider} from '@pepbits/components';

import {useNavigation} from '@pepbits/platform';
import {type DraftCenterAdapter,type DraftCenterData,type DraftCenterItem} from '@pepbits/data';
import {Button, Input, Select} from "@pepbits/ui";
import {Card, TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, RecoveryNotice, failureFromError} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
export interface DraftRecoveryCenterProps {
 application:{id:string;name:string;pages:Readonly<Record<string,{id:string;title:string}>>};
 adapter:DraftCenterAdapter;
 /** The host renders configured import/approval workflows after access is rechecked. */
 renderWorkflow?:(item:DraftCenterItem,onClose:()=>void)=>React.ReactNode;
}
export function DraftRecoveryCenter(props:DraftRecoveryCenterProps){
 const {identity}=useDraftHost();
 return <Center key={JSON.stringify([props.application.id,identity])} {...props}/>;
}
function Center({application:product,adapter,renderWorkflow}:DraftRecoveryCenterProps){
 const navigation=useNavigation(),{t,dateTime,language}=useLocalization(),{available}=useDraftHost();
 const {preferences}=usePreferences();
 const [data,setData]=useState<DraftCenterData|null>(null),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[kind,setKind]=useState(''),[status,setStatus]=useState(''),[offset,setOffset]=useState(0),[workflow,setWorkflow]=useState<DraftCenterItem|null>(null);
 const generation=useRef(0),alive=useRef(true),pending=useRef<(()=>Promise<void>)|null>(null),lock=useRef(false);
 const load=async()=>{const seq=++generation.current;pending.current=null;setBusy(true);setError(null);try{const next=await adapter.list(product.id,{query,kind,status,offset,language});if(alive.current&&seq===generation.current)setData(next);}catch(e){if(alive.current&&seq===generation.current)setError(e);}finally{if(alive.current&&seq===generation.current)setBusy(false);}};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
 useEffect(()=>{const timer=setTimeout(()=>{if(!lock.current)void load();},250);return()=>{clearTimeout(timer);generation.current++;};},[adapter,product.id,query,kind,status,offset,language]);
 const execute=async(operation:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;pending.current=operation;setBusy(true);setError(null);generation.current++;
  try{await operation();if(alive.current)pending.current=null;}catch(e){if(alive.current)setError(e);}finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 const open=(item:DraftCenterItem)=>void execute(async()=>{const next=await adapter.open(product.id,item);if(!alive.current)return;
  if(!next.pageId||!product.pages[next.pageId])throw {status:403};
  if(next.kind==='dcp'){navigation.open({pageId:next.pageId});return;}
  if(next.kind==='form')navigation.open({pageId:next.pageId,...(next.recordId==='new'?{mode:'new' as const}:{mode:'edit' as const,recordId:next.recordId??undefined})});else setWorkflow(next);
 });
 const discard=(item:DraftCenterItem)=>{const id=crypto.randomUUID();void execute(async()=>{await adapter.discard(product.id,item,id);if(alive.current)await load();});};
 const close=()=>{setWorkflow(null);void load();};

 return <PresentationProvider value={preferences}><Card className="space-y-4 p-5" data-draft-center>
  <div className="flex items-center justify-between gap-4"><h1 className="text-xl font-bold">{t('center.title')}</h1><Button disabled={busy} onClick={()=>{pending.current=null;void load();}}><LocalizedText message="center.refresh" /></Button></div>
  <p>{t('center.description',{application:product.name})}</p>
  {data?<Card tone="muted" className="space-y-2 p-3"><p>{t(data.policy.enabled?'center.storageOn':'draft.disabled')}</p><p>{t('center.retention',{days:data.policy.retentionDays})}</p><p>{t('center.counts',{all:data.counts.all,outdated:data.counts.outdated,unavailable:data.counts.unavailable})}</p><p>{t('center.exclusions',{fields:data.policy.excludedFields.join(', ')||t('center.none')})}</p></Card>:null}
  <div className="grid gap-3 lg:grid-cols-3"><Input disabled={busy} label={t('center.search')} value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);}}/><Select disabled={busy} placeholder={t('center.allTypes')} label={t('center.kind')} value={kind} options={['','form','import','approval','dcp'].map(value=>({value,label:t(value?'center.'+value:'center.allTypes')}))} onChange={e=>{setKind(e.target.value);setOffset(0);}}/><Select disabled={busy} placeholder={t('center.allStatuses')} label={t('center.status')} value={status} options={['','ready','outdated','unavailable','file-required'].map(value=>({value,label:t(value?'center.'+value:'center.allStatuses')}))} onChange={e=>{setStatus(e.target.value);setOffset(0);}}/></div>
  {error?<RecoveryNotice sessionRestored={available} failure={failureFromError(error)} preservesValues busy={busy} onRetry={()=>void (pending.current?execute(pending.current):load())}/>:null}
  {busy?<p role="status">{t('center.loading')}</p>:null}
  {data&&!data.items.length?<p role="status">{t('center.empty')}</p>:null}
  {data?.items.length?<TableContainer><Table className="w-full text-sm [&_th]:p-3 [&_th]:text-start [&_td]:p-3 [&_td]:align-top [&_tbody_tr]:border-t [&_tbody_tr]:border-[var(--border)]"><TableHeader><TableRow>{['application','record','kind','saved','expiry','status','actions'].map(key=><TableHead key={key}>{t('center.'+key)}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map(item=><TableRow key={item.id} data-draft-id={item.id}>
   <TableCell>{product.name}</TableCell><TableCell className="max-w-64 break-words">{item.pageId?<><b>{t(product.pages[item.pageId]?.title??item.pageId)}</b><p>{item.recordId==='new'?t('center.newRecord'):item.recordId==='inbox'?t('center.inbox'):item.recordId==='mapping'?t('center.import'):item.recordId}</p></>:t('center.hidden')}</TableCell><TableCell>{t('center.'+item.kind)}</TableCell><TableCell><time dateTime={item.savedAt}>{dateTime(item.savedAt)}</time></TableCell><TableCell><time dateTime={item.expiresAt}>{dateTime(item.expiresAt)}</time></TableCell><TableCell>{t('center.'+item.status)}</TableCell><TableCell><div className="flex gap-2"><Button disabled={busy||item.status==='unavailable'} onClick={()=>open(item)}><LocalizedText message="center.open" /></Button><Button disabled={busy} onClick={()=>discard(item)}><LocalizedText message="draft.discard" /></Button></div></TableCell>
  </TableRow>)}</TableBody></Table></TableContainer>:null}
  {data&&data.total>25?<div className="flex items-center gap-3"><Button disabled={busy||data.offset===0} onClick={()=>setOffset(Math.max(0,data.offset-25))}><LocalizedText message="center.previous" /></Button><span>{t('center.pageCount',{start:data.offset+1,end:Math.min(data.offset+25,data.total),total:data.total})}</span><Button disabled={busy||data.offset+25>=data.total} onClick={()=>setOffset(data.offset+25)}><LocalizedText message="center.next" /></Button></div>:null}
  <p>{t('center.hint')}</p>
  {workflow&&renderWorkflow?.(workflow,close)}
 </Card></PresentationProvider>;
}
