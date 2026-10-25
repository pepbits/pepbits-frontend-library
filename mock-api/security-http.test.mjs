import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';import {once} from 'node:events';
import {startApi} from '../desktop-clients/e2e/managed-api.mjs';

test('HTTP enforcement: origins, tenant audit authorization, schedules and AI refusals',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const api=`http://127.0.0.1:${probe.address().port}`;await new Promise(resolve=>probe.close(resolve));
 const stop=await startApi(api,'security-http');
 try {
  const request=async(path,body,token,headers={})=>fetch(api+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await request('/auth/login',{username:'admin',password:'admin'},null,{Origin:'https://untrusted.example'})).status,403);
  const admin=(await (await request('/auth/login',{username:'admin',password:'admin'})).json()).token;
  const user=(await (await request('/auth/login',{username:'user1',password:'user1'})).json()).token;
  assert.equal((await request('/audit',undefined,user)).status,403);
  assert.equal((await request('/exports',{pageId:'customer-master',columns:['status'],rows:1,value:'PRIVATE'},admin)).status,202);
  const audit=await (await request('/audit',undefined,admin)).json();assert.equal(audit.events.some(row=>row.action==='POST:/exports'),true);assert.equal(JSON.stringify(audit).includes('PRIVATE'),false);
  const spec={productId:'nexora',pageId:'profit-loss-report',language:'ar',frequency:'daily',startAt:new Date().toISOString(),name:'Test'};
  const created=await request('/report-schedules',{...spec,action:'create'},admin);assert.equal(created.status,201);
  let deliveries=[];
  for(let attempt=0;attempt<70;attempt++) {
   const result=await (await request('/report-schedules',{...spec,action:'list'},admin)).json();deliveries=result.deliveries;
   if(deliveries[0]?.state==='ready')break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(deliveries[0]?.state,'ready');
  const body=await (await request('/report-schedules',{...spec,action:'download',id:deliveries[0].id},admin)).json();assert.match(body.filename,/\.csv$/);assert.match(body.content,/[\u0600-\u06ff]/);
  assert.equal((await request('/report-schedules',{...spec,action:'download',id:deliveries[0].id},user)).status,400);
  await fetch(api+'/ai/config/credential',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${admin}`},body:JSON.stringify({secret:'isolated-security-test-key'})});
  const denied=await request('/ai/dispatch',{useCaseId:'report.summarise',promptId:'report.summarise.v1',pageId:'profit-loss-report',fields:[{key:'current',value:'Patient Alice'}]},admin);
  assert.equal(denied.status,403);
 }finally{await stop();}
});
