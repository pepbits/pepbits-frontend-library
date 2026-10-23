import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createConnection} from 'node:net';
import assert from 'node:assert/strict';
const directory=new URL('./',import.meta.url);
const names=readdirSync(directory).filter(name=>/^(pilot\d*-identity|identity-(final|post-ci))\.json$/.test(name));
const identities=names.map(name=>({path:name,identity:JSON.parse(readFileSync(new URL(name,directory),'utf8'))}));
for(const {path,identity} of identities){assert.equal(identity.cleanup?.length,3,path);assert.ok(identity.cleanup.every(c=>c.groupAlive===false),path);}
const ports=[...new Set(identities.flatMap(({identity:i})=>[i.apiPort,i.appPort]))];
const listeners=await Promise.all(ports.map(port=>new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});let finished=false;const finish=state=>{if(finished)return;finished=true;socket.destroy();resolve({port,state});};socket.once('connect',()=>finish('open'));socket.once('error',error=>finish(error.code==='ECONNREFUSED'?'closed':error.code));socket.setTimeout(2000,()=>finish('timeout'));})));
const result={scope:'Owned launcher child-group receipts plus independent loopback listener probes; no unrelated process was stopped.',identities:identities.map(({path,identity})=>({path,children:identity.cleanup})),ports:listeners};
writeFileSync(new URL('cleanup.json',directory),JSON.stringify(result,null,2)+'\n');
assert.ok(listeners.every(p=>p.state==='closed'));console.log(names.length+' launcher identities; '+ports.length+' owned ports closed; all child groups stopped.');
