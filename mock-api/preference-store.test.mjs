import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createPreferenceStore} from './preference-store.mjs';
const admin={id:'admin',tenantId:'a',permissions:['preferences:manage']};const user={id:'user',tenantId:'a'};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'nexora-policy-'));const file=join(dir,'preferences.sqlite');let store=createPreferenceStore(file);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return {get store(){return store;},restart(){store.close();store=createPreferenceStore(file);}};}
test('locks persist, reject overrides, and unlocking restores personal choices',t=>{
 const f=fixture(t);assert.equal(f.store.write(user,'nexora',{preferences:{theme:'midnight'}}).status,200);
 assert.equal(f.store.writePolicy(admin,'nexora',{revision:0,rules:{theme:{value:'sand',locked:true}}}).status,200);
 f.restart();assert.equal(f.store.read(user,'nexora').preferences.theme,'sand');
 assert.equal(f.store.write(user,'nexora',{policyRevision:1,preferences:{theme:'nexora'}}).status,403);
 assert.equal(f.store.write(user,'nexora',{policyRevision:1,preferences:{pageSize:50}}).status,200);
 assert.equal(f.store.writePolicy(admin,'nexora',{revision:1,rules:{theme:{value:'sand',locked:false}}}).status,200);
 assert.equal(f.store.read(user,'nexora').preferences.theme,'midnight');
 assert.equal(f.store.policy(admin,'nexora').history.length,2);
});
test('policy and overrides isolate tenant, product and user; permission is explicit',t=>{
 const {store}=fixture(t);assert.equal(store.writePolicy({...admin,permissions:[]},'nexora',{revision:0,rules:{}}).status,403);
 store.writePolicy(admin,'nexora',{revision:0,rules:{pageSize:{value:100,locked:true}}});
 assert.equal(store.read(user,'nexora').preferences.pageSize,100);
 assert.equal(store.read({...user,tenantId:'b'},'nexora').preferences.pageSize,20);
 assert.equal(store.read(user,'ledger').preferences.pageSize,20);
 store.write(user,'ledger',{preferences:{theme:'midnight'}});
 assert.equal(store.read({...user,id:'another'},'ledger').preferences.theme,'nexora');
});
test('stale policies, concurrent saves and invalid fields cannot replace current state',t=>{
 const {store}=fixture(t);store.writePolicy(admin,'nexora',{revision:0,rules:{theme:{value:'sand',locked:false}}});
 assert.equal(store.writePolicy(admin,'nexora',{revision:0,rules:{}}).status,409);
 assert.equal(store.write(user,'nexora',{preferences:{theme:'midnight'}}).status,409);
 assert.equal(store.write(user,'nexora',{policyRevision:1,userRevision:0,preferences:{theme:'midnight'}}).status,200);
 assert.equal(store.write(user,'nexora',{policyRevision:1,userRevision:0,preferences:{}}).status,409);
 for(const preferences of [{madeUp:1},{pageSize:999},{fontSizeBase:99},JSON.parse('{"__proto__":{"theme":"sand"}}')])assert.equal(store.write(user,'nexora',{policyRevision:1,preferences}).status,400);
 assert.equal(store.read(user,'nexora').preferences.theme,'midnight');
});
test('admin defaults apply to new users; unlocked personal choices and reset take precedence',t=>{
 const {store}=fixture(t);store.writePolicy(admin,'nexora',{revision:0,rules:{theme:{value:'sand',locked:false}}});
 assert.equal(store.read(user,'nexora').preferences.theme,'sand');
 store.write(user,'nexora',{policyRevision:1,preferences:{theme:'midnight'}});assert.equal(store.read(user,'nexora').preferences.theme,'midnight');
 store.write(user,'nexora',{policyRevision:1,preferences:{}});assert.equal(store.read(user,'nexora').preferences.theme,'sand');
});
test('default module persists per account and respects access revocation and tenant locks',t=>{
 const dir=mkdtempSync(join(tmpdir(),'own-settings-')),file=join(dir,'prefs.sqlite');let allowed=['finance','sales'];let store=createPreferenceStore(file,{modules:()=>allowed});t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 assert.equal(store.write(user,'nexora',{preferences:{defaultModule:'sales'}}).status,200);
 store.close();store=createPreferenceStore(file,{modules:()=>allowed});assert.equal(store.read(user,'nexora').preferences.defaultModule,'sales');
 assert.equal(store.read({...user,id:'other'},'nexora').preferences.defaultModule,'');assert.equal(store.read(user,'other').preferences.defaultModule,'');
 assert.equal(store.write(user,'nexora',{preferences:{defaultModule:'library'}}).status,400);
 assert.equal(store.writePolicy(admin,'nexora',{revision:0,rules:{defaultModule:{value:'finance',locked:true}}}).status,200);
 assert.equal(store.read(user,'nexora').preferences.defaultModule,'finance');assert.equal(store.write(user,'nexora',{policyRevision:1,preferences:{defaultModule:'sales'}}).status,403);
 assert.equal(store.writePolicy(admin,'nexora',{revision:1,rules:{}}).status,200);assert.equal(store.read(user,'nexora').preferences.defaultModule,'sales');
 allowed=['finance'];assert.equal(store.read(user,'nexora').preferences.defaultModule,'');assert.equal(store.write(user,'nexora',{policyRevision:2,preferences:{theme:'sand'}}).status,200);
});
