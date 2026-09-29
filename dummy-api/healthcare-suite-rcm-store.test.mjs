import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHealthcareSuiteRcmStore} from './healthcare-suite-rcm-store.mjs';
const admin={id:'ADMIN',tenantId:'TENANT-DEMO',role:'enterprise-admin',branch:'hq'};
const finance={id:'FINANCE',tenantId:'TENANT-DEMO',role:'finance-manager',branch:'hq'};
const checker={...finance,id:'CHECKER'};
const scope={applicationId:'nexora',branchId:'hq',facilityId:'F001'};
async function harness(t,options={}){
 const dataDir=await mkdtemp('/tmp/healthcare-rcm-test-');t.after(()=>rm(dataDir,{recursive:true,force:true}));let store=createHealthcareSuiteRcmStore({dataDir,...options}),version=0,counter=0;
 const read=async(user=admin,selected=scope)=>{const response=await store.handle(user,selected,{method:'GET',path:'/rcm/workspace'});assert.equal(response.status,200,JSON.stringify(response.body));if(selected===scope)version=response.body.version;return response.body;};
 await read();
 return {dataDir,get store(){return store;},restart(extra={}){store=createHealthcareSuiteRcmStore({dataDir,...options,...extra});},read,async command(kind,payload={},user=admin,status=201){const response=await store.handle(user,scope,{method:'POST',path:'/rcm/commands',body:{kind,expectedVersion:version,idempotencyKey:`op-${++counter}`,currency:options.defaultCurrency??'AED',...payload}});assert.equal(response.status,status,JSON.stringify(response.body));if(response.status===201)version=response.body.version;return response.body;},get version(){return version;}};
}
const inv=w=>w.invoices.find(i=>i.id==='RCM-INV-001');

test('finance roles are separate from admin configuration and user/client scope cannot escalate',async t=>{
 const h=await harness(t);assert.equal((await h.read(finance)).capabilities.configure,false);const configAdmin={...admin,role:'admin'};assert.equal((await h.read(configAdmin)).capabilities.finance,false);
 await h.command('configure-payer-sequence',{invoiceId:'RCM-INV-001',payerIds:['PY001']},finance,403);
 for(const [user,selected,status]of [[null,scope,401],[{...finance,branch:'dubai'},scope,403],[finance,{...scope,tenantId:'OTHER'},403],[finance,{...scope,facilityId:'FOREIGN'},403],[finance,{...scope,moduleId:'other'},403],[{...finance,facilityIds:['F002']},scope,403]])assert.equal((await h.store.handle(user,selected,{path:'/rcm/workspace'})).status,status);
 assert.equal(await h.store.handle(null,{}, {path:'/patients'}),null);
});

test('durable tenant/branch/facility partitions and tenant default/branch policy inheritance',async t=>{
 const h=await harness(t);const dubai={...scope,branchId:'dubai'},pharmacy={...scope,facilityId:'F002'};await h.read(admin,dubai);await h.read(admin,pharmacy);
 await h.command('configure-payer-policy',{level:'tenant-default',payerIds:['PY001','PY002'],maximumPayers:2,effectiveFrom:'2026-01-01'});
 const inherited=await h.read(admin,dubai);assert.equal(inherited.effectivePayerPolicy.level,'tenant-default');assert.equal(inherited.effectivePayerPolicy.maximumPayers,2);assert.equal(inherited.version,1);
 await h.command('configure-payer-sequence',{invoiceId:'RCM-INV-001',payerIds:['PY001','PY002','PY003']},admin,400);
 await h.command('configure-payer-policy',{level:'branch',payerIds:['PY001','PY002','PY003','PY004'],maximumPayers:4,effectiveFrom:'2026-01-01'});await h.command('configure-payer-sequence',{invoiceId:'RCM-INV-001',payerIds:['PY001','PY002','PY003','PY004']});
 await h.command('collect-payment',{invoiceId:'RCM-INV-001',amountMinor:10000,reference:'CASH-1'},finance);assert.equal(inv(await h.read(admin,dubai)).patientPaidMinor,0);assert.equal(inv(await h.read(admin,pharmacy)).patientPaidMinor,0);assert.equal(inv(await h.read({...admin,tenantId:'OTHER'})).patientPaidMinor,0);
 h.restart();assert.equal(inv(await h.read()).patientPaidMinor,10000);assert.equal((await h.read(admin,dubai)).effectivePayerPolicy.maximumPayers,2);
 await h.command('configure-payer-policy',{level:'branch',inherit:true,effectiveFrom:'2026-01-01'});assert.equal((await h.read()).effectivePayerPolicy.level,'tenant-default');
});

