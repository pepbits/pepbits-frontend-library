import React,{useMemo,useRef,useState} from 'react';
import {RecoveryNotice,failureFromError} from '@pepbits/components';
import {WorklistPage} from '@pepbits/page-engines/worklist';
import type {WorklistConfig,PageDefinition} from '@pepbits/page-engines/types';
import {NavigationProvider,useNavigation} from '@pepbits/platform/navigation';
import {ScreenHostProvider,useScreenHost} from '@pepbits/patterns/screen-host';
import {useApi,useScopeMemory,listUrl,rememberIds} from './client';
import {useKeystone} from './context';
import {listFields,defaultHidden,primaryField} from './registry';
import {ErpFilters,ErpPersonalViews,filterFields,sourceFilters,decodeCondition} from './personal-views';
import {recordAllowed,type ErpTarget} from '../../navigation';
import type {PageDef,ListResponse} from './types';
export function ErpWorklist({def,page,onOpen,onLoaded,refreshKey}:{def:PageDef;page:PageDefinition;onOpen:(target:ErpTarget)=>void;onLoaded?:(result:ListResponse)=>void;refreshKey?:string|number}){
 const parentDefault=useRef('');
 const [layoutFailure,setLayoutFailure]=useState<unknown>(),[layoutRevision,setLayoutRevision]=useState(0),failedLayout=useRef<RequestInit|undefined>(undefined);
 const loaded=useRef(onLoaded);loaded.current=onLoaded;
 const request=useApi(),memory=useScopeMemory(),{scopeKey}=useKeystone(),host=useScreenHost(),navigation=useNavigation();
 const config=useMemo<WorklistConfig>(()=>({id:page.id,entity:def.entity,title:def.title,description:def.description,rows:[],primaryKey:'id',displayKey:primaryField(def)?.key??'code',columns:listFields(def).map(f=>({key:f.key,label:f.label,type:f.type==='currency'?'money':['number','date','status'].includes(f.type)?f.type as 'number'|'date'|'status':'text',classification:'unclassified',sortable:true,defaultVisible:!defaultHidden(def).includes(f.key)})),basicFilters:def.fields.filter(f=>f.filter).slice(0,3).map(f=>({key:f.key,label:f.label,type:f.options?'select':'text',options:f.options,classification:'unclassified'})),advancedFilters:def.template==='print'?[]:filterFields(def).filter(f=>!def.fields.filter(f=>f.filter).slice(0,3).some(b=>b.key===f.key)).map(f=>({key:f.key,label:f.label,type:'text',classification:'unclassified'}))}),[def,page.id]);
 const adapter=useMemo(()=>({identity:scopeKey+':layout:'+layoutRevision,applicationId:page.module,request:async(path:string,init?:RequestInit)=>{
  try{
   const body=init?.body?JSON.parse(String(init.body)):{};
   if(path==='/exports')return Response.json(await request(path,init),{status:202});
   if(path==='/worklists/search'){const filters={...body.safeFilters,...body.sensitiveFilters},q=filters.query;delete filters.query;const data=await request<ListResponse>(listUrl(def.entity,{q,page:body.page,size:body.pageSize,sort:body.sort?.key,dir:body.sort?.direction,filters:def.template==='print'?Object.fromEntries(Object.entries(filters).map(([key,value])=>[key,[value]])):sourceFilters(def,filters)}),{signal:init?.signal});rememberIds(memory,def.slug,data.rows.map(r=>r.id));if(!init?.signal?.aborted)loaded.current?.(data);return Response.json(data);}
   if(path==='/layouts'){setLayoutFailure(undefined);const key='keystone.cols.'+def.slug;if(init?.method==='PUT'){await request('/api/view-state',{method:'PUT',body:JSON.stringify({key,value:def.template==='print'?body.layout.columns:listFields(def).map(field=>field.key).filter(key=>!body.layout.columns.includes(key))})});return Response.json({});}const data=await request<{value:string[]|null}>('/api/view-state?key='+key);return Response.json({layouts:data.value?{[page.id]:{columns:def.template==='print'?data.value:listFields(def).map(field=>field.key).filter(key=>!data.value!.includes(key)),sort:null}}:{}});}
   throw new Error('This service action is unavailable for the ERP API.');
  }catch(error){if(path==='/layouts'){failedLayout.current=init;setLayoutFailure(error);}return Response.json({error:error instanceof Error?error.message:'Request failed'},{status:typeof (error as {status?:number}).status==='number'?(error as {status:number}).status:502});}
 }}),[scopeKey,page.id,page.module,def,request,memory,layoutRevision]);
 const local=useMemo(()=>{const open=(target:ErpTarget)=>onOpen(target.mode==='new'&&def.parent&&parentDefault.current?{...target,query:new URLSearchParams({[def.parent.key]:parentDefault.current}).toString()}:target);return {...navigation,open,openInNewContext:open};},[navigation,onOpen,def]);
 const access=useMemo(()=>({...host,can:(action:string,context?:unknown)=>action==='archive'?false:action==='create'?recordAllowed(def.template,'new')&&host.can(action,context):action==='edit'?recordAllowed(def.template,'edit')&&host.can(action,context):host.can(action,context)}),[host,def.template]);
 return <NavigationProvider value={local}><ScreenHostProvider value={access}><>{!!layoutFailure&&<RecoveryNotice failure={failureFromError(layoutFailure)} onRetry={()=>{if(failedLayout.current)void adapter.request('/layouts',failedLayout.current);else{setLayoutFailure(undefined);setLayoutRevision(value=>value+1);}}}/>}<WorklistPage refreshKey={refreshKey} key={layoutRevision} page={page} config={config} adapter={adapter} personalViews={false} renderViewControls={def.template==='print'?undefined:controls=><ErpPersonalViews def={def} {...controls}/>} renderFilters={def.template==='print'?undefined:controls=>{const value=def.parent?decodeCondition(controls.values[def.parent.key]??''):'';parentDefault.current=Array.isArray(value)?value.length===1?String(value[0]):'':typeof value==='string'?value:'';return <ErpFilters def={def} {...controls}/>;}} rowClick="open"/></></ScreenHostProvider></NavigationProvider>;
}
