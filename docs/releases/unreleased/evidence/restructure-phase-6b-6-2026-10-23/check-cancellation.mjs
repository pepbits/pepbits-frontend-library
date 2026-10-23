import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const identityPath='/tmp/phase6b6-cancellation-identity.json',stopFile='/tmp/phase6b6-cancellation-stop';
rmSync(stopFile,{force:true});rmSync(identityPath,{force:true});
// Run only after the main integration has stopped. The launcher's own stop path must reap every group.
const child=spawn('bash',['docs/releases/unreleased/evidence/restructure-phase-6b-6-2026-10-23/run-browser.sh'],{
 env:{...process.env,HEALTHCARE_ROUTE_FILTER:'quality',HEALTHCARE_STOP_FILE:stopFile,HEALTHCARE_IDENTITY:identityPath,HEALTHCARE_RESULT:'/tmp/phase6b6-cancelled-browser.json'},stdio:['ignore','inherit','inherit'],
});
const exited=new Promise(resolve=>child.once('exit',code=>resolve(code)));
let identity;
try{
 for(let i=0;i<120;i++){
  if(existsSync(identityPath))identity=JSON.parse(readFileSync(identityPath,'utf8'));
  if(identity?.startedServices?.length===3)break;
  if(child.exitCode!==null)throw Error('Launcher exited before cancellation');
  await delay(250);
 }
 assert.equal(identity?.startedServices?.length,3,'API, Next and browser started');
 writeFileSync(stopFile,'cancel this bounded lifecycle check\n');
 const code=await Promise.race([exited,delay(15000,undefined,{ref:false}).then(()=>{throw Error('Cancellation timed out');})]);
 assert.equal(code,1);
 identity=JSON.parse(readFileSync(identityPath,'utf8'));
 assert.equal(identity.interrupted,'stop-file');
 assert.equal(identity.cleanup.length,3);
 assert.ok(identity.cleanup.every(entry=>!entry.groupAlive));
 console.log(JSON.stringify({scope:'Bounded stop-file cancellation; not workflow acceptance',exitCode:code,cleanup:identity.cleanup}));
}finally{
 // Failure fallback also prevents this test from leaving services behind.
 if(existsSync(identityPath))identity=JSON.parse(readFileSync(identityPath,'utf8'));
 if(child.exitCode===null){for(const service of [...(identity?.startedServices??[])].reverse())try{process.kill(-service.pid,'SIGKILL');}catch{}child.kill('SIGKILL');}
 rmSync(stopFile,{force:true});
}
