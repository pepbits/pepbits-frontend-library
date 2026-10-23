'use client';
import React,{useMemo} from 'react';
import {IdentityDeviceWorkspace,type IdentityCommand,type IdentityAdapter,type IdentityLibrary,type IdentityAttempt} from '@pepbits/patterns/identity-devices';
import {createIdentityDeviceConnector} from '@pepbits/platform/devices';
import {withIdentityConnector} from '@pepbits/platform/device-workflows';
/** A simulated opaque capture never authenticates or changes a real identity. */
export function createDemoIdentity():IdentityAdapter{
 const library:IdentityLibrary={devices:[{id:'reader',title:'Fictional reader',method:'card',transport:'native'}],subjects:[{id:'subject-a',name:'Fictional subject',birthDate:'2000-01-01'}],scenarios:[{id:'match',title:'Illustrative match'}],policy:{version:1,biometricsEnabled:false,lockedDevice:''},attempts:[],defaultDevice:'reader',canManage:false};
 const operations=new Map<string,unknown>();
 const adapter:IdentityAdapter={library:async()=>structuredClone(library),async command<T>(input:IdentityCommand):Promise<T>{
  if(input.operationId&&operations.has(input.operationId))return structuredClone(operations.get(input.operationId)) as T;
  let result:unknown=library;
  if(input.action==='start'||input.action==='manual'){
   const attempt:IdentityAttempt={id:input.operationId!,subjectId:input.subjectId??'subject-a',deviceId:input.deviceId??'reader',stationId:input.stationId,status:input.action==='manual'?'manual-review':'pending',authenticated:false,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+120000).toISOString()};library.attempts.push(attempt);result=attempt;
  }else if(input.action==='cancel'||input.action==='simulate'){const attempt=library.attempts.find(a=>a.id===input.attemptId)!;attempt.status=input.action==='cancel'?'cancelled':'demo-match';result=attempt;}
  else if(input.action==='preference')library.defaultDevice=input.deviceId??'reader';
  if(input.operationId)operations.set(input.operationId,structuredClone(result));return structuredClone(result) as T;
 }};
 return withIdentityConnector(adapter,{connector:createIdentityDeviceConnector(async ticket=>({challengeId:ticket.challengeId,status:'captured',assertionReference:'fictional-assertion'})),ticket:async attempt=>({challengeId:attempt.id,subjectReference:attempt.subjectId,deviceId:attempt.deviceId,method:'card',expiresAt:attempt.expiresAt}),verify:async attempt=>{const result={...attempt,status:'manual-review' as const};library.attempts=library.attempts.map(a=>a.id===result.id?result:a);return result;}});
}
export function IdentityDevicesDemo(){const adapter=useMemo(createDemoIdentity,[]);return <div><p>The fictional reader returns an opaque assertion through the platform port. The simulation always routes to manual review.</p><IdentityDeviceWorkspace adapter={adapter} scopeKey="showcase:identity" stationId="example-station" mode="card"/></div>;}
