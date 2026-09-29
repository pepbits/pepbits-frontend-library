// CarePoint fictional operations API. Original CSV fixtures and business services remain server-owned.
// The HTTP host authorizes module access; this adapter also checks actor, product, branch and write roles.
// Process-lifetime storage is partitioned by trusted tenant/application/branch. No real clinical/payer service.
import {createHash} from 'node:crypto';
import {CsvStore} from './reference-healthcare-suite-source/common/csv-store.service.mjs';
import {ValidationFailed} from './reference-healthcare-suite-source/common/errors.mjs';
import {BadRequestException,HttpException} from './reference-healthcare-suite-source/runtime.mjs';
import {todayIso} from './reference-healthcare-suite-source/common/query.mjs';
import {MastersService} from './reference-healthcare-suite-source/masters/masters.service.mjs';
import {PatientsService} from './reference-healthcare-suite-source/patients/patients.service.mjs';
import {SchedulingService} from './reference-healthcare-suite-source/scheduling/scheduling.service.mjs';
import {EligibilityService} from './reference-healthcare-suite-source/encounters/eligibility.service.mjs';
import {EncountersService} from './reference-healthcare-suite-source/encounters/encounters.service.mjs';
import {OrdersService} from './reference-healthcare-suite-source/orders/orders.service.mjs';
import {ApprovalsService} from './reference-healthcare-suite-source/orders/approvals.service.mjs';
import {PricingService} from './reference-healthcare-suite-source/pricing/pricing.service.mjs';
import {BillingService} from './reference-healthcare-suite-source/billing/billing.service.mjs';
import {SystemService} from './reference-healthcare-suite-source/system/system.service.mjs';
const READ_ROLES=new Set(['enterprise-admin','admin','operations-analyst','operations','finance-manager','finance','read-only']);
const WRITE_ROLES=new Set(['enterprise-admin','admin','operations-analyst','operations']);
const BRANCHES=new Set(['hq','dubai','sharjah']);
const fail=(status,message,fields)=>({status,body:{statusCode:status,message,...(fields?{fields}:{})}});
const invalid=(field,message)=>{throw new ValidationFailed({[field]:message});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const number=value=>typeof value==='number'&&Number.isFinite(value);
const ids=(value,field)=>{if(!Array.isArray(value)||value.some(id=>typeof id!=='string'||!id)||new Set(value).size!==value.length)invalid(field,'Choose distinct record identifiers');};
function partition(){
 const store=new CsvStore(new URL('./reference-healthcare-suite-data/',import.meta.url));
 const patients=new PatientsService(store),masters=new MastersService(store),pricing=new PricingService(store),scheduling=new SchedulingService(store,patients),eligibility=new EligibilityService(store,patients),orders=new OrdersService(store,pricing),approvals=new ApprovalsService(store),encounters=new EncountersService(store,patients,orders,approvals,pricing,eligibility),billing=new BillingService(store,orders,approvals,pricing,patients),system=new SystemService(store,scheduling,approvals);
 system.onApplicationBootstrap();return{store,patients,masters,pricing,scheduling,eligibility,orders,approvals,encounters,billing,system,replays:new Map()};
}
function validatePayments(payments){
 if(!Array.isArray(payments))invalid('payments','Provide an array of payments');
 payments.forEach((p,i)=>{if(!object(p))invalid(`payments.${i}`,'Provide a payment');if(!number(p.amount)||p.amount<0)invalid(`payments.${i}.amount`,'Enter a finite non-negative amount');if(!['Cash','Card','Online','Advance'].includes(p.mode))invalid(`payments.${i}.mode`,'Choose a payment mode');if(p.reference!=null&&typeof p.reference!=='string')invalid(`payments.${i}.reference`,'Enter a text value');if(p.mode==='Card'&&!String(p.reference??'').trim())invalid(`payments.${i}.reference`,'Enter the card approval code');});
}
function validateShape(body){
 if(!object(body))invalid('body','Provide a JSON object');
 // Generic text fields are source CSV strings. Reject objects/arrays instead of coercing them into records.
 for(const [field,value]of Object.entries(body)){
  if(value!==null&&typeof value==='object'&&!['policies','lines','payments','orderIds'].includes(field))invalid(field,'Unsupported field value');
  if(typeof value==='number'&&!Number.isFinite(value))invalid(field,'Enter a finite number');
 }
 for(const field of ['code','patientId','policyId','resourceId','departmentId','providerId','specialtyId','appointmentId','date','startTime','status','category','encounterType','paymentClass','firstName','lastName','guestName','guestPhone','gender','dob','phone','email','nationalId','diagnosis','justification','reason','mode','reference','channel','dosage','frequency','instructions','route'])if(body[field]!=null&&typeof body[field]!=='string')invalid(field,'Enter a text value');
 for(const field of ['date','dob','guestDob','validFrom','validTo','licenseExpiry'])if(body[field]&&(!/^\d{4}-\d{2}-\d{2}$/.test(body[field])||Number.isNaN(Date.parse(body[field]))||new Date(body[field]).toISOString().slice(0,10)!==body[field]))invalid(field,'Enter an ISO calendar date');
 for(const field of ['startTime','endTime'])if(body[field]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(body[field]))invalid(field,'Enter a time from 00:00 to 23:59');
 if(body.orderIds!==undefined)ids(body.orderIds,'orderIds');
 if(body.qty!==undefined&&(!number(body.qty)||body.qty<=0))invalid('qty','Quantity must be greater than zero');
 if(body.durationDays!==undefined&&(!number(body.durationDays)||body.durationDays<0))invalid('durationDays','Enter a non-negative duration');
 if(body.policies!==undefined){if(!Array.isArray(body.policies)||body.policies.some(value=>!object(value)))invalid('policies','Provide an array of policies');for(const [i,policy] of body.policies.entries())for(const [field,value] of Object.entries(policy)){if(field==='isPrimary'){if(typeof value!=='boolean')invalid(`policies.${i}.${field}`,'Choose true or false');}else if(value!=null&&typeof value!=='string')invalid(`policies.${i}.${field}`,'Enter a text value');}}
 if(body.payments!==undefined)validatePayments(body.payments);
}
function validatePatientPolicies(store,body,patientId){
 for(const [i,pol]of(body.policies??[]).entries()){
  if(pol.id&&store.get('patient_policies',pol.id,'Policy').patientId!==patientId)invalid(`policies.${i}.id`,'Policy belongs to another patient');
  if(pol.status==='Inactive')continue;
  for(const[field,table]of[['payerId','payers'],['tpaId','tpas'],['planId','insurance_plans'],['networkId','networks']])if(pol[field]&&!store.find(table,pol[field]))invalid(`policies.${i}.${field}`,'Selected record no longer exists');
  const plan=store.find('insurance_plans',pol.planId);if(plan&&pol.tpaId!==plan.tpaId)invalid(`policies.${i}.tpaId`,'TPA does not belong to the selected plan');
 }
}
function validateMasterSchema(store,masters,entity,body){
 const def=masters.def(entity),cols=store.table(def.table).columns;
 for(const col of cols){const value=body[col.name];if(value===undefined||value===null||value==='')continue;
  if(col.type==='number'&&!(number(value)||(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value)))))invalid(col.name,'Enter a finite number');
  if(col.type==='boolean'&&typeof value!=='boolean')invalid(col.name,'Choose true or false');
  if(col.type==='string'&&typeof value!=='string')invalid(col.name,'Enter a text value');
 }
}
function route(p,method,path,q,body,user,facility){
 const {store,masters,patients,scheduling,eligibility,encounters,orders,approvals,pricing,billing,system}=p;
 if(path==='/health'&&method==='GET')return{ok:true,at:new Date().toISOString()};
 if(path==='/session'&&method==='GET')return{user:{id:user.id,name:user.name,role:user.role,email:user.email,initials:user.initials},facilities:store.all('facilities').filter(f=>f.status==='Active'),defaultFacilityId:facility.id,selectedFacilityId:facility.id,currency:process.env.CURRENCY??'AED',today:todayIso(),canWrite:WRITE_ROLES.has(user.role)};
 if(path==='/dashboard'&&method==='GET')return system.dashboard(q.date||undefined);
 let m;
 if((m=path.match(/^\/(masters|lookups)\/([^/]+)(?:\/([^/]+)(?:\/(status))?)?$/))){const[,kind,entity,id,status]=m;
  if(kind==='lookups'&&method==='GET'&&!id)return masters.lookups(entity,q);
  if(kind==='masters'){
   if(method==='GET'&&!status)return id?masters.get(entity,id):masters.list(entity,q);
   if(method==='POST'&&!id){validateMasterSchema(store,masters,entity,body);return masters.create(entity,body);}
   if(method==='PUT'&&id&&!status){validateMasterSchema(store,masters,entity,body);return masters.update(entity,id,body);}
   if(method==='PATCH'&&id&&status){if(!['Active','Inactive'].includes(body.status))invalid('status','Choose Active or Inactive');return masters.setStatus(entity,id,body.status);}
  }
 }
 if(path==='/patients'){if(method==='GET')return patients.search(q);if(method==='POST'){validatePatientPolicies(store,body);return patients.create(body);}}
 if((m=path.match(/^\/patients\/([^/]+)$/))){if(method==='GET')return patients.get(m[1]);if(method==='PUT'){validatePatientPolicies(store,body,m[1]);return patients.update(m[1],body);}}
 if(path==='/scheduling/slots'&&method==='GET'){if(q.date&&!/^\d{4}-\d{2}-\d{2}$/.test(q.date))invalid('date','Enter an ISO calendar date');return scheduling.slots(q);}
 if(path==='/appointments'){if(method==='GET')return scheduling.list(q);if(method==='POST')return scheduling.book(body);}
 if((m=path.match(/^\/appointments\/([^/]+)(?:\/(reschedule|status|register))?$/))){const[,id,action]=m;
  if(method==='GET'&&!action)return scheduling.get(id);
  if(method==='PUT'&&action==='reschedule')return scheduling.reschedule(id,body);
  if(method==='PATCH'&&action==='status'){const a=store.get('appointments',id);if(body.status==='Cancelled'&&!String(body.reason??'').trim())invalid('reason','Give a reason for cancelling');return a.status===body.status?scheduling.get(id):scheduling.setStatus(id,body.status,body.reason);}
  if(method==='POST'&&action==='register'){validatePatientPolicies(store,body);return scheduling.register(id,body);}
 }
 if(path==='/eligibility/check'&&method==='POST')return eligibility.check(body);
 if(path==='/encounters'){
  if(method==='GET')return encounters.list(q);
  if(method==='POST'){
   if(!['Outpatient','Walk-in','Emergency','Pharmacy'].includes(body.encounterType))invalid('encounterType','Choose a supported encounter type');
   if(body.facilityId&&body.facilityId!==facility.id)invalid('facilityId','Facility differs from the selected facility');
   for(const[field,table]of[['departmentId','departments'],['specialtyId','specialties'],['providerId','providers']])if(body[field])store.get(table,body[field]);
   const provider=body.providerId?store.find('providers',body.providerId):null,specialty=body.specialtyId?store.find('specialties',body.specialtyId):null;
   if(provider&&provider.departmentId!==body.departmentId)invalid('providerId','Provider does not belong to the selected department');
   if(specialty&&specialty.departmentId!==body.departmentId)invalid('specialtyId','Specialty does not belong to the selected department');
   if(provider&&body.specialtyId&&provider.specialtyId!==body.specialtyId)invalid('providerId','Provider does not belong to the selected specialty');
   if(body.appointmentId){const appt=store.get('appointments',body.appointmentId),resource=store.get('resources',appt.resourceId);if(resource.providerId&&resource.providerId!==body.providerId)invalid('providerId','Provider differs from the booked resource');}
   return encounters.create({...body,facilityId:facility.id});
  }
 }
 if((m=path.match(/^\/encounters\/([^/]+)(?:\/(status|orders|orders\/sign|approvals))?$/))){const[,id,action]=m;
  if(method==='GET'&&!action)return encounters.get(id);
  if(method==='PATCH'&&action==='status')return store.get('encounters',id).status===body.status?encounters.get(id):encounters.setStatus(id,body.status);
  if(method==='POST'&&action==='orders')return orders.add(id,body);
  if(method==='POST'&&action==='orders/sign'){
   if(body.orderIds?.length){for(const orderId of body.orderIds){const order=store.get('orders',orderId);if(order.encounterId!==id)invalid('orderIds','Order belongs to another encounter');if(!['Draft','Signed'].includes(order.status))invalid('orderIds','Only draft or signed lines can be signed');}
    if(body.orderIds.every(orderId=>store.get('orders',orderId).status==='Signed'))return{signed:0};}
   return orders.sign(id,body.orderIds);
  }
  if(method==='POST'&&action==='approvals'){if(!['PriorAuth','eRx'].includes(body.channel))invalid('channel','Choose PriorAuth or eRx');return approvals.submit(id,body);}
 }
 if((m=path.match(/^\/orders\/([^/]+)$/))){if(method==='PUT'){
    const order=store.get('orders',m[1]);
    if(order.priorAuthStatus==='Pending'||order.erxStatus==='Pending')throw new BadRequestException('An approval is in progress for this line. Wait for the response before changing it.');
    const quantityChanged=body.qty!==undefined&&body.qty!==order.qty;
    const updated=orders.update(m[1],body);
    if(quantityChanged&&(updated.erxRequired||updated.priorAuthRequired))return store.update('orders',m[1],{erxStatus:updated.erxRequired?'Required':'NotRequired',erxId:'',priorAuthStatus:updated.priorAuthRequired?'Required':'NotRequired',approvalId:''});
    return updated;
   }if(method==='DELETE')return orders.cancel(m[1]);}
 if(path==='/approvals'&&method==='GET')return approvals.list(q);
 if(path==='/pricing/quote'&&method==='GET'){const qty=q.qty===undefined?1:Number(q.qty);if(!Number.isFinite(qty)||qty<=0)invalid('qty','Quantity must be greater than zero');return pricing.quote(q.code,qty,q.policyId||null);}
 if(path==='/catalog/search'&&method==='GET')return pricing.search(q.q??'',q.kind??'all',q.policyId,q.encounterType);
 if((m=path.match(/^\/contracts\/([^/]+)\/lines$/))){
  if(method==='GET')return pricing.contractGrid(m[1],q.kind??'all',q.search??'');
  if(method==='PUT'){
   if(!Array.isArray(body.lines))invalid('lines','Provide an array of contract lines');
   const codes=new Set();for(const [i,line]of body.lines.entries()){
    if(!object(line)||typeof line.code!=='string'||!line.code||codes.has(line.code))invalid(`lines.${i}.code`,'Choose a distinct catalog code');codes.add(line.code);pricing.catalogEntry(line.code);
    if(line.price!==null&&(!number(line.price)||line.price<0))invalid(`lines.${i}.price`,'Enter a finite non-negative price or leave blank');
    if(typeof line.covered!=='boolean'||typeof line.priorAuth!=='boolean')invalid(`lines.${i}`,'Coverage and prior approval must be true or false');
   }
   // A blank override retains the contract default discount, even when coverage flags differ.
   const list=store.get('price_lists',m[1]);const lines=body.lines.map(line=>line.price===null&&(!line.covered||line.priorAuth)?{code:line.code,covered:line.covered,priorAuth:line.priorAuth,price:Math.round(pricing.catalogEntry(line.code).row.basePrice*(1-(list.defaultDiscountPct||0)/100)*100)/100}:{code:line.code,covered:line.covered,priorAuth:line.priorAuth,price:line.price});
   return pricing.saveContractLines(m[1],lines);
  }
 }
 if(path==='/billing/pending'&&method==='GET'){if(q.category&&!['Hospital','Pharmacy'].includes(q.category))invalid('category','Choose Hospital or Pharmacy');return billing.pending(q);}
 if((m=path.match(/^\/billing\/preview\/([^/]+)$/))&&method==='GET'){if(!['Hospital','Pharmacy'].includes(q.category))invalid('category','Choose Hospital or Pharmacy');return billing.preview(m[1],q.category);}
 if(path==='/billing/invoices'){
  if(method==='GET')return billing.list(q);
  if(method==='POST'){
   if(!['Hospital','Pharmacy'].includes(body.category))invalid('category','Choose Hospital or Pharmacy');
   return billing.create(body);
  }
 }
 if((m=path.match(/^\/billing\/invoices\/([^/]+)(?:\/(payments|cancel))?$/))){const[,id,action]=m;
  if(method==='GET'&&!action)return billing.get(id);
  if(method==='POST'&&action==='payments'){validatePayments([{...body,mode:body.mode??'Cash'}]);return billing.collect(id,body);}
  if(method==='POST'&&action==='cancel')return store.get('invoices',id).status==='Cancelled'?billing.get(id):billing.cancel(id,body.reason);
 }
 throw new HttpException('Healthcare Suite endpoint or method is unavailable',404);
}
export function createReferenceHealthcareSuiteStore(){
 const partitions=new Map();
 return{handle(user,scope,request){
  if(!user?.id||!user.tenantId)return fail(401,'Not signed in.');
  if(!READ_ROLES.has(user.role))return fail(403,'Healthcare Suite role is unavailable.');
  if(scope?.applicationId!=='nexora')return fail(403,'Healthcare Suite product is unavailable.');
  if(!BRANCHES.has(scope.branchId)||(user.role!=='enterprise-admin'&&user.role!=='admin'&&scope.branchId!==user.branch))return fail(403,'Healthcare Suite branch is unavailable.');
  if(scope.moduleId&&scope.moduleId!=='reference-healthcare-suite')return fail(403,'Healthcare Suite module is unavailable.');
  const method=String(request.method??'GET').toUpperCase();
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))return fail(405,'Healthcare Suite method is unavailable.');
  if(method!=='GET'&&!WRITE_ROLES.has(user.role))return fail(403,'Healthcare Suite is read-only for this role.');
  const key=JSON.stringify([user.tenantId,scope.applicationId,scope.branchId]);
  let p=partitions.get(key);if(!p){p=partition();partitions.set(key,p);}
  let snapshot;
  try{
   const path=decodeURIComponent(String(request.path??'/')).replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'')||'/';
   const q=request.query instanceof URLSearchParams?Object.fromEntries(request.query):{...(request.query??{})};
   const body=request.body??{};if(method!=='GET')validateShape(body);
   const selected=request.headers?.['x-reference-facility']??request.headers?.['X-Reference-Facility']??scope.facilityId??'F001';
   const facility=p.store.find('facilities',selected);if(!facility||facility.status!=='Active')return fail(403,'Healthcare Suite facility is unavailable.');
   const replayKey=request.headers?.['idempotency-key']??request.headers?.['Idempotency-Key'];
   if(replayKey!==undefined&&(typeof replayKey!=='string'||!/^[\w:.-]{1,128}$/.test(replayKey)))invalid('idempotencyKey','Provide an operation identifier of up to 128 characters');
   const replayId=replayKey?JSON.stringify([user.id,facility.id,replayKey]):null;
   const fingerprint=createHash('sha256').update(JSON.stringify([method,path,q,body])).digest('hex');
   if(replayId&&p.replays.has(replayId)){const replay=p.replays.get(replayId);return replay.fingerprint===fingerprint?structuredClone(replay.result):fail(409,'Operation identifier was already used for another request.');}
   snapshot=p.store.snapshot();p.store.actor=user;
   const result={status:method==='POST'?201:200,body:route(p,method,path,q,body,user,facility)};
   if(replayId){p.replays.set(replayId,{fingerprint,result:structuredClone(result)});}
   return structuredClone(result);
  }catch(error){if(snapshot)p.store.restore(snapshot);if(error instanceof HttpException)return{status:error.status,body:error.response};if(error instanceof URIError)return fail(400,'Malformed Healthcare Suite path.');throw error;}
 }};
}
