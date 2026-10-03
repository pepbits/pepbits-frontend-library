import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createReferenceRcmStore,rcmRequestAllowed} from './reference-rcm-store.mjs';
const admin={id:'synthetic-rcm-admin',name:'Synthetic RCM Administrator',role:'enterprise-admin',tenantId:'synthetic-rcm',initials:'SR'};
const scope={applicationId:'nexora',branchId:'hq'};
test('RCM host permissions reject role forgery, traversal and cross-domain commands',()=>{
 for(const p of ['/seed','/auth/login','/users','/%2e%2e/records','//records','/records\\invoices'])assert.notEqual(rcmRequestAllowed(admin,{method:'POST',path:p}),200);
 assert.equal(rcmRequestAllowed({...admin,role:'admin'},{method:'GET',path:'/meta'}),403);
 assert.equal(rcmRequestAllowed({...admin,role:'rcm-reference-viewer'},{method:'POST',path:'/records/receipts'}),403);
 assert.equal(rcmRequestAllowed({...admin,role:'rcm-reference-clerk'},{method:'POST',path:'/records/invoices/1/actions/issue'}),403);
 assert.equal(rcmRequestAllowed({...admin,role:'rcm-reference-insurance'},{method:'POST',path:'/records/credit-notes'}),403);
 assert.equal(rcmRequestAllowed({...admin,role:'rcm-reference-accountant'},{method:'POST',path:'/records/claims'}),403);
 assert.equal(rcmRequestAllowed({...admin,role:'rcm-reference-coder'},{method:'POST',path:'/records/refunds'}),403);
});
test('RCM original service has complete registry, durable scoped transactions, second-person approval and financial rollback',{timeout:120000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pepbits-rcm-test-'));let store=createReferenceRcmStore({dataDir:dir});
 const call=(method,path,body,user=admin,s=scope,headers={})=>store.handle(user,s,{method,path,body,headers:{...(!['GET','HEAD'].includes(method)?{'idempotency-key':randomUUID()}:{}),...headers}});
 const ok=async(m,p,b,u=admin,s=scope,h={})=>{const r=await call(m,p,b,u,s,h);assert.ok(r.status>=200&&r.status<300,`${m} ${p}: ${JSON.stringify(r)}`);return r.body;};
 const actor2={...admin,id:'synthetic-rcm-checker',name:'Synthetic independent approver'};
 try{
  const meta=await ok('GET','/meta');assert.equal(meta.resources.length,36);assert.equal(meta.categories.flatMap(c=>c.pages).length,40);assert.equal(meta.hostManagedIdentity,true);assert.equal(meta.currentUser.name,admin.name);
  for(const r of meta.resources){const result=await ok('GET','/records/'+r.key);assert.ok(Array.isArray(result.rows),r.key);}
  for(const p of ['/dashboard/home','/dashboard/aging','/dashboard/reports','/approvals','/pending','/audit'])await ok('GET',p);
  const sar=await ok('GET','/records/invoices',undefined,admin,scope,{'x-rcm-scope':'ALL:SAR'});const aed=await ok('GET','/records/invoices',undefined,admin,scope,{'x-rcm-scope':'ALL:AED'});
  assert.ok(sar.rows.length&&aed.rows.length);assert.ok(sar.rows.every(r=>r.currency==='SAR'));assert.ok(aed.rows.every(r=>r.currency==='AED'));
  assert.equal((await call('GET','/meta',undefined,admin,scope,{'x-rcm-scope':'INVALID'})).status,400);
  assert.equal((await call('GET','/records/invoices?pageSize=Infinity')).status,400);
  assert.equal((await call('GET','/records/claims?pageSize=300')).status,200);
  assert.equal((await call('GET','/records/claims?pageSize=301')).status,400);
  const invoice=sar.rows.find(r=>r.status==='ISSUED'&&r.values.balance>10);assert.ok(invoice);
  const values={invoice:invoice.id,patient:invoice.values.patient,amount:1,reasonCode:'PRICE_ERROR',note:'Synthetic reference acceptance'};
  const key={'idempotency-key':'rcm-credit-create-0001'};
  const create=await call('POST','/records/credit-notes',{values},admin,scope,key);assert.equal(create.status,201);assert.deepEqual(await call('POST','/records/credit-notes',{values},admin,scope,key),create);
  assert.equal((await call('POST','/records/credit-notes',{values:{...values,amount:2}},admin,scope,key)).status,409);
  assert.equal((await call('POST','/records/credit-notes',{values},admin,scope,{...key,'x-rcm-scope':'ALL:AED'})).status,409);
  let credit=create.body;const oldVersion=credit.rowVersion;
  credit=await ok('PUT','/records/credit-notes/'+credit.id,{rowVersion:credit.rowVersion,values:{note:'Corrected synthetic note'}});
  assert.equal((await call('PUT','/records/credit-notes/'+credit.id,{rowVersion:oldVersion,values:{note:'Stale edit'}})).status,409);
  credit=await ok('POST','/records/credit-notes/'+credit.id+'/actions/submit',{rowVersion:credit.rowVersion});
  assert.equal((await call('POST','/records/credit-notes/'+credit.id+'/actions/issue',{rowVersion:credit.rowVersion})).status,403);
  const issueKey={'idempotency-key':'rcm-credit-issue-0001'},issueBody={rowVersion:credit.rowVersion};
  const issued=await call('POST','/records/credit-notes/'+credit.id+'/actions/issue',issueBody,actor2,scope,issueKey);assert.equal(issued.status,200);assert.equal(issued.body.status,'ISSUED');assert.deepEqual(await call('POST','/records/credit-notes/'+credit.id+'/actions/issue',issueBody,actor2,scope,issueKey),issued);
  assert.equal((await ok('GET','/records/invoices/'+invoice.id)).values.balance,invoice.values.balance-1);
  let excess=await ok('POST','/records/credit-notes',{values:{...values,amount:invoice.values.balance+100}});excess=await ok('POST','/records/credit-notes/'+excess.id+'/actions/submit',{rowVersion:excess.rowVersion});
  const before=await ok('GET','/records/invoices/'+invoice.id);assert.ok((await call('POST','/records/credit-notes/'+excess.id+'/actions/issue',{rowVersion:excess.rowVersion},actor2)).status>=400);
  assert.deepEqual(await ok('GET','/records/invoices/'+invoice.id),before);assert.equal((await ok('GET','/records/credit-notes/'+excess.id)).status,'PENDING_APPROVAL');
  for(const [u,s]of [[admin,{...scope,branchId:'other'}],[{...admin,tenantId:'other'},scope]])assert.equal((await call('GET','/records/credit-notes/'+credit.id,undefined,u,s)).status,404);
  assert.equal((await call('POST','/records/credit-notes',{values},{...admin,role:'rcm-reference-viewer'})).status,403);
  const viewMeta=await ok('GET','/meta',undefined,{...admin,role:'rcm-reference-viewer'});assert.ok(viewMeta.resources.every(r=>!r.create&&!r.actions.length&&!r.editable.length));
  await store.close();store=createReferenceRcmStore({dataDir:dir});assert.deepEqual(await call('POST','/records/credit-notes/'+credit.id+'/actions/issue',issueBody,actor2,scope,issueKey),issued);assert.deepEqual(await call('POST','/records/credit-notes',{values},admin,scope,key),create);
  assert.equal((await call('POST','/records/credit-notes',{values},admin,scope,{'idempotency-key':undefined})).status,400);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
