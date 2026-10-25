import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:net';import {once} from 'node:events';
import {startApi} from '../desktop-clients/e2e/managed-api.mjs';
test('documentation HTTP authorizes every view and persists scoped read state',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const api=`http://127.0.0.1:${probe.address().port}`;await new Promise(resolve=>probe.close(resolve));const stop=await startApi(api,'documentation-http');
 try{
 const login=async username=>(await(await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})})).json()).token;
 const token=await login('user1');const release='2026-09-08-documentation';const path=`/documentation?releaseId=${release}`;
 const call=(suffix,product='nexora',body)=>fetch(api+suffix,{method:body?'PUT':'GET',headers:{Authorization:`Bearer ${token}`,'X-Product-Id':product,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await fetch(api+path)).status,401);
 assert.equal((await call(path+'&pageId=patient-master','ledger')).status,403);
 assert.equal((await call(path+'&language=xx')).status,400);
 const guide=await(await call(path+'&pageId=patient-master&language=ar')).json();assert.match(guide.guide.sections[0].paragraphs[0],/[\u0600-\u06ff]/);
 const body={releaseId:release,changeId:'preference-policy-controls',revision:1,action:'read',tenantId:'forged'};
 assert.equal((await call('/documentation/state','nexora',body)).status,200);
 const index=await(await call(path)).json();assert.ok(index.changes.find(c=>c.id===body.changeId).readAt);
 assert.equal((await(await call(path,'ledger')).json()).changes.find(c=>c.id===body.changeId).readAt,null);
 assert.equal((await call('/documentation/state','nexora',{...body,revision:0})).status,409);
 assert.equal((await call('/documentation/state','nexora',{...body,action:'acknowledge'})).status,400);
 assert.equal((await fetch(api+'/documentation',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})).status,405);
 }finally{await stop();}
});
