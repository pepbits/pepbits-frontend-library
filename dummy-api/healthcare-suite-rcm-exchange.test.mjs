// Actual MockIns loopback integration: four protocol families and a fourth payer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHealthcareSuiteRcmStore} from './healthcare-suite-rcm-store.mjs';
import {freezeMockInsRequest,dispatchMockIns} from './healthcare-suite-rcm-exchange.mjs';
const MOCK_ROOT=process.env.HC_RCM_MOCK_REPO??new URL('../../../tools/pepbits-mock-services/',import.meta.url).pathname;
const user={id:'ADMIN',role:'enterprise-admin',tenantId:'RCM-MOCK-TEST',branch:'hq'},scope={applicationId:'nexora',branchId:'hq',facilityId:'F001'};
async function setup(t){
 const dir=await mkdtemp('/tmp/rcm-mockins-');const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const apiKey='synthetic-rcm-insurance-test-api-key-2026',baseUrl=`http://127.0.0.1:${port}`;const child=spawn('python3',['-m','mockpay','--port',String(port),'--db',join(dir,'mock.sqlite'),'--quiet'],{cwd:MOCK_ROOT,env:{...process.env,MOCK_ENV:'test',MOCK_API_KEY:apiKey,MOCK_WEBHOOK_SECRET:'synthetic-rcm-insurance-webhook-secret-2026',MOCK_INS_MAX_PAYER_LEVEL:'4'},stdio:['ignore','pipe','pipe']});let output='';child.stderr.on('data',b=>{output+=b;});
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await rm(dir,{recursive:true,force:true});});
 let ready=false;for(let n=0;n<200;n++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(baseUrl+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,20));}assert.equal(ready,true,output);return {dir,provider:{baseUrl,apiKey,maxPayerLevel:4},async control(identity,path,body){const res=await fetch(baseUrl+'/ins/v1/admin/'+path,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'X-Tenant-ID':identity.tenant,'X-Sender-ID':identity.sender,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(res.ok,await res.text());}};
}
async function internal(dir){const files=(await readdir(dir)).filter(f=>f.endsWith('.json'));return Object.values(JSON.parse(await readFile(join(dir,files[0]),'utf8')).partitions)[0];}
for(const format of ['REST_JSON','REST_XML','SOAP11','SOAP12'])test(`actual MockIns ${format} eligibility, claim, status and remittance round trip`,async t=>{
 const {dir,provider,control}=await setup(t),dataDir=join(dir,'rcm'),currency=format==='SOAP12'?'AED':'USD';const store=createHealthcareSuiteRcmStore({dataDir,provider,defaultCurrency:currency});let version=0,key=0;
 async function command(kind,payload){const res=await store.handle(user,scope,{method:'POST',path:'/rcm/commands',body:{kind,...payload,currency,expectedVersion:version,idempotencyKey:'k'+(++key)}});assert.equal(res.status,201,JSON.stringify(res.body));version=res.body.version;return res.body;}
 await command('configure-exchange',{profileId:'PROFILE',wireFormat:format,payerId:'PY001'});const eligibility=await command('queue-exchange',{profileId:'PROFILE',operation:'ELIGIBILITY'});const identity=(await internal(dataDir)).exchanges.at(-1).identity;
 await control(identity,'members',{memberId:'MBR-NORMAL-001',payerCode:'MOCKPAYER1',planCode:'PLAN-DEMO',coverageStart:'2026-01-01',coverageEnd:'2030-12-31',eligibility:'ACTIVE',claimScenario:'partial'});
 const eligible=await command('dispatch-exchange',{exchangeId:eligibility.result.id});assert.equal(eligible.result.status,'Succeeded',eligible.result.lastError);
 const claim=(await command('create-claim',{invoiceId:'RCM-INV-001',payerId:'PY001'})).result,submit=(await command('queue-exchange',{profileId:'PROFILE',operation:'CLAIM_SUBMIT',claimId:claim.id})).result;
 const sent=await command('dispatch-exchange',{exchangeId:submit.id});assert.equal(sent.result.status,'Succeeded',sent.result.lastError);assert.equal(sent.workspace.claims[0].status,'Submitted');
 const status=(await command('queue-exchange',{profileId:'PROFILE',operation:'CLAIM_STATUS',claimId:claim.id})).result;assert.equal((await command('dispatch-exchange',{exchangeId:status.id})).result.status,'Succeeded');
 const remit=(await command('queue-exchange',{profileId:'PROFILE',operation:'REMITTANCE'})).result;const response=await command('dispatch-exchange',{exchangeId:remit.id});assert.equal(response.result.status,'Succeeded',response.result.lastError);const advice=response.result.response.advices[0];assert.equal(advice.currencyCode,currency);
 const posted=await command('apply-exchange-remittance',{exchangeId:remit.id,remittanceId:advice.remittanceId,claimId:claim.id});assert.equal(posted.workspace.reports.cashMinor,64000);assert.equal(posted.workspace.invoices[0].payerOutstandingMinor,0);assert.equal(posted.workspace.invoices[0].patientOutstandingMinor,20000);assert.equal(posted.result.adjustmentMinor,16000);
});

