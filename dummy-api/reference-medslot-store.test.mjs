import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {createReferenceMedslotStore,medslotRequestAllowed} from './reference-medslot-store.mjs';
const admin={id:'synthetic-medslot-admin',name:'Synthetic Scheduler Admin',tenantId:'synthetic',role:'enterprise-admin',email:'synthetic@example.test'},scope={applicationId:'nexora',branchId:'hq'};
test('MedSlot rejects source impersonation, traversal, forged roles and restricted master access',()=>{for(const path of ['/auth/login','/auth/logout','/seed','/%2e%2e/patients','//patients','/patients\\1'])assert.notEqual(medslotRequestAllowed(admin,{path,method:'POST'}),200);assert.equal(medslotRequestAllowed({...admin,role:'admin'},{path:'/patients',method:'GET'}),403);assert.equal(medslotRequestAllowed({...admin,role:'medslot-provider'},{path:'/appointments',method:'POST'}),403);assert.equal(medslotRequestAllowed({...admin,role:'medslot-scheduler'},{path:'/users',method:'GET'}),403);});
test('Real MedSlot booking, overlap, schedules, audit, restart/retry and isolation',{timeout:120000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'medslot-test-'));let store=createReferenceMedslotStore({dataDir:dir});
 const call=(method,path,body,user=admin,s=scope,key=randomUUID())=>store.handle(user,s,{method,path,body,headers:{'idempotency-key':key}});
 const ok=async(...args)=>{const r=await call(...args);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.body;};
 try{
  const actor=await ok('GET','/auth/me');assert.equal(actor.user.name,admin.name);assert.equal(actor.user.password_hash,undefined);
  for(const path of ['/settings','/departments','/specialties','/resource-types','/resources','/services','/holidays','/patients','/appointments','/kpis','/users','/audit','/notifications/meta','/notifications/templates','/notifications/log'])await ok('GET',path);
  const payload={first_name:'Synthetic',last_name:'Medslot Acceptance',phone:'+971500000001',consent:true},key='medslot-patient-create-0001';
  const created=await call('POST','/patients',payload,admin,scope,key);assert.equal(created.status,201,JSON.stringify(created));assert.deepEqual(await call('POST','/patients',payload,admin,scope,key),created);
  assert.equal((await call('POST','/patients',{...payload,phone:'+971500000002'},admin,scope,key)).status,409);
  const id=created.body.id;assert.equal((await ok('GET','/patients/'+id)).first_name,'Synthetic');assert.equal((await call('GET','/patients/'+id,undefined,admin,{...scope,branchId:'other'})).status,404);assert.equal((await call('GET','/patients/'+id,undefined,{...admin,tenantId:'other-tenant'})).status,404);
  const services=await ok('GET','/services'),service=services.find(x=>x.department_name==='General Medicine')??services.find(x=>x.category==='consultation'),settings=await ok('GET','/settings');assert.ok(service);
  const date=new Date(settings.facility_now.slice(0,10)+'T00:00Z');date.setUTCDate(date.getUTCDate()+14);const from=date.toISOString().slice(0,10);
  const availability=await ok('GET','/availability?service_id='+service.id+'&from='+from);assert.ok(availability.days?.some(d=>d.slots.length),JSON.stringify(availability).slice(0,400));const slot=availability.days.flatMap(d=>d.slots)[0];
  const booking={patient_id:id,patient_kind:'new',service_id:service.id,start_at:slot.start,resources:slot.resources.map(r=>({resource_id:r.id,role:r.role})),reason:'Synthetic acceptance visit',visit_type:'new_visit',source:'front_desk',notify_channels:['email','sms']};
  const b=await call('POST','/appointments',booking);assert.equal(b.status,201,JSON.stringify(b));
  assert.equal((await call('POST','/appointments',booking)).status,409,'overlap rejected');
  const a=await ok('GET','/appointments/'+b.body.id);assert.equal(a.booked_by_name,admin.name);assert.ok(a.notifications.every(n=>n.status==='sent'||n.status==='opted_out'));
  assert.equal((await call('POST','/appointments/'+b.body.id+'/status',{status:'completed'})).status,400,'invalid source transition');
  const reminders=await ok('POST','/notifications/reminders/run',{});assert.equal(reminders.ok,true);assert.equal((await ok('POST','/notifications/reminders/run',{})).created,0,'same reminder window does not send twice');assert.equal((await call('POST','/notifications/reminders/run',{}, {...admin,role:'medslot-scheduler'})).status,403);
  const resource=await ok('GET','/resources/'+slot.resources[0].id);await ok('PUT','/resources/'+resource.id+'/schedules',{schedules:resource.schedules});
  const before=await ok('GET','/resources/'+resource.id);assert.equal((await call('PUT','/resources/'+resource.id+'/schedules',{schedules:[{weekday:1,start_time:'11:00',end_time:'10:00'}]})).status>=400,true);assert.deepEqual((await ok('GET','/resources/'+resource.id)).schedules,before.schedules);
  assert.equal((await call('PUT','/users/'+actor.user.id,{name:admin.name,email:'changed@example.test',role:'admin',active:true})).status,400);
  assert.equal((await call('GET','/auth/me',undefined,{...admin,id:'unmapped-provider',role:'medslot-provider'})).status,200);assert.equal((await call('GET','/patients',undefined,{...admin,id:'unmapped-provider',role:'medslot-provider'})).status,403);
  const provider={...admin,id:'ACCESS-MEDSLOT-PROVIDER',role:'medslot-provider'};const prov=(await ok('GET','/auth/me',undefined,provider)).user;const cal=await ok('GET','/appointments/calendar?from='+from+'&to='+from+'&resource_ids=99999',undefined,provider);assert.ok(cal.resources.every(r=>r.id===prov.resource_id));assert.equal((await call('GET','/patients/'+id,undefined,provider)).status,403);await ok('GET','/kpis',undefined,provider);
  assert.equal((await call('POST','/appointments/'+b.body.id+'/status',{status:'checked_in'},provider)).status,403,'provider cannot mutate another resource');
  const owned=(await ok('GET','/appointments?status=confirmed,scheduled&limit=200',undefined,provider)).items.find(x=>x.resources.some(r=>r.id===prov.resource_id));assert.ok(owned,'seed contains assigned provider visit');
  // The seeded roster includes future visits. Resource ownership does not bypass
  // the original service's same-facility-day check-in rule.
  const sameDay=owned.start_at.slice(0,10)===(await ok('GET','/settings')).facility_now.slice(0,10);
  const checkIn=await call('POST','/appointments/'+owned.id+'/status',{status:'checked_in'},provider);
  assert.equal(checkIn.status,sameDay?200:400,JSON.stringify(checkIn));
  if(!sameDay)assert.match(checkIn.body.error,/only on the day of the appointment/);
  assert.equal((await ok('GET','/appointments/'+owned.id,undefined,provider)).status,sameDay?'checked_in':owned.status);
  const providerPatients=await ok('GET','/patients',undefined,provider);assert.equal(providerPatients.some(p=>p.id===id),false);
  assert.equal((await call('GET','/patients?limit=-1')).status,400);assert.equal((await call('POST','/patients',payload,admin,scope,'')).status,400);
  await store.close();store=createReferenceMedslotStore({dataDir:dir});assert.deepEqual(await call('POST','/patients',payload,admin,scope,key),created);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