test('safe integer/currency validation, stale versions and durable conflicting replay',async t=>{
 const h=await harness(t);
 for(const amountMinor of [-1,0,0.01,'100',null,Number.MAX_SAFE_INTEGER+1])await h.command('record-deposit',{patientId:'PT00001',amountMinor,reference:'INVALID'},finance,400);
 await h.command('record-deposit',{patientId:'PT00001',amountMinor:1,reference:'FX',currency:'USD'},finance,400);
 const body={kind:'record-deposit',patientId:'PT00001',amountMinor:10000,reference:'DURABLE',expectedVersion:h.version,idempotencyKey:'stable',currency:'AED'};
 const first=await h.store.handle(finance,scope,{method:'POST',path:'/rcm/commands',body});assert.equal(first.status,201);h.restart();assert.deepEqual(await h.store.handle(finance,scope,{method:'POST',path:'/rcm/commands',body}),first);
 assert.equal((await h.store.handle(finance,scope,{method:'POST',path:'/rcm/commands',body:{...body,amountMinor:20000}})).status,409);
 assert.equal((await h.store.handle(finance,scope,{method:'POST',path:'/rcm/commands',body:{...body,idempotencyKey:'stale'}})).body.code,'STALE_VERSION');
 const w=await h.read();assert.equal(w.deposits.length,1);assert.equal(w.reports.cashMinor,10000);assert.equal(w.outbox.length,1);
});

test('two concurrent store instances serialize one optimistic winner and no overcollection',async t=>{
 const h=await harness(t),other=createHealthcareSuiteRcmStore({dataDir:h.dataDir});const command=key=>({method:'POST',path:'/rcm/commands',body:{kind:'collect-payment',invoiceId:'RCM-INV-001',amountMinor:15000,reference:key,expectedVersion:0,idempotencyKey:key,currency:'AED'}});
 const results=await Promise.all([h.store.handle(finance,scope,command('one')),other.handle(finance,scope,command('two'))]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);const w=await h.read();assert.equal(inv(w).patientOutstandingMinor,5000);assert.equal(w.reports.cashMinor,15000);await h.command('collect-payment',{invoiceId:'RCM-INV-001',amountMinor:6000,reference:'overspend'},finance,409);
});

test('atomic persistence failure rolls back command financial state and replay identity',async t=>{
 const h=await harness(t);h.restart({beforePersist(){throw Error('injected disk failure');}});
 await h.command('record-deposit',{patientId:'PT00001',amountMinor:5000,reference:'FAIL'},finance,503);h.restart();const w=await h.read();assert.equal(w.version,0);assert.equal(w.deposits.length,0);assert.equal(w.outbox.length,0);assert.equal(w.reports.cashMinor,0);assert.equal((await readdir(h.dataDir)).filter(f=>f.includes('.tmp-')||f.includes('.lock')).length,0);
});

