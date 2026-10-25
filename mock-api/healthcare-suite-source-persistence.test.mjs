import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReferenceHealthcareSuiteStore} from './reference-healthcare-suite-store.mjs';
const user={id:'SOURCE-ADMIN',tenantId:'SOURCE-TENANT',branch:'hq',role:'enterprise-admin',name:'Synthetic actor'};
const scope={applicationId:'nexora',branchId:'hq',moduleId:'reference-healthcare-suite'};
const patient={firstName:'Durable',lastName:'Synthetic Patient',gender:'Female',phone:'+971 50 123 8888',dob:'1990-01-01'};
function call(store,method,path,body,headers={},targetScope=scope){return store.handle(user,targetScope,{method,path:'/api'+path,body,headers});}
function ok(result){assert.ok(result.status<300,JSON.stringify(result));return result.body;}
test('clinical identities, source invoices and replay evidence survive restart without cross-branch leakage',t=>{
 const dir=mkdtempSync(join(tmpdir(),'suite-source-durable-'));let store=createReferenceHealthcareSuiteStore({dataDir:dir});t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const p=ok(call(store,'POST','/patients',patient,{'Idempotency-Key':'patient-create'}));
 const e=ok(call(store,'POST','/encounters',{patientId:p.id,encounterType:'Pharmacy',paymentClass:'Cash'}));
 const order=ok(call(store,'POST',`/encounters/${e.id}/orders`,{code:'ITM-PAR500',qty:1,dosage:'Synthetic dose',frequency:'Synthetic schedule'}));
 ok(call(store,'POST',`/encounters/${e.id}/orders/sign`,{orderIds:[order.id]}));
 const inv=ok(call(store,'POST','/billing/invoices',{encounterId:e.id,category:'Pharmacy',payments:[]}));
 const stock=ok(call(store,'GET','/masters/items/I001')).stockQty;
 store.close();store=createReferenceHealthcareSuiteStore({dataDir:dir});
 assert.equal(ok(call(store,'GET',`/billing/invoices/${inv.id}`)).patientId,p.id);
 assert.equal(ok(call(store,'GET','/masters/items/I001')).stockQty,stock);
 assert.equal(ok(call(store,'POST','/patients',patient,{'Idempotency-Key':'patient-create'})).id,p.id);
 const other=ok(call(store,'POST','/patients',{...patient,firstName:'Next'}, {'Idempotency-Key':'next-patient'}));assert.notEqual(other.id,p.id);
 assert.equal(call(store,'GET',`/billing/invoices/${inv.id}`,undefined,{}, {...scope,branchId:'dubai'}).status,404);
});
test('failed durable commit restores business data and retry ownership',t=>{
 const dir=mkdtempSync(join(tmpdir(),'suite-source-rollback-'));let fail=false;const store=createReferenceHealthcareSuiteStore({dataDir:dir,beforePersist:()=>{if(fail)throw Error('Injected disk failure');}});t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const before=ok(call(store,'GET','/patients')).total;fail=true;
 assert.throws(()=>call(store,'POST','/patients',patient,{'Idempotency-Key':'retry-after-disk'}),/Injected disk failure/);
 fail=false;assert.equal(ok(call(store,'GET','/patients')).total,before);
 const recovered=ok(call(store,'POST','/patients',patient,{'Idempotency-Key':'retry-after-disk'}));assert.ok(recovered.id);
 assert.equal(ok(call(store,'GET','/patients')).total,before+1);
});
test('a second source writer is rejected until the owning writer closes',t=>{
 const dir=mkdtempSync(join(tmpdir(),'suite-source-writer-'));const one=createReferenceHealthcareSuiteStore({dataDir:dir});t.after(()=>{one.close();rmSync(dir,{recursive:true,force:true});});
 assert.throws(()=>createReferenceHealthcareSuiteStore({dataDir:dir}),/active writer/);one.close();const two=createReferenceHealthcareSuiteStore({dataDir:dir});assert.equal(ok(call(two,'GET','/session')).user.id,user.id);two.close();
});
