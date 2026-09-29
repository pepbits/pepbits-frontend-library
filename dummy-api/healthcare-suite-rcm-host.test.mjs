import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';

test('RCM HTTP uses authenticated host scope and separate commercial authority',async t=>{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const dir=mkdtempSync(join(tmpdir(),'suite-rcm-host-'));
 const child=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NEXORA_DATA_DIR:dir,RECORD_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}rmSync(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<400;i++){if(child.exitCode!==null)break;try{await fetch(base);ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.ok(ready,output);
 async function login(username){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})});assert.equal(r.status,200);return(await r.json()).token;}
 const admin=await login('admin'),finance=await login('user1'),operations=await login('user2');
 const navResponse=await fetch(base+'/navigation?productId=nexora',{headers:{Authorization:`Bearer ${admin}`}});
 assert.equal(navResponse.status,200);const navigation=await navResponse.json();
 for(const section of ['claims','exchange','remittances','patient-finance','packages','drg','accounting','commercial','receivables']){
  const pageId='reference-healthcare-suite-rcm-'+section;
  assert.ok(navigation.pages.some(p=>p.id===pageId),'authenticated navigation must expose '+pageId);
  assert.ok(navigation.nodes.some(n=>n.pageId===pageId),'authenticated menu must expose '+pageId);
 }
 async function call(token,path,options={}){return fetch(base+'/reference-modules/healthcare-suite/api'+path,{method:options.body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers},...(options.body?{body:JSON.stringify(options.body)}:{})});}
 assert.equal((await call(null,'/rcm/workspace')).status,401);
 assert.equal((await call(admin,'/rcm/workspace',{headers:{'X-Product-Id':'ledger'}})).status,403);
 assert.equal((await call(finance,'/rcm/workspace',{headers:{'X-Reference-Branch':'hq'}})).status,403);
 assert.equal((await call(admin,'/rcm/workspace',{headers:{'X-Reference-Facility':'unknown'}})).status,403);
 const session=await(await call(finance,'/session')).json();assert.equal(session.canWrite,false);assert.equal(session.canWriteRcm,true);
 const view=await call(admin,'/rcm/workspace');assert.equal(view.status,200,await view.clone().text());const initial=await view.json();assert.equal(initial.capabilities.configure,true);
 const body={kind:'configure-payer-sequence',invoiceId:'RCM-INV-001',payerIds:['PY001','PY002','PY003','PY004'],expectedVersion:initial.version,idempotencyKey:'host-four-payers',currency:initial.currency};
 const posted=await call(admin,'/rcm/commands',{body});assert.equal(posted.status,201,await posted.clone().text());const result=await posted.json();assert.equal(result.workspace.payerSequences[0].payerIds.length,4);
 const retry=await call(admin,'/rcm/commands',{body});assert.equal(retry.status,201);assert.deepEqual(await retry.json(),result);
 assert.equal((await call(admin,'/rcm/commands',{body:{...body,payerIds:['PY001']}})).status,409);
 const other=await(await call(admin,'/rcm/workspace',{headers:{'X-Reference-Facility':'F002'}})).json();assert.equal(other.version,0);
 const ops=await(await call(operations,'/rcm/workspace')).json();assert.equal(ops.capabilities.configure,false);
 assert.equal((await call(operations,'/rcm/commands',{body:{...body,expectedVersion:ops.version,idempotencyKey:'denied-config'}})).status,403);
 const fin=await(await call(finance,'/rcm/workspace')).json();assert.equal(fin.capabilities.finance,true);
 assert.equal((await call(finance,'/rcm/commands',{body:{...body,expectedVersion:fin.version,idempotencyKey:'denied-fin-config'}})).status,403);
 async function postSource(path,body){const r=await call(admin,path,{body});assert.equal(r.status,201,await r.clone().text());return r.json();}
 async function sourceInvoice(){
  const p=await postSource('/patients',{firstName:'Ownership',lastName:'Synthetic patient',gender:'Female',phone:'+971 50 123 8888'});
  const e=await postSource('/encounters',{patientId:p.id,encounterType:'Pharmacy',paymentClass:'Cash'});
  const o=await postSource(`/encounters/${e.id}/orders`,{code:'ITM-PAR500',qty:1,dosage:'Synthetic dose',frequency:'Synthetic schedule'});
  await postSource(`/encounters/${e.id}/orders/sign`,{orderIds:[o.id]});
  return postSource('/billing/invoices',{encounterId:e.id,category:'Pharmacy',payments:[]});
 }
 const source=await sourceInvoice();let version=(await(await call(admin,'/rcm/workspace')).json()).version;
 const imported=await call(admin,'/rcm/commands',{body:{kind:'import-invoice',invoiceId:source.id,expectedVersion:version,idempotencyKey:'host-source-import',currency:initial.currency}});assert.equal(imported.status,201,await imported.clone().text());
 for(const action of ['payments','payments/','%70ayments','%63ancel/']){
  const blocked=await call(admin,`/billing/invoices/${source.id}/${action}`,{body:action.includes('ayment')?{mode:'Cash',amount:1}:{reason:'Blocked source cancellation'}});assert.equal(blocked.status,409,await blocked.clone().text());
 }
 assert.equal((await call(admin,`/billing/invoices/${source.id}/payments`,{headers:{'X-Reference-Facility':'F002'},body:{mode:'Cash',amount:1}})).status,403);
 const racing=await sourceInvoice();version=(await(await call(admin,'/rcm/workspace')).json()).version;
 const [transfer,payment]=await Promise.all([
  call(admin,'/rcm/commands',{body:{kind:'import-invoice',invoiceId:racing.id,expectedVersion:version,idempotencyKey:'host-racing-import',currency:initial.currency}}),
  call(admin,`/billing/invoices/${racing.id}/payments`,{body:{mode:'Cash',amount:1}}),
 ]);
 assert.equal(transfer.status,201,await transfer.clone().text());assert.ok([201,409].includes(payment.status),await payment.clone().text());
 const snapshot=(await transfer.json()).workspace.invoices.find(i=>i.id===racing.id);const current=await(await call(admin,`/billing/invoices/${racing.id}`)).json();assert.equal(snapshot.paidMinor,Math.round(current.paid*100));
 // Existing clinical write restrictions remain independent of new RCM capabilities.
 assert.equal((await call(finance,'/patients',{body:{firstName:'Blocked'}})).status,403);
});
