"use client";
import React from 'react';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {classifyFailure,type Failure} from './error-mapper';
export function failureFromError(error:unknown):Failure {
 const value=error as {status?:number;reference?:string;name?:string}|null;
 const status=value?.status??(value?.name==='TimeoutError'?408:undefined);
 const reference=typeof value?.reference==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value.reference)?value.reference:undefined;
 return {...classifyFailure({status,networkError:status===undefined}),reference};
}
/** Actions are supplied by the owner so retries retain its operation identity. */
export function RecoveryNotice({failure,onRetry,onReturn,onReload,onSignIn,busy=false,preservesValues=false,sessionRestored=false}: {
 failure:Failure;onRetry?:()=>void;onReturn?:()=>void;onReload?:()=>void;onSignIn?:()=>void;busy?:boolean;preservesValues?:boolean;sessionRestored?:boolean;
}){
 const {t}=useLocalization();
 if(sessionRestored&&failure.kind==='session-expired')failure={...failure,kind:'error',retryable:true,title:'recovery.resumeTitle',description:'recovery.resume'};
 return <div role="alert" className="w-full space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" data-recovery-kind={failure.kind}>
  <p className="font-semibold">{t(failure.title)}</p><p>{t(failure.description)}</p>
  {preservesValues?<p>{t('recovery.retained')}</p>:null}
  {failure.reference?<p>{t('Reference')}: <bdi>{failure.reference}</bdi></p>:null}
  <div className="flex flex-wrap gap-2">
   {failure.retryable&&onRetry?<Button disabled={busy} onClick={onRetry}>{t('Retry')}</Button>:null}
   {failure.kind==='session-expired'&&onSignIn?<Button disabled={busy} onClick={onSignIn}>{t('Sign in')}</Button>:null}
   {onReload&&!preservesValues?<Button disabled={busy} onClick={onReload}>{t('Reload')}</Button>:null}
   {onReturn?<Button disabled={busy} onClick={onReturn}>{t('recovery.return')}</Button>:null}
  </div>
 </div>;
}
