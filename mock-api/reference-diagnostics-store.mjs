import bwipjs from 'bwip-js';
import {Worker} from 'node:worker_threads';import {mkdirSync} from 'node:fs';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {diagnosticPolicy,diagnosticScope} from './diagnostics-policy.mjs';
/** Single public service; source services use private IPC, never separate public ports. */
export function createDiagnosticStore({variant,dataDir,maxWorkers=8,idleMs=300000,timeoutMs=120000}){
 const workers=new Map();
 function retire(key,entry){clearTimeout(entry.idle);if(workers.get(key)===entry)workers.delete(key);const stopped=entry.worker.terminate();for(const p of entry.pending.values()){clearTimeout(p.timer);p.resolve({status:503,body:{error:'Diagnostic service unavailable'}});}entry.pending.clear();return stopped;}
 function spawn(key){
  if(workers.size>=maxWorkers){const idle=[...workers].find(([,e])=>!e.pending.size);if(idle)retire(...idle);else throw new Error('Diagnostic workspace capacity reached');}
  const directory=join(dataDir,key);mkdirSync(directory,{recursive:true,mode:0o700});
  const worker=new Worker(new URL('./diagnostics-runtime/worker.cjs',import.meta.url),{workerData:{variant,directory}}),entry={worker,pending:new Map(),idle:null};workers.set(key,entry);
  worker.on('message',message=>{if(message.startupError){retire(key,entry);return;}const p=entry.pending.get(message.id);if(!p)return;entry.pending.delete(message.id);clearTimeout(p.timer);const result=message.result;if(result.raw){result.body=Buffer.from(result.raw,'base64');delete result.raw;}p.resolve(result);if(!entry.pending.size){entry.idle=setTimeout(()=>retire(key,entry),idleMs);entry.idle.unref();}});
  worker.on('error',()=>retire(key,entry));worker.on('exit',()=>{if(workers.get(key)===entry)retire(key,entry);});return entry;
 }
 return {async handle(user,scope,request){
  const policy=diagnosticPolicy(user,request.method,request.path);if(policy!==200)return {status:policy,body:{error:'Diagnostic action is not allowed'}};
  let key;try{key=diagnosticScope(variant,user,scope);}catch{return {status:403,body:{error:'Invalid diagnostic scope'}};}
  const url=new URL(request.path,'http://diagnostics.internal');
  if(url.pathname==='/api/barcode'&&request.method==='GET'){
   const value=url.searchParams.get('value')??'',height=Number(url.searchParams.get('height')??34);
   if(!value||value.length>128||!Number.isFinite(height)||height<10||height>200)return {status:400,body:{error:'Invalid barcode input'}};
   try{return {status:200,body:{svg:Buffer.from(bwipjs.toSVG({bcid:'code128',text:value,height:height/3,scale:1,includetext:false})).toString('base64')}};}catch{return {status:400,body:{error:'Unsupported barcode'}};}
  }
  let entry;try{entry=workers.get(key)??spawn(key);}catch{return {status:503,body:{error:'Diagnostic service is at capacity'}};}clearTimeout(entry.idle);
  // Never forward caller cookies, Authorization, role headers or arbitrary host headers.
  const headers={};for(const h of ['content-type','x-api-key','x-calling-ae'])if(request.headers?.[h])headers[h]=request.headers[h];
  return new Promise(resolve=>{const id=randomUUID(),timer=setTimeout(()=>retire(key,entry),timeoutMs);entry.pending.set(id,{resolve,timer});entry.worker.postMessage({id,user:{id:user.id,name:user.name??user.email,role:user.role},request:{method:request.method,path:request.path,headers,raw:request.raw??(request.body===undefined?undefined:Buffer.from(JSON.stringify(request.body)).toString('base64'))}});});
 },async close(){await Promise.all([...workers].map(([key,entry])=>retire(key,entry)));}};
}
