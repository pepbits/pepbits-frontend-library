'use client';
import React,{useMemo} from 'react';
import {DeviceIntegrationWorkspace,type IntegrationCommand,type IntegrationAdapter,type IntegrationLibrary,type IntegrationJob} from '@pepbits/patterns/device-integrations';
import {createDeviceConnector} from '@pepbits/platform/devices';
import {withDeviceConnector} from '@pepbits/platform/device-workflows';
/** Queue and connector are session memory; there is no physical device. */
export function createDemoDevices():IntegrationAdapter{
 const library:IntegrationLibrary={devices:[{id:'printer',title:'Fictional printer',transport:'native',capabilities:['label']}],records:[{id:'item-a',code:'ITEM-A',title:'Fictional item',context:'items'}],rules:[],jobs:[],stationId:'example-station',defaultDevice:'printer',policy:{version:1,lockedDevice:'',automatic:false,maxCopies:10},canManage:false};
 const operations=new Map<string,unknown>();
 const adapter:IntegrationAdapter={library:async()=>structuredClone(library),async command<T>(input:IntegrationCommand):Promise<T>{
  if(input.operationId&&operations.has(input.operationId))return structuredClone(operations.get(input.operationId)) as T;
  let result:unknown=library;
  if(input.action==='enqueue'){const job:IntegrationJob={id:input.operationId!,owner:'demo',stationId:input.stationId,deviceId:input.deviceId!,capability:input.capability!,recordId:input.recordId!,eventId:'',status:'queued',copies:input.copies??1,createdAt:new Date().toISOString(),title:'Fictional item',lines:['ITEM-A'],attempts:0};library.jobs.push(job);result=job;}
  else if(input.action==='lookup')result=library.records.find(r=>r.code===input.code&&r.context===input.context);
  else if(input.action==='dispatch'||input.action==='cancel'){const job=library.jobs.find(j=>j.id===input.jobId)!;if(input.action==='cancel')job.status='cancelled';result=job;}
  else if(input.action==='preference')library.defaultDevice=input.deviceId!;
  if(input.operationId)operations.set(input.operationId,structuredClone(result));return structuredClone(result) as T;
 }};
 return withDeviceConnector(adapter,{connector:createDeviceConnector(async(_method,payload)=>({jobId:(payload as {jobId:string}).jobId,state:'accepted'})),ticket:async job=>({jobId:job.id,deviceId:job.deviceId,contentReference:'fictional-content',expiresAt:new Date(Date.now()+120000).toISOString()}),acknowledge:async(job,result)=>{const next={...job,status:result.state,attempts:job.attempts+1};library.jobs=library.jobs.map(j=>j.id===next.id?next:j);return next;}});
}
export function DeviceIntegrationsDemo(){const adapter=useMemo(createDemoDevices,[]);return <div><p>Queue a fictional label and dispatch through an in-memory platform device port.</p><DeviceIntegrationWorkspace adapter={adapter} scopeKey="showcase:devices" stationId="example-station" mode="workbench" contexts={[{value:'items',label:'Items'}]}/></div>;}
