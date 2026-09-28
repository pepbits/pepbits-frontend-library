"use client";
import React,{useState} from 'react';
import {ReferenceLink} from '@pepbits/reference-host';
import {useLocalization} from '@pepbits/ops-ui';
import {useReportsClient} from '../api/client';
import {Button,Card,PageHeader,Notice} from '../ui/primitives';

/** Host adaptation of the source authenticated binary download route. */
export function SecureDownload({token}:{token:string}){
 const {t}=useLocalization(),client=useReportsClient();
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const download=async()=>{setBusy(true);setError(null);try{await client.download('/api/downloads/'+encodeURIComponent(token));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <><PageHeader title={t('Report result')}/><Card><div className="lr-pad lr-stack">
  {error&&<Notice tone="danger" role="alert">{t(error)}</Notice>}
  <div><Button loading={busy} disabled={!client.canDownload} onClick={download}>{t('Download')}</Button></div>
  <ReferenceLink href="/jobs" className="lr-link">{t('Open My reports')}</ReferenceLink>
 </div></Card></>;
}

/** Plain mail text stays escaped; only this module's signed links become host links. */
export function MailText({text}:{text:string}){
 const {t}=useLocalization();
 const parts=text.split(/(\/reference-modules\/reports\/api\/downloads\/[A-Za-z0-9_.-]+)/g);
 return <>{parts.map((part,index)=>part.startsWith('/reference-modules/reports/api/downloads/')
  ?<ReferenceLink key={index} href={'/downloads/'+part.split('/').at(-1)} className="lr-link">{t('Download')}</ReferenceLink>
  :<React.Fragment key={index}>{part}</React.Fragment>)}</>;
}
