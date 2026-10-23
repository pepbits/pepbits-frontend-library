import React,{useMemo} from 'react';
import {WorklistPage} from '@pepbits/page-engines/worklist';
import type {WorklistConfig,PageDefinition} from '@pepbits/page-engines/types';
import {NavigationProvider,useNavigation} from '@pepbits/platform/navigation';
import {ScreenHostProvider,useScreenHost} from '@pepbits/patterns/screen-host';
import {useApi,useScopeMemory,listUrl,rememberIds} from './client';
import {useKeystone} from './context';
import {listFields,defaultHidden,primaryField} from './registry';
import {recordAllowed,type ErpTarget} from '../../navigation';
import type {PageDef,ListResponse} from './types';
export function ErpWorklist({def,page,onOpen}:{def:PageDef;page:PageDefinition;onOpen:(target:ErpTarget)=>void}){
 const request=useApi(),memory=useScopeMemory(),{scopeKey}=useKeystone(),host=useScreenHost(),navigation=useNavigation();
 const config=useMemo<WorklistConfig>(()=>({id:page.id,entity:def.entity,title:def.title,description:def.description,rows:[],primaryKey:'id',displayKey:primaryField(def)?.key??'code',columns:listFields(def).map(f=>({key:f.key,label:f.label,type:f.type==='currency'?'money':['number','date','status'].includes(f.type)?f.type as 'number'|'date'|'status':'text',classification:'unclassified',sortable:true,defaultVisible:!defaultHidden(def).includes(f.key)})),basicFilters:def.fields.filter(f=>f.filter).slice(0,3).map(f=>({key:f.key,label:f.label,type:f.options?'select':'text',options:f.options,classification:'unclassified'})),advancedFilters:[]}),[def,page.id]);
 const adapter=useMemo(()=>({identity:scopeKey,applicationId:page.module,request:async(path:string,init?:RequestInit)=>{
  try{
   const body=init?.body?JSON.parse(String(init.body)):{};
   if(path==='/exports')return Response.json(await request(path,init),{status:202});
   if(path==='/worklists/search'){const filters={...body.safeFilters,...body.sensitiveFilters},q=filters.query;delete filters.query;const data=await request<ListResponse>(listUrl(def.entity,{q,page:body.page,size:body.pageSize,sort:body.sort?.key,dir:body.sort?.direction,filters:Object.fromEntries(Object.entries(filters).map(([k,v])=>[k,[v]]))}),{signal:init?.signal});rememberIds(memory,def.slug,data.rows.map(r=>r.id));return Response.json(data);}
   if(path==='/layouts'){const key='keystone.cols.'+def.slug;if(init?.method==='PUT'){await request('/api/view-state',{method:'PUT',body:JSON.stringify({key,value:body.layout.columns})});return Response.json({});}const data=await request<{value:string[]|null}>('/api/view-state?key='+key);return Response.json({layouts:data.value?{[page.id]:{columns:data.value,sort:null}}:{}});}
   throw new Error('This service action is unavailable for the ERP API.');
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Request failed'},{status:typeof (error as {status?:number}).status==='number'?(error as {status:number}).status:502});}
 }}),[scopeKey,page.id,page.module,def,request,memory]);
 const local=useMemo(()=>({...navigation,open:onOpen,openInNewContext:onOpen}),[navigation,onOpen]);
 const access=useMemo(()=>({...host,can:(action:string,context?:unknown)=>action==='archive'?false:action==='create'?recordAllowed(def.template,'new')&&host.can(action,context):action==='edit'?recordAllowed(def.template,'edit')&&host.can(action,context):host.can(action,context)}),[host,def.template]);
 return <NavigationProvider value={local}><ScreenHostProvider value={access}><WorklistPage page={page} config={config} adapter={adapter} personalViews={false} rowClick="open"/></ScreenHostProvider></NavigationProvider>;
}
