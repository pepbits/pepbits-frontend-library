import {spawn} from 'node:child_process';
import {mkdtempSync,openSync,closeSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
export async function startApi(api,suite){
 const url=new URL(api);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/')throw new Error('Managed API requires a local origin without a path');
 const port=Number(url.port);
 const probe=createServer();probe.listen(port,'127.0.0.1');await once(probe,'listening');await new Promise(resolve=>probe.close(resolve));
 const data=mkdtempSync(join(tmpdir(),'nexora-suite-'));
 const artifacts=process.env.E2E_ARTIFACTS??join(tmpdir(),'nexora-suite-artifacts');mkdirSync(artifacts,{recursive:true});
 const log=openSync(join(artifacts,`${suite}.api.log`),'w');
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,HOST:"127.0.0.1",PORT:String(port),NEXORA_DATA_DIR:data,RECORD_DATA_DIR:data,NEXORA_KEY_FILE:join(data,"test-master.key")},stdio:['ignore',log,log]});
 closeSync(log);
 const stop=async()=>{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}rmSync(data,{recursive:true,force:true});};
 try{for(let attempt=0;attempt<100;attempt++){
  if(child.exitCode!==null)throw new Error(`API exited before readiness: ${suite}`);
  try{const response=await fetch(api+'/health',{signal:AbortSignal.timeout(500)});if(response.ok)return stop;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }throw new Error(`API not ready: ${suite}`);}catch(error){await stop();throw error;}
}
