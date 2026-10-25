import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createImportStore} from './import-store.mjs';
import {getImportDefinition} from '../desktop-clients/packages/erp-config/src/imports.ts';
const user={id:'one',tenantId:'tenant',role:'finance-manager'};
const good=code=>({customerCode:code,legalName:'Company',customerType:'Corporate',contactName:'Person',email:'person@example.test',address1:'Street',city:'Dubai'});
function setup(t){
 const directory=mkdtempSync(join(tmpdir(),'import-test-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));const file=join(directory,'jobs.json');const saved=new Map();let failCode=null;
 const options={definition:()=>getImportDefinition('customer'),existing:()=>['EXISTING',...saved.values()].map(value=>typeof value==='string'?value:value.customerCode),alreadySaved:(_u,_j,id)=>saved.has(id),save:(_u,_j,id,values)=>{if(values.customerCode===failCode)throw new Error('Unavailable');saved.set(id,values);}};
 const store=createImportStore(file,options);const preview=rows=>store.handle(user,{action:'preview',id:randomUUID(),productId:'product',pageId:'customer-master',rows});
 return {store,preview,saved,file,options,fail:code=>{failCode=code;}};
}
test('preview never writes, marks all CSV duplicates and detects existing records and invalid formats',t=>{
 const s=setup(t);const result=s.preview([good('DUP'),good('dup'),good('existing'),{...good('BAD'),email:'bad'},good('VALID')]);
 assert.equal(result.status,200);assert.deepEqual(result.body.job.rows.map(row=>row.status),['invalid','invalid','invalid','invalid','pending']);assert.equal(s.saved.size,0);
 const run=s.store.handle(user,{action:'run',id:result.body.job.id});assert.equal(s.saved.size,1);assert.equal(run.body.job.rows[4].status,'success');
});
test('partial failures retry only failed rows and survive lost job receipts',t=>{
 const s=setup(t);s.fail('B');const job=s.preview([good('A'),good('B')]).body.job;const before=readFileSync(s.file);
 let result=s.store.handle(user,{action:'run',id:job.id});assert.deepEqual(result.body.job.rows.map(row=>row.status),['success','failed']);assert.equal(s.saved.size,1);
 s.fail(null);result=s.store.handle(user,{action:'run',id:job.id,retry:true});assert.equal(s.saved.size,2);assert.ok(result.body.job.rows.every(row=>row.status==='success'));
 // Simulate process failure after records were saved but before the job receipt persisted.
 writeFileSync(s.file,before);const reopened=createImportStore(s.file,s.options);result=reopened.handle(user,{action:'run',id:job.id});assert.equal(s.saved.size,2);assert.ok(result.body.job.rows.every(row=>row.status==='success'));
});
test('batch progress, race duplicates, role checks and user isolation',t=>{
 const s=setup(t);const job=s.preview(Array.from({length:12},(_,i)=>good('NEW-'+i))).body.job;
 let result=s.store.handle(user,{action:'run',id:job.id});assert.equal(result.body.job.rows.filter(row=>row.status==='success').length,10);
 assert.equal(s.store.handle({...user,id:'other'},{action:'run',id:job.id}).status,404);
 assert.equal(s.store.handle({...user,role:'viewer'},{action:'run',id:job.id}).status,403);
 s.saved.set('outside',good('NEW-10'));result=s.store.handle(user,{action:'run',id:job.id});assert.equal(result.body.job.rows[10].status,'failed');assert.equal(result.body.job.rows[10].retryable,false);assert.equal(result.body.job.rows[11].status,'success');
 assert.equal(s.store.handle({...user,tenantId:'other'},{action:'latest',productId:'product',pageId:'customer-master'}).body.job,null);
});