test('four-payer waterfall conserves payer/patient balances through denials, remittance and clawback',async t=>{
 const h=await harness(t);await h.command('collect-payment',{invoiceId:'RCM-INV-001',amountMinor:20000,reference:'PATIENT-CASH'},finance);
 const one=(await h.command('create-claim',{invoiceId:'RCM-INV-001',payerId:'PY001'},finance)).result;assert.equal(one.chargeMinor,80000);
 await h.command('create-claim',{invoiceId:'RCM-INV-001',payerId:'PY002'},finance,409);await h.command('adjudicate-claim',{claimId:one.id,paidMinor:60000,adjustmentMinor:10000,deniedMinor:10000,reason:'partial'},finance);
 assert.equal((await h.read()).reports.cashMinor,20000);const remit=(await h.command('create-remittance',{claimId:one.id,paidMinor:60000,adjustmentMinor:10000,reference:'PAYER-ONE'},finance)).result;
 await h.command('create-remittance',{claimId:one.id,paidMinor:60000,adjustmentMinor:10000,reference:'DUP'},finance,409);
 for(const payerId of ['PY002','PY003']){const claim=(await h.command('create-claim',{invoiceId:'RCM-INV-001',payerId},finance)).result;assert.equal(claim.chargeMinor,10000);await h.command('adjudicate-claim',{claimId:claim.id,paidMinor:0,adjustmentMinor:0,deniedMinor:10000,reason:'Denied'},finance);}
 const fourth=(await h.command('create-claim',{invoiceId:'RCM-INV-001',payerId:'PY004'},finance)).result;assert.equal(fourth.sequenceIndex,3);await h.command('create-remittance',{claimId:fourth.id,paidMinor:10000,adjustmentMinor:0,reference:'PAYER-FOUR'},finance);
 let w=await h.read();assert.equal(inv(w).outstandingMinor,0);assert.equal(w.reports.cashMinor,90000);await h.command('clawback',{remittanceId:remit.id,amountMinor:20000,reason:'Payer recoupment'},finance);w=await h.read();assert.equal(inv(w).payerOutstandingMinor,20000);assert.equal(inv(w).patientOutstandingMinor,0);assert.equal(w.reports.cashMinor,70000);assert.equal(w.reports.journalBalanced,true);
 await h.command('issue-credit',{invoiceId:'RCM-INV-001',amountMinor:50000,reason:'Cannot refund payer funds to patient'},finance,409);
});

test('partially settled denied residual can be appealed, settled without duplicate prior payment',async t=>{
 const h=await harness(t),claim=(await h.command('create-claim',{invoiceId:'RCM-INV-001',payerId:'PY001'},finance)).result;
 await h.command('create-remittance',{claimId:claim.id,paidMinor:60000,adjustmentMinor:0,reference:'PARTIAL'},finance);await h.command('appeal-claim',{claimId:claim.id,reason:'Residual dispute'},finance);
 await h.command('adjudicate-claim',{claimId:claim.id,paidMinor:20000,adjustmentMinor:0,deniedMinor:0,reason:'Appeal accepted'},finance);await h.command('create-remittance',{claimId:claim.id,paidMinor:20000,adjustmentMinor:0,reference:'APPEAL'},finance);const w=await h.read();assert.equal(w.claims[0].paidMinor,80000);assert.equal(inv(w).payerOutstandingMinor,0);assert.equal(w.reports.cashMinor,80000);
});

test('trusted insured Suite import preserves header allocation remainders and opening balance exactly once',async t=>{
 const source={id:'IV0001',net:1000,patientShare:200,payerShare:800,paid:100,balance:100,status:'Partially paid',patientId:'PT00001',encounterId:'EN0001',createdAt:'2026-09-29T00:00:00.000Z',lines:[{orderId:'OR0001',code:'SVC001',qty:1,net:1000,patientShare:150,payerShare:850}]};let reads=0;
 const h=await harness(t,{referenceReader:async()=>{reads++;return {invoice:source,facilityId:'F001',currency:'AED'};}});await h.command('import-invoice',{invoiceId:'IV0001'},finance);const w=await h.read(),imported=w.invoices.find(i=>i.id==='IV0001');assert.equal(imported.patientOutstandingMinor,10000);assert.equal(imported.payerOutstandingMinor,80000);assert.equal(imported.source.patientAllocationRemainderMinor,5000);assert.equal(imported.source.payerAllocationRemainderMinor,-5000);assert.equal(w.journal.at(-1).entries.at(-1).account,'Suite opening balance');assert.equal(await h.store.ownsInvoice(finance,scope,'IV0001'),true);
 await h.command('import-invoice',{invoiceId:'IV0001'},finance);assert.equal((await h.read()).journal.length,w.journal.length);assert.equal(reads,2);source.net=1001;await h.command('import-invoice',{invoiceId:'IV0001'},finance,409);h.restart();assert.equal(await h.store.ownsInvoice(finance,scope,'IV0001'),true);
});

