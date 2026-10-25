import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';

test('four reference module HTTP boundaries preserve authentication, role and branch scope', async t => {
  const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const dir=mkdtempSync(join(tmpdir(),'reference-http-'));
  const child=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{env:{...process.env,PORT:String(port),RECORD_DATA_DIR:dir,NEXORA_DATA_DIR:dir,REFERENCE_REPORTS_INBOUND_SECRET:'reference-http-test-secret'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}rmSync(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<100;i++){try{await fetch(base);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(ready,output);
  const login=async username=>{const response=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})});assert.equal(response.status,200);return(await response.json()).token;};
  const admin=await login('admin'),finance=await login('user1'),teacher=await login('school-teacher');
  const call=(variant,path,token,options={})=>fetch(base+`/reference-modules/${variant}`+path,{method:options.method??'GET',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json',...options.headers},...(options.body?{body:JSON.stringify(options.body)}:{})});
  for(const variant of ['reports','erp1','erp2','school'])assert.equal((await call(variant,'/api/meta',null)).status,401);
  for(const variant of ['erp1','erp2']){
    const dashboard=await call(variant,'/api/dashboard',admin);assert.equal(dashboard.status,200,await dashboard.clone().text());
    assert.equal((await call(variant,'/api/dashboard',teacher)).status,403);
    assert.equal((await call(variant,'/api/dashboard',finance,{headers:{'X-Reference-Branch':'hq'}})).status,403);
    assert.equal((await call(variant,'/api/dashboard',admin,{headers:{'X-Reference-Branch':'not-a-branch'}})).status,403);
  }
  assert.equal((await call('school','/api/meta',teacher)).status,200);
  assert.equal((await call('school','/api/session?role=admin',teacher)).status,403);
  const sessionResponse=await call('school','/api/session',teacher);assert.equal(sessionResponse.status,200,await sessionResponse.clone().text());const session=await sessionResponse.json();assert.equal(session.data.role,'teacher');
  assert.equal((await call('reports','/api/page/reports',admin)).status,200);
  assert.equal((await call('reports','/api/page/reports',teacher)).status,403);
  assert.equal((await call('reports','/api/page/reports',admin,{headers:{'X-Product-Id':'ledger'}})).status,403);
  const created=await call('reports','/api/account/keys',admin,{method:'POST',body:{name:'HTTP BI test'}});assert.equal(created.status,201,await created.clone().text());const key=await created.json();
  const keys=await(await call('reports','/api/account/keys',admin)).json();assert.ok(!JSON.stringify(keys).includes(key.secret));
  const pull=await call('reports','/api/v1/reports',key.secret,{headers:{'X-Product-Id':'ledger','X-Reference-Branch':'not-a-branch'}});assert.equal(pull.status,200,await pull.clone().text());assert.ok(Array.isArray(await pull.json()));
  assert.equal((await call('reports','/api/page/reports',key.secret)).status,401);
  const csv=await call('reports','/api/v1/reports/trial-balance?format=csv&period=last_month',key.secret);assert.equal(csv.status,200,await csv.clone().text());assert.match(csv.headers.get('Content-Type'),/text\/csv/);assert.match(csv.headers.get('Content-Disposition'),/attachment/);assert.ok((await csv.text()).length>0);
  assert.equal((await call('reports',`/api/account/keys/${key.key.id}`,admin,{method:'DELETE'})).status,200);
  assert.equal((await call('reports','/api/v1/reports',key.secret)).status,401);
  assert.equal((await call('reports','/api/inbound-email',null,{method:'POST',headers:{'X-Inbound-Secret':'wrong'},body:{from:'unregistered@example.com',subject:'HELP'}})).status,401);
  const inbound=await call('reports','/api/inbound-email',null,{method:'POST',headers:{'X-Inbound-Secret':'reference-http-test-secret','X-Product-Id':'ledger','X-Reference-Branch':'not-a-branch'},body:{from:'unregistered@example.com',subject:'HELP'}});assert.equal(inbound.status,200,await inbound.clone().text());
  await fetch(base+'/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${admin}`}});
  assert.equal((await call('erp1','/api/dashboard',admin)).status,401);
});
