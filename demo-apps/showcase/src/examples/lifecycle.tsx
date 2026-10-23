"use client";
import React,{useMemo} from 'react';
import {createMemoryRecordAdapter} from '@pepbits/data';
import {LifecycleConfigurationPage,emptyLifecycleDefinition,type LifecycleApi,type LifecycleVersionDetail,type LifecycleMetadataResult} from '@pepbits/patterns/lifecycle';
/** Draft editing simulation only; governance requires independent server actors. */
export function createDemoLifecycle():LifecycleApi {
 const records=createMemoryRecordAdapter(),key=JSON.stringify(['showcase','item-flow']);
 const definition=emptyLifecycleDefinition('showcase','item-flow','Fictional item flow');definition.label='Fictional item flow';
 const initial:LifecycleVersionDetail={activation:null,version:{application:'showcase',code:'item-flow',version:1,status:'DRAFT',revision:0,checksum:'a'.repeat(64),approvedChecksum:null,definition,editors:['demo-editor'],createdBy:'demo-editor',createdAt:'2026-10-23T10:00:00Z',updatedBy:'demo-editor',updatedAt:'2026-10-23T10:00:00Z',approvedBy:null,approvedAt:null,approvalComment:null,publishedBy:null,publishedAt:null}};
 const detail=async()=>structuredClone((await records.load<LifecycleVersionDetail>(key)).record?.values??initial);
 const report=async()=>({valid:true,activatable:false,checksum:'a'.repeat(64),issues:[]});
 const unsupported=async():Promise<never>=>{throw new Error('Independent governance is outside this local draft simulation');};
 const metadata:LifecycleMetadataResult={available:true,host:null,schemaVersion:1,targetKinds:['FORM'],supportedTargetKinds:['FORM'],dimensionTypes:['STRING','NUMBER','BOOLEAN','DATE'],operators:['IN','WITHIN','RANGE'],statuses:['DRAFT','APPROVED','PUBLISHED'],outcomes:['MATCH','NO_MATCH','UNKNOWN'],reservedDimensions:['organisation','subject-type'],limits:{stages:256,events:512,lifecycles:64,bindings:1024,dimensions:64,constraints:32,values:256,pageSize:100}};
 return {metadata:async()=>metadata,list:async()=>{const {version:v}=await detail();return {items:[{application:v.application,code:v.code,version:v.version,label:v.definition.label,status:v.status,revision:v.revision,checksum:v.checksum,updatedAt:v.updatedAt,active:false}],nextCursor:null};},detail,
 createDraft:unsupported,saveDraft:async(request,mutation)=>{const previous=await detail();const next={...previous,version:{...previous.version,definition:request.definition,revision:request.expectedRevision+1,updatedAt:new Date().toISOString()}};await records.save(key,next,request.expectedRevision,(await records.load(key)).draftVersion,mutation.operationKey);return next;},approve:unsupported,publish:unsupported,activate:unsupported,activation:async()=>null,validate:report,validateVersion:report,resolve:async()=>({application:'showcase',code:'item-flow',version:1,checksum:'a'.repeat(64),activationRevision:0,slots:[]})};
}
export function LifecycleDemo(){const api=useMemo(createDemoLifecycle,[]);return <div><p>Edit and save a fictional lifecycle draft. Validation is illustrative; approval, publication and activation need a real host.</p><LifecycleConfigurationPage api={api} scopeKey="fictional-gallery:showcase:demo-editor" application={{code:'showcase',label:'Showcase'}} actorId="demo-editor" permissions={{read:true,edit:true,approve:false,publish:false,activate:false,resolve:true}}/></div>;}