test('untrusted import financial snapshots cannot bypass trusted reader, facility or source currency',async t=>{
 const h=await harness(t);await h.command('import-invoice',{invoiceId:'IV0001',net:1,paid:1},finance,409);h.restart({referenceReader:async()=>({invoice:{id:'IV0001'},facilityId:'F002',currency:'AED'})});await h.command('import-invoice',{invoiceId:'IV0001'},finance,403);
});

test('deposit reservations, maker-checker refunds and provider-disabled payout cannot overspend',async t=>{
 const h=await harness(t),deposit=(await h.command('record-deposit',{patientId:'PT00001',amountMinor:30000,reference:'CASH-DEPOSIT'},finance)).result;
 const refund=(await h.command('request-refund',{depositId:deposit.id,amountMinor:20000,reason:'unused deposit'},finance)).result;await h.command('request-refund',{depositId:deposit.id,amountMinor:20000,reason:'double reserve'},finance,409);
 await h.command('approve-refund',{refundId:refund.id},finance,403);await h.command('approve-refund',{refundId:refund.id},checker);await h.command('allocate-deposit',{depositId:deposit.id,invoiceId:'RCM-INV-001',amountMinor:15000},finance,409);await h.command('pay-refund',{refundId:refund.id,reference:'CLIENT-FAKE'},checker,409);assert.equal((await h.read()).refunds[0].status,'Approved');
});

test('durable preparation precedes provider capture; lost outcome replays same provider key after restart',async t=>{
 let providerCalls=0,operations=new Map(),failOutcome=false;
 const moneyProvider={async capture({key,amountMinor,currency}){providerCalls++;if(!operations.has(key))operations.set(key,{paymentRef:'pay_demo',status:'captured',amountMinor,currency});return operations.get(key);}};
 const h=await harness(t,{moneyProvider});h.restart({beforePersist(state){if(failOutcome&&state.deposits.some(d=>d.status==='Available'))throw Error('crash after remote commit');}});failOutcome=true;
 const body={kind:'capture-deposit',patientId:'PT00001',amountMinor:30000,reference:'CAPTURE',currency:'AED',expectedVersion:0,idempotencyKey:'CAPTURE-KEY'};let r=await h.store.handle(finance,scope,{method:'POST',path:'/rcm/commands',body});assert.equal(r.status,503);assert.equal(operations.size,1);h.restart();let w=await h.read();assert.equal(w.deposits[0].status,'Uncertain');assert.equal(w.reports.cashMinor,0);
 r=await h.store.handle(finance,scope,{method:'POST',path:'/rcm/commands',body});assert.equal(r.status,201);w=await h.read();assert.equal(w.reports.cashMinor,30000);assert.equal(w.deposits.length,1);assert.equal(operations.size,1);assert.equal(providerCalls,2);assert.equal(w.outbox.filter(e=>e.kind==='capture-deposit').length,1);
});

test('provider refund unknown keeps funds reserved and correlation-reconciled success posts once',async t=>{
 let refundCalls=0;const moneyProvider={async capture({amountMinor,currency}){return {paymentRef:'pay_demo',status:'captured',amountMinor,currency};},async refund({amountMinor}){refundCalls++;return {providerRef:'rfd_demo',status:'unknown',amountMinor};},async refundStatus(){return {providerRef:'rfd_demo',status:'succeeded',amountMinor:10000,currency:'AED'};}};
 const h=await harness(t,{moneyProvider}),deposit=(await h.command('capture-deposit',{patientId:'PT00001',amountMinor:20000,reference:'CAP'},finance)).result;
 const refund=(await h.command('request-refund',{depositId:deposit.id,amountMinor:10000,reason:'unused'},finance)).result;await h.command('approve-refund',{refundId:refund.id},checker);
 await h.command('pay-refund',{refundId:refund.id,scenario:'invalid'},checker,400);assert.equal(refundCalls,0);
 await h.command('pay-refund',{refundId:refund.id,scenario:'timeout_after_accept'},checker);assert.equal((await h.read()).deposits[0].reservedMinor,10000);h.restart();await h.command('reconcile-refund',{refundId:refund.id},checker);const w=await h.read();assert.equal(w.refunds[0].status,'Paid');assert.equal(w.reports.cashMinor,10000);assert.equal(w.deposits[0].reservedMinor,0);await h.command('reconcile-refund',{refundId:refund.id},checker,409);assert.equal((await h.read()).reports.cashMinor,10000);
});

