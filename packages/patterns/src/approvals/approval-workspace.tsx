"use client";
import {useSharedDraft,DraftRecovery} from "../drafts/use-shared-draft";
import {draftContext} from "@pepbits/data";
import {RecoveryNotice, failureFromError, type Failure} from "@pepbits/components";
import {reportOperationFailure} from "@pepbits/platform/monitoring";
import {useDraftHost} from "../drafts/draft-host";
import {usePreferences} from "@pepbits/preferences/react";
import {Card} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import {localizeApprovalNotice,localizeApiMessage} from "@pepbits/i18n";
import React,{useContext,useEffect,useMemo,useRef,useState} from 'react';


import {useNavigation} from '@pepbits/platform';
import {ApprovalError,type ApprovalAdapter,type ApprovalData,type ApprovalChange,type ApprovalStage} from '@pepbits/data';
import {Button, Input, Textarea, Select, Checkbox} from "@pepbits/ui";
import {ConfirmDialog} from "@pepbits/components";
export interface ApprovalWorkspaceProps {
 productId:string; pageId:string; recordId?:string; onReturn?:()=>void;
 adapter:ApprovalAdapter; actorId?:string; roleOptions:readonly string[];
}
export function ApprovalWorkspace(props:ApprovalWorkspaceProps) {
 const {identity}=useDraftHost();
 return <Workspace key={JSON.stringify([identity,props.productId,props.pageId,props.recordId])} {...props}/>;
}
/** The host decides which pages support approval; there is no page-name gate. */
export function RecordApproval(props:ApprovalWorkspaceProps) {
 return props.recordId?<ApprovalWorkspace {...props}/>:<p className="p-4 text-sm"><LocalizedText message="ui.save.the.record.before.submitting.it.for.approval.9161f6f6" /></p>;
}
function Workspace({productId,pageId,recordId,onReturn,adapter,actorId,roleOptions}:ApprovalWorkspaceProps) {
 const {t,dateTime}=useLocalization(),navigation=useNavigation(),{available}=useDraftHost();
 const {preferences}=usePreferences(),pageSize=preferences.pageSize;
 const [data,setData]=useState<ApprovalData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[comment,setComment]=useState('');
 const [status,setStatus]=useState('pending'),[owner,setOwner]=useState('all'),[query,setQuery]=useState(''),[stage,setStage]=useState(''),[offset,setOffset]=useState(0),[selected,setSelected]=useState<string[]>([]);
 const [settings,setSettings]=useState(false),[stages,setStages]=useState<ApprovalStage[]>([]),[confirmation,setConfirmation]=useState<ApprovalChange|null>(null),[uncertain,setUncertain]=useState(false);
 const [context,setContext]=useState('');
 useEffect(()=>{let active=true;if(data)void draftContext([data.config.version,data.items.map(i=>[i.recordId,i.version,i.recordChanged])]).then(value=>{if(active)setContext(value);});return()=>{active=false;};},[data]);
 const draft=useSharedDraft({productId,pageId,recordId:recordId??'inbox',kind:'approval'},true,comment&&context?{schemaVersion:1,context,data:{comment}}:null);
 const [failure,setFailure]=useState<Failure|null>(null);
 const alive=useRef(true),lock=useRef(false),sequence=useRef(0),pending=useRef<{change:ApprovalChange;id:string}|null>(null);
 const refresh=async()=>{
  const seq=++sequence.current;setBusy(true);setError('');setFailure(null);
  try{const next=await adapter.read([productId,pageId],recordId);if(alive.current&&sequence.current===seq){setData(next);if(!settings)setStages(next.config.stages);setSelected([]);}}
  catch(e){reportOperationFailure();if(alive.current&&sequence.current===seq)setFailure(failureFromError(e));}
  finally{if(alive.current&&sequence.current===seq)setBusy(false);}
 };
 useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;sequence.current++;};},[adapter]);
 const mutate=async(change?:ApprovalChange)=>{
  if(lock.current)return;pending.current??=change?{change,id:crypto.randomUUID()}:null;if(!pending.current)return;
  lock.current=true;setBusy(true);setError('');setFailure(null);setConfirmation(null);const operation=pending.current;
  try{const next=await adapter.change([productId,pageId],operation.change,operation.id,recordId);if(!alive.current)return;setData(next);setStages(next.config.stages);setSelected([]);if((operation.change.action==='submit'||operation.change.action==='decide')&&!next.results?.some(r=>!r.ok)){setComment('');void draft.discard();}setSettings(false);pending.current=null;setUncertain(false);}
  catch(e){reportOperationFailure();if(alive.current){setFailure(failureFromError(e));if(e instanceof ApprovalError&&e.status>=400&&e.status<500&&![408,429].includes(e.status)){pending.current=null;setUncertain(false);}else setUncertain(true);}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 const disabled=busy||!data||!!draft.recovery||uncertain||failure?.kind==='denied'||failure?.kind==='session-expired';
 const filtered=(data?.items??[]).filter(item=>recordId||(!status||item.status===status)&&(!stage||item.stages[item.stage]?.name===stage)&&(owner==='all'||owner==='mine'&&item.requesterId===actorId||owner==='assigned'&&item.canAct)&&`${item.recordId} ${item.requester}`.toLowerCase().includes(query.toLowerCase()));
 const shown=filtered.slice(offset,offset+pageSize),actionItems=(data?.items??[]).filter(item=>selected.includes(item.recordId)&&item.canAct);
 useEffect(()=>{setOffset(0);setSelected([]);},[pageSize]);
 const choose=(decision:'approve'|'reject'|'request-changes',ids=actionItems)=>setConfirmation({action:'decide',decision,comment,items:ids.map(item=>({recordId:item.recordId,version:item.version}))});
 const record=data?.items.find(item=>item.recordId===recordId);
 return <Card shadow="none" as="section" radius="xl" aria-label={t(recordId?'Record approval':'Approval inbox')} className="space-y-4 p-4 text-sm">
  <div className="flex items-center gap-3"><h2 className="flex-1 text-lg font-semibold">{t(recordId?'Record approval':'Approval inbox')}</h2><Button disabled={busy||uncertain} onClick={()=>void refresh()}><LocalizedText message="ui.refresh.approvals.fe2ff673" /></Button>{data?.canConfigure&&!recordId?<Button disabled={disabled} onClick={()=>setSettings(!settings)}><LocalizedText message="ui.configure.stages.b1a58fa2" /></Button>:null}</div>
  <p><LocalizedText message="ui.review.the.saved.record.before.deciding.approval.stages.4091af11" /></p>
  <DraftRecovery draft={draft} context={context} canRestore={!!data&&!!context} onRestore={value=>setComment(typeof value.comment==='string'?value.comment:'')}/>
  {failure?<RecoveryNotice sessionRestored={available} failure={failure} preservesValues busy={busy} onRetry={()=>void (uncertain?mutate():refresh())} onReturn={onReturn??(()=>navigation.open({pageId}))}/>:null}
  {error?<div role="alert" className="text-[var(--danger-ink)]">{t(error)}</div>:null}
  {uncertain?<div role="status"><LocalizedText message="ui.the.action.has.not.been.confirmed.ef061242" />{" "}<Button disabled={busy} onClick={()=>void mutate()}><LocalizedText message="ui.retry.approval.action.d14a0834" /></Button></div>:null}
  {busy?<p role="status"><LocalizedText message="ui.updating.approvals.8c051f99" /></p>:null}
  {data?.results?.length?<div role="status">{data.results.filter(r=>r.ok).length}{" "}<LocalizedText message="ui.succeeded.5cbc2fb4" />{" "}{data.results.filter(r=>!r.ok).length}{" "}<LocalizedText message="ui.failed.5d28a90f" />{data.results.filter(r=>!r.ok).map(r=><p key={r.recordId}>{r.recordId}: {localizeApiMessage(r.errorMessage,r.error ?? "",t)}</p>)}</div>:null}
  {settings&&data?<fieldset disabled={disabled} className="space-y-3 rounded-lg border border-[var(--border)] p-3"><legend><LocalizedText message="ui.approval.stages.1faaedac" /></legend><p><LocalizedText message="ui.changes.apply.to.new.submissions.and.resubmissions.pendi.2d7a336e" /></p>{stages.map((item,index)=><div key={index} className="flex flex-wrap items-end gap-3"><Input label={t("Stage {number} name",{number:index+1})} maxLength={80} value={item.name} onChange={e=>setStages(stages.map((s,i)=>i===index?{...s,name:e.target.value}:s))}/>{roleOptions.map(role=><Checkbox key={role} label={`${index+1}: ${t(role)}`} checked={item.roles.includes(role)} onChange={e=>setStages(stages.map((s,i)=>i===index?{...s,roles:e.target.checked?[...s.roles,role]:s.roles.filter(r=>r!==role)}:s))}/>)}<Button disabled={stages.length===1} onClick={()=>setStages(stages.filter((_,i)=>i!==index))}><LocalizedText message="ui.remove.stage.1c2a084f" />{" "}{index+1}</Button></div>)}<div className="flex gap-2"><Button disabled={stages.length>=5} onClick={()=>setStages([...stages,{name:'New review',roles:roleOptions.length?[roleOptions[0]!]:[]}])}><LocalizedText message="ui.add.stage.76fa771d" /></Button><Button disabled={stages.some(s=>!s.name.trim()||!s.roles.length)} onClick={()=>setConfirmation({action:'configure',version:data.config.version,stages})}><LocalizedText message="ui.save.approval.stages.492223a7" /></Button></div></fieldset>:null}
  {!recordId?<div className="grid gap-3 lg:grid-cols-4"><Input label="ui.find.approvals.02c11f97" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);setSelected([]);}}/><Select label="ui.approval.status.5a66175a" value={status} options={[{value:'',label:'All statuses'},...['pending','approved','rejected','changes-requested'].map(value=>({value,label:value}))]} onChange={e=>{setStatus(e.target.value);setOffset(0);setSelected([]);}}/><Select label="ui.approval.ownership.61a992d1" value={owner} options={[{value:'all',label:'All available'},{value:'assigned',label:'Awaiting my decision'},{value:'mine',label:'My requests'}]} onChange={e=>{setOwner(e.target.value);setOffset(0);setSelected([]);}}/><Select label="ui.approval.stage.19f10a3e" value={stage} options={[{value:'',label:'All stages'},...Array.from(new Set(data?.items.flatMap(i=>i.stages.map(s=>s.name))??[])).map(value=>({value,label:value}))]} onChange={e=>{setStage(e.target.value);setOffset(0);setSelected([]);}}/></div>:null}
  <Textarea label={recordId?'Approval comment':'Bulk decision comment'} maxLength={4000} disabled={disabled} value={comment} onChange={e=>{setComment(e.target.value);if(!e.target.value)void draft.discard();}} hint="ui.a.comment.is.required.for.submission.and.every.decision.322dedac"/>
  {recordId&&data&&(!record||record.canSubmit)?<Button disabled={disabled||!comment.trim()} onClick={()=>setConfirmation({action:'submit',recordId,version:record?.version??0,comment})}>{record?<LocalizedText message="ui.resubmit.saved.record.5678154a" />:<LocalizedText message="ui.submit.for.approval.beec6c10" />}</Button>:null}
  {!recordId?<div className="flex flex-wrap gap-2"><Button disabled={disabled} onClick={()=>setSelected(shown.filter(i=>i.canAct).map(i=>i.recordId))}><LocalizedText message="ui.select.eligible.rows.on.this.page.55468a85" /></Button>{(['approve','reject','request-changes'] as const).map(decision=><Button key={decision} disabled={disabled||!actionItems.length||!comment.trim()} onClick={()=>choose(decision)}>{decision==='approve'?<LocalizedText message="ui.approve.selected.86372811" />:decision==='reject'?<LocalizedText message="ui.reject.selected.7237aa41" />:<LocalizedText message="ui.request.changes.for.selected.fcb2ba25" />}</Button>)}<span>{selected.length}{" "}<LocalizedText message="ui.selected.d7cbbb68" /></span></div>:null}
  {data&&!filtered.length?<p><LocalizedText message="ui.no.approvals.match.this.view.c111d946" /></p>:null}
  <div className="space-y-3">{shown.map(item=><article key={item.recordId} className="space-y-2 rounded-lg border border-[var(--border)] p-3"><div className="flex flex-wrap items-center gap-3">{!recordId?<Checkbox label={t("Select {record}", {record:item.recordId})} checked={selected.includes(item.recordId)} disabled={disabled||!item.canAct} onChange={e=>setSelected(e.target.checked?[...selected,item.recordId]:selected.filter(id=>id!==item.recordId))}/>:null}<b>{item.recordId}</b><span>{t(item.status)} · {item.stages[item.stage]?.name}{" "}<LocalizedText message="ui.requested.by.83e44ed5" />{" "}{item.requester}</span>{!recordId?<Button onClick={()=>navigation.open({pageId,recordId:item.recordId,mode:'view'})}><LocalizedText message="ui.review.aff0766a" />{" "}{item.recordId}</Button>:null}</div>{item.recordChanged?<p role="status" className="font-semibold"><LocalizedText message="ui.saved.record.changed.the.requester.must.resubmit.it.this.7afe52e7" /></p>:null}{recordId&&item.canAct?<div className="flex gap-2">{(['approve','reject','request-changes'] as const).map(decision=><Button key={decision} disabled={disabled||!comment.trim()} onClick={()=>choose(decision,[item])}>{decision==='approve'?<LocalizedText message="ui.approve.6007acbe" />:decision==='reject'?<LocalizedText message="ui.reject.ab604a36" />:<LocalizedText message="ui.request.changes.cb5d9f98" />}</Button>)}</div>:null}<details><summary className="cursor-pointer"><LocalizedText message="ui.approval.history.for.9208c99b" />{" "}{item.recordId}</summary><ol className="space-y-2 p-3">{item.history.map(event=><li key={event.id}><b>{t(event.action)}</b> · {event.stage} · {event.actor} · <time dateTime={event.at}>{dateTime(event.at)}</time><p className="whitespace-pre-wrap break-words">{event.comment}</p></li>)}</ol></details></article>)}</div>
  {!recordId&&filtered.length>pageSize?<div className="flex gap-3"><Button disabled={offset===0} onClick={()=>{setOffset(Math.max(0,offset-pageSize));setSelected([]);}}><LocalizedText message="ui.previous.approvals.601c366a" /></Button><span>{offset+1}–{Math.min(offset+pageSize,filtered.length)}{" "}<LocalizedText message="ui.of.28391d3b" />{" "}{filtered.length}</span><Button disabled={offset+pageSize>=filtered.length} onClick={()=>{setOffset(offset+pageSize);setSelected([]);}}><LocalizedText message="ui.next.approvals.ca7c29b6" /></Button></div>:null}
  {data?<details><summary className="cursor-pointer">{t("My approval notifications · Unread: {count}",{count:data.notifications.filter(n=>!n.read).length})}</summary><div className="space-y-2 pt-3"><Button disabled={disabled||!data.notifications.some(n=>!n.read)} onClick={()=>void mutate({action:'mark-read',ids:data.notifications.filter(n=>!n.read).map(n=>n.id)})}><LocalizedText message="ui.mark.notifications.read.1b2f9273" /></Button>{!data.notifications.length?<p><LocalizedText message="ui.no.approval.notifications.yet.f2e11ecf" /></p>:data.notifications.map(n=><div key={n.id} className="flex items-center gap-3"><span className="flex-1">{n.read?'':<LocalizedText message="ui.unread.8abefced" />}{n.recordId}: {localizeApiMessage(n,localizeApprovalNotice(n.message,t),t)} · {dateTime(n.at)}</span><Button onClick={()=>navigation.open({pageId,recordId:n.recordId,mode:'view'})}><LocalizedText message="ui.open.notification.072eaf0e" />{" "}{n.recordId}</Button></div>)}</div></details>:null}
  <ConfirmDialog open={!!confirmation} title="ui.confirm.approval.action.005e321a" message={confirmation?.action==='decide'?t("{decision} for {count} record(s)? Your comment will be added to each history.", {decision:t(confirmation.decision),count:confirmation.items.length}):confirmation?.action==='configure'?'Save these ordered stages for future submissions?':'Submit the current saved record for review? Save any form edits first.'} confirmLabel="ui.confirm.approval.action.aeacaf3d" onCancel={()=>setConfirmation(null)} onConfirm={()=>{if(confirmation)void mutate(confirmation);}}/>
 </Card>;
}
