import {Worker} from 'node:worker_threads';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
export const QUALITY_ROLES=Object.freeze({'enterprise-admin':'admin','quality-manager':'quality_manager','quality-steward':'data_steward','quality-verifier':'verifier','quality-approver':'approver','quality-viewer':'viewer'});
export function qualityScope(user,scope){
 if(!user?.id||![user?.tenantId,scope?.applicationId,scope?.branchId].every(v=>typeof v==='string'&&/^[\w.:-]{1,64}$/.test(v)))throw new Error('Authenticated quality scope required');
 return createHash('sha256').update(JSON.stringify(['quality',user.tenantId,scope.applicationId,scope.branchId])).digest('hex');
}
export function qualityRequestAllowed(user,request){
 if(!Object.hasOwn(QUALITY_ROLES,user?.role??''))return 403;
 let path;try{path=decodeURIComponent(request.path.split('?')[0]).replace(/^\/api(?=\/)/,'');}catch{return 400;}
 if(!path.startsWith('/')||/[\\\x00-\x1f]/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))return 400;
 if(path.startsWith('/auth/')&&!(path==='/auth/me'&&request.method==='GET'))return 403;
 if(!['GET','POST','PUT','PATCH','DELETE','HEAD'].includes(request.method))return 405;
 return 200;
}
/** Host-authenticated workers, serialized SQLite transactions, persisted command retries. */
export function createReferenceQualityStore({dataDir,maxWorkers=8,idleMs=300000,timeoutMs=120000}){
 const workers=new Map();let closing=false;
 function retire(key,e){clearTimeout(e.idle);if(workers.get(key)===e)workers.delete(key);for(const p of e.pending.values()){clearTimeout(p.timer);p.resolve({status:503,body:{error:'quality_unavailable',message:'Quality service is unavailable. Try again.'}});}e.pending.clear();return e.worker.terminate();}
 function spawn(key){
  if(workers.size>=maxWorkers){const idle=[...workers].find(([,e])=>!e.pending.size);if(idle)retire(...idle);else throw new Error('Quality capacity reached');}
  const directory=join(dataDir,key);mkdirSync(directory,{recursive:true,mode:0o700});
  const worker=new Worker(new URL('./quality-runtime/worker.mjs',import.meta.url),{workerData:{directory}}),e={worker,pending:new Map(),idle:null};workers.set(key,e);
  worker.on('message',message=>{if(message.startupError){retire(key,e);return;}const p=e.pending.get(message.id);if(!p)return;e.pending.delete(message.id);clearTimeout(p.timer);const result=message.result;if(result.raw){result.body=Buffer.from(result.raw,'base64');delete result.raw;}p.resolve(result);if(!e.pending.size){e.idle=setTimeout(()=>retire(key,e),idleMs);e.idle.unref();}});
  worker.on('error',()=>retire(key,e));worker.on('exit',()=>{if(workers.get(key)===e)retire(key,e);});return e;
 }
 return {async handle(user,scope,request){
  if(closing)return {status:503,body:{error:'quality_unavailable'}};
  const allowed=qualityRequestAllowed(user,request);if(allowed!==200)return {status:allowed,body:{error:'quality_forbidden',message:'Your role does not allow this Quality action.'}};
  let key;try{key=qualityScope(user,scope);}catch{return {status:403,body:{error:'quality_scope',message:'Quality scope is unavailable.'}};}
  let e;try{e=workers.get(key)??spawn(key);}catch{return {status:503,body:{error:'quality_capacity',message:'Quality service is at capacity. Try again.'}};}clearTimeout(e.idle);
  const path=request.path.replace(/^\/api(?=\/)/,'');
  const headers={};for(const name of ['idempotency-key','if-match'])if(request.headers?.[name])headers[name]=request.headers[name];
  return new Promise(resolve=>{const id=randomUUID(),timer=setTimeout(()=>retire(key,e),timeoutMs);e.pending.set(id,{resolve,timer});e.worker.postMessage({id,user:{id:user.id,name:user.name??user.email??user.id,email:user.email??null,role:QUALITY_ROLES[user.role]},request:{method:request.method,path:'/api'+path,headers,body:request.body??null}});});
 },async close(){closing=true;await Promise.all([...workers].map(([key,e])=>retire(key,e)));}};
}
