'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Button} from '@pepbits/ui';
import {RecoveryNotice,failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {previewErrors,resolveDesignerValues,matchesDesignerCondition,type DesignerDefinition,type DesignerValues,type TemplateValue,type DesignerValue} from '@pepbits/data/dcp-designer';
import type {DesignerAdapter} from '@pepbits/data';
import {DesignerSections} from './sections';
import {useDesignerLookups} from './preview-lookups';
import styles from './designer.module.css';
interface DesignerPreviewProps{adapter:DesignerAdapter;definition:DesignerDefinition;resolved?:DesignerDefinition;values:DesignerValues;errors:Record<string,string>;change:(id:string,value:DesignerValue)=>void;reset:()=>void;validation:(errors:Record<string,string>)=>void;clearValidation:()=>void}
export function DesignerPreview({adapter,definition,resolved=definition,values,errors,change,reset,validation,clearValidation}:DesignerPreviewProps){
 const {t,language}=useLocalization(),heading=useRef<HTMLHeadingElement>(null),active=useRef(true),[busy,setBusy]=useState(false),[failure,setFailure]=useState<unknown>(null);
 const snapshot=JSON.stringify([definition,values]),current=useRef(snapshot);current.current=snapshot;
 const effectiveValues=resolveDesignerValues(resolved,values);
 const lookups=useDesignerLookups(adapter,definition,effectiveValues,t,resolved,language);
 const fieldStates={...lookups.states};for(const f of definition.sections.flatMap(s=>s.fields))if(f.rules?.calculation||(f.rules?.readOnlyWhen&&matchesDesignerCondition(f.rules.readOnlyWhen,effectiveValues)))fieldStates[f.id]={...fieldStates[f.id],disabled:true};
 useEffect(()=>{active.current=true;heading.current?.focus({preventScroll:true});return()=>{active.current=false;};},[]);
 useEffect(()=>{setFailure(null);},[snapshot]);
 async function validate(){const local=previewErrors(resolved,values);if(Object.keys(local).length){validation(local);return;}setBusy(true);setFailure(null);clearValidation();const captured=snapshot;
  try{const result=await adapter.command({action:'validate',definition,values});if(!result.validation)throw new Error('designer.invalidResponse');if(active.current&&current.current===captured)validation(result.validation);}
  catch(error){if(active.current&&current.current===captured)setFailure(error);}finally{if(active.current)setBusy(false);}
 }
 return <section className={styles.preview} aria-label={t('designer.preview')} data-designer-preview>
  <h2 ref={heading} tabIndex={-1}>{t(definition.title)}</h2><p>{t('designer.previewOnly')}</p>
  {!!lookups.failure&&<RecoveryNotice failure={failureFromError(lookups.failure)} onRetry={lookups.retry}/>}
  {!!failure&&<RecoveryNotice failure={failureFromError(failure)} onRetry={()=>void validate()}/>}
  <DesignerSections definition={definition} values={effectiveValues} errors={Object.fromEntries(Object.entries(errors).map(([id,key])=>[id,t(key)]))} states={fieldStates} change={change}/>
  <div className={styles.toolbar}><Button variant="primary" disabled={busy} onClick={()=>void validate()}>{t(busy?'designer.validating':'designer.validate')}</Button><Button onClick={reset}>{t('template.reset')}</Button></div>
 </section>;
}
