"use client";
import React,{useMemo} from 'react';
import {WorklistPage,type PersonalViewLayout,type WorklistAdapter} from '@pepbits/page-engines/worklist';
import type {WorklistConfig,PageDefinition} from '@pepbits/page-engines/types';
const page:PageDefinition={id:'items',title:'Items',subtitle:'Fictional stock items',entity:'item',module:'gallery',kind:'worklist'};
const config:WorklistConfig={id:'items',entity:'item',title:'Items',description:'Search, sort and preview fictional items.',primaryKey:'id',displayKey:'name',rows:[],basicFilters:[{key:'q',label:'Search items',type:'text',classification:'operational'}],advancedFilters:[],columns:[{key:'id',label:'ID',classification:'operational'},{key:'name',label:'Name',sortable:true,classification:'operational'},{key:'amount',label:'Amount',type:'money',sortable:true,classification:'operational'},{key:'status',label:'Status',type:'status',classification:'operational'}]};
/** Relative request paths are handled in memory; no HTTP is sent. */
export function createDemoWorklist():WorklistAdapter {
 let rows=Array.from({length:36},(_,i)=>({id:`ITEM-${i+1}`,name:`Fictional item ${i+1}`,amount:(i+1)*17,status:i%3?'Active':'Pending'}));
 const layouts:Record<string,unknown>={};let personal:Array<{id:string;label:string;version:number;isDefault:boolean;layout:PersonalViewLayout}>=[];
 return {identity:'fictional-gallery:showcase:demo-editor',applicationId:'showcase',sessionAvailable:true,actor:{id:'demo-editor',name:'Fictional editor'},request:async(path,init)=>{
 const body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(path==='/worklists/search'){const query=String(body.safeFilters?.query??body.sensitiveFilters?.query??body.safeFilters?.q??body.sensitiveFilters?.q??'').toLowerCase();let shown=rows.filter(row=>row.name.toLowerCase().includes(query));if(body.sort){const {key,direction}=body.sort;shown=[...shown].sort((a,b)=>String(a[key as keyof typeof a]).localeCompare(String(b[key as keyof typeof b]),undefined,{numeric:true})*(direction==='desc'?-1:1));}const pageSize=body.pageSize??20,page=body.page??1;return Response.json({rows:shown.slice((page-1)*pageSize,page*pageSize),total:shown.length,page});}
 if(path.startsWith('/layouts')){if(init?.method==='PUT')layouts[body.pageId]=body.layout;return Response.json({layouts});}
 if(path.startsWith('/personal-views')){if(body.action==='create')personal=[...personal,{id:crypto.randomUUID(),label:body.label,layout:body.layout,version:1,isDefault:false}];if(body.action==='delete')personal=personal.filter(item=>item.id!==body.id);if(body.action==='rename'||body.action==='default')personal=personal.map(item=>item.id===body.id?{...item,label:body.label??item.label,isDefault:body.isDefault??item.isDefault,version:item.version+1}:item);return Response.json({views:personal});}
 if(path==='/worklists/archive'){rows=rows.filter(row=>!(body.ids??[]).includes(row.id));return Response.json({results:(body.ids??[]).map((id:string)=>({id,ok:true}))});}
 if(path==='/exports')return Response.json({ok:true});
 if(path.startsWith('/worklists/'))return Response.json({record:rows.find(row=>path.endsWith('/'+row.id))});
 return Response.json({error:'This operation is not part of the fictional adapter'}, {status:404});
 }};
}
export function WorklistDemo(){const adapter=useMemo(createDemoWorklist,[]);return <WorklistPage page={page} config={config} adapter={adapter}/>;}
