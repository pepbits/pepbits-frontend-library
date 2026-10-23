// Own the local Next process group so every smoke run closes its server.
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {once} from 'node:events';
const folder='docs/releases/unreleased/evidence/restructure-phase-6a-2026-10-23/follow-up';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','demo-apps/showcase','--port','3318','--hostname','127.0.0.1'],{detached:true,stdio:['ignore','pipe','pipe']});
const log=createWriteStream(folder+'/server-managed.log',{flags:'a'});
server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});
try {
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Local server did not start')),30000);
  server.stdout.on('data',chunk=>{if(chunk.toString().includes('Ready in')){clearTimeout(timeout);resolve();}});
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('Local server exited '+code));});
  server.once('error',reject);
 });
 const smoke=spawn('bash',[folder+'/run-browser.sh'],{stdio:'inherit'});
 const [code]=await once(smoke,'exit');process.exitCode=code??1;
} finally {
 try {process.kill(-server.pid,'SIGTERM');} catch(error){if(error.code!=='ESRCH')throw error;}
 if(server.exitCode===null)await once(server,'exit');
 log.end();
}
