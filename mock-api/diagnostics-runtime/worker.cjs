/* Server-only embedded services: one isolated worker/database per authenticated scope. */
const {parentPort,workerData}=require('node:worker_threads');
const {createHash,randomBytes}=require('node:crypto');const path=require('node:path');const fs=require('node:fs');
const {variant,directory}=workerData;
fs.mkdirSync(directory,{recursive:true,mode:0o700});
process.env.DB_PATH=path.join(directory,'data.sqlite');process.env.RIS_DATA_DIR=directory;process.env.RIS_DICOM_DIR=path.join(directory,'dicom');
process.env.JWT_SECRET=randomBytes(32).toString('hex');process.env.DIAGNOSTICS_EMBEDDED='1';
let app,db,source,actor;
async function initialize(){
 if(variant==='ris1'){source=require('./dist/ris1/lib/db');db=source.db();return;}
 require('reflect-metadata');const {NestFactory}=require('@nestjs/core');const express=require('express');
 const {AppModule}=require('./dist/'+variant+'/app.module');
 app=await NestFactory.create(AppModule,{bodyParser:false,logger:false,abortOnError:false});
 app.use((req,res,next)=>{req.user=actor;next();});
 app.use(express.json({limit:'16mb',type:['application/json','application/*+json']}));
 app.use(express.text({limit:'16mb',type:['text/*','application/hl7-v2','application/astm','application/edi-hl7','x-application/hl7-v2+er7']}));
 app.setGlobalPrefix('api');await app.init();
 if(variant==='lis1'){db=app.get(require('typeorm').DataSource);await require('./dist/lis1/seed').seed(db);}
 else db=app.get(require('./dist/lis2/db/database.service').Db);
}
async function identity(user){
 const username='host_'+createHash('sha256').update(user.id).digest('hex').slice(0,24),name=user.name??user.displayName??user.email??user.id;
 const role=user.role==='enterprise-admin'?'ADMIN':user.role==='finance-manager'?(variant==='ris1'?'BILLING':'RECEPTION'):'READ_ONLY';
 let id;
 if(variant==='lis1'){
  const repository=db.getRepository(require('./dist/lis1/entities').User);let row=await repository.findOneBy({username});row=await repository.save({...row,username,fullName:name,role,active:true});id=row.id;
 }else if(variant==='lis2'){
  let row=db.get('SELECT id FROM users WHERE username=?',username);
  if(!row)id=db.insert('users',{username,full_name:name,role,active:1,password_hash:randomBytes(32).toString('hex')});else{id=row.id;db.update('users',id,{full_name:name,role,active:1});}
 }else{
  let row=source.get('SELECT id FROM users WHERE username=?',username);
  if(!row)id=source.insert('users',{username,name,role,active:1});else{id=row.id;source.update('users',id,{name,role,active:1});}
 }
 actor={id,username,fullName:name,full_name:name,name,role,department_id:null};globalThis.__diagnosticActor=actor;return actor;
}
const routes=variant==='ris1'?require('./dist/ris-routes.json'):[];
function resolveRoute(url){const segments=url.split('/').filter(Boolean);for(const r of [...routes].sort((a,b)=>a.path.includes('[')-b.path.includes('['))){const parts=r.path.split('/').filter(Boolean);if(parts.length!==segments.length)continue;const params={};let ok=true;parts.forEach((p,i)=>{if(p.startsWith('['))params[p.slice(1,-1)]=decodeURIComponent(segments[i]);else if(p!==segments[i])ok=false;});if(ok)return {r,params};}return null;}
async function handle(message){
 await identity(message.user);const request=message.request,url=new URL(request.path,'http://diagnostics.internal');
 if(url.pathname==='/api/session'||url.pathname==='/api/auth/me')return {status:200,body:{...(url.pathname==='/api/session'?{user:actor,users:[actor]}:actor)}};
 if(variant!=='ris1'){
  const inject=require('light-my-request');const result=await inject(app.getHttpAdapter().getInstance(),{method:request.method,url:request.path,headers:request.headers,payload:request.raw?Buffer.from(request.raw,'base64'):undefined});
  const ct=result.headers['content-type']??'application/json';return ct.includes('json')?{status:result.statusCode,body:JSON.parse(result.payload||'null')}:{status:result.statusCode,raw:result.rawPayload.toString('base64'),headers:{'Content-Type':ct}};
 }
 if(url.pathname==='/api/integration/samples'&&request.method==='GET'){
 const samples=require('./dist/ris1/lib/samples'),kind=url.searchParams.get('kind'),placer=url.searchParams.get('placer')||samples.newPlacer(),accession=url.searchParams.get('accession')||'R0000000000';
 const payload=kind==='orm'?samples.sampleOrm({placer}):kind==='cancel'?samples.sampleOrm({placer,control:'CA'}):kind==='oru'?samples.sampleOru({accession}):kind==='adt'?samples.sampleAdt():kind==='bad'?samples.sampleInvalidOrm():kind==='fhir'?JSON.stringify(samples.sampleServiceRequest(),null,2):null;
 return payload?{status:200,body:{placer,text:payload.replace(/\r/g,'\n')}}:{status:400,body:{error:'Unknown sample kind'}};
 }
 // Client print templates receive the same source joins through authenticated API.
 const print=url.pathname.match(/^\/api\/print\/(report|invoice)\/(\d+)$/);
 if(print){const id=Number(print[2]);if(print[1]==='report'){const context=require('./dist/ris1/lib/context'),o=context.loadOrder(id);if(!o)return {status:404,body:{error:'Order not found'}};return {status:200,body:{o,r:context.loadReport(id),crit:source.all("SELECT * FROM critical_results WHERE order_id=? AND status!='OPEN' ORDER BY id DESC",id)[0]}};}
 const i=source.get('SELECT i.*,o.accession,o.priority,pr.name procedure_name,pr.cpt,pr.code procedure_code,p.first_name,p.last_name,p.mrn,p.address,p.insurance,p.phone FROM invoices i JOIN orders o ON o.id=i.order_id JOIN patients p ON p.id=o.patient_id JOIN procedures pr ON pr.id=o.procedure_id WHERE i.id=?',id);return i?{status:200,body:{i,payments:source.all('SELECT p.*,u.name received_by_name FROM payments p LEFT JOIN users u ON u.id=p.received_by WHERE invoice_id=? ORDER BY received_at',id)}}:{status:404,body:{error:'Invoice not found'}};}
 const match=resolveRoute(url.pathname);if(!match)return {status:404,body:{error:'Diagnostic route not found'}};
 const fn=require('./dist/'+match.r.file)[request.method];if(!fn)return {status:405,body:{error:'Method not allowed'}};
 const incoming=new Request(url,{method:request.method,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:Buffer.from(request.raw??'','base64')});
 const response=await fn(incoming,{params:match.params});const contentType=response.headers.get('content-type')??'application/octet-stream',bytes=Buffer.from(await response.arrayBuffer());
 return contentType.includes('json')?{status:response.status,body:JSON.parse(bytes.toString()||'null')}:{status:response.status,raw:bytes.toString('base64'),headers:{'Content-Type':contentType}};
}
let queue=initialize();
parentPort.on('message',message=>{queue=queue.then(async()=>{try{parentPort.postMessage({id:message.id,result:await handle(message)});}catch(e){parentPort.postMessage({id:message.id,result:{status:500,body:{error:'Diagnostic service failed',code:'DIAGNOSTIC_SERVICE_ERROR'}}});console.error('Diagnostic failure',variant,e?.name,e?.message);}});});
queue.then(()=>parentPort.postMessage({ready:true})).catch(e=>{parentPort.postMessage({startupError:'Diagnostic dependencies or database initialization failed'});console.error('Diagnostic startup',variant,e?.message);process.exitCode=1;parentPort.close();});
