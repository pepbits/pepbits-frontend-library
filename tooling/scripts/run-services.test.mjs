import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
const root=fileURLToPath(new URL('../../',import.meta.url));
async function cli(state,args,env={}){
 const p=spawn(process.execPath,[join(root,'tooling/scripts/run-services.mjs'),...args],{cwd:root,env:{...process.env,NEXORA_RUN_DIR:state,...env},stdio:['ignore','pipe','pipe']});
 let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);
 const [code]=await once(p,'exit');return {code,output};
}
test('controller refuses busy ports and never stops an unowned or stale process', {skip:process.platform!=='linux'}, async(t)=>{
 const state=mkdtempSync(join(tmpdir(),'pepbits-controller-'));
 const server=spawn(process.execPath,['--input-type=module','-e',"import {createServer} from 'node:http';const s=createServer((q,r)=>r.end('fixture'));s.listen(0,'127.0.0.1',()=>console.log(s.address().port));"],{detached:true,stdio:['ignore','pipe','ignore']});
 t.after(()=>{try{process.kill(-server.pid,'SIGKILL');}catch{}rmSync(state,{recursive:true,force:true});});
 const port=Number(String((await once(server.stdout,'data'))[0]).trim());
 assert.equal((await cli(state,['stop','api'])).code,0);
 assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(),'fixture');
 writeFileSync(join(state,'api.json'),JSON.stringify({root,pid:server.pid,birth:'stale'}));
 assert.equal((await cli(state,['stop','api'])).code,0);
 assert.equal((await fetch(`http://127.0.0.1:${port}`)).status,200);
 assert.notEqual((await cli(state,['start','api'],{API_PORT:String(port)})).code,0);
 assert.equal((await fetch(`http://127.0.0.1:${port}`)).status,200);
 const birth=readFileSync(`/proc/${server.pid}/stat`,'utf8').split(') ').at(-1).split(' ')[19];
 writeFileSync(join(state,'api.json'),JSON.stringify({root,pid:server.pid,birth}));
 const exited=once(server,'exit');assert.equal((await cli(state,['stop','api'])).code,0);await exited;
 await assert.rejects(fetch(`http://127.0.0.1:${port}`));
});
test('unknown service validation happens before any start', async()=>{
 const state=mkdtempSync(join(tmpdir(),'pepbits-controller-'));
 try{const result=await cli(state,['start','api','not-a-demo']);assert.notEqual(result.code,0);assert.match(result.output,/Unknown service/);}finally{rmSync(state,{recursive:true,force:true});}
});
