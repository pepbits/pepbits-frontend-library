/** Original Phial services; no public source listener or user-switcher authentication. */
import {parentPort,workerData} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import inject from 'light-my-request';
const directory=workerData.directory;mkdirSync(directory,{recursive:true,mode:0o700});
const dbFile=join(directory,'phial.db'),absent=!existsSync(dbFile);process.env.DB_PATH=dbFile;process.env.PHARMACY_HOST_MODE='1';process.env.NODE_ENV='test';
let source,db,app;
const failure=(status,code,message)=>({status,body:{error:{code,message}}});
async function initialize(){
 source=await import('./dist/db/index.js');db=source.db;
 if(absent){
  db.exec('CREATE TABLE host_bootstrap (id INTEGER PRIMARY KEY CHECK(id=1), ready INTEGER NOT NULL)');db.prepare('INSERT INTO host_bootstrap(id,ready) VALUES(1,0)').run();
  const seed=(await import('./dist/db/seed.js')).seedIfEmpty;source.tx(()=>seed());db.prepare('UPDATE host_bootstrap SET ready=1 WHERE id=1').run();
 }else if(!db.prepare("SELECT name FROM sqlite_master WHERE name='host_bootstrap'").get()||!db.prepare('SELECT ready FROM host_bootstrap WHERE id=1').get()?.ready)throw Error('Incomplete pharmacy bootstrap; existing database was not reseeded.');
 db.exec(`CREATE TABLE IF NOT EXISTS host_command (actor TEXT NOT NULL,key TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(actor,key))`);
 app=(await import('./dist/app.js')).createApp();
}
function identity(user){
 const id='host_'+createHash('sha256').update(user.id).digest('hex').slice(0,32);
 db.prepare('INSERT INTO users(id,name,role,initials) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,initials=excluded.initials').run(id,user.name,user.role,user.initials||user.name.slice(0,2).toUpperCase());
 globalThis.__pharmacyHostActor=id;return {id,name:user.name,role:user.role,initials:user.initials};
}
class RollbackResponse{constructor(result){this.result=result;}}
async function handle(message){
 const req=message.request,url=new URL(req.path,'http://pharmacy.internal'),write=!['GET','HEAD'].includes(req.method),key=req.headers?.['idempotency-key'];
 if(write&&(!key||typeof key!=='string'||! /^[\w:.-]{8,128}$/.test(key)))return failure(400,'idempotency_required','A valid idempotency key is required for this command.');
 if(req.body!==null&&(typeof req.body!=='object'||Array.isArray(req.body)))return failure(400,'validation_failed','Invalid request body.');
 for(const name of ['limit','offset','days']){const value=url.searchParams.get(name);if(value!==null&&(!/^\d+$/.test(value)||Number(value)>(name==='days'?3660:100000)))return failure(400,'validation_failed','Select a valid bounded query range.');}
 const digest=createHash('sha256').update(JSON.stringify([req.method,req.path,req.body])).digest('hex');
 try{return await source.hostTransaction(async()=>{
  const actor=identity(message.user);
  if(write){const old=db.prepare('SELECT digest,result FROM host_command WHERE actor=? AND key=?').get(message.user.id,key);if(old)return old.digest===digest?JSON.parse(old.result):failure(409,'idempotency_conflict','This command key was already used for different content.');}
  const historyBefore=write?db.prepare('SELECT count(*) n FROM status_history').get().n:0;
  const response=await inject(app,{method:req.method,url:req.path,headers:{'content-type':'application/json'},payload:write?JSON.stringify(req.body??{}):undefined});
  const type=response.headers['content-type']??'application/json';
  const result=type.includes('json')?{status:response.statusCode,body:JSON.parse(response.payload||'null')}:{status:response.statusCode,raw:response.rawPayload.toString('base64'),headers:{'Content-Type':type}};
  if(result.status>=400)throw new RollbackResponse(result);
  if(url.pathname==='/api/meta'&&result.body){result.body.currentUser=actor;result.body.hostManagedIdentity=true;result.body.demo=true;result.body.scope={branchId:message.scope?.branchId??null};}
  if(write&&db.prepare('SELECT count(*) n FROM status_history').get().n===historyBefore)db.prepare('INSERT INTO status_history(entity,entity_id,ref,from_status,to_status,note,actor,at) VALUES(?,?,?,?,?,?,?,?)').run('command',key,req.method+' '+url.pathname,null,'completed','Authenticated command recorded; request payload excluded.',actor.id,new Date().toISOString());
  if(write)db.prepare('INSERT INTO host_command(actor,key,digest,result,created_at) VALUES(?,?,?,?,?)').run(message.user.id,key,digest,JSON.stringify(result),new Date().toISOString());
  return result;
 });}catch(error){if(error instanceof RollbackResponse)return error.result;throw error;}finally{globalThis.__pharmacyHostActor=undefined;}
}
let queue=initialize();parentPort.on('message',message=>{queue=queue.then(async()=>{try{parentPort.postMessage({id:message.id,result:await handle(message)});}catch(error){console.error('Pharmacy command failed',error?.name);parentPort.postMessage({id:message.id,result:failure(500,'pharmacy_error','The server could not complete the request.')});}});});
queue.then(()=>parentPort.postMessage({ready:true})).catch(error=>{console.error('Pharmacy startup failed',error?.name);parentPort.postMessage({startupError:true});parentPort.close();process.exitCode=1;});