test('provider pending collection reserves patient receivable and partial receipt conserves cents',async t=>{
 const moneyProvider={async collect({amountMinor,currency}){return {providerRef:'col_demo',status:'unknown',amountMinor,currency};},async collectionStatus(){return {providerRef:'col_demo',status:'captured',amountMinor:15000,capturedAmountMinor:10000,currency:'AED'};}};
 const h=await harness(t,{moneyProvider}),task=(await h.command('create-collection',{invoiceId:'RCM-INV-001',owner:'Collector',dueDate:'2026-10-01',note:'Follow up'},finance)).result;
 await h.command('dispatch-collection',{collectionId:task.id,amountMinor:15000,scenario:'invalid'},finance,400);await h.command('dispatch-collection',{collectionId:task.id,amountMinor:15000},finance);await h.command('collect-payment',{invoiceId:'RCM-INV-001',amountMinor:6000,reference:'OVER'},finance,409);await h.command('issue-credit',{invoiceId:'RCM-INV-001',amountMinor:1,reason:'Pending'},finance,409);
 h.restart();await h.command('reconcile-collection',{collectionId:task.id},finance);const w=await h.read();assert.equal(inv(w).patientOutstandingMinor,10000);assert.equal(w.reports.cashMinor,10000);assert.equal(w.collections[0].status,'Partially collected');await h.command('reconcile-collection',{collectionId:task.id},finance,409);
});

test('package reservations/releases, frozen commercial revisions and one case/excess invoice',async t=>{
 const h=await harness(t),ent=(await h.command('enroll-package',{packageId:'PKG-DEMO',patientId:'PT00001'},finance)).result;
 const r=(await h.command('reserve-package',{entitlementId:ent.id,units:2},finance)).result;await h.command('close-package',{entitlementId:ent.id},finance,409);await h.command('consume-package',{entitlementId:ent.id,units:2},finance,409);await h.command('release-package',{reservationId:r.id},finance);
 const r2=(await h.command('reserve-package',{entitlementId:ent.id,units:3},finance)).result;await h.command('consume-package',{entitlementId:ent.id,reservationId:r2.id,units:3},finance);await h.command('consume-package',{entitlementId:ent.id,reservationId:r2.id,units:3},finance,409);await h.command('consume-package',{entitlementId:ent.id,units:2},finance);
 await h.command('configure-package',{packageId:'PKG-DEMO',name:'New price',caseRateMinor:99999,entitlementUnits:1,excessUnitMinor:99999});const closed=(await h.command('close-package',{entitlementId:ent.id},finance)).result;assert.equal(closed.invoice.totalMinor,80000);assert.equal(closed.entitlement.packageVersion,1);await h.command('close-package',{entitlementId:ent.id},finance,409);const w=await h.read();assert.equal(w.packageVersions[0].caseRateMinor,50000);assert.equal(w.packageVersions.length,2);assert.equal(w.invoices.filter(i=>i.id===closed.invoice.id).length,1);
});

