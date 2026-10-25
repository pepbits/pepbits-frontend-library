/** No public listener or source password sessions. Every actor comes from the host. */
import {parentPort,workerData} from 'node:worker_threads';
import {createHash,randomBytes} from 'node:crypto';
import {existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import express from 'express';
import inject from 'light-my-request';
const {directory}=workerData;mkdirSync(directory,{recursive:true,mode:0o700});process.env.DATA_DIR=directory;
let app,db,source,auth;
const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const monthIndex=v=>Number(v.slice(0,4))*12+Number(v.slice(5,7));
const DAY=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function validDay(value){return DAY.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function validRange(body,url){
 const from=body?.from??body?.period_from??url.searchParams.get('from')??url.searchParams.get('period_from'),to=body?.to??body?.period_to??url.searchParams.get('to')??url.searchParams.get('period_to');
 const dayRange=url.pathname==='/api/tat/analysis';
 const valid=value=>value===undefined||value===null||(dayRange?validDay(String(value)):MONTH.test(String(value)));
 if(!valid(from)||!valid(to))return false;
 if(from&&to){if(String(from)>String(to))return false;return dayRange?(Date.parse(to)-Date.parse(from)<=3660*86400000):(monthIndex(to)-monthIndex(from)<=120);}
 return true;
}
async function initialize(){
 // Bootstrap only an absent database. Retained databases are never seeded/reset.
 if(!existsSync(join(directory,'allyvora-quality.db')))await import('./dist/seed.js');
 source=await import('./dist/db.js');db=source.db;
 if(!db.prepare("SELECT name FROM sqlite_master WHERE name='host_bootstrap'").get()||!db.prepare('SELECT ready FROM host_bootstrap WHERE id=1').get()?.ready)throw new Error('Incomplete Quality bootstrap requires owned recovery; existing data was not reseeded.');
 source.migrate();auth=await import('./dist/auth.js');
 db.exec(`CREATE TABLE IF NOT EXISTS host_command (actor TEXT NOT NULL, key TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(actor,key))`);
 app=express();app.disable('x-powered-by');app.use(express.json({limit:'2mb'}));
 const core=await import('./dist/routes/core.js');app.use('/api/auth',core.authRouter);
 for(const [file,name] of [['core','metaRouter'],['indicators','indicatorsRouter'],['events','eventsRouter'],['validation','validationRouter'],['reporting','reportingRouter'],['admin','adminRouter']])app.use('/api',(await import('./dist/routes/'+file+'.js'))[name]);
 app.use((_req,res)=>res.status(404).json({error:'not_found',message:'That endpoint does not exist.'}));
 app.use((err,_req,res,_next)=>{if(err instanceof auth.HttpError)return res.status(err.status).json({error:err.code,message:err.message});console.error('Quality request failed',err?.name);res.status(500).json({error:'quality_error',message:'The server could not complete the request.'});});
}
function identity(user){
 const email='host-'+createHash('sha256').update(user.id).digest('hex')+'@quality.invalid';
 let row=db.prepare('SELECT * FROM users WHERE email=?').get(email);
 if(!row){const r=db.prepare('INSERT INTO users(name,email,role,status,password_hash,created_at) VALUES(?,?,?,?,?,?)').run(user.name,email,user.role,'active',randomBytes(32).toString('hex'),source.nowIso());row={id:Number(r.lastInsertRowid)};}
 else db.prepare('UPDATE users SET name=?,role=?,status=? WHERE id=?').run(user.name,user.role,'active',row.id);
 const actor={id:row.id,name:user.name,email:user.email??email,role:user.role,title:'Authenticated workspace user',facility_id:null};globalThis.__qualityHostActor=actor;return actor;
}
async function handle(message){
 const req=message.request,url=new URL(req.path,'http://quality.internal'),write=!['GET','HEAD'].includes(req.method),body=req.body;
 // Bound all SQL-interpolated numeric filters and month ranges before source routing.
 for(const key of ['facility','facility_ids','indicator','limit','offset','definition','id']){const v=url.searchParams.get(key);if(v!==null&&!/^\d+(,\d+)*$/.test(v))return {status:400,body:{error:'validation',message:'Invalid numeric filter.'}};}
 for(const key of ['period','period_from','period_to']){const v=url.searchParams.get(key);if(v!==null&&!( /^\d{4}-(0[1-9]|1[0-2])$/.test(v)|| /^\d{4}-\d{2}-\d{2}T/.test(v)))return {status:400,body:{error:'validation',message:'Invalid period.'}};}
 if(!validRange(body,url))return {status:400,body:{error:'validation',message:'Select a valid report period of at most 120 months.'}};
 if(body&&typeof body!=='object')return {status:400,body:{error:'validation',message:'Invalid request body.'}};
 if(body?.ids&&( !Array.isArray(body.ids)||body.ids.length>1000||body.ids.some(id=>!Number.isSafeInteger(Number(id))||Number(id)<1)))return {status:400,body:{error:'validation',message:'Invalid result selection.'}};
 const key=req.headers?.['idempotency-key'];
 if(write&&url.pathname!=='/api/reports/preview'&&!key)return {status:400,body:{error:'idempotency_required',message:'An idempotency key is required for this command.'}};
 if(write&&key!==undefined&&(typeof key!=='string'||! /^[\w:.-]{8,128}$/.test(key)))return {status:400,body:{error:'validation',message:'Invalid idempotency key.'}};
 const digest=createHash('sha256').update(JSON.stringify([req.method,req.path,body])).digest('hex');
 db.exec('BEGIN IMMEDIATE');try{
 const actor=identity(message.user);
 if(write&&key){const saved=db.prepare('SELECT * FROM host_command WHERE actor=? AND key=?').get(message.user.id,key);if(saved){db.exec('ROLLBACK');return saved.digest===digest?JSON.parse(saved.result):{status:409,body:{error:'idempotency_conflict',message:'This command key was already used for different content.'}};}}
 // Reference Users is a directory, never a way to alter host identity/role grants.
 if(write&&/^\/api\/users\/(\d+)$/.test(url.pathname)){const target=db.prepare('SELECT email FROM users WHERE id=?').get(Number(url.pathname.split('/').at(-1)));if(target?.email.startsWith('host-')){db.exec('ROLLBACK');return {status:403,body:{error:'host_identity',message:'Manage workspace role assignments in the host application.'}};}}
 if(write&&/^\/api\/results\/\d+$/.test(url.pathname)&&body?.version!==undefined){const result=db.prepare('SELECT version FROM indicator_results WHERE id=?').get(Number(url.pathname.split('/').at(-1)));if(result&&result.version!==Number(body.version)){db.exec('ROLLBACK');return {status:409,body:{error:'stale_version',message:'This result changed. Refresh it before saving.'}};}}
 const response=await inject(app,{method:req.method,url:req.path,headers:{'content-type':'application/json'},payload:write?JSON.stringify(body??{}):undefined});
 const contentType=response.headers['content-type']??'application/json';
 const result=contentType.includes('json')?{status:response.statusCode,body:JSON.parse(response.payload||'null')}:{status:response.statusCode,raw:response.rawPayload.toString('base64'),headers:{'Content-Type':contentType,...(response.headers['content-disposition']?{'Content-Disposition':response.headers['content-disposition']}:{})}};
 if(response.statusCode>=500){db.exec('ROLLBACK');return result;}
 if(write&&key)db.prepare('INSERT INTO host_command(actor,key,digest,result,created_at) VALUES(?,?,?,?,?)').run(message.user.id,key,digest,JSON.stringify(result),source.nowIso());
 db.exec('COMMIT');return result;
 }catch(e){db.exec('ROLLBACK');throw e;}finally{globalThis.__qualityHostActor=undefined;}
}
let queue=initialize();parentPort.on('message',message=>{queue=queue.then(async()=>{try{parentPort.postMessage({id:message.id,result:await handle(message)});}catch(e){console.error('Quality failure',e?.name,e?.message);parentPort.postMessage({id:message.id,result:{status:500,body:{error:'quality_error',message:'The server could not complete the request.'}}});}});});
queue.then(async()=>{const scheduler=await import('./dist/services/scheduler.js');const tick=()=>{queue=queue.then(()=>{for(const schedule of db.prepare('SELECT * FROM schedules WHERE active=1 AND next_run_at IS NOT NULL AND next_run_at<=?').all(source.nowIso())){try{db.transaction(()=>scheduler.executeSchedule(schedule,null,'schedule'))();}catch(e){db.prepare('UPDATE schedules SET last_status=?,next_run_at=? WHERE id=?').run('failed',scheduler.computeNextRun(schedule),schedule.id);auth.audit(null,'schedule.failed','schedule',schedule.id,'Scheduled demonstration report failed.');}}});};const timer=setInterval(tick,30000);timer.unref();parentPort.postMessage({ready:true});}).catch(e=>{console.error('Quality startup',e?.name,e?.message);parentPort.postMessage({startupError:true});parentPort.close();process.exitCode=1;});
