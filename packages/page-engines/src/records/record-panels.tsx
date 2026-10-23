"use client";
import {Card} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import React, {useContext,useEffect,useMemo,useRef,useState} from 'react';


import {localizeApiMessage} from "@pepbits/i18n";
import {RecordPanelsError,type RecordPanelsAdapter,type RecordPanelScope,type RecordPanels,type PanelChange} from '@pepbits/data';
import {useRecordHost} from "./use-record-editor";
import {useNavigation} from '@pepbits/platform';
import {useScreenHost,useScreenDraftState} from "@pepbits/patterns/screen-host";
import {Button, Input, Textarea, Select} from "@pepbits/ui";
import {ConfirmDialog} from "@pepbits/components";

const tabs=['Attachments','Comments','Related records','Activity'] as const;
const empty:RecordPanels={attachments:[],comments:[],related:[],activity:[]};
export interface RecordPanelsProps {pageId:string;recordId?:string;adapter:RecordPanelsAdapter;actorId?:string;pages:ReadonlyArray<{id:string;title:string}>}
export function RecordPanelsPanel(props:RecordPanelsProps) {
 const {identity,applicationId}=useRecordHost();
 if(!props.recordId)return <Card shadow="none" as="section" radius="xl" className="p-4 text-sm"><LocalizedText message="ui.save.the.record.to.add.attachments.comments.and.related.a87df725" /></Card>;
 return <Panels key={JSON.stringify([identity,applicationId,props.pageId,props.recordId])} {...props} scope={[applicationId,props.pageId,props.recordId]} />;
}
function Panels({scope,adapter,actorId,pages}:RecordPanelsProps & {scope:RecordPanelScope}) {
 const {t:translateCopy,t,dateTime}=useLocalization(),host=useScreenHost(),navigation=useNavigation();
 const [tab,setTab]=useState<typeof tabs[number]>('Attachments'),[data,setData]=useState(empty),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const canWrite=host.can('edit',scope)&&data.permissions?.write!==false;
 const [draft,setDraft]=useScreenDraftState<{text:string;pageId:string;recordId:string;label:string;pending:null|{change:PanelChange;id:string}}>('panels:'+JSON.stringify(scope),{text:'',pageId:scope[1],recordId:'',label:'',pending:null});
 const [removing,setRemoving]=useState<Extract<PanelChange,{action:'remove'}>|null>(null);
 const alive=useRef(true),locked=useRef(false),loadVersion=useRef(0);
 const refresh=async(signal?:AbortSignal)=>{
  const version=++loadVersion.current;setError(null);
  try{const result=await adapter.load(scope,signal);if(alive.current&&version===loadVersion.current){setData(result);setLoaded(true);}}
  catch(e){if(alive.current&&version===loadVersion.current&&!signal?.aborted)setError((e as Error).message);}
 };
 useEffect(()=>{alive.current=true;const controller=new AbortController();void refresh(controller.signal);return()=>{alive.current=false;loadVersion.current++;controller.abort();};},[adapter]);
 const mutate=async(change?:PanelChange)=>{
  if(locked.current||!canWrite)return;
  const pending=draft.pending??(change?{change,id:crypto.randomUUID()}:null);if(!pending)return;
  locked.current=true;const version=++loadVersion.current;setBusy(true);setError(null);setDraft({...draft,pending});setRemoving(null);
  try{const result=await adapter.change(scope,pending.change,pending.id);if(!alive.current||version!==loadVersion.current)return;setData(result);setLoaded(true);setDraft({...draft,text:pending.change.action==='comment'?'':draft.text,recordId:pending.change.action==='link'?'':draft.recordId,label:pending.change.action==='link'?'':draft.label,pending:null});}
  catch(e){if(alive.current){setError((e as Error).message);if(e instanceof RecordPanelsError&&e.status>=400&&e.status<500)setDraft({...draft,pending:null});}}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 };
 const upload=async(file?:File)=>{
  if(!file)return;if(file.size<1||file.size>2*1024*1024){setError('Choose a file between 1 byte and 2 MB.');return;}
  try{const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]!);reader.onerror=()=>reject(new Error('The file could not be read.'));reader.readAsDataURL(file);});if(alive.current)await mutate({action:'upload',name:file.name,content});}catch(e){if(alive.current)setError((e as Error).message);}
 };
 const download=async(id:string)=>{
  try{const file=await adapter.download(scope,id);if(!alive.current)return;const bytes=Uint8Array.from(atob(file.content),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));const link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){if(alive.current)setError((e as Error).message);}
 };
 const disabled=!loaded||busy||!canWrite||!!draft.pending;
 const remove=(collection:'attachments'|'comments'|'related',id:string)=><Button variant="ghost" disabled={disabled} onClick={()=>setRemoving({action:'remove',collection,id})}><LocalizedText message="ui.remove.c3812fc4" /></Button>;
 return <Card shadow="none" as="section" radius="xl" aria-label={translateCopy("ui.record.supporting.information.a40993f1")} className="p-4">
  <div className="flex flex-wrap items-center gap-2">{tabs.map(item=><Button key={item} variant={tab===item?'primary':'secondary'} aria-pressed={tab===item} onClick={()=>setTab(item)}>{item}</Button>)}<Button className="ml-auto" disabled={busy} onClick={()=>void refresh()}><LocalizedText message="ui.refresh.panels.171a4cfd" /></Button></div>
  <p className="my-3 text-sm text-[var(--text-muted)]"><LocalizedText message="ui.changes.here.save.separately.from.the.record.f35c36d1" />{" "}{canWrite?'':<LocalizedText message="ui.your.current.access.allows.reading.only.e3f1b863" />}</p>
  {error?<div role="alert" className="my-3 text-[var(--danger-ink)]">{error}</div>:null}
  {draft.pending?<div className="my-3" role="status">{busy?<LocalizedText message="ui.saving.change.c0ce71ff" />:<LocalizedText message="ui.the.change.is.awaiting.confirmation.ad7a6793" />}<Button disabled={busy||!canWrite} onClick={()=>void mutate()}><LocalizedText message="ui.retry.change.b38331b5" /></Button></div>:null}
  {!loaded?<p role="status">{error?<LocalizedText message="ui.panel.data.is.unavailable.use.refresh.panels.to.retry.452f583a" />:<LocalizedText message="ui.loading.record.panels.4d1216a9" />}</p>:null}
  {tab==='Attachments'?<div className="space-y-3"><Input type="file" label="ui.add.attachment.maximum.2.mb.88f8a023" disabled={disabled} onChange={event=>{void upload(event.target.files?.[0]);event.target.value='';}} />{loaded&&!data.attachments.length?<p><LocalizedText message="ui.no.attachments.yet.becf0183" /></p>:null}{data.attachments.map(item=><div key={item.id} className="flex items-center gap-3 border-t border-[var(--border)] pt-2"><span className="min-w-0 flex-1 break-words">{item.name} · {Math.ceil(item.size/1024)}{" "}<LocalizedText message="ui.kb.e48db0d1" />{" "}{item.author}</span><Button onClick={()=>void download(item.id)}><LocalizedText message="ui.download.d6eafe82" />{" "}{item.name}</Button>{remove('attachments',item.id)}</div>)}</div>:null}
  {tab==='Comments'?<div className="space-y-3"><Textarea label="ui.new.comment.cf9c2573" maxLength={4000} disabled={disabled} value={draft.text} onChange={event=>setDraft({...draft,text:event.target.value})} /><Button disabled={disabled||!draft.text.trim()} onClick={()=>void mutate({action:'comment',text:draft.text})}><LocalizedText message="ui.post.comment.153dc13a" /></Button>{loaded&&!data.comments.length?<p><LocalizedText message="ui.no.comments.yet.b7cba957" /></p>:null}{data.comments.map(item=><article key={item.id} className="border-t border-[var(--border)] pt-3"><div className="flex items-center gap-2"><b>{item.author}</b><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>{item.authorId===actorId||host.can('remove-comment',item)?remove('comments',item.id):null}</div><p className="whitespace-pre-wrap break-words">{item.text}</p></article>)}</div>:null}
  {tab==='Related records'?<div className="space-y-3"><div className="grid gap-3 lg:grid-cols-3"><Select label="ui.related.page.bc7a46d5" disabled={disabled} value={draft.pageId} options={pages.map(page=>({value:page.id,label:page.title}))} onChange={event=>setDraft({...draft,pageId:event.target.value})} /><Input label="ui.related.record.id.2def8f74" disabled={disabled} value={draft.recordId} onChange={event=>setDraft({...draft,recordId:event.target.value})} /><Input label="ui.relationship.label.e30c78d5" disabled={disabled} maxLength={200} value={draft.label} onChange={event=>setDraft({...draft,label:event.target.value})} /></div><Button disabled={disabled||!draft.recordId.trim()||!draft.label.trim()} onClick={()=>void mutate({action:'link',pageId:draft.pageId,recordId:draft.recordId.trim(),label:draft.label})}><LocalizedText message="ui.link.record.1787cac0" /></Button>{loaded&&!data.related.length?<p><LocalizedText message="ui.no.related.records.yet.595d14ca" /></p>:null}{data.related.map(item=><div key={item.id} className="flex items-center gap-3 border-t border-[var(--border)] pt-2"><span className="flex-1 break-words">{item.label} · {item.recordId}</span><Button disabled={!pages.some(page=>page.id===item.pageId)} onClick={()=>navigation.open({pageId:item.pageId,recordId:item.recordId,mode:'view'})}><LocalizedText message="ui.open.ed077f3d" />{" "}{item.recordId}</Button>{remove('related',item.id)}</div>)}</div>:null}
  {tab==='Activity'?<div className="space-y-3"><p className="text-sm text-[var(--text-muted)]"><LocalizedText message="ui.recent.panel.changes.newest.first.43be1f92" /></p>{loaded&&!data.activity.length?<p><LocalizedText message="ui.no.panel.activity.yet.d3114311" /></p>:null}{data.activity.map(item=><div key={item.id} className="border-t border-[var(--border)] pt-2"><b>{localizeApiMessage(item,item.detail,t)}</b> · {item.author} · <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div>)}</div>:null}
  <ConfirmDialog open={!!removing} title="ui.remove.this.item.b8391ef4" message="ui.the.item.will.be.removed.from.this.record.its.activity.e.16a42e63" confirmLabel="ui.remove.item.5a89edf2" onCancel={()=>setRemoving(null)} onConfirm={()=>{if(removing)void mutate(removing);}} />
 </Card>;
}
