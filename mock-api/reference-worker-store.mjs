import {Worker} from 'node:worker_threads';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
/** Authenticated isolated service partitions shared by embedded reference APIs. */
export function referenceWorkerScope(namespace,user,scope){
 if(!user?.id||![user?.tenantId,scope?.applicationId,scope?.branchId].every(v=>typeof v==='string'&&/^[\w.:-]{1,64}$/.test(v)))throw Error('Authenticated reference scope required');
 return createHash('sha256').update(JSON.stringify([namespace,user.tenantId,scope.applicationId,scope.branchId])).digest('hex');
}
export function createReferenceWorkerStore({namespace,workerUrl,dataDir,roles,guard,error,forwardedHeaders=[],maxWorkers=8,idleMs=300000,timeoutMs=120000}){
 const workers=new Map();let closing=false;
 function retire(key,e){clearTimeout(e.idle);if(workers.get(key)===e)workers.delete(key);for(const p of e.pending.values()){clearTimeout(p.timer);p.resolve(error(503,'unavailable'));}e.pending.clear();return e.worker.terminate();}
 function spawn(key){
  if(workers.size>=maxWorkers){const idle=[...workers].find(([,e])=>!e.pending.size);if(idle)retire(...idle);else throw Error('Reference service capacity reached');}
  const directory=join(dataDir,key);mkdirSync(directory,{recursive:true,mode:0o700});
  const worker=new Worker(workerUrl,{workerData:{directory}}),e={worker,pending:new Map(),idle:null};workers.set(key,e);
  worker.on('message',message=>{if(message.startupError){retire(key,e);return;}const p=e.pending.get(message.id);if(!p)return;e.pending.delete(message.id);clearTimeout(p.timer);const result=message.result;if(result.raw){result.body=Buffer.from(result.raw,'base64');delete result.raw;}p.resolve(result);if(!e.pending.size){e.idle=setTimeout(()=>retire(key,e),idleMs);e.idle.unref();}});
  worker.on('error',()=>retire(key,e));worker.on('exit',()=>{if(workers.get(key)===e)retire(key,e);});return e;
 }
 return {async handle(user,scope,request){
  if(closing)return error(503,'unavailable');
  const allowed=guard(user,request);if(allowed!==200)return error(allowed,'forbidden');
  let key;try{key=referenceWorkerScope(namespace,user,scope);}catch{return error(403,'scope');}
  let e;try{e=workers.get(key)??spawn(key);}catch{return error(503,'capacity');}clearTimeout(e.idle);
  const path=request.path.replace(/^\/api(?=\/)/,'');const headers={};for(const name of ['idempotency-key','if-match',...forwardedHeaders])if(request.headers?.[name])headers[name]=request.headers[name];
  return new Promise(resolve=>{const id=randomUUID(),timer=setTimeout(()=>retire(key,e),timeoutMs);e.pending.set(id,{resolve,timer});e.worker.postMessage({id,scope:{applicationId:scope.applicationId,branchId:scope.branchId},user:{id:user.id,name:user.name??user.email??user.id,email:user.email??null,initials:user.initials??'',role:roles[user.role]},request:{method:request.method,path:'/api'+path,headers,body:request.body??null}});});
 },async close(){closing=true;await Promise.all([...workers].map(([key,e])=>retire(key,e)));}};
}
