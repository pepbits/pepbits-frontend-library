import {useEffect,useRef,useState} from 'react';
import {WorkflowBoard} from '@pepbits/patterns/board';
import {useScreenHost,useFormatters} from '@pepbits/patterns/screen-host';
import {Card,LoadingState,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Button,Input,Select,Segmented} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useEntityApi,useFetch,useScopeMemory,rememberIds,listUrl} from './client';
import {ErpWorklist} from './worklist';
import type {PageDef,Row,ListResponse} from './types';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {ErpTarget} from '../../navigation';

export function CaseBoard({def,page,onOpen}:{def:PageDef;page:PageDefinition;onOpen:(target:ErpTarget)=>void}) {
 const {t}=useLocalization(),host=useScreenHost(),format=useFormatters(),api=useEntityApi(),memory=useScopeMemory(),fetched=useFetch<ListResponse>(listUrl(def.entity,{size:1000,sort:'created',dir:'desc'}));
 const [mode,setMode]=useState('board'),[query,setQuery]=useState(''),[priority,setPriority]=useState(''),[assignee,setAssignee]=useState(''),[busy,setBusy]=useState(false),[failure,setFailure]=useState<unknown>();
 const pending=useRef<{row:Row;status:string;operationId:string}|undefined>(undefined),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const rows=fetched.data?.rows??[],shown=rows.filter(row=>(!query||Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase()))&&(!priority||row.priority===priority)&&(!assignee||row.assignee===assignee));
 const visibleIds=JSON.stringify(shown.map(row=>row.id));useEffect(()=>{rememberIds(memory,def.slug,JSON.parse(visibleIds));},[memory,def.slug,visibleIds]);
 const move=async(row:Row,status:string)=>{
  if(busy||!host.can('edit')||!def.statusFlow?.includes(status)||row.status===status)return;
  if(pending.current?.row!==row||pending.current.status!==status)pending.current={row,status,operationId:crypto.randomUUID()};
  setBusy(true);setFailure(undefined);
  try{const saved=await api.update(def.entity,row.id,{status,expectedVersion:row.version??0,operationId:pending.current.operationId});if(!live.current)return;fetched.setData(data=>data?{...data,rows:data.rows.map(item=>item.id===saved.id?saved:item)}:data);pending.current=undefined;host.notify(t('Changes saved'),{tone:'success'});}
  catch(error){if(live.current)setFailure(error);}finally{if(live.current)setBusy(false);}
 };
 const options=(key:string)=>[...new Set(rows.map(row=>String(row[key]??'')).filter(Boolean))].sort().map(value=>({value,label:value}));
 return <div className="space-y-3" aria-busy={fetched.loading}><Card className="flex flex-wrap items-end gap-3 p-3"><Segmented label="View" value={mode} onChange={setMode} options={[{value:'board',label:'Board'},{value:'list',label:'List'}]}/>{mode==='board'&&<><Input label="Search" value={query} onChange={event=>setQuery(event.target.value)}/><Select label="Priority" value={priority} options={[{value:'',label:'Any priority'},...options('priority')]} onChange={event=>setPriority(event.target.value)}/><Select label="Assignee" value={assignee} options={[{value:'',label:'Everyone'},...options('assignee')]} onChange={event=>setAssignee(event.target.value)}/>{host.can('create')&&<Button onClick={()=>onOpen({pageId:page.id,mode:'new'})}>{t('New')}</Button>}</>}</Card>
  {!!failure&&<><RecoveryNotice failure={failureFromError(failure)} onRetry={()=>{if(pending.current)void move(pending.current.row,pending.current.status);}}/><Button disabled={busy} onClick={()=>{pending.current=undefined;setFailure(undefined);fetched.reload();}}>{t('Reload')}</Button></>}
  {fetched.error?<RecoveryNotice failure={failureFromError(new Error(fetched.error))} onRetry={fetched.reload}/>:mode==='list'?<ErpWorklist def={def} page={page} onOpen={onOpen}/>:!fetched.data?<LoadingState/>:<WorkflowBoard label={def.title} columns={(def.statusFlow??[]).map(id=>({id,label:id}))} items={shown} itemId={row=>row.id} itemLabel={row=>String(row.subject??row.code??row.id)} columnId={row=>row.status} disabled={busy||!host.can('edit')} onOpen={row=>onOpen({pageId:page.id,recordId:row.id,mode:'view'})} onMove={(row,status)=>void move(row,status)} renderItem={row=><p>{String(row.code??'')} · {t(String(row.priority??''))}<br/>{String(row.assignee??'')} · {row.created?format.date(row.created):''}</p>}/>}
 </div>;
}
