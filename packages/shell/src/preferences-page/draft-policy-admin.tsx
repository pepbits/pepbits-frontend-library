"use client";
import React,{useEffect,useState,useRef} from 'react';
import {DEFAULT_DRAFT_POLICY,parseDraftPolicy,PROTECTED_DRAFT_FIELDS,type DraftPolicy} from '@pepbits/data';
import {useShell} from "../shell-context";
import { Button, Input, Textarea, Toggle } from "@pepbits/ui";
import { Card, RecoveryNotice, failureFromError } from "@pepbits/components";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";
import {usePreferenceRequest,usePreferencePage} from "./services";
export function DraftPolicyAdmin(){
 const {canManagePreferencePolicy}=usePreferencePage();
 const retry=useRef<()=>Promise<void>>(async()=>{});
 const request=usePreferenceRequest(),{product}=useShell(),{t}=useLocalization();
 const [policy,setPolicy]=useState<DraftPolicy>(DEFAULT_DRAFT_POLICY),[fields,setFields]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[saved,setSaved]=useState(false),[invalid,setInvalid]=useState(false);
 const load=async()=>{if(!canManagePreferencePolicy)return;retry.current=load;setBusy(true);setError(null);setReady(false);try{const r=await request('/draft-policy',{headers:{'X-Product-Id':product.id}});if(!r.ok)throw {status:r.status};const b=await r.json(),p=parseDraftPolicy(b.policy);setPolicy(p);setFields(p.excludedFields.join('\n'));setReady(b.canManage===true);setInvalid(false);}catch(e){setError(e);}finally{setBusy(false);}};
 useEffect(()=>{void load();},[product.id,canManagePreferencePolicy]);
 const save=async()=>{if(!canManagePreferencePolicy||!ready)return;retry.current=save;let next;try{next=parseDraftPolicy({...policy,excludedFields:fields.split(/[\n,]/).map(s=>s.trim()).filter(Boolean)});}catch{setInvalid(true);return;}
  setBusy(true);setError(null);setSaved(false);setInvalid(false);try{const r=await request('/draft-policy',{method:'PUT',headers:{'Content-Type':'application/json','X-Product-Id':product.id},body:JSON.stringify(next)});if(!r.ok){if(r.status===409)setReady(false);throw {status:r.status};}const b=await r.json();setPolicy(parseDraftPolicy(b.policy));setSaved(true);}catch(e){setError(e);}finally{setBusy(false);}};
 return <Card className="space-y-3 p-4" data-draft-policy><h2 className="font-bold"><LocalizedText message="draft.policyTitle" /></h2><p>{t('draft.policyHelp')}</p>
  <Toggle label={t('draft.enabled')} checked={policy.enabled} disabled={!ready||busy} onChange={enabled=>{setPolicy(p=>({...p,enabled}));setSaved(false);}}/>
  <Input label={t('draft.retention')} type="number" min={1} max={30} value={policy.retentionDays} disabled={!ready||busy} onChange={e=>{setPolicy(p=>({...p,retentionDays:Number(e.target.value)}));setSaved(false);}}/>
  <Textarea label={t('draft.exclusions')} value={fields} disabled={!ready||busy} onChange={e=>{setFields(e.target.value);setSaved(false);}} hint={t('draft.exclusionHelp')}/>
  <p>{t('draft.protected',{fields:PROTECTED_DRAFT_FIELDS.join(', ')})}</p>
  {invalid?<p role="alert">{t('draft.invalidPolicy')}</p>:null}{saved?<p role="status">{t('draft.policySaved')}</p>:null}
  {error?<RecoveryNotice failure={failureFromError(error)} preservesValues onRetry={()=>void retry.current()}/>:null}
  <Button disabled={busy} onClick={()=>void load()}><LocalizedText message="draft.loadLatest" /></Button><Button disabled={!ready||busy} onClick={()=>void save()}><LocalizedText message="draft.savePolicy" /></Button>
 </Card>;
}
