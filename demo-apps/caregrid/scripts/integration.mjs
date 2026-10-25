import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

/**
 * Real-HTTP check: starts the unchanged CareGrid scheduling API (its own Express + SQLite backend,
 * seeded into a temporary database), then the shared demo runner (demo host API, production Next
 * server and Chromium). Every process group it starts is stopped on success, failure or signal.
 */
const root=fileURLToPath(new URL('../../../',import.meta.url)),backend=join(root,'source/caregrid/backend');
const identityPath=process.env.CAREGRID_SCHEDULING_IDENTITY??'/tmp/caregrid-scheduling-identity.json';
const freePort=()=>new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const port=await freePort(),temp=mkdtempSync(join(tmpdir(),'caregrid-scheduling-'));
const identity={sourceBase:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceStatus:execFileSync('git',['status','--short','source/caregrid'],{cwd:root,encoding:'utf8'}).trim(),schedulingPort:port,schedulingNode:process.version,database:'temporary, seeded by the unchanged backend'};
const save=()=>writeFileSync(identityPath,JSON.stringify(identity,null,2)+'\n');
let api,runner,stopping;
async function stopApi(){return stopping??=(async()=>{
 if(!api)return;
 try{process.kill(-api.pid,'SIGTERM');}catch{}
 await Promise.race([new Promise(resolve=>api.exitCode!==null||api.signalCode!==null?resolve():api.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);
 try{process.kill(-api.pid,'SIGKILL');}catch{}
 await new Promise(resolve=>setTimeout(resolve,100));
 let groupAlive=false;try{process.kill(-api.pid,0);groupAlive=true;}catch{}
 const portOpen=await new Promise(resolve=>{const server=createServer();server.once('error',()=>resolve(true));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(false)));});
 identity.cleanup={pid:api.pid,groupAlive,portOpen};rmSync(temp,{recursive:true,force:true});save();
})();}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{runner?.kill(signal);void stopApi().finally(()=>process.exit(1));});
try{
 const output=[];
 api=spawn(process.execPath,[join(backend,'node_modules/tsx/dist/cli.mjs'),'src/server.ts'],{cwd:backend,detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PORT:String(port),DB_FILE:join(temp,'caregrid.db'),CORS_ORIGIN:'http://127.0.0.1'}});
 api.stdout.on('data',d=>output.push(String(d)));api.stderr.on('data',d=>output.push(String(d)));
 identity.schedulingPid=api.pid;save();
 const started=Date.now();
 for(let i=0;;i++){
  if(api.exitCode!==null)throw new Error('Scheduling API exited before readiness: '+output.join('').split('\n').slice(-6).join('\n'));
  try{const response=await fetch(`http://127.0.0.1:${port}/api/health`);if(response.ok)break;}catch{}
  if(i>240)throw new Error('Scheduling API readiness timed out');
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 identity.seedAndStartMs=Date.now()-started;save();
 runner=spawn(process.execPath,[join(root,'tooling/scripts/run-demo-integration.mjs'),'caregrid'],{cwd:root,stdio:'inherit',env:{...process.env,CAREGRID_SCHEDULING_API_URL:`http://127.0.0.1:${port}/api`}});
 const code=await new Promise(resolve=>runner.on('exit',resolve));
 identity.runnerExit=code;process.exitCode=code??1;
}catch(error){identity.error=error.message;process.exitCode=1;console.error(error.message);}
finally{await stopApi();console.log(JSON.stringify({schedulingCleanup:identity.cleanup,runnerExit:identity.runnerExit}));}