test('actual MockIns fourth payer receives ordered frozen prior EOB with posted denial advice provenance',async t=>{
 const {dir,provider,control}=await setup(t),dataDir=join(dir,'rcm');let store=createHealthcareSuiteRcmStore({dataDir,provider,defaultCurrency:'USD'}),version=0,key=0;
 const command=async(kind,payload)=>{const res=await store.handle(user,scope,{method:'POST',path:'/rcm/commands',body:{kind,...payload,currency:'USD',expectedVersion:version,idempotencyKey:'cob'+(++key)}});assert.equal(res.status,201,JSON.stringify(res.body));version=res.body.version;return res.body;};
 for(let i=1;i<=4;i++){
  const payerId=`PY00${i}`,profileId=`PROFILE${i}`;await command('configure-exchange',{profileId,wireFormat:i%2?'REST_JSON':'SOAP12',payerId});
  const elig=(await command('queue-exchange',{profileId,operation:'ELIGIBILITY'})).result,identity=(await internal(dataDir)).exchanges.at(-1).identity;
  await control(identity,'members',{memberId:'MBR-NORMAL-001',payerCode:`MOCKPAYER${i}`,planCode:'PLAN-DEMO',coverageStart:'2026-01-01',coverageEnd:'2030-12-31',eligibility:'ACTIVE',claimScenario:i<4?'deny':'normal'});
  await command('dispatch-exchange',{exchangeId:elig.id});const claim=(await command('create-claim',{invoiceId:'RCM-INV-001',payerId})).result;
  const submit=(await command('queue-exchange',{profileId,operation:'CLAIM_SUBMIT',claimId:claim.id})).result;const frozen=(await internal(dataDir)).exchanges.at(-1);
  if(i>1){assert.equal(frozen.canonical.payerLevel,i);assert.equal(frozen.canonical.serviceLines[0].priorEob.length,i-1);assert.ok(frozen.canonical.serviceLines[0].priorEob.every(e=>e.rejectedAmount==='800.00'));assert.equal(frozen.canonical.frequencyCode,'1');assert.equal(frozen.canonical.priorPayerClaimId,undefined);}
  const sent=await command('dispatch-exchange',{exchangeId:submit.id});assert.equal(sent.result.status,'Succeeded',sent.result.lastError);
  const queued=(await command('queue-exchange',{profileId,operation:'REMITTANCE'})).result,response=await command('dispatch-exchange',{exchangeId:queued.id});assert.equal(response.result.status,'Succeeded',response.result.lastError);const advice=response.result.response.advices[0];await command('apply-exchange-remittance',{exchangeId:queued.id,remittanceId:advice.remittanceId,claimId:claim.id});
  store=createHealthcareSuiteRcmStore({dataDir,provider,defaultCurrency:'USD'});
 }
 const workspace=(await store.handle(user,scope,{path:'/rcm/workspace'})).body;assert.equal(workspace.claims.length,4);assert.equal(workspace.remittances.length,4);assert.equal(workspace.reports.cashMinor,80000);assert.equal(workspace.invoices[0].payerOutstandingMinor,0);assert.equal(workspace.claims[3].priorEvidence.length,3);
});

test('transport rejects unapproved origin/path and malformed correlated provider responses',async()=>{
 const c={submissionId:'SUB',sender:{id:'SND',providerId:'PRV'},payerCode:'PAYER',patientControlNumber:'CLM',claimVersion:1,frequencyCode:'1',subscriber:{memberId:'MEMBER'},currencyCode:'USD',totalChargeAmount:'1.00',serviceDates:{from:'2026-01-01',to:'2026-01-01'},serviceLines:[{lineControl:'LINE',lineNumber:1,procedureCode:'SVC',serviceDate:'2026-01-01',units:'1',chargeAmount:'1.00'}]},profile={wireFormat:'REST_JSON'},wire=freezeMockInsRequest(profile,'CLAIM_SUBMIT',c),e={id:'EXC',operation:'CLAIM_SUBMIT',canonical:c,wire},identity={tenant:'TENANT',sender:'SND'};
 await assert.rejects(()=>dispatchMockIns({baseUrl:'https://real-payer.example',apiKey:'key'},profile,e,identity),/loopback/);
 await assert.rejects(()=>dispatchMockIns({baseUrl:'http://127.0.0.1:1',apiKey:'key'},profile,{...e,wire:{...wire,path:'https://outside.example/'}},identity),/route/);
 const ack={submissionId:'SUB',payerClaimId:'PCL',claimVersion:1,currencyCode:'USD',totalChargeAmount:'1.00',ackStatus:'A',lineAcks:[{lineControl:'FOREIGN',status:'A'}]};await assert.rejects(()=>dispatchMockIns({baseUrl:'http://127.0.0.1:1',apiKey:'key',fetch:async()=>new Response(JSON.stringify({claimAck:ack}),{headers:{'Content-Type':'application/json'}})},profile,e,identity),/line correlation/);
});
