"use client";
import React,{useContext,useEffect,useMemo,useRef,useState} from 'react';
import {useDraftHost} from './draft-host';
import {type DraftPayload,type DraftScope,type SharedDraft,type SharedDraftBundle} from '@pepbits/data';
import {Button} from "@pepbits/ui";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import {RecoveryNotice, failureFromError} from "@pepbits/components";

/** Holds only acknowledged API drafts; no form data enters browser storage. */
export function useSharedDraft<T>(scope:DraftScope,enabled:boolean,values:DraftPayload<T>|null) {
 const {adapter,identity:hostIdentity,available}=useDraftHost(),expired=!available;
 const identity=JSON.stringify([hostIdentity,scope]);
 const [bundle,setBundle]=useState<SharedDraftBundle<T>|null>(null),[recovery,setRecovery]=useState<SharedDraft<T>|null>(null),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[savedAt,setSavedAt]=useState<string|null>(null),[excluded,setExcluded]=useState(false);
 const active=useRef(0),version=useRef(0),pending=useRef<(()=>Promise<void>)|null>(null),flight=useRef<Promise<void>|null>(null),ack=useRef(''),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),latest=useRef(values),resolved=useRef(false);
 latest.current=values;
 const load=async()=>{
  const generation=active.current;setBusy(true);setError(null);
  try{const next=await adapter.load<T>(scope);if(active.current!==generation)return;version.current=next.draftVersion;setBundle(next);setRecovery(next.draft);resolved.current=!next.draft;pending.current=null;ack.current='';}
  catch(e){if(active.current===generation)setError(e);}
  finally{if(active.current===generation)setBusy(false);}
 };
 useEffect(()=>{active.current++;setBundle(null);setRecovery(null);setError(null);setSavedAt(null);setExcluded(false);resolved.current=false;ack.current='';pending.current=null;flight.current=null;if(enabled)void load();return()=>{active.current++;clearTimeout(timer.current);};},[identity,adapter,enabled]);
 const run=async(operation:()=>Promise<void>)=>{
  if(flight.current)return;const generation=active.current;pending.current=operation;setBusy(true);setError(null);
  const task=(async()=>{try{await operation();if(generation===active.current)pending.current=null;}catch(e){if(generation===active.current)setError(e);}finally{if(generation===active.current){flight.current=null;setBusy(false);}}})();flight.current=task;await task;
 };
 const write=()=>{
  const payload=latest.current;if(!payload||!bundle||!resolved.current||!bundle.draftPolicy.enabled||pending.current||flight.current||expired||!available)return;
  const serialized=JSON.stringify(payload);if(serialized===ack.current)return;const id=crypto.randomUUID(),revision=version.current,generation=active.current;
  void run(async()=>{const next=await adapter.save(scope,payload,revision,id);if(generation!==active.current)return;version.current=next.version;ack.current=serialized;setSavedAt(next.disabled?null:next.savedAt);setExcluded(!!next.excludedFields?.length);if(next.disabled)setBundle(b=>b?{...b,draftPolicy:{...b.draftPolicy,enabled:false}}:b);});
 };
 useEffect(()=>{clearTimeout(timer.current);if(enabled&&!busy&&!error&&!recovery&&values&&!expired)timer.current=setTimeout(write,800);return()=>clearTimeout(timer.current);},[JSON.stringify(values),enabled,busy,error,recovery,bundle,expired]);
 const discard=async()=>{
  const started=active.current;clearTimeout(timer.current);resolved.current=false;await flight.current;if(active.current!==started)return;
  const id=crypto.randomUUID(),revision=version.current,generation=active.current;
  await run(async()=>{await adapter.discard(scope,revision,id);if(generation!==active.current)return;version.current=revision+1;setRecovery(null);setSavedAt(null);setExcluded(false);ack.current=JSON.stringify(latest.current);resolved.current=true;});
 };
 return {bundle,recovery,error,busy,savedAt,excluded,load,discard,restore:(apply:(data:T)=>void)=>{if(!recovery||recovery.values.schemaVersion!==1)return;apply(recovery.values.data);ack.current=JSON.stringify(recovery.values);setSavedAt(recovery.savedAt);setExcluded(!!recovery.excludedFields?.length);setRecovery(null);resolved.current=true;},retry:()=>pending.current?run(pending.current):load()};
}
export function DraftRecovery<T>({draft,context,onRestore,canRestore=true}: {draft:ReturnType<typeof useSharedDraft<T>>;context:string;onRestore:(data:T)=>void;canRestore?:boolean}) {
 const {available}=useDraftHost();
 const {t,dateTime}=useLocalization();const [reviewed,setReviewed]=useState(false);
 const old=draft.recovery,stale=!!old&&old.values.context!==context,incompatible=!!old&&old.values.schemaVersion!==1;
 useEffect(()=>setReviewed(false),[old,context]);
 return <div className="space-y-2 text-sm" data-shared-draft>
  {old?<div role="status" className="rounded-lg border border-[var(--border)] p-3 space-y-2">
   <p>{t('draft.available',{date:dateTime(old.savedAt)})}</p>
   {incompatible?<p>{t('draft.incompatible')}</p>:stale?<p>{t('draft.outdated')}</p>:null}
   {old.excludedFields?.length?<p>{t('draft.excluded')}</p>:null}
   {stale&&!incompatible?<Button disabled={!canRestore||draft.busy} onClick={()=>setReviewed(true)}><LocalizedText message="draft.reviewed" /></Button>:null}
   <Button disabled={draft.busy||!canRestore||incompatible||(stale&&!reviewed)} onClick={()=>draft.restore(onRestore)}><LocalizedText message="draft.restore" /></Button>
   <Button disabled={draft.busy} onClick={()=>void draft.discard()}><LocalizedText message="draft.discard" /></Button>
  </div>:draft.savedAt?<p role="status">{t('draft.saved',{date:dateTime(draft.savedAt)})}</p>:null}
  {!old&&draft.excluded?<p>{t('draft.excluded')}</p>:null}
  {draft.bundle&&!draft.bundle.draftPolicy.enabled?<p>{t('draft.disabled')}</p>:null}
  {draft.error?<><RecoveryNotice sessionRestored={available} failure={failureFromError(draft.error)} preservesValues busy={draft.busy} onRetry={()=>void draft.retry()}/>{(draft.error as {status?:number}).status===409?<Button disabled={draft.busy} onClick={()=>void draft.load()}><LocalizedText message="draft.loadLatest" /></Button>:null}</>:null}
 </div>;
}
