import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {createReferenceSurgiSuiteStore,surgisuiteRequestAllowed} from './reference-surgisuite-store.mjs';
const admin={id:'test-surg-admin',name:'Synthetic surgical administrator',tenantId:'synthetic',role:'enterprise-admin',email:'synthetic@example.test'};const scope={applicationId:'nexora',branchId:'hq'};
test('SurgiSuite trusted roles reject auth endpoints, traversal, unknown paths and viewer writes',()=>{for(const path of ['/auth/login','/auth/directory','/seed','/%2e%2e/cases','//cases','/cases\\1'])assert.notEqual(surgisuiteRequestAllowed(admin,{path,method:'POST'}),200);assert.equal(surgisuiteRequestAllowed({...admin,role:'ADMIN'},{path:'/cases',method:'GET'}),403);assert.equal(surgisuiteRequestAllowed({...admin,role:'surgisuite-viewer'},{path:'/patients',method:'POST'}),403);assert.equal(surgisuiteRequestAllowed({...admin,role:'surgisuite-nurse'},{path:'/staff/1',method:'PATCH'}),403);});
test('Original surgical services work through isolated durable transactional host',{timeout:120000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'surgisuite-test-'));let store=createReferenceSurgiSuiteStore({dataDir:dir});
 const call=(method,path,body,user=admin,s=scope,headers={})=>store.handle(user,s,{method,path,body,headers:{...(!['GET','HEAD'].includes(method)?{'idempotency-key':randomUUID()}:{}),...headers}});
 const ok=async(...args)=>{const r=await call(...args);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.body;};
 try{
  const actor=await ok('GET','/auth/me');assert.equal(actor.name,admin.name);assert.equal(actor.role,'ADMIN');assert.equal(actor.pin_hash,undefined);
  for(const path of ['/dashboard','/analytics','/approvals','/inventory','/lookups','/procedures','/diagnoses','/theatres','/equipment','/staff','/patients','/cases','/health'])await ok('GET',path);
  const staff=await ok('GET','/staff');assert.ok(staff.every(x=>!x.pin_hash));
  const payload={mrn:'SYNTHETIC-IMPORT-0001',name:'Synthetic Surgery Patient',dob:'1990-01-01',sex:'Female'},headers={'idempotency-key':'surgisuite-patient-create-001'};
  const created=await call('POST','/patients',payload,admin,scope,headers);assert.equal(created.status,201);assert.deepEqual(await call('POST','/patients',payload,admin,scope,headers),created);
  assert.equal((await call('POST','/patients',{...payload,name:'Changed'},admin,scope,headers)).status,409);
  const id=created.body.id;assert.equal((await ok('GET','/patients/'+id)).name,payload.name);
  assert.equal((await call('POST','/patients',payload,{...admin,role:'surgisuite-viewer'})).status,403);
  assert.equal((await call('GET','/patients/'+id,undefined,admin,{...scope,branchId:'other'})).status,404);
  assert.equal((await call('GET','/patients/'+id,undefined,{...admin,tenantId:'other'})).status,404);
  const bundle=(await ok('GET','/cases')).items??(await ok('GET','/cases')).rows??(await ok('GET','/cases'));
  assert.ok(Array.isArray(bundle)&&bundle.length);
  const c=await ok('GET','/cases/'+bundle[0].id);assert.ok(c.patient&&c.approvals&&c.milestones&&c.report!==undefined);
  assert.equal((await call('POST','/approvals/1/decide',{decision:'Approved',pin:'wrong'}, {...admin,role:'surgisuite-coordinator'})).status>=400,true);
  const procedures=await ok('GET','/procedures'),diagnoses=await ok('GET','/diagnoses'),theatres=await ok('GET','/theatres');
  const surgeon=staff.find(s=>s.role==='SURGEON');
  const booking={patientId:id,theatreId:theatres[0].id,scheduledStart:'2035-01-04T09:00:00.000Z',estDurationMin:60,procedures:[{procedureId:procedures[0].id,role:'Primary'}],diagnoses:[{diagnosisId:diagnoses[0].id,isPrimary:true}],team:[{staffId:surgeon.id,role:'Primary Surgeon'}]};
  const booked=await call('POST','/cases',booking);assert.equal(booked.status,201,JSON.stringify(booked));
  const before=await ok('GET','/inventory');
  assert.equal((await call('POST','/cases',booking)).status,409);
  assert.deepEqual(await ok('GET','/inventory'),before,'overlap rejection rolls back stock reservations');
  assert.equal((await call('POST','/cases',{...booking,scheduledStart:'2035-01-05T09:00:00Z',diagnoses:[]})).status,400);
  assert.equal((await call('POST','/cases/'+booked.body.id+'/milestones',{code:'INCISION'})).status>=400,true,'required milestone sequence cannot be skipped');
  const cancellation=await call('POST','/cases/'+booked.body.id+'/cancel',{reason:'Synthetic booking acceptance'});assert.equal(cancellation.status,200,JSON.stringify(cancellation));
  const cancelled=await ok('GET','/cases/'+booked.body.id);assert.equal(cancelled.status,'CANCELLED');
  await store.close();store=createReferenceSurgiSuiteStore({dataDir:dir});assert.deepEqual(await call('POST','/patients',payload,admin,scope,headers),created);
  assert.equal((await call('POST','/patients',payload,admin,scope,{'idempotency-key':undefined})).status,400);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
