import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createConnection} from 'node:net';
const folder='docs/releases/unreleased/evidence/restructure-phase-6b-6-2026-10-23';
const receipts=['phase6b6-pilot-identity.json','phase6b6-pilot2-identity.json','phase6b6-pilot3-identity.json','identity-final.json','cancellation-identity.json','identity-post-ci.json'];
const identities=receipts.map(file=>({file,...JSON.parse(readFileSync(folder+'/'+file,'utf8'))}));
for(const identity of identities){assert.equal(identity.cleanup.length,3,identity.file);assert.ok(identity.cleanup.every(child=>!child.groupAlive),identity.file);}
const ports=[...new Set(identities.flatMap(identity=>[identity.apiPort,identity.appPort]))];
const listeners=await Promise.all(ports.map(port=>new Promise(resolve=>{
 const socket=createConnection({host:'127.0.0.1',port});
 socket.once('connect',()=>{socket.destroy();resolve({port,closed:false});});
 socket.once('error',error=>resolve({port,closed:error.code==='ECONNREFUSED',code:error.code}));
 socket.setTimeout(1500,()=>{socket.destroy();resolve({port,closed:false,code:'timeout'});});
})));
assert.ok(listeners.every(listener=>listener.closed));
const report={scope:'Process groups were checked by each owning launcher; loopback listener ports are independently checked after all runs. Normal runner exits account for unit-test/build/shell-browser completion.',identities:identities.map(({file,cleanup,interrupted})=>({file,cleanup,interrupted})),listeners,taskOwnedServicesRemaining:0};
writeFileSync(folder+'/cleanup.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({identities:receipts.length,closedPorts:listeners.length,taskOwnedServicesRemaining:0}));
