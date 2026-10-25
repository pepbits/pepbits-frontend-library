import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('authenticated configuration HTTP contract and conditional requests',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const directory=mkdtempSync(join(tmpdir(),'config-http-'));
 const child=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{env:{...process.env,PORT:String(port),NEXORA_DATA_DIR:directory,RECORD_DATA_DIR:directory},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;
 try{
  let ready=false;for(let n=0;n<80;n++){try{await fetch(base+'/health');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
  assert.ok(ready,'test API started');
  assert.equal((await fetch(base+'/navigation?productId=nexora')).status,401);
  for (const path of ['/records','/imports','/approvals','/personal-views','/record-panels','/worklists/archive','/navigation','/localization']) {
    const method = await fetch(base+path,{method:'DELETE'});
    assert.equal(method.status,405,path);
    assert.ok(method.headers.get('allow').includes('OPTIONS'));
    assert.ok((await method.json()).errorMessage.messageKey);
  }
  assert.equal((await fetch(base+'/application-config',{method:'DELETE'})).status,404,'unregistered endpoint remains unknown');

  const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'user2',password:'user2'})});const {token}=await login.json();const headers={Authorization:`Bearer ${token}`};
  const response=await fetch(base+'/navigation?productId=nexora',{headers});assert.equal(response.status,200);const nav=await response.json();assert.ok(nav.nodes.length>0);assert.ok(!nav.pages.some(p=>p.id==='ai-administration'));
  assert.equal((await fetch(base+'/navigation?productId=nexora',{headers:{...headers,'If-None-Match':response.headers.get('etag')}})).status,304);
  const ar=await fetch(base+'/localization?productId=nexora&language=ar',{headers});assert.equal(ar.status,200);assert.equal((await ar.json()).direction,'rtl');assert.equal(ar.headers.get('cache-control'),'private, no-cache');
  assert.equal((await fetch(base+'/localization?productId=nexora&language=unknown',{headers})).status,400);
  assert.equal((await fetch(base+'/navigation?productId=unknown',{headers})).status,403);
  assert.equal((await fetch(base+'/navigation?productId=nexora',{method:'POST',headers})).status,405);
 }finally{child.kill();await once(child,'exit');rmSync(directory,{recursive:true,force:true});}
});
