import {useEffect,useRef,useState} from 'react';
import {RecordSectionLayout} from '@pepbits/page-engines/record-layout';
import {TemplateFields} from '@pepbits/page-engines/templates';
import {Button,Toggle,Input,Textarea} from '@pepbits/ui';
import {LoadingState,RecoveryNotice,failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useUnsavedWarning} from '@pepbits/patterns/drafts';
import {useEntityApi,useFetch} from './client';
import {templateField} from './fields';
import type {PageDef,Row} from './types';
import './settings.css';

export function SettingsPage({def}:{def:PageDef}) {
 const result=useFetch<Row>(`/api/entities/${def.entity}/1`);
 if(!result.data)return result.error?<RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/>:<LoadingState/>;
 return <SettingsForm key={def.slug} def={def} initial={result.data} onAccepted={result.setData} onReload={()=>{result.setData(null);result.reload();}}/>;
}
function SettingsForm({def,initial,onAccepted,onReload}:{def:PageDef;initial:Row;onAccepted:(row:Row)=>void;onReload:()=>void}) {
 const {t}=useLocalization(),{preferences}=usePreferences(),host=useScreenHost(),api=useEntityApi();
 const sections=(def.sections??[]).map((section,index)=>({...section,id:'section-'+index}));
 const [draft,setDraft]=useState(initial),[active,setActive]=useState('section-0'),[busy,setBusy]=useState(false),[failure,setFailure]=useState<unknown>(),[errors,setErrors]=useState<Record<string,string>>({});
 const changed=sections.flatMap(section=>section.fields).filter(field=>JSON.stringify(draft[field.key])!==JSON.stringify(initial[field.key]));
 const pending=useRef<{signature:string;operationId:string}|undefined>(undefined),saving=useRef(false),live=useRef(true),access=useRef(host);access.current=host;
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const conflict=(failure as {status?:number}|undefined)?.status===409,editable=host.can('edit');
 useUnsavedWarning(editable&&changed.length>0);
 const save=async()=>{
  if(saving.current||!access.current.can('edit')||!changed.length||conflict)return;
  const missing=sections.flatMap(section=>section.fields).filter(field=>field.required&&!field.readOnly&&(draft[field.key]===''||draft[field.key]==null));
  if(missing.length){setErrors(Object.fromEntries(missing.map(field=>[field.key,t('is required')])));return;}
  const signature=JSON.stringify(draft);if(pending.current?.signature!==signature)pending.current={signature,operationId:crypto.randomUUID()};
  saving.current=true;setBusy(true);setFailure(undefined);
  try {const row=await api.update(def.entity,'1',{...draft,operationId:pending.current.operationId,...(typeof initial.version==='number'?{expectedVersion:initial.version}:{})});if(live.current){pending.current=undefined;setDraft(row);onAccepted(row);setErrors({});host.notify(t('Changes saved'),{tone:'success'});}}
  catch(error){if(live.current){setFailure(error);const status=(error as {status?:number}).status;if(status&&status<500)pending.current=undefined;}}
  finally{saving.current=false;if(live.current)setBusy(false);}
 };
 const saveRef=useRef(save);saveRef.current=save;
 useEffect(()=>{if(!preferences.keyboardShortcuts||!editable)return;const key=(event:KeyboardEvent)=>{if(event.altKey&&event.key.toLowerCase()==='s'){event.preventDefault();void saveRef.current();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[preferences.keyboardShortcuts,editable]);
 return <section className="erp-settings" data-erp-settings data-record-page data-density={preferences.density}><h1 className="sr-only">{t(def.title)}</h1>
  {!!failure&&<RecoveryNotice failure={failureFromError(failure)} onRetry={conflict?undefined:()=>void save()}/>}{conflict&&<Button onClick={onReload}>{t('Reload')}</Button>}
  <RecordSectionLayout appearance="plain" sizing="container" keepMounted showCompletion={false} sections={sections} active={active} onActive={setActive} isDone={()=>false} railHeader={null}
   footer={changed.length>0?<div className="erp-settings-actions"><span role="status">{t(changed.length===1?'{count} unsaved change':'{count} unsaved changes',{count:changed.length})}</span><Button disabled={busy||conflict} onClick={()=>{setDraft(initial);setFailure(undefined);setErrors({});pending.current=undefined;}}>{t('Discard')}</Button><Button variant="primary" disabled={busy||!editable||conflict} onClick={()=>void save()}>{t('Save changes')}</Button></div>:null}
   renderSection={section=><div className="erp-settings-section" data-settings-section><div><h2>{t(section.title)}{section.fields.some(field=>changed.some(item=>item.key===field.key))&&<span className="erp-settings-dirty" title={t('Unsaved changes')}/>}</h2><p>{t(section.description??'')}</p></div><div className="erp-settings-fields"><TemplateFields section={{id:section.id,title:section.title,fields:section.fields.map(templateField)}} values={draft} errors={errors} disabled={busy||!editable||conflict} columns={2} fieldStates={Object.fromEntries(section.fields.map(field=>[field.key,{disabled:field.readOnly}]))} onChange={(key,value)=>setDraft(old=>({...old,[key]:value}))} renderField={field=>field.type==='textarea'?<Textarea label={field.label} rows={3} value={String(draft[field.id]??'')} error={errors[field.id]} required={field.required} disabled={busy||!editable||conflict} onChange={event=>setDraft(old=>({...old,[field.id]:event.target.value}))}/>:field.type==='number'||section.fields.find(item=>item.key===field.id)?.type==='phone'?<Input label={field.label} type={field.type==='number'?'number':'tel'} step={section.fields.find(item=>item.key===field.id)?.type==='currency'?'0.01':'any'} value={String(draft[field.id]??'')} error={errors[field.id]} required={field.required} disabled={busy||!editable||conflict} onChange={event=>setDraft(old=>({...old,[field.id]:field.type==='number'&&event.target.value!==''?Number(event.target.value):event.target.value}))}/>:field.type==='checkbox'?<div className="erp-settings-boolean"><span>{t(field.label)}</span><div className="erp-settings-boolean-row"><Toggle className="inline-flex min-h-0 gap-0 rounded-none border-0 bg-transparent p-0 [&>span]:sr-only" label={field.label} checked={!!draft[field.id]} disabled={busy||!editable||conflict} onChange={value=>setDraft(old=>({...old,[field.id]:value}))}/><small>{t(draft[field.id]?'Yes':'No')}</small></div></div>:undefined}/></div></div>}/>
 </section>;
}
