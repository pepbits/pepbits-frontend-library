'use client';
import React,{useRef,useState} from 'react';
import {Modal,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Button,Input,Select,Textarea} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {validCatalogSet,validCatalogRelationship,type DesignerCatalog,type DesignerCommand,type CatalogSet,type CatalogRelationship} from '@pepbits/data/dcp-designer';
import type {DesignerAdapter} from '@pepbits/data';
import {DesignerPanel} from './components';
import {CsvOptionsEditor} from '../imports/csv-options-editor';
type Mode='set'|'relationship';
const refKey=(r:{id:string;revision:number})=>`${r.id}@${r.revision}`;
export function CatalogManager({open,close,catalog,canDesign,adapter,update}:{open:boolean;close:()=>void;catalog:DesignerCatalog;canDesign:boolean;adapter:DesignerAdapter;update:(c:DesignerCatalog)=>void}){
 const {t}=useLocalization(),[staged,setStaged]=useState(false),[importKey,setImportKey]=useState(0),[mode,setMode]=useState<Mode>('set'),[selected,setSelected]=useState(''),[name,setName]=useState(''),[options,setOptions]=useState(''),[parent,setParent]=useState(''),[child,setChild]=useState(''),[pairs,setPairs]=useState<Record<string,string>>({}),[expected,setExpected]=useState<number>(),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState<unknown>(null),[message,setMessage]=useState(''),[failedAction,setFailedAction]=useState<'save'|'refresh'>('save'),[pending,setPending]=useState<{mode:Mode;key:string}| 'close'|null>(null);
 const retry=useRef<DesignerCommand|null>(null),inFlight=useRef(false);
 const versions=mode==='set'?catalog.sets:catalog.relationships,editing=versions.find(v=>refKey(v)===selected),disabled=busy||!canDesign;
 const setOptionsList=catalog.sets.map(s=>({value:refKey(s),label:t('designer.catalogVersion',{name:t(s.name),version:s.revision})}));
 const mark=()=>{setDirty(true);setMessage('');setFailure(null);retry.current=null;};
 function load(next:Mode,key:string){setStaged(false);setImportKey(k=>k+1);const rows=next==='set'?catalog.sets:catalog.relationships,record=rows.find(r=>refKey(r)===key);setMode(next);setSelected(key);setName(record?t(record.name):'');setExpected(record?Math.max(...rows.filter(r=>r.id===record.id).map(r=>r.revision)):undefined);setOptions(next==='set'&&record?(record as CatalogSet).options.map(o=>`${o.value}|${t(o.label)}`).join('\n'):'');const r=next==='relationship'&&record?record as CatalogRelationship:null;setParent(r?refKey(r.parent):'');setChild(r?refKey(r.child):'');setPairs(r?Object.fromEntries(r.pairs.map(p=>[p.childValue,p.parentValue])):{});setDirty(false);setFailure(null);setMessage('');retry.current=null;}
 function request(next:Mode,key:string){if(busy)return;if(dirty)setPending({mode:next,key});else load(next,key);}
 function leave(){if(busy)return;if(dirty)setPending('close');else close();}
 async function refresh(){if(inFlight.current)return;inFlight.current=true;setBusy(true);setFailure(null);setFailedAction('refresh');try{const result=await adapter.command({action:'load'});if(!result.catalog)throw new Error('designer.invalidResponse');update(result.catalog);setMessage('designer.catalogRefreshed');}catch(error){setFailure(error);}finally{inFlight.current=false;setBusy(false);}}
 async function save(){if(disabled||staged||inFlight.current)return;const parentSet=catalog.sets.find(s=>refKey(s)===parent),childSet=catalog.sets.find(s=>refKey(s)===child);
  const catalogSet={name,options:options.split('\n').map(line=>{const i=line.indexOf('|');return {value:i<0?line:line.slice(0,i),label:i<0?line:line.slice(i+1)};})};
  const catalogRelationship={name,parent:{id:parentSet?.id??'',revision:parentSet?.revision??0},child:{id:childSet?.id??'',revision:childSet?.revision??0},pairs:(childSet?.options??[]).map(o=>({childValue:o.value,parentValue:Object.hasOwn(pairs,o.value)?pairs[o.value]!:''}))};
  if(!(mode==='set'?validCatalogSet(catalogSet):validCatalogRelationship(catalogRelationship,catalog.sets))){setMessage('designer.catalogInvalid');return;}
  const command=retry.current??{action:mode==='set'?'save-value-set':'save-relationship',id:editing?.id,revision:expected,operationId:crypto.randomUUID(),...(mode==='set'?{catalogSet}:{catalogRelationship})} satisfies DesignerCommand;
  retry.current=command;setFailedAction('save');inFlight.current=true;setBusy(true);setFailure(null);
  try{const result=await adapter.command(command);if(!result.catalog)throw new Error('designer.invalidResponse');update(result.catalog);load(mode,'');setMessage('designer.catalogSaved');}catch(error){setFailure(error);}finally{inFlight.current=false;setBusy(false);}
 }
 return <Modal open={open} onClose={leave} title={t('designer.catalogManage')} subtitle={t('designer.catalogScope')} size="xl" footer={<><Button disabled={busy} onClick={leave}>{t('designer.catalogClose')}</Button><Button disabled={disabled||staged||!dirty} onClick={()=>void save()}>{t('designer.catalogSaveVersion')}</Button></>}>
  <div className="space-y-4">
   <div className="flex flex-wrap gap-2"><Button variant={mode==='set'?'primary':'secondary'} disabled={busy} onClick={()=>request('set','')}>{t('designer.catalogSets')}</Button><Button variant={mode==='relationship'?'primary':'secondary'} disabled={busy} onClick={()=>request('relationship','')}>{t('designer.catalogRelationships')}</Button><Button disabled={busy} onClick={()=>void refresh()}>{t('designer.catalogRefresh')}</Button></div>
   {!!failure&&<RecoveryNotice failure={failureFromError(failure)} onRetry={()=>void (failedAction==='refresh'?refresh():save())}/>}
   <p role="status">{message?t(message):t('designer.catalogPinned')}</p>
   {pending&&<DesignerPanel title="designer.unsaved"><p>{t('designer.discardWarning')}</p><Button onClick={()=>{if(pending==='close'){load(mode,'');close();}else load(pending.mode,pending.key);setPending(null);}}>{t('designer.discard')}</Button><Button onClick={()=>setPending(null)}>{t('designer.keep')}</Button></DesignerPanel>}
   <Select aria-label={t('designer.catalogOpen')} label={t('designer.catalogOpen')} value={selected} disabled={busy} placeholder={t('designer.catalogNew')} options={versions.map(r=>({value:refKey(r),label:t('designer.catalogVersion',{name:t(r.name),version:r.revision})}))} onChange={e=>request(mode,e.target.value)}/>
   <Input label={t('designer.catalogName')} value={name} disabled={disabled} onChange={e=>{mark();setName(e.target.value);}}/>
   {mode==='set'?<><CsvOptionsEditor key={importKey} disabled={disabled} onStage={()=>{mark();setStaged(true);}} onCancel={()=>setStaged(false)} onApply={value=>{mark();setStaged(false);setOptions(value);}}/><Textarea label={t('designer.options')} value={options} disabled={disabled} onChange={e=>{mark();setOptions(e.target.value);}}/></>:<>
    <Select aria-label={t('designer.catalogParent')} label={t('designer.catalogParent')} value={parent} disabled={disabled} options={setOptionsList} onChange={e=>{mark();setParent(e.target.value);setPairs({});}}/>
    <Select aria-label={t('designer.catalogChild')} label={t('designer.catalogChild')} value={child} disabled={disabled} options={setOptionsList} onChange={e=>{mark();setChild(e.target.value);setPairs({});}}/>
    {(catalog.sets.find(s=>refKey(s)===child)?.options??[]).map(o=><Select key={o.value} aria-label={t('designer.parentFor',{label:t(o.label)})} label={t('designer.parentFor',{label:t(o.label)})} value={Object.hasOwn(pairs,o.value)?pairs[o.value]!:''} disabled={disabled||!parent} options={catalog.sets.find(s=>refKey(s)===parent)?.options??[]} onChange={e=>{mark();setPairs({...pairs,[o.value]:e.target.value});}}/>)}</>}
  </div>
 </Modal>;
}
