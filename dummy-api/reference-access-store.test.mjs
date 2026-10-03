import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createReferenceTenantAdminStore,createReferenceMedbandStore,tenantAdminRequestAllowed,medbandRequestAllowed} from './reference-access-store.mjs';
const user={id:'synthetic-access-admin',name:'Synthetic administrator',email:'access@example.test',role:'enterprise-admin',tenantId:'synthetic-access'};const scope={applicationId:'nexora',branchId:'hq'};
test('Embedded access role guards reject source actors, viewer writes, reset, malformed paths and unauthorized decisions',()=>{
 for(const guard of [tenantAdminRequestAllowed,medbandRequestAllowed]){assert.equal(guard({...user,role:'admin'},{method:'GET',path:'/bootstrap'}),403);assert.equal(guard(user,{method:'GET',path:'/../patients'}),400);assert.equal(guard(user,{method:'POST',path:'/admin/reset'}),403);assert.equal(guard(user,{method:'GET',path:'//patients'}),400);}
 assert.equal(tenantAdminRequestAllowed({...user,role:'tenant-config-editor'},{method:'POST',path:'/resources/numbering/1/approve'}),403);assert.equal(tenantAdminRequestAllowed({...user,role:'tenant-config-approver'},{method:'POST',path:'/resources/numbering'}),403);assert.equal(medbandRequestAllowed({...user,role:'medband-viewer'},{method:'POST',path:'/patients'}),403);assert.equal(medbandRequestAllowed({...user,role:'medband-reception'},{method:'PATCH',path:'/cases/1'}),403);
});
test('Tenant Admin preserves immutable independent approvals, stale row versions, atomic replay, audit and partitioned records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'access-tenant-'));let store=createReferenceTenantAdminStore({dataDir:dir});
 const call=(method,path,body,actor=user,target=scope,key=randomUUID())=>store.handle(actor,target,{method,path,body:body??null,headers:{'idempotency-key':key,'x-actor-id':'1'}});
 const good=async(...args)=>{const r=await call(...args);assert.ok(r.status<400,JSON.stringify(r));return r.body;};
 try{
  const meta=await good('GET','/meta');assert.equal(meta.resources.length,30);assert.equal(meta.currentUser.name,user.name);assert.equal(meta.hostManagedIdentity,true);assert.notEqual(meta.currentUser.id,1);
  for(const resource of meta.resources)assert.equal((await call('GET','/resources/'+resource.key)).status,200,resource.key);
  const key=randomUUID(),body={code:'NUM-SYNTHETIC',name:'Synthetic invoice sequence',effectiveFrom:new Date().toISOString().slice(0,10),data:{documentType:'INVOICE',legalEntity:'MCN-KSA',pattern:'INV-{YYYY}-{SEQ:6}',nextNumber:100,resetCycle:'YEARLY',branchScoped:true},reason:'Synthetic governance validation'};
  let row=await good('POST','/resources/numbering',body,user,scope,key);assert.equal(row.status,'DRAFT');assert.deepEqual(await good('POST','/resources/numbering',body,user,scope,key),row);assert.equal((await call('POST','/resources/numbering',{...body,name:'Changed'},user,scope,key)).status,409);
  const original=row;row=await good('POST','/resources/numbering/'+row.id+'/submit',{rowVersion:row.rowVersion});assert.equal(row.status,'PENDING_APPROVAL');assert.equal((await call('PUT','/resources/numbering/'+row.id,{...body,rowVersion:original.rowVersion})).status,409);assert.equal((await call('POST','/resources/numbering/'+row.id+'/approve',{rowVersion:row.rowVersion})).status,403);
  const approver={...user,id:'synthetic-independent-approver',email:'approver@example.test',role:'tenant-config-approver',name:'Independent approver'};
  row=await good('POST','/resources/numbering/'+row.id+'/approve',{rowVersion:row.rowVersion},approver);assert.equal(row.status,'APPROVED');assert.equal((await call('PUT','/resources/numbering/'+row.id,{...body,rowVersion:row.rowVersion})).status,409);
  const audit=await good('GET','/audit?resource=numbering&code=NUM-SYNTHETIC');assert.ok(audit.some(entry=>entry.action==='APPROVED'));assert.ok(audit.some(entry=>entry.action==='CREATED'&&entry.actorName===user.name)||audit.some(entry=>entry.action==='CREATED'&&entry.actorId===meta.currentUser.id));
  assert.equal((await call('GET','/resources/numbering/'+row.id,null,user,{...scope,branchId:'dubai'})).status,404);
  assert.equal((await call('POST','/resources/numbering',body,{...user,role:'tenant-config-viewer'})).status,403);
  await store.close();store=createReferenceTenantAdminStore({dataDir:dir});assert.deepEqual(await good('POST','/resources/numbering',body,user,scope,key),original);
  assert.equal((await call('POST','/resources/items',{name:'invalid',data:{}})).status,422);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
test('MedBand keeps registration, counter/encounter rules, actor audit, admission clearances, atomic replay and branch isolation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'access-medband-'));let store=createReferenceMedbandStore({dataDir:dir});
 const call=(method,path,body,actor=user,target=scope,key=randomUUID())=>store.handle(actor,target,{method,path,body:body??null,headers:{'idempotency-key':key,'x-actor-id':'1'}});
 const good=async(...args)=>{const r=await call(...args);assert.ok(r.status<400,JSON.stringify(r));return r.body;};
 try{
  const boot=await good('GET','/bootstrap');assert.equal(boot.currentUser.id,user.id);assert.equal(boot.master.counters.length,5);assert.equal(boot.hostManagedIdentity,true);
  const key=randomUUID(),body={firstName:'Synthetic',lastName:'Access',dob:'1990-04-12',gender:'Female',phone:'5550100099',nationalId:'SYNTHETIC-ACCESS-ID',coverages:[]};const registration=await good('POST','/patients',body,user,scope,key);const id=registration.patientId;assert.deepEqual(await good('POST','/patients',body,user,scope,key),registration);assert.equal((await call('POST','/patients',{...body,phone:'changed'},user,scope,key)).status,409);
  const before=(await good('GET','/bootstrap')).data.patients.length;assert.equal((await call('POST','/patients',{...body,nationalId:'SYNTHETIC-INVALID',phone:''})).status,422);assert.equal((await good('GET','/bootstrap')).data.patients.length,before);
  const audit=await good('GET','/audit/patient/'+id);assert.equal(audit.entries[0].actorId,user.id);assert.equal((await call('GET','/patients/'+id,null,user,{...scope,branchId:'dubai'})).status,404);
  const counter=boot.master.counters.find(c=>c.types?.includes('OP')||c.encounterTypes?.includes('OP'))??boot.master.counters[0];const department=boot.master.departments.find(d=>d.consults);const practitioner=boot.master.practitioners.find(p=>p.departmentId===department.id);const complaint=boot.master.complaints[0];
  const visit={counterId:counter.id,patientId:id,type:'OP',startType:'WALK_IN',priority:'Routine',start:new Date().toISOString(),departmentId:department.id,practitionerId:practitioner.id,complaints:[{code:complaint.code,label:complaint.label,duration:1,unit:'days'}],case:{mode:'new',episode:{mode:'new',title:'Synthetic episode',kind:'Acute illness'}},billingMode:'Self pay'};
  assert.ok((await call('POST','/encounters',{...visit,type:'IP'})).status>=400);const created=await good('POST','/encounters',visit);assert.equal(created.encounters[0].patientId,id);assert.ok(created.encounters[0].caseId);assert.ok(created.encounters[0].episodeId);
  assert.equal((await call('PATCH','/cases/'+created.encounters[0].caseId,{status:'Closed'})).status,409);await good('PATCH','/encounters/'+created.encounterId,{status:'In progress',counterId:counter.id});await good('PATCH','/encounters/'+created.encounterId,{status:'Completed',counterId:counter.id});await good('PATCH','/cases/'+created.encounters[0].caseId,{status:'Closed'});
  const pending=boot.data.admissionRequests.find(r=>r.billingMode==='Insurance'&&r.status==='Pending');assert.ok(pending);assert.equal((await call('PATCH','/admission-requests/'+pending.id,{action:'authorize',decision:'Approved'})).status,422);const cleared=await good('PATCH','/admission-requests/'+pending.id,{action:'authorize',decision:'Approved',authNumber:'SYNTHETIC-AUTH'});assert.equal(cleared.admissionRequests[0].status,'Ready');
  assert.equal((await call('POST','/patients',body,{...user,role:'medband-viewer'})).status,403);assert.equal((await call('POST','/admin/reset',{})).status,403);
  await store.close();store=createReferenceMedbandStore({dataDir:dir});assert.deepEqual(await good('POST','/patients',body,user,scope,key),registration);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
