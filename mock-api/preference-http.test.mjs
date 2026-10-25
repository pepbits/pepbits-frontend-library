import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:net';import {once} from 'node:events';
import {startApi} from '../desktop-clients/e2e/managed-api.mjs';
test('preference HTTP rejects non-admin policy writes, locked imports and stale clients',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const api=`http://127.0.0.1:${probe.address().port}`;await new Promise(resolve=>probe.close(resolve));const stop=await startApi(api,'preference-http');
 try {
  const login=async username=>(await (await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})})).json()).token;
  const admin=await login('admin'),user=await login('user1');
  const call=(path,token,body,product='nexora')=>fetch(api+path,{method:body===undefined?'GET':'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Product-Id':product},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await call('/preference-policy',user,{revision:0,rules:{}})).status,403);
  assert.equal((await call('/preference-policy',user)).status,403);
  const rules={language:{value:'ar',locked:true},confirmBulkActions:{value:true,locked:true}};
  assert.equal((await call('/preference-policy',admin,{revision:0,rules})).status,200);
  const state=await (await call('/preferences',user)).json();assert.equal(state.preferences.language,'ar');assert.equal(state.canManage,false);
  assert.equal((await call('/preferences',user,{policyRevision:1,preferences:{language:'en'}})).status,403);
  assert.equal((await call('/preferences',user,{preferences:{language:'en'}})).status,409);
  assert.equal((await call('/preferences',user,{policyRevision:1,preferences:{fontSizeBase:14}})).status,200);
  assert.equal((await (await call('/preferences',user,undefined,'ledger')).json()).policy.revision,0);
  assert.equal((await call('/preference-policy',admin,{revision:0,rules:{}})).status,409);
 }finally{await stop();}
});
test('API module preference changes startup navigation only for its account and application',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const api=`http://127.0.0.1:${probe.address().port}`;await new Promise(resolve=>probe.close(resolve));const stop=await startApi(api,'own-settings-http');
 try{
 const login=async username=>(await(await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})})).json()).token;
 const admin=await login('admin'),other=await login('user1');
 const get=async(path,token=admin)=>(await fetch(api+path,{headers:{Authorization:`Bearer ${token}`,'X-Product-Id':'nexora'}})).json();
 const before=await get('/navigation?productId=nexora');assert.ok(before.nodes.some(n=>n.moduleId==='library'));
 const write=preferences=>fetch(api+'/preferences',{method:'PUT',headers:{Authorization:`Bearer ${admin}`,'Content-Type':'application/json','X-Product-Id':'nexora'},body:JSON.stringify({policyRevision:0,preferences})});
 assert.equal((await write({defaultModule:'not-accessible'})).status,400);
 assert.equal((await write({defaultModule:'library'})).status,200);
 const nav=await get('/navigation?productId=nexora');assert.equal(nav.defaultModule,'library');assert.equal(nav.defaultPageId,'library-dashboard');assert.notEqual(nav.revision,before.revision);
 assert.equal((await get('/navigation?productId=nexora',other)).defaultModule,before.defaultModule);
 assert.equal((await get('/navigation?productId=ledger')).defaultModule,'finance');
 assert.equal((await write({})).status,200);assert.equal((await get('/navigation?productId=nexora')).defaultModule,before.defaultModule);
 }finally{await stop();}
});
