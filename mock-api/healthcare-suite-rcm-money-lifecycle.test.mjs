// RCM aggregate lifecycle against both actual dedicated synthetic HTTP providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHealthcareSuiteRcmStore} from './healthcare-suite-rcm-store.mjs';
import {createRcmMoneyProvider} from './healthcare-suite-rcm-money-provider.mjs';
const MOCK_ROOT=process.env.HC_RCM_MOCK_REPO??new URL('../../../tools/pepbits-mock-services/',import.meta.url).pathname;
async function start(t,dir,module){
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const origin=`http://127.0.0.1:${port}`,apiKey='synthetic-engine-money-provider-api-key';
 const child=spawn('python3',['-m',module,'--port',String(port),'--db',join(dir,module+'.sqlite'),'--quiet'],{cwd:MOCK_ROOT,env:{...process.env,MOCK_ENV:'test',MOCK_API_KEY:apiKey,MOCK_WEBHOOK_SECRET:'synthetic-engine-money-webhook-secret'},stdio:['ignore','pipe','pipe']});let output='';child.stderr.on('data',b=>{output+=b;});t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}});
 for(let n=0;n<200;n++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/health')).ok)return {origin,apiKey};}catch{}await new Promise(r=>setTimeout(r,20));}throw Error('Provider failed to start '+output);
}
test('actual payment/refund/collection providers retain unknown reservations and post reconciled money exactly once',async t=>{
 const dir=await mkdtemp('/tmp/rcm-money-lifecycle-');t.after(()=>rm(dir,{recursive:true,force:true}));const [payments,collections]=await Promise.all([start(t,dir,'mockpay'),start(t,dir,'mockpay.collection_mock')]);
 const moneyProvider=createRcmMoneyProvider({payments,collections}),options={dataDir:join(dir,'rcm'),moneyProvider,defaultCurrency:'USD'};let store=createHealthcareSuiteRcmStore(options),version=0,key=0;
 const user={id:'FINANCE',role:'finance-manager',tenantId:'RCM-MONEY-TEST',branch:'hq'},checker={...user,id:'CHECKER'},scope={applicationId:'nexora',branchId:'hq',facilityId:'F001'};
 const command=async(kind,payload,actor=user)=>{const response=await store.handle(actor,scope,{method:'POST',path:'/rcm/commands',body:{kind,...payload,currency:'USD',expectedVersion:version,idempotencyKey:`actual-${++key}`}});assert.equal(response.status,201,JSON.stringify(response.body));version=response.body.version;return response.body;};
 const capture=await command('capture-deposit',{patientId:'PT00001',amountMinor:20000,reference:'ACTUAL-PROVIDER-CAPTURE'});assert.equal(capture.result.status,'Available',capture.result.lastError);assert.ok(capture.result.providerPaymentRef);assert.equal(capture.workspace.reports.cashMinor,20000);
 const refund=(await command('request-refund',{depositId:capture.result.id,amountMinor:10000,reason:'unused patient deposit'})).result;await command('approve-refund',{refundId:refund.id},checker);
 const payout=await command('pay-refund',{refundId:refund.id,scenario:'timeout_after_accept'},checker);assert.equal(payout.result.status,'Uncertain');assert.ok(payout.result.providerRef);assert.equal(payout.workspace.deposits[0].reservedMinor,10000);assert.equal(payout.workspace.reports.cashMinor,20000);
 store=createHealthcareSuiteRcmStore(options);const reconciled=await command('reconcile-refund',{refundId:refund.id},checker);assert.equal(reconciled.result.status,'Paid',reconciled.result.lastError);assert.equal(reconciled.workspace.reports.cashMinor,10000);assert.equal(reconciled.workspace.deposits[0].reservedMinor,0);
 await command('allocate-deposit',{depositId:capture.result.id,invoiceId:'RCM-INV-001',amountMinor:10000});
 const collection=(await command('create-collection',{invoiceId:'RCM-INV-001',owner:'Demo Collector',dueDate:'2026-10-01',note:'collect remaining patient obligation'})).result;
 const dispatched=await command('dispatch-collection',{collectionId:collection.id,amountMinor:10000,scenario:'timeout_after_accept'});assert.equal(dispatched.result.status,'Uncertain',dispatched.result.lastError);assert.ok(dispatched.result.providerRef);assert.equal(dispatched.workspace.reports.cashMinor,10000);
 store=createHealthcareSuiteRcmStore(options);const settled=await command('reconcile-collection',{collectionId:collection.id});assert.equal(settled.result.status,'Collected',settled.result.lastError);assert.equal(settled.workspace.reports.cashMinor,20000);assert.equal(settled.workspace.invoices[0].patientOutstandingMinor,0);assert.equal(settled.workspace.invoices[0].payerOutstandingMinor,80000);assert.equal(settled.workspace.reports.journalBalanced,true);assert.equal(settled.workspace.journal.filter(j=>j.event==='refund.pay').length,1);assert.equal(settled.workspace.journal.filter(j=>j.event==='collection.provider-receipt').length,1);
 const partialTask=(await command('create-collection',{invoiceId:'RCM-INV-001',owner:'Demo Collector',dueDate:'2026-10-02',note:'payer residual task'})).result;
 const blocked=await store.handle(user,scope,{method:'POST',path:'/rcm/commands',body:{kind:'dispatch-collection',collectionId:partialTask.id,amountMinor:1,currency:'USD',expectedVersion:version,idempotencyKey:'cannot-collect-payer'}});assert.equal(blocked.status,409);
});