test('versioned maker-checker pricing/tax uses exact rounding and rejects stale proposal and overflow',async t=>{
 const h=await harness(t),other={...admin,id:'SECOND-ADMIN',role:'admin'};
 const p=(await h.command('propose-pricing',{priceId:'SVC-DEMO',unitPriceMinor:10001,taxBasisPoints:500,effectiveFrom:'2026-01-01'})).result;
 const stale=(await h.command('propose-pricing',{priceId:'SVC-DEMO',unitPriceMinor:10002,taxBasisPoints:500,effectiveFrom:'2026-01-01'})).result;await h.command('approve-pricing',{pricingVersionId:p.id},admin,403);await h.command('approve-pricing',{pricingVersionId:p.id},other);await h.command('approve-pricing',{pricingVersionId:stale.id},other,409);
 const quote=(await h.command('quote-price',{priceId:'SVC-DEMO',quantity:3},finance)).result;assert.equal(quote.netMinor,30003);assert.equal(quote.taxMinor,1500);assert.equal(quote.totalMinor,31503);
 const huge=(await h.command('propose-pricing',{priceId:'HUGE',unitPriceMinor:Number.MAX_SAFE_INTEGER,taxBasisPoints:0,effectiveFrom:'2026-01-01'})).result;await h.command('approve-pricing',{pricingVersionId:huge.id},other);await h.command('quote-price',{priceId:'HUGE',quantity:2},finance,400);
});

test('explicit configurable demo DRG quotes freeze version and never create a charge',async t=>{
 const h=await harness(t),before=await h.read();const old=(await h.command('group-drg',{invoiceId:'RCM-INV-001',adapter:'demo-v1',diagnosisCodes:['I10']},finance)).result;assert.equal(old.allowedMinor,120000);
 await h.command('configure-drg',{adapter:'demo-v1',baseRateMinor:90000,groups:[{prefix:'I',groupCode:'DEMO-CARD',weightBasisPoints:12000},{prefix:'*',groupCode:'DEMO-OTHER',weightBasisPoints:10000}]});const next=(await h.command('group-drg',{invoiceId:'RCM-INV-001',adapter:'demo-v1',diagnosisCodes:['I10']},finance)).result;assert.equal(next.allowedMinor,108000);assert.equal(next.adapterVersion,2);const after=await h.read();assert.deepEqual(after.journal,before.journal);assert.equal(after.invoices.length,before.invoices.length);assert.equal(after.drgCases[0].allowedMinor,old.allowedMinor);
});

test('GL export is idempotently mapped, journal remains append-only and corruption fails closed',async t=>{
 const h=await harness(t),before=await h.read();const batch=(await h.command('export-gl',{},finance)).result;assert.deepEqual(batch.journalIds,before.journal.map(j=>j.id));assert.deepEqual((await h.read()).journal,before.journal);await h.command('export-gl',{},finance,409);
 const files=(await readdir(h.dataDir)).filter(f=>f.endsWith('.json'));const file=join(h.dataDir,files[0]),disk=JSON.parse(await readFile(file,'utf8'));Object.values(disk.partitions)[0].journal[0].entries[0].debitMinor=1;await writeFile(file,JSON.stringify(disk));assert.notEqual((await h.store.handle(admin,scope,{path:'/rcm/workspace'})).status,200);
});

