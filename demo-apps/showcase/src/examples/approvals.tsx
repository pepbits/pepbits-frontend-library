"use client";
import React,{useMemo} from 'react';
import {createMemoryRecordAdapter,createMemoryDraftAdapter,type ApprovalAdapter,type ApprovalData} from '@pepbits/data';
import {ApprovalWorkspace,RecordApproval} from '@pepbits/patterns/approvals';
import {DraftHost} from '@pepbits/patterns/drafts';
/** Fictional single-reviewer simulation; production eligibility belongs to a server. */
export function createDemoApprovals():ApprovalAdapter {
 const records=createMemoryRecordAdapter(),key=JSON.stringify(['showcase','approvals']);
 const initial:ApprovalData={config:{version:1,stages:[{name:'Review',roles:['editor']}]},canConfigure:true,items:[{recordId:'ITEM-001',requesterId:'fictional-author',requester:'Fictional author',version:1,status:'pending',stage:0,stages:[{name:'Review',roles:['editor']}],canAct:true,canSubmit:false,history:[]}],notifications:[]};
 const read=async()=>{const saved=await records.load<ApprovalData>(key);return {data:saved.record?.values??structuredClone(initial),version:saved.record?.version??0,draftVersion:saved.draftVersion};};
 return {read:async()=> (await read()).data,change:async(_scope,change,operationId)=>{
  const {data,version,draftVersion}=await read();
  if(change.action==='configure'){data.config={version:data.config.version+1,stages:change.stages};}
  if(change.action==='decide')for(const item of data.items.filter(item=>change.items.some(selected=>selected.recordId===item.recordId))){item.status=change.decision==='approve'?'approved':change.decision==='reject'?'rejected':'changes-requested';item.version++;item.canAct=false;item.canSubmit=true;item.history.push({id:operationId,action:change.decision,comment:change.comment,actor:'Fictional reviewer',at:new Date().toISOString(),stage:'Review'});}
  if(change.action==='submit'){const item=data.items.find(item=>item.recordId===change.recordId);if(item){item.status='pending';item.canAct=true;item.canSubmit=false;item.version++;}}
  if(change.action==='mark-read')data.notifications.forEach(item=>{if(change.ids.includes(item.id))item.read=true;});
  return (await records.save(key,data,version,draftVersion,operationId)).record!.values;
 }};
}
export function ApprovalsDemo(){const adapter=useMemo(createDemoApprovals,[]),drafts=useMemo(()=>createMemoryDraftAdapter(),[]);return <DraftHost adapter={drafts} identity="fictional-gallery:showcase:demo-editor" available><ApprovalWorkspace productId="showcase" pageId="items" adapter={adapter} actorId="demo-editor" roleOptions={['editor']}/><details><summary>Record approval</summary><RecordApproval productId="showcase" pageId="items" recordId="ITEM-001" adapter={adapter} actorId="demo-editor" roleOptions={['editor']}/></details></DraftHost>;}
