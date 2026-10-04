import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readClinicalCsv,writeClinicalCsv,parseCsv,decodeClinicalCsv} from './clinical-template-csv.ts';
import {createClinicalTemplateStore} from './clinical-template-store.ts';
import type {PatientRecord,PatientOverview,PatientSearchResult} from '../desktop-clients/packages/erp-config/src/clinical-templates.ts';
const user={id:'csv-user',tenantId:'csv-tenant',name:'CSV demo'};
const scope=JSON.stringify([user.tenantId,'nexora']);
function setup(){const dir=mkdtempSync(join(tmpdir(),'clinical-csv-')),file=join(dir,'clinical-templates.csv');return {dir,file,store:createClinicalTemplateStore(file),close:()=>rmSync(dir,{recursive:true,force:true})};}
test('CSV create round-trips commas quotes Unicode newlines and booleans; query and 360 read the saved record after restart',()=>{
 const x=setup();try{
 const request={action:'save',record:structuredClone(x.store.handle(user,'nexora',{action:'load',id:'PT-0001'},true).body as PatientRecord),expectedVersion:0,operationId:'csv-create'};
 request.record.id='new';request.record.version=0;request.record.values.firstName='CSV, "മലയാളം"\nहिन्दी';request.record.values.lastName='Created';request.record.collections.identifiers=[];
 const result=x.store.handle(user,'nexora',request,true);assert.equal(result.status,200);const saved=result.body as PatientRecord;
 const csv=readFileSync(x.file,'utf8');assert.ok(csv.startsWith('tenant,application,entity,owner,id'));assert.ok(csv.includes('value.firstName'));assert.ok(!existsSync(x.file.replace('.csv','.json')));
 const restarted=createClinicalTemplateStore(x.file);assert.deepEqual(restarted.handle(user,'nexora',request,true),result);
 const loaded=restarted.handle(user,'nexora',{action:'load',id:saved.id},true).body as PatientRecord;assert.equal(loaded.values.firstName,request.record.values.firstName);assert.equal(typeof loaded.values.deceased,'boolean');
 const overview=restarted.handle(user,'nexora',{action:'overview',id:saved.id},true).body as PatientOverview;assert.equal(overview.patient.id,saved.id);assert.deepEqual(overview.rows,[]);
 const search=restarted.handle(user,'nexora',{action:'search',filters:{firstName:'CSV'}},true).body as PatientSearchResult;assert.ok(search.rows.some(row=>row.id===saved.id));
 }finally{x.close();}
});
test('CSV changes are read on the next API operation; legacy JSON migration preserves records and leaves source intact',()=>{
 const x=setup();try{
 x.store.handle(user,'nexora',{action:'search'},true);
 const data=readClinicalCsv(x.file);data[scope].records[0].values.firstName='Edited in CSV';writeClinicalCsv(x.file,data);
 assert.equal((x.store.handle(user,'nexora',{action:'load',id:data[scope].records[0].id},true).body as PatientRecord).values.firstName,'Edited in CSV');
 const legacy=join(x.dir,'legacy.json');writeFileSync(legacy,JSON.stringify(data));const migrated=createClinicalTemplateStore(legacy);
 assert.ok(existsSync(join(x.dir,'legacy.csv')));assert.equal(readFileSync(legacy,'utf8'),JSON.stringify(data));
 assert.equal((migrated.handle(user,'nexora',{action:'load',id:data[scope].records[0].id},true).body as PatientRecord).values.firstName,'Edited in CSV');
 assert.deepEqual(readClinicalCsv(join(x.dir,'legacy.csv'))[scope].care,data[scope].care);
 }finally{x.close();}
});
test('corrupt CSV fails closed instead of replacing saved records with seed data',()=>{
 const x=setup();try{writeFileSync(x.file,'tenant,application,entity,owner,id\n"unterminated');assert.throws(()=>createClinicalTemplateStore(x.file),/Unterminated/);assert.throws(()=>x.store.handle(user,'nexora',{action:'search'},true),/Unterminated/);assert.ok(readFileSync(x.file,'utf8').includes('unterminated'));}finally{x.close();}
});
test('CSV parser enforces quoting, row width and duplicate entity identities',()=>{
 assert.deepEqual(parseCsv('a,b\r\n"a,b","say ""hello""\nnext"\r\n'),[['a','b'],['a,b','say "hello"\nnext']]);
 assert.throws(()=>parseCsv('"closed"x'),/Invalid/);
 assert.throws(()=>decodeClinicalCsv('tenant,application,entity,owner,id\nt,a,scope\n'),/width/);
 assert.throws(()=>decodeClinicalCsv('tenant,application,entity,owner,id\nt,a,scope,,\nt,a,scope,,\n'),/Duplicate/);
});
test('new related entries and their retry receipts survive restart and appear in 360 from CSV',()=>{
 const x=setup();try{
 const input={action:'schedule',patientId:'PT-0001',kind:'encounter',date:'2027-01-02',time:'14:30',provider:'provider-1',notes:'CSV related encounter',operationId:'csv-encounter'};
 const first=x.store.handle(user,'nexora',input,true);assert.equal(first.status,200);
 const restarted=createClinicalTemplateStore(x.file);assert.deepEqual(restarted.handle(user,'nexora',input,true),first);
 const overview=restarted.handle(user,'nexora',{action:'overview',id:'PT-0001'},true).body as PatientOverview;
 assert.equal(overview.rows.filter(row=>row.detail==='CSV related encounter').length,1);
 assert.equal(readClinicalCsv(x.file)[scope].care['PT-0001'].filter(row=>row.detail==='CSV related encounter').length,1);
 }finally{x.close();}
});
test('a booking without notes keeps detail as an empty string after the CSV round trip',()=>{
 const x=setup();try{
 const metadata=x.store.handle(user,'nexora',{action:'metadata'},true).body as {providers:{value:string}[]};
 const booked=x.store.handle(user,'nexora',{action:'schedule',operationId:'csv-book-no-notes',patientId:'PT-0001',kind:'appointment',date:'2027-03-20',time:'14:30',provider:metadata.providers[0].value},true);
 assert.equal(booked.status,200);
 const restarted=createClinicalTemplateStore(x.file);
 const row=(restarted.handle(user,'nexora',{action:'overview',id:'PT-0001'},true).body as PatientOverview).rows.find(r=>r.kind==='appointment'&&r.date==='2027-03-20T14:30:00.000Z');
 assert.ok(row);assert.equal(row.detail,'');assert.equal(row.title,'template.clinical.followUp');
 }finally{x.close();}
});
