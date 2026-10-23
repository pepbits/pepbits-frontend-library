'use client';
import {useScreenHost} from '../screen-host';
import React,{useEffect,useRef,useState} from 'react';
import {Button} from '@pepbits/ui';
import {FormErrorSummary,Card,CardHeader,CardTitle,CardContent,RecoveryNotice,failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {dcpWritablePatch,type DcpLoaded,type DcpRuntimeView,type DcpValue} from '../dcp-fields';
import {DcpRuntimeDraft} from './runtime-draft';
import type {DcpRuntimeAdapter,DraftScope} from '@pepbits/data';
import {DcpRuntimeFields} from '../dcp-fields';
/** Host mounts this reusable part inside an existing page engine and preference provider. */
export function DcpHostRuntime({adapter,scopeKey,onDirtyChange,draftScope}:{adapter:DcpRuntimeAdapter;scopeKey:string;draftScope?:DraftScope;onDirtyChange?:(dirty:boolean)=>void}){const host=useScreenHost();return <Runtime key={scopeKey} adapter={adapter} draftScope={draftScope} onDirtyChange={onDirtyChange??host.document.reportDirty}/>;}
function Runtime({adapter,onDirtyChange,draftScope}:{adapter:DcpRuntimeAdapter;draftScope?:DraftScope;onDirtyChange?:(dirty:boolean)=>void}){
 const {t}=useLocalization(),[loaded,setLoaded]=useState<DcpLoaded|null>(null),[view,setView]=useState<DcpRuntimeView|null>(null),[patch,setPatch]=useState<Record<string,DcpValue>>({}),[failure,setFailure]=useState<unknown>(null),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[confirm,setConfirm]=useState(false);
 const generation=useRef(0),request=useRef<AbortController|null>(null),flight=useRef(false),active=useRef(true);const dirty=Object.keys(patch).length>0;
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 const root=useRef<HTMLDivElement>(null);
 const previewed=useRef('');
 const snapshot=useRef('');snapshot.current=JSON.stringify(patch);
 async function run(action:'load'|'preview'|'save'){
  if(action!=='load'&&!loaded)return;if(action==='preview')previewed.current=snapshot.current;if(flight.current)return;flight.current=true;request.current?.abort();const abort=new AbortController();request.current=abort;const id=++generation.current,captured=snapshot.current;setBusy(true);setFailure(null);setSaved(false);
  try{if(action==='load'){const next=await adapter.load(abort.signal);if(!active.current||id!==generation.current)return;setLoaded(next);setView(next.view);setPatch({});}
   else{const current=loaded!,currentView=view??current.view;
    const safe=dcpWritablePatch({...currentView,values:current.view.values},patch),command={expectedVersion:current.version,checksum:current.view.checksum,mode:current.mode,patch:safe};
    const next=await adapter[action](command,abort.signal);if(!active.current||id!==generation.current||captured!==snapshot.current)return;setView(next.view);
    if(action==='save'&&!next.view.violations.length){setLoaded({version:next.version,mode:current.mode,view:next.view});setPatch({});setSaved(true);}
   }
  }catch(e){if(active.current&&!abort.signal.aborted)setFailure(e);}finally{if(id===generation.current){flight.current=false;if(active.current)setBusy(false);}}
 }
 useEffect(()=>{active.current=true;void run('load');return()=>{active.current=false;generation.current++;flight.current=false;request.current?.abort();};},[adapter]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 useEffect(()=>{if(!dirty||!loaded)return;const timer=setTimeout(()=>{if(previewed.current!==snapshot.current&&!flight.current)void run('preview');},500);return()=>clearTimeout(timer);},[JSON.stringify(patch),loaded]);
 function change(id:string,value:DcpValue){setPatch(p=>({...p,[id]:value}));setSaved(false);}
 // Preview re-evaluates server decisions after edits. Writes and uncertain CAS retries are always explicit.
 return <div ref={root} className="space-y-4 p-4" data-dcp-host-runtime><p>{t('designer.v1.boundary')}</p>{failure?<RecoveryNotice failure={failureFromError(failure)} preservesValues onRetry={!loaded?()=>void run('load'):undefined} onReload={()=>setConfirm(true)} onReturn={()=>setConfirm(true)}/>:null}
 {!loaded?<Button disabled={busy} onClick={()=>void run('load')}>{t('designer.loadAnswer')}</Button>:<>
 {draftScope&&<DcpRuntimeDraft scope={draftScope} loaded={loaded} view={view??loaded.view} patch={patch} saved={saved} restore={setPatch}/>}
 <p>{t('designer.v1.revision',{revision:loaded.version})}</p><FormErrorSummary title={t('designer.invalidValues')} errors={(view?.violations??[]).map(v=>({id:v.path,label:t(view?.sections.flatMap(s=>s.fields).find(f=>v.path===f.code||v.path.startsWith(f.code+'['))?.label??''),message:t('designer.v1.error.'+v.code)===('designer.v1.error.'+v.code)?t('designer.invalidValues'):t('designer.v1.error.'+v.code)}))} onFocus={path=>{const control=root.current?.querySelector<HTMLElement>('[name="'+CSS.escape(path)+'"]')??root.current?.querySelector<HTMLElement>('[data-dcp-collection="'+CSS.escape(path.split('[')[0]!!)+'"]');control?.focus();control?.scrollIntoView({block:'nearest'});}}/>
 {view?.sections.map(s=><Card key={s.code}><CardHeader><CardTitle title={s.label}/></CardHeader><CardContent><DcpRuntimeFields fields={s.fields} view={view} values={{...view.values,...patch}} change={change} disabled={busy}/></CardContent></Card>)}
 <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--surface)] py-3"><Button disabled={busy} onClick={()=>void run('preview')}>{t('designer.v1.preview')}</Button><Button disabled={busy||!dirty||!!failure} onClick={()=>void run('save')}>{t('designer.v1.save')}</Button><Button disabled={busy} onClick={()=>dirty?setConfirm(true):void run('load')}>{t('designer.v1.reload')}</Button></div>
 {saved&&<p role="status">{t('designer.v1.saved')}</p>}
 {confirm&&<Card><CardContent><p>{t('designer.v1.conflict')}</p><Button onClick={()=>{setConfirm(false);void run('load');}}>{t('designer.v1.reload')}</Button><Button onClick={()=>setConfirm(false)}>{t('designer.keep')}</Button></CardContent></Card>}
 </>}
 </div>;
}
