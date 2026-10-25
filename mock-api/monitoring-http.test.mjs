import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:net';import {once} from 'node:events';import {randomUUID} from 'node:crypto';import {startApi} from '../desktop-clients/e2e/managed-api.mjs';
test('monitoring HTTP permits collection but restricts management and rejects tenant spoofing',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const api=`http://127.0.0.1:${probe.address().port}`;await new Promise(resolve=>probe.close(resolve));const stop=await startApi(api,'monitoring-http');
 try{const login=async username=>(await(await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})})).json()).token;
 const user=await login('user1'),admin=await login('admin');const call=(path,token,method='GET',body,product='nexora')=>fetch(api+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Product-Id':product},...(body?{body:JSON.stringify(body)}:{})});
 const e={id:randomUUID(),kind:'runtime',code:'runtime-error',pageId:'preferences',release:'2026-09-08-documentation',breadcrumbs:[],tenantId:'forged',message:'SECRET'};
 assert.equal((await fetch(api+'/monitoring/events',{method:'POST'})).status,401);
 const result=await call('/monitoring/events',user,'POST',{events:[e]});assert.equal(result.status,202);const id=(await result.json()).accepted[0].incidentId;
 assert.equal((await call('/monitoring/incidents',user)).status,403);assert.equal((await call('/monitoring/incidents/'+id,user,'PATCH',{status:'resolved',revision:1})).status,403);
 const detail=await(await call('/monitoring/incidents/'+id,admin)).json();assert.ok(!JSON.stringify(detail).includes('SECRET'));assert.equal(detail.incident.occurrences,1);
 assert.equal((await call('/monitoring/incidents/'+id,admin,'GET',undefined,'ledger')).status,404);
 assert.equal((await call('/monitoring/incidents/'+id,admin,'PATCH',{status:'investigating',revision:1})).status,200);
 assert.equal((await call('/monitoring/incidents/'+id,admin,'PATCH',{status:'resolved',revision:1})).status,409);
 }finally{await stop();}
});
