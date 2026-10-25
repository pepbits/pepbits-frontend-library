import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplicationConfig,validateNavigation} from './application-config.mjs';
import {PAGE_REGISTRY} from '../desktop-clients/packages/erp-config/src/navigation.ts';
const root=new URL('./config/',import.meta.url).pathname,known=new Set(Object.keys(PAGE_REGISTRY));
const admin={role:'enterprise-admin'},user={role:'operations-analyst'};
test('navigation filters restricted pages, returns stable identity and handles authorization',()=>{
 const store=createApplicationConfig(root,known),nav=store.navigation(user,'nexora');
 assert.equal(nav.status,200);assert.ok(nav.body.nodes.some(n=>n.pageId==='customer-master'));
 assert.ok(!nav.body.pages.some(p=>p.id==='ai-administration'));assert.ok(store.navigation(admin,'nexora').body.pages.some(p=>p.id==='ai-administration'));
 assert.equal(store.navigation(null,'nexora').status,401);assert.equal(store.navigation(user,'../private').status,400);assert.equal(store.navigation(user,'missing').status,403);
 assert.equal(store.navigation(user,'nexora').body.revision,nav.body.revision);
 assert.equal(store.localization(user,'nexora','xx').status,400);
});
test('backend file edits change menu ordering and page translations, and overrides are isolated',()=>{
 const dir=mkdtempSync(join(tmpdir(),'app-config-'));try{
 cpSync(root,dir,{recursive:true});
 const file=join(dir,'navigation','nexora.json'),nav=JSON.parse(readFileSync(file));
 nav.nodes.find(n=>n.pageId==='customer-master').order=987;
 writeFileSync(file,JSON.stringify(nav));
 const path=join(dir,'localization/products/nexora/ar.json');writeFileSync(path,JSON.stringify({schemaVersion:1,messages:{'page.customer-master.title':'عنوان من الخادم'}}));
 const store=createApplicationConfig(dir,known);
 assert.equal(store.navigation(admin,'nexora').body.nodes.find(n=>n.pageId==='customer-master').order,987);
 assert.equal(store.localization(admin,'nexora','ar').body.messages['page.customer-master.title'],'عنوان من الخادم');
 assert.notEqual(store.localization(admin,'ledger','ar').body.messages['page.customer-master.title'],'عنوان من الخادم');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('rejects duplicates, invalid parents, cycles, unknown pages and malformed catalogs',()=>{
 const fixture=JSON.parse(readFileSync(join(root,'navigation/nexora.json')));
 for(const mutate of [n=>n.nodes.push(n.nodes[0]),n=>n.nodes.find(n=>n.kind==='page').parentId='missing',n=>n.pages[0].id='missing',n=>{const group=n.nodes.find(n=>n.kind==='group');group.parentId=group.id;}]){
  const nav=structuredClone(fixture);mutate(nav);assert.throws(()=>validateNavigation(nav,known));
 }
 const dir=mkdtempSync(join(tmpdir(),'app-invalid-'));try{cpSync(root,dir,{recursive:true});writeFileSync(join(dir,'localization/products/nexora/ar.json'),JSON.stringify({schemaVersion:1,messages:{'Import {page}':'{wrong}'}}));assert.throws(()=>createApplicationConfig(dir,known),/placeholder/);}finally{rmSync(dir,{recursive:true,force:true});}
});
