import {useEffect, useRef, useState} from 'react';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useUnsavedWarning} from '@pepbits/patterns/drafts';
import {useEntityApi} from '../client';
import {defaultsFor} from '../record';
import type {PageDef, Row} from '../types';

export function useMasterDraft(def:PageDef, onSaved:()=>void) {
 const api=useEntityApi(),host=useScreenHost(),access=useRef(host);access.current=host;
 const [draft,setDraft]=useState<Row>(),[initial,setInitial]=useState<Row>(),[busy,setBusy]=useState(false),[failure,setFailure]=useState<unknown>(),[errors,setErrors]=useState<Record<string,string>>({}),[confirm,setConfirm]=useState(false),[conflicted,setConflicted]=useState(false),[added,setAdded]=useState(0);
 const lock=useRef(false),live=useRef(true),defaults=useRef<Partial<Row>>({}),pending=useRef<{signature:string;operationId:string}|undefined>(undefined),lastAction=useRef<'save'|'again'|'delete'>('save');
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const creating=!initial?.id,allowed=host.can(creating?'create':'edit');
 useUnsavedWarning(!!draft&&JSON.stringify(draft)!==JSON.stringify(initial));
 const reset=(row:Row)=>{setInitial(row);setDraft(row);setFailure(undefined);setErrors({});setConfirm(false);setConflicted(false);pending.current=undefined;};
 const open=(row:Row|undefined,values:Partial<Row>={})=>{
  if(lock.current||!access.current.can(row?'edit':'create'))return;
  defaults.current=values;setAdded(0);reset(row??{...defaultsFor(def.fields),...values,id:''});
 };
 const close=()=>{if(!lock.current){setDraft(undefined);setInitial(undefined);setFailure(undefined);setConfirm(false);setConflicted(false);pending.current=undefined;}};
 const set=(key:string,value:unknown)=>{if(!lock.current&&allowed)setDraft(row=>row?{...row,[key]:value}:row);};
 const reload=async()=>{
  if(lock.current||!initial?.id)return;lock.current=true;setBusy(true);
  try{const row=await api.get(def.entity,initial.id);if(live.current)reset(row);}catch(error){if(live.current)setFailure(error);}finally{lock.current=false;if(live.current)setBusy(false);}
 };
 const save=async(again=false)=>{
  if(lock.current||!draft||!access.current.can(creating?'create':'edit')||conflicted)return;
  const missing=def.fields.filter(field=>field.required&&!field.readOnly&&(draft[field.key]==null||String(draft[field.key]).trim()===''));
  if(missing.length){setErrors(Object.fromEntries(missing.map(field=>[field.key,'is required'])));return;}
  lock.current=true;setBusy(true);setFailure(undefined);lastAction.current=again?'again':'save';
  const signature=JSON.stringify(draft);if(pending.current?.signature!==signature)pending.current={signature,operationId:crypto.randomUUID()};
  try{
   const payload={...draft,operationId:pending.current.operationId,...(!creating&&typeof initial?.version==='number'?{expectedVersion:initial.version}:{})};
   if(creating)await api.create(def.entity,payload);else await api.update(def.entity,initial!.id,payload);
   if(!live.current)return;pending.current=undefined;onSaved();
   if(again&&creating){setAdded(value=>value+1);reset({...defaultsFor(def.fields),...defaults.current,id:''});}
   else{setDraft(undefined);setInitial(undefined);}
  }catch(error){if(live.current){setFailure(error);const status=(error as {status?:number}).status;if(status===409)setConflicted(true);if(status&&status<500)pending.current=undefined;}}
  finally{lock.current=false;if(live.current)setBusy(false);}
 };
 const remove=async()=>{
  if(lock.current||!initial?.id||!confirm||!access.current.can('delete'))return;
  lock.current=true;setBusy(true);setFailure(undefined);lastAction.current='delete';
  try{await api.remove(def.entity,initial.id);if(live.current){onSaved();setDraft(undefined);setInitial(undefined);setConfirm(false);}}
  catch(error){if(live.current)setFailure(error);}finally{lock.current=false;if(live.current)setBusy(false);}
 };
 return {draft,initial,creating,busy,failure,errors,confirm,conflicted,added,allowed,canDelete:host.can('delete'),open,close,set,reload,save,remove,setConfirm,retry:()=>lastAction.current==='delete'?remove():save(lastAction.current==='again')};
}
