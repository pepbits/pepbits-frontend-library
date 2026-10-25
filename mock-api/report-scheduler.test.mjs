import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createReportScheduler,nextOccurrence} from './report-scheduler.mjs';
test('calendar month recurrence preserves the anchor day across February',()=>{
 const anchor='2026-01-31T07:30:00Z';const feb=nextOccurrence(anchor,'monthly',Date.parse(anchor));
 assert.equal(new Date(feb).toISOString(),'2026-02-28T07:30:00.000Z');
 assert.equal(new Date(nextOccurrence(anchor,'monthly',feb)).toISOString(),'2026-03-31T07:30:00.000Z');
});
test('schedules persist, retry failed work, isolate owners and do not duplicate a due delivery',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexora-reports-'));let now=Date.parse('2026-10-01T00:00:00Z');let fails=true;let rendered=0;
 const user={tenantId:'t',id:'u'};const events=[];const options={now:()=>now,audit:(...args)=>events.push(args),render:async()=>{rendered++;if(fails)throw new Error('private diagnostics');return 'column\r\n1';}};
 let store=createReportScheduler(join(dir,'reports.sqlite'),options);
 try {
  const id=store.create(user,{name:'Report',productId:'nexora',pageId:'r',language:'ar',frequency:'daily',startAt:new Date(now).toISOString()});
  await store.tick();let job=store.list(user,'nexora','r').deliveries[0];assert.equal(job.state,'failed');assert.equal(job.error.includes('private'),false);
  assert.equal(store.list({...user,id:'other'},'nexora','r').deliveries.length,0);assert.equal(store.retry({...user,id:'other'},job.id),false);
  store.close();store=createReportScheduler(join(dir,'reports.sqlite'),options);fails=false;
  assert.equal(store.retry(user,job.id),true);await store.tick();await store.tick();
  assert.equal(store.list(user,'nexora','r').deliveries.length,1);assert.equal(rendered,2);assert.equal(store.download(user,job.id).content,'column\r\n1');
  assert.equal(store.download({...user,tenantId:'other'},job.id),undefined);
  store.enabled(user,id,false);now+=86400000;await store.tick();assert.equal(store.list(user,'nexora','r').deliveries.length,1);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
