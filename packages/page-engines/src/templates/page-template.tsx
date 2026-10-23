"use client";
import {usePreferences} from "@pepbits/preferences/react";
import {useFormatters,useScreenHost} from "@pepbits/patterns/screen-host";
import React,{useEffect,useRef,useState} from 'react';
import {PresentationProvider, Card, CardHeader, CardTitle, CardContent, CardGrid, Tabs, DescriptionList, EmptyState, LoadingState, AccessDenied, ConfirmDialog, RecoveryNotice, failureFromError} from "@pepbits/components";
import {Button, Badge, Input, Textarea} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {type PageTemplateDefinition, type TemplateDocument, type TemplateLayout} from "../types";
import {RegistryTemplateBody} from './registry-template';
import {TemplateHierarchy,TemplateDocuments,TemplateImport} from './template-specialized';
import {TemplateFields,TemplateSummary,TemplateTimeline,TemplateChecklist} from './template-parts';
import {TemplateLines,TemplateList,TemplateBooking,TemplateReport,TemplateReconcile,TemplateAdministration,TemplateChart,type TemplateEngineProps} from './template-engines';
import {validateTemplate,type TemplateScope,type PageTemplateAdapter,type TemplateSaveRequest} from './template-state';
export interface PageTemplateProps {definition:PageTemplateDefinition;scope:TemplateScope;initialDocument:TemplateDocument;adapter?:PageTemplateAdapter;layout?:TemplateLayout;readOnly?:boolean;state?:'ready'|'loading'|'empty'|'denied';onSaved?:(document:TemplateDocument)=>void;support?:React.ReactNode}
/** Scope changes remount the editor. No browser persistence, credentials or implicit API calls. */
export function PageTemplateWorkspace(props:PageTemplateProps) {
 const {preferences}=usePreferences();
 return <PresentationProvider value={preferences}><TemplateEditor key={JSON.stringify([props.scope,props.definition.id])} {...props}/></PresentationProvider>;
}
function TemplateEditor({definition,scope,initialDocument,adapter,layout,readOnly=false,state='ready',onSaved,support}:PageTemplateProps) {
 const {t}=useLocalization(),{preferences,isLocked}=usePreferences(),format=useFormatters(),host=useScreenHost();
 const [document,setDocument]=useState(()=>structuredClone(initialDocument)),[section,setSection]=useState(definition.sections[0]?.id??''),[tab,setTab]=useState('overview'),[errors,setErrors]=useState<Record<string,string>>({}),[failure,setFailure]=useState<unknown>(null),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[dirty,setDirty]=useState(false),[latest,setLatest]=useState<TemplateDocument|null>(null);
 const [discardOpen,setDiscardOpen]=useState(false);
 useEffect(()=>host.document.reportDirty(dirty),[host.document.reportDirty,dirty]);
 const checkpoint=useRef(structuredClone(initialDocument));
 const pending=useRef<TemplateSaveRequest|null>(null),inFlight=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const effectiveLayout=isLocked("formNavigation") ? preferences.formNavigation : layout??preferences.formNavigation;
 const disabled=readOnly||busy||!definition.editable||!adapter;
 const update=(next:TemplateDocument)=>{if(disabled)return;pending.current=null;setDocument(next);setDirty(true);setSaved(false);setFailure(null);};
 const save=async()=>{
  if(inFlight.current||disabled||!adapter)return;
  const problems=validateTemplate(definition,document);setErrors(problems);
  if(Object.keys(problems).length){const first=definition.sections.find(item=>item.fields.some(field=>problems[field.id]));if(first)setSection(first.id);return;}
  const request=pending.current??{scope:{...scope,recordId:document.id},templateId:definition.id,document:structuredClone(document),expectedVersion:document.version,operationId:crypto.randomUUID()};pending.current=request;inFlight.current=true;setBusy(true);setFailure(null);
  let acknowledged:TemplateDocument|null=null;
  try {const result=await adapter.save(request);if(!alive.current)return;if((typeof result.id!=='string'||!result.id||(request.expectedVersion>0&&result.id!==document.id))||!Number.isSafeInteger(result.version)||result.version<=request.expectedVersion||!result.values||!Array.isArray(result.lines)||!Array.isArray(result.rows))throw {status:502};checkpoint.current=structuredClone(result);setDocument(structuredClone(result));pending.current=null;setDirty(false);setSaved(true);acknowledged=result;}
  catch(error){if(alive.current)setFailure(error);}
  finally{inFlight.current=false;if(alive.current)setBusy(false);}
  if(acknowledged&&alive.current)onSaved?.(acknowledged);
 };
 const reviewLatest=async()=>{if(!adapter?.load||inFlight.current)return;inFlight.current=true;setBusy(true);try{const value=await adapter.load({...scope,recordId:document.id},definition.id);if(alive.current){if(value.id!==document.id||!Number.isSafeInteger(value.version)||value.version<document.version||!value.values||!Array.isArray(value.lines)||!Array.isArray(value.rows))throw {status:502};setLatest(value);}}catch(error){if(alive.current)setFailure(error);}finally{inFlight.current=false;if(alive.current)setBusy(false);}};
 const props:TemplateEngineProps={preferences,definition,document,update,disabled,errors,format,density:preferences.density,precision:preferences.decimalPlaces,pageSize:preferences.pageSize,resultView:preferences.resultView};
 const fields=(all=false)=><div className={effectiveLayout==='rail'&&!all&&definition.sections.length>1?'grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]':'space-y-4'}>
  {!all&&definition.sections.length>1?<Tabs items={definition.sections.map(item=>({id:item.id,label:item.title,badge:item.fields.some(field=>errors[field.id])?'!':undefined}))} value={section} onChange={setSection} orientation={effectiveLayout==='rail'?'vertical':'horizontal'} variant={effectiveLayout==='rail'?'pills':'line'}/>:null}
  <div className="space-y-3">{definition.sections.filter(item=>all||item.id===section).map(item=><TemplateFields key={item.id} section={item} values={document.values} errors={errors} disabled={disabled} onChange={(id,value)=>update({...document,values:{...document.values,[id]:value}})}/>)}
   {!all&&definition.sections.length>1&&effectiveLayout==='wizard'?<div className="flex justify-between gap-2"><Button disabled={definition.sections.findIndex(item=>item.id===section)===0} onClick={()=>setSection(definition.sections[definition.sections.findIndex(item=>item.id===section)-1]!.id)}>{t('template.previous')}</Button><Button disabled={definition.sections.findIndex(item=>item.id===section)===definition.sections.length-1} onClick={()=>setSection(definition.sections[definition.sections.findIndex(item=>item.id===section)+1]!.id)}>{t('template.next')}</Button></div>:null}
  </div>
 </div>;
 let body:React.ReactNode;
 switch(definition.engine){
  case 'master':body=<div className="space-y-4">{fields()}{definition.id==='template-hierarchical-master'?<TemplateHierarchy {...props}/>:null}</div>;break;
  case 'list':body=<TemplateList {...props}/>;break;
  case 'booking':body=<TemplateBooking {...props}/>;break;
  case 'order':case 'finance':body=<div className="space-y-4">{fields()}<TemplateLines {...props} financial={definition.engine==='finance'}/></div>;break;
  case 'result':body=<div className="space-y-4">{fields()}{definition.view==='document'?<Card><CardContent><Textarea label="template.field.findings" value={String(document.values.findings)} disabled={disabled} onChange={event=>update({...document,values:{...document.values,findings:event.target.value}})}/></CardContent></Card>:<TemplateLines {...props} result/>}{definition.view==='timeline'?<TemplateChart rows={document.rows} format={format}/>:null}</div>;break;
  case 'case':body=<div className="space-y-4">{fields()}<CardGrid columns={2}><TemplateChecklist lines={document.lines} disabled={disabled} onChange={lines=>update({...document,lines})}/><TemplateTimeline rows={document.rows.slice(0,3)}/></CardGrid></div>;break;
  case 'report':case 'dashboard':body=<TemplateReport {...props}/>;break;
  case 'reconcile':body=<TemplateReconcile {...props}/>;break;
  case 'admin':body=definition.id==='template-import-wizard'?<TemplateImport {...props}/>:<TemplateAdministration {...props}/>;break;
  case 'entity':body=definition.id==='template-document-workspace'||definition.id==='template-communication-workspace'?<TemplateDocuments {...props} communication={definition.id==='template-communication-workspace'}/>:<div className="space-y-4"><Tabs items={['overview','history','related','documents'].map(id=>({id,label:`template.${id}`}))} value={tab} onChange={setTab}/>{tab==='overview'?fields(true):tab==='history'?<TemplateTimeline rows={document.rows}/>:tab==='related'?<TemplateList {...props}/>:<Card><CardContent><DescriptionList items={document.lines.map(line=>({id:line.id,label:line.description,value:<Badge>{t('template.sampleDocument')}</Badge>}))}/></CardContent></Card>}</div>;break;
 }
 return <section className="space-y-4" data-page-template={definition.id} data-template-engine={definition.engine} style={{'--fs-scale':'var(--fs-form)'} as React.CSSProperties}>
  <Card className="overflow-hidden"><div className="h-1 bg-[var(--primary)]"/><CardContent className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{t(`template.group.${definition.group}`)}</Badge><Badge tone={dirty?'warning':'success'}>{t(dirty?'template.unsaved':'template.ready')}</Badge><span className="text-xs text-[var(--text-muted)]">{document.id}</span></div><h2 className="text-2xl font-bold tracking-tight">{t(definition.title)}</h2><p className="max-w-3xl text-sm text-[var(--text-muted)]">{t(definition.description)}</p></div>{definition.editable&&!definition.designFamily?<Button data-tour="template-actions" variant="primary" loading={busy} disabled={disabled||state!=='ready'} onClick={()=>void save()}>{t('template.save')}</Button>:null}</CardContent></Card>
  {saved?<p role="status" className="rounded-lg bg-[var(--primary-soft)] p-3 text-sm">{t('template.saved')}</p>:null}
  {failure&&adapter?.load&&(failure as {status?:number}).status===409?<Button disabled={busy} onClick={()=>void reviewLatest()}>{t('template.reviewLatest')}</Button>:null}
  <ConfirmDialog open={!!latest} title="template.reviewLatest" message="template.replaceLocalHelp" confirmLabel="template.replaceLocal" onCancel={()=>setLatest(null)} onConfirm={()=>{if(latest){checkpoint.current=structuredClone(latest);setDocument(structuredClone(latest));pending.current=null;setDirty(false);setFailure(null);setErrors({});setLatest(null);}}}/>
  {failure?<RecoveryNotice failure={failureFromError(failure)} onRetry={()=>void save()} onReturn={()=>setFailure(null)} preservesValues busy={busy}/>:null}
  {Object.keys(errors).length?<Card><CardContent><div role="alert" className="space-y-1 text-sm text-[var(--danger-ink)]">{[...new Set(Object.values(errors))].map(error=><p key={error}>{t(error)}</p>)}</div></CardContent></Card>:null}
  <ConfirmDialog open={discardOpen} title="template.clinical.discard" message="template.replaceLocalHelp" confirmLabel="template.clinical.discard" onCancel={()=>setDiscardOpen(false)} onConfirm={()=>{setDocument(structuredClone(checkpoint.current));setDirty(false);setErrors({});setFailure(null);pending.current=null;setDiscardOpen(false);}}/>
  {state==='loading'?<LoadingState/>:state==='denied'?<AccessDenied/>:state==='empty'?<EmptyState/>:definition.designFamily==='registry'?<RegistryTemplateBody {...props} section={section} onSection={setSection} dirty={dirty} busy={busy} onSave={()=>void save()} onDiscard={()=>setDiscardOpen(true)}/>:<CardGrid className="items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]"><div className="min-w-0" data-tour="template-body">{body}</div><aside className="space-y-4"><TemplateSummary document={document}/>{support??<Card><CardHeader><CardTitle title="template.integration"/></CardHeader><CardContent className="space-y-2 text-sm text-[var(--text-muted)]"><p>{t('template.adapterHelp')}</p><p>{t('template.preferenceHelp')}</p></CardContent></Card>}</aside></CardGrid>}
 </section>;
}
