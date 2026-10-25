import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecordStore} from './record-store.mjs';
import {createDraftPolicyStore} from './draft-policy-store.mjs';
const admin={tenantId:'t1',id:'u1',permissions:['preferences:manage']};
const key=JSON.stringify(['app','form:customer-master:one']);
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'draft-policy-'));let time=Date.now();let store;
 const policy=createDraftPolicyStore(join(dir,'policy.sqlite'),{scrub:(...args)=>store.scrub(...args)});
 const file=join(dir,'records.json');store=createRecordStore(file,{draftPolicy:(...a)=>policy.read(...a),now:()=>time});
 t.after(()=>{policy.close();rmSync(dir,{recursive:true,force:true});});
 return {store,policy,file,advance:days=>time+=days*86400000,call:(action,body,user=admin,k=key)=>store.handle(user,k,action,body)};
}
test('mandatory exclusions are recursive and replay responses contain no secrets',t=>{
 const {call,file}=fixture(t);const body={version:0,baseVersion:0,operationId:'one',values:{name:'public',password:'SECRET-1',lines:[{token:'SECRET-2',name:'line'}]}};
 const result=call('draft',body);assert.equal(result.status,200);assert.deepEqual(result.body.values,{name:'public',lines:[{name:'line'}]});assert.deepEqual(call('draft',body),result);assert.ok(!readFileSync(file,'utf8').includes('SECRET'));
});
test('policy is tenant/application scoped and ordinary users cannot override it',t=>{
 const {policy}=fixture(t),base=policy.read(admin,'app');assert.equal(policy.write({...admin,permissions:[]},'app',{...base,enabled:false}).status,403);
 assert.equal(policy.write(admin,'app',{...base,enabled:false}).status,200);assert.equal(policy.read(admin,'app').enabled,false);assert.equal(policy.read(admin,'another').enabled,true);assert.equal(policy.read({...admin,tenantId:'other'},'app').enabled,true);assert.equal(policy.write(admin,'app',base).status,409);
});
test('tightened exclusions erase existing drafts and replay copies; old windows cannot resurrect them',t=>{
 const {policy,call,file}=fixture(t);const values={name:'public',email:'PRIVATE-EMAIL'};call('draft',{version:0,baseVersion:0,operationId:'one',values});
 policy.write(admin,'app',{...policy.read(admin,'app'),excludedFields:['email']});assert.ok(!readFileSync(file,'utf8').includes('PRIVATE-EMAIL'));
 const current=call('load').body;assert.equal(current.draftVersion,2);assert.deepEqual(current.draft.values,{name:'public'});
 assert.equal(call('draft',{version:1,baseVersion:0,operationId:'two',values}).status,409);
});
test('retention purges on read and keeps tombstones; acknowledged business records survive',t=>{
 const {call,advance,file}=fixture(t);call('save',{version:0,draftVersion:0,operationId:'save',values:{name:'saved'}});call('draft',{version:1,baseVersion:1,operationId:'draft',values:{name:'EXPIRED-DRAFT'}});advance(8);
 const loaded=call('load').body;assert.equal(loaded.draft,null);assert.equal(loaded.record.values.name,'saved');assert.equal(loaded.draftVersion,3);assert.ok(!readFileSync(file,'utf8').includes('EXPIRED-DRAFT'));
 assert.equal(call('draft',{version:2,baseVersion:1,operationId:'late',values:{name:'late'}}).status,409);
});
test('disabled storage deletes all users drafts and never blocks ordinary record saves',t=>{
 const {policy,call}=fixture(t);call('draft',{version:0,baseVersion:0,operationId:'one',values:{name:'one'}});const other={...admin,id:'u2'};call('draft',{version:0,baseVersion:0,operationId:'two',values:{name:'two'}},other);
 policy.write(admin,'app',{...policy.read(admin,'app'),enabled:false});assert.equal(call('load').body.draft,null);assert.equal(call('load',undefined,other).body.draft,null);
 const result=call('draft',{version:2,baseVersion:0,operationId:'blocked',values:{name:'not persisted'}});assert.equal(result.body.disabled,true);assert.equal(call('load').body.draft,null);
 assert.equal(call('save',{version:0,draftVersion:2,operationId:'saved',values:{name:'business'}}).status,200);
});
test('shared import and approval drafts survive restart and isolate owner, tenant, product and record',t=>{
 const {call,file,policy}=fixture(t),scope=JSON.stringify(['app','$draft:approval:["customer-master","one"]']);
 call('draft',{version:0,baseVersion:0,operationId:'draft',values:{schemaVersion:1,context:'a'.repeat(64),data:{comment:'private'}}},admin,scope);
 assert.equal(createRecordStore(file,{draftPolicy:(...a)=>policy.read(...a)}).handle(admin,scope,'load').body.draft.values.data.comment,'private');
 for(const [user,k] of [[{...admin,id:'another'},scope],[{...admin,tenantId:'another'},scope],[admin,scope.replace('app','other')],[admin,scope.replace('one','two')]])assert.equal(call('load',undefined,user,k).body.draft,null);
 policy.write(admin,'app',{...policy.read(admin,'app'),excludedFields:['comment']});assert.deepEqual(call('load',undefined,admin,scope).body.draft.values.data,{});
});