test('commercial tenant defaults and branch overrides propagate across facilities with immutable histories',async t=>{
 const h=await harness(t),pharmacy={...scope,facilityId:'F002'},dubai={...scope,branchId:'dubai'};
 const at=async(selected,kind,payload,actor=admin)=>{const w=await h.read(actor,selected);const res=await h.store.handle(actor,selected,{method:'POST',path:'/rcm/commands',body:{kind,...payload,currency:'AED',expectedVersion:w.version,idempotencyKey:`scope-${Math.random()}`.replace('.','-')}});assert.equal(res.status,201,JSON.stringify(res.body));return res.body;};
 await h.read(admin,pharmacy);await h.read(admin,dubai);
 await at(scope,'configure-payer-policy',{level:'branch',payerIds:['PY001'],maximumPayers:1,effectiveFrom:'2026-01-01'});assert.equal((await h.read(admin,pharmacy)).effectivePayerPolicy.maximumPayers,1);assert.equal((await h.read(admin,dubai)).effectivePayerPolicy.maximumPayers,16);
 await at(scope,'configure-package',{level:'tenant',packageId:'PKG-DEMO',name:'Tenant case',caseRateMinor:60000,entitlementUnits:4,excessUnitMinor:10000});assert.equal((await h.read(admin,dubai)).packages[0].caseRateMinor,60000);
 await at(scope,'configure-package',{level:'branch',packageId:'PKG-DEMO',name:'HQ case',caseRateMinor:70000,entitlementUnits:5,excessUnitMinor:20000});assert.equal((await h.read(admin,pharmacy)).packages[0].caseRateMinor,70000);
 await at(dubai,'configure-package',{level:'tenant',packageId:'PKG-DEMO',name:'Revised tenant',caseRateMinor:65000,entitlementUnits:4,excessUnitMinor:10000});assert.equal((await h.read(admin,pharmacy)).packages[0].caseRateMinor,70000);assert.equal((await h.read(admin,dubai)).packages[0].caseRateMinor,65000);assert.equal((await h.read()).packageVersions[0].caseRateMinor,50000);
 await at(scope,'configure-exchange',{level:'tenant',profileId:'TENANT-PROFILE',wireFormat:'SOAP11',payerId:'PY001'});assert.equal((await h.read(admin,dubai)).exchangeProfiles[0].wireFormat,'SOAP11');await at(scope,'configure-exchange',{level:'branch',profileId:'TENANT-PROFILE',wireFormat:'REST_JSON',payerId:'PY001'});assert.equal((await h.read(admin,pharmacy)).exchangeProfiles[0].wireFormat,'REST_JSON');assert.equal((await h.read(admin,dubai)).exchangeProfiles[0].wireFormat,'SOAP11');assert.equal((await h.read()).exchangeProfileVersions.length,2);
 const proposal=(await at(scope,'propose-pricing',{level:'tenant',priceId:'SHARED',unitPriceMinor:101,taxBasisPoints:500,effectiveFrom:'2026-01-01'})).result;
 await at(dubai,'approve-pricing',{pricingVersionId:proposal.id},{...admin,id:'CHECKER-ADMIN'});const quote=(await at(pharmacy,'quote-price',{priceId:'SHARED',quantity:10})).result;assert.equal(quote.totalMinor,1061);
 await at(scope,'configure-drg',{level:'branch',adapter:'demo-v1',baseRateMinor:12345,groups:[{prefix:'*',groupCode:'LOCAL',weightBasisPoints:10000}]});assert.equal((await at(pharmacy,'group-drg',{invoiceId:'RCM-INV-001',adapter:'demo-v1',diagnosisCodes:['I10']})).result.allowedMinor,12345);assert.equal((await at(dubai,'group-drg',{invoiceId:'RCM-INV-001',adapter:'demo-v1',diagnosisCodes:['I10']})).result.allowedMinor,120000);
 h.restart();assert.equal((await h.read(admin,pharmacy)).packages[0].caseRateMinor,70000);assert.equal((await h.read(admin,dubai)).packages[0].caseRateMinor,65000);
});

test('cancellation releases only unsent refund reservation and collection captured amount must be proven',async t=>{
 const moneyProvider={async collect({amountMinor,currency}){return {providerRef:'col_missing',status:'captured',amountMinor,currency,capturedAmountMinor:null};}};
 const h=await harness(t,{moneyProvider}),d=(await h.command('record-deposit',{patientId:'PT00001',amountMinor:10000,reference:'MANUAL'},finance)).result,r=(await h.command('request-refund',{depositId:d.id,amountMinor:10000,reason:'return'},finance)).result;
 await h.command('cancel-refund',{refundId:r.id,reason:'Use deposit for care'},finance);assert.equal((await h.read()).deposits[0].availableMinor,10000);assert.equal((await h.read()).deposits[0].reservedMinor,0);
 const task=(await h.command('create-collection',{invoiceId:'RCM-INV-001',owner:'Collector',dueDate:'2026-10-01',note:'test'},finance)).result;const result=await h.command('dispatch-collection',{collectionId:task.id,amountMinor:10000},finance);assert.equal(result.result.status,'Uncertain');assert.equal(inv(result.workspace).patientPaidMinor,0);assert.equal(result.workspace.reports.cashMinor,10000);
});
