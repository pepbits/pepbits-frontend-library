import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {createMonitoringStore} from './monitoring-store.mjs';
const user={id:'user',tenantId:'tenant',permissions:[]},admin={...user,id:'admin',permissions:['monitoring:manage']};const pages=new Set(['preferences']);
const event=()=>({id:randomUUID(),kind:'runtime',code:'runtime-error',pageId:'preferences',release:'2026-09-08-documentation',platform:'web',line:14,column:3,breadcrumbs:['preferences'],message:'PATIENT SECRET',stack:'TOKEN SECRET',body:{password:'secret'}});
test('monitoring strips sensitive payloads, deduplicates deliveries, reopens incidents and isolates tenants/products',()=>{
 const root=mkdtempSync(join(tmpdir(),'monitoring-'));let store=createMonitoringStore(join(root,'state.sqlite'));try{
 const e=event();const first=store.ingest(user,'nexora',{events:[e]},pages);assert.equal(first.status,202);const id=first.body.accepted[0].incidentId;
 store.ingest(user,'nexora',{events:[e]},pages);let detail=store.detail(admin,'nexora',id).body;assert.equal(detail.incident.occurrences,1);assert.ok(!JSON.stringify(detail).includes('SECRET'));assert.deepEqual(detail.references,[e.id]);
 assert.equal(store.list(user,'nexora',new URLSearchParams()).status,403);assert.equal(store.detail({...admin,tenantId:'other'},'nexora',id).status,404);assert.equal(store.detail(admin,'ledger',id).status,404);
 assert.equal(store.update(admin,'nexora',id,{revision:0,status:'resolved'}).status,409);assert.equal(store.update(admin,'nexora',id,{revision:1,status:'resolved'}).status,200);
 store.ingest(user,'nexora',{events:[event()]},pages);detail=store.detail(admin,'nexora',id).body;assert.equal(detail.incident.status,'new');assert.equal(detail.incident.occurrences,2);assert.equal(detail.history.length,1);
 assert.equal(store.list(admin,'nexora',new URLSearchParams({reference:e.id})).body.total,1);
 store.close();store=createMonitoringStore(join(root,'state.sqlite'));assert.equal(store.detail(admin,'nexora',id).body.incident.occurrences,2);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
test('monitoring validates page references and rate limits each authenticated user',()=>{
 const root=mkdtempSync(join(tmpdir(),'monitoring-'));const store=createMonitoringStore(join(root,'state.sqlite'));try{
 assert.equal(store.ingest(user,'nexora',{events:[{...event(),pageId:'patient-john'}]},pages).status,400);
 assert.equal(store.ingest(user,'nexora',{events:[{...event(),breadcrumbs:['patient-john']}]},pages).status,400);
 for(let i=0;i<6;i++)assert.equal(store.ingest(user,'nexora',{events:Array.from({length:10},event)},pages).status,202);
 assert.equal(store.ingest(user,'nexora',{events:[event()]},pages).status,429);
 assert.equal(store.ingest({...user,id:'other'},'nexora',{events:[event()]},pages).status,202);
 assert.equal(store.list(admin,'nexora',new URLSearchParams('offset=-1')).status,400);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
