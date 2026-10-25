import {parentPort,workerData} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
export const directory=workerData.directory;
mkdirSync(directory,{recursive:true,mode:0o700});
export const dbFile=join(directory,'reference.db'),absent=!existsSync(dbFile);
export const failure=(status,code,message)=>({status,body:{error:{code,message}}});
class CommandRollback{constructor(result){this.result=result;}}
/** Commands and durable retry result share one transaction with the original service and its history. */
export async function serve({initialize,identity,dispatch,decorate,fingerprint,background=[]}){
 let db;
 const ready=initialize().then(database=>{db=database;db.exec('CREATE TABLE IF NOT EXISTS host_command (actor TEXT NOT NULL,key TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(actor,key)); CREATE TABLE IF NOT EXISTS host_action (id INTEGER PRIMARY KEY,actor TEXT NOT NULL,method TEXT NOT NULL,path TEXT NOT NULL,at TEXT NOT NULL)');parentPort.postMessage({ready:true});});
 let queue=ready;
 // Embedded jobs join the same command queue and transaction boundary. Never
 // allow an original standalone timer to spend or edit shared module records.
 const timers=[];
 ready.then(()=>{
  for(const job of background){
   if(!Number.isSafeInteger(job.intervalMs)||job.intervalMs<1000||typeof job.run!=='function')throw Error('Invalid owned background job');
   const enqueue=()=>{queue=queue.then(()=>db.hostTransaction(async()=>{
    await job.run();
    db.prepare('INSERT INTO host_action(actor,method,path,at) VALUES(?,?,?,?)').run('SYSTEM:'+job.id,'JOB','/jobs/'+job.id,new Date().toISOString());
   })).catch(error=>console.error('Embedded background job failed',job.id,error?.name));};
   const interval=setInterval(enqueue,job.intervalMs);interval.unref();timers.push(interval);
   if(job.firstDelayMs!==undefined){const first=setTimeout(enqueue,job.firstDelayMs);first.unref();timers.push(first);}
  }
 }).catch(error=>console.error('Embedded job startup failed',error?.name));
 parentPort.on('close',()=>{for(const timer of timers){clearInterval(timer);clearTimeout(timer);}});
 async function handle(message){
  const req=message.request,write=!['GET','HEAD'].includes(req.method),key=req.headers?.['idempotency-key'];
  if(write&&(!key||typeof key!=='string'||! /^[\w:.-]{8,128}$/.test(key)))return failure(400,'IDEMPOTENCY_REQUIRED','A valid operation key is required.');
  if(req.body!==null&&(typeof req.body!=='object'||Array.isArray(req.body)))return failure(400,'VALIDATION_FAILED','Invalid request body.');
  const digest=createHash('sha256').update(JSON.stringify(fingerprint?fingerprint(req):[req.method,req.path,req.body])).digest('hex');
  try{return await db.hostTransaction(async()=>{
   const actor=identity(db,message.user);globalThis.__accessHostActor={...actor,hostId:message.user.id};
   if(write){const old=db.prepare('SELECT digest,result FROM host_command WHERE actor=? AND key=?').get(message.user.id,key);if(old)return old.digest===digest?JSON.parse(old.result):failure(409,'IDEMPOTENCY_CONFLICT','This operation key was already used for different content.');}
   const result=await dispatch(req);
   if(result.status>=400)throw new CommandRollback(result);
   decorate?.(result,req,actor,message.scope);
   if(write){db.prepare('INSERT INTO host_action(actor,method,path,at) VALUES(?,?,?,?)').run(message.user.id,req.method,new URL(req.path,'http://reference.internal').pathname,new Date().toISOString());db.prepare('INSERT INTO host_command(actor,key,digest,result,at) VALUES(?,?,?,?,?)').run(message.user.id,key,digest,JSON.stringify(result),new Date().toISOString());}
   return result;
  });}catch(error){if(error instanceof CommandRollback)return error.result;console.error('Access command failed',error?.name);return failure(500,'REFERENCE_ERROR','The server could not complete this request.');}finally{globalThis.__accessHostActor=undefined;}
 }
 parentPort.on('message',message=>{queue=queue.then(async()=>{parentPort.postMessage({id:message.id,result:await handle(message)});});});
 ready.catch(error=>{console.error('Access startup failed',error?.name);parentPort.postMessage({startupError:true});parentPort.close();process.exitCode=1;});
}
