import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAuditStore} from './audit-store.mjs';
import {providerAllowed,credentialExpired,createUserLimiter,redactProviderContext} from './ai-security.mjs';
test('audit survives restart, isolates tenants, strips data and expires by retention', () => {
 const dir=mkdtempSync(join(tmpdir(),'nexora-audit-'));const file=join(dir,'audit.sqlite'); let now=100000000;
 try {
  let store=createAuditStore(file,{now:()=>now,retentionDays:1});
  store.append({tenantId:'a',id:'u'},'exports',202,{columns:['status'],value:'SECRET-PATIENT',secret:'SECRET-KEY',rows:2});
  store.close(); store=createAuditStore(file,{now:()=>now,retentionDays:1});
  assert.equal(store.list('b').length,0);assert.equal(store.list('a').length,1);
  assert.deepEqual(store.list('a')[0].metadata,{columns:['status'],rows:2});
  now+=86400001;assert.equal(store.prune(),1);store.close();
  assert.equal(readFileSync(file).includes('SECRET-PATIENT'),false);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('providers must match exact HTTPS bases; expired credentials fail closed',()=>{
 assert.equal(providerAllowed('https://api.openai.com/v1'),true);
 for(const value of ['http://127.0.0.1','https://api.openai.com.evil/v1','https://api.openai.com/v1?x=1'])assert.equal(providerAllowed(value),false);
 assert.equal(credentialExpired({}),true);assert.equal(credentialExpired({setAt:new Date().toISOString()}),false);
 assert.equal(credentialExpired({setAt:'2020-01-01'}),true);
});
test('one user cannot exhaust another user allowance; tenant remains part of the key',()=>{
 const limiter=createUserLimiter({requestsPerMinute:1});const user={tenantId:'a',id:'1'};
 assert.equal(limiter.admit(user),true);assert.equal(limiter.admit(user),false);
 assert.equal(limiter.admit({...user,id:'2'}),true);assert.equal(limiter.admit({...user,tenantId:'b'}),true);
});
test('modified AI clients cannot send free text, clinical data, labels or undeclared keys',()=>{
 const body={useCaseId:'report.summarise',promptId:'report.summarise.v1',fields:[{key:'current',label:'Patient: Alice',value:'100'}]};
 assert.deepEqual(redactProviderContext(body),[{key:'current',label:'current',value:'100'}]);
 assert.equal(redactProviderContext({...body,fields:[{key:'dimension',value:'Abu Dhabi HQ'}]})[0].value,'Abu Dhabi HQ');
 assert.throws(()=>redactProviderContext({...body,fields:[{key:'dimension',value:'Patient Alice'}]}));
 for(const changed of [{...body,userInput:'Alice'}, {...body,fields:[{key:'current',value:'Alice'}]}, {...body,fields:[{key:'patientName',value:'Alice'}]}])assert.throws(()=>redactProviderContext(changed));
});

test('encrypted credentials migrate, survive restart and reject the wrong master key',async()=>{
 const {createCredentialStore}=await import('./credential-store.mjs');const {writeFileSync}=await import('node:fs');const {randomBytes}=await import('node:crypto');
 const dir=mkdtempSync(join(tmpdir(),'nexora-keys-'));const key=join(dir,'key');const file=join(dir,'credentials');
 try {
  writeFileSync(key,randomBytes(32));writeFileSync(file,JSON.stringify({a:{secret:'sensitive-canary'}}));
  const store=createCredentialStore(file,key);assert.equal(store.load().a.secret,'sensitive-canary');
  assert.equal(readFileSync(file,'utf8').includes('sensitive-canary'),false);
  assert.equal(createCredentialStore(file,key).load().a.secret,'sensitive-canary');
  writeFileSync(key,randomBytes(32));assert.throws(()=>createCredentialStore(file,key).load());
 }finally{rmSync(dir,{recursive:true,force:true});}
});
