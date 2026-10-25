import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
export async function smokeApi(directory, verify=async()=>{}){
 const probe=createServer();await new Promise((res,rej)=>{probe.once('error',rej);probe.listen(0,'127.0.0.1',res);});const port=probe.address().port;await new Promise(r=>probe.close(r));
 const data=await mkdtemp(join(tmpdir(),'pepbits-packaged-api-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:directory,detached:true,env:{...process.env,NODE_PATH:'',NODE_OPTIONS:'',HOST:'127.0.0.1',PORT:String(port),NEXORA_DATA_DIR:data,RECORD_DATA_DIR:data,NEXORA_KEY_FILE:join(data,'test.key')},stdio:['ignore','ignore','pipe']});
 child.stderr.resume();
 const kill=signal=>{try{process.kill(-child.pid,signal);}catch{}};
 const closed=new Promise(res=>{child.once('error',res);child.once('exit',res);});
 try{for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error('Packaged API exited before readiness (inspect its dependency/build contract)');
  let ready=false;
  try{const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)});ready=r.ok&&(await r.json()).ok;}catch{}
  if(ready){console.log('  packaged API: isolated health passed without workspace dependency resolution');await verify(`http://127.0.0.1:${port}`);return;}
  await delay(250);
 }throw Error('Packaged API readiness timeout');
 }finally{kill('SIGTERM');const timer=setTimeout(()=>kill('SIGKILL'),3000);await closed;clearTimeout(timer);kill('SIGKILL');await rm(data,{recursive:true,force:true});}
}
