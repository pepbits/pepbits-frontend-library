import {smokeApi} from '../deployment/api-smoke.mjs';
import {withAllyVoraBackend} from '../deployment/allyvora-smoke.mjs';
import {smokeRelease} from '../deployment/process.mjs';
// Offline receiver-contract validation. Never contacts a host or activates a release.
import {readFileSync,mkdtempSync,rmSync,readdirSync,lstatSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out=resolve(process.argv[2]??'release'),id=readFileSync(join(out,'id'),'utf8').trim();
if(!/^\d{17}-[a-f0-9]{8}$/.test(id))throw Error('Invalid release id');
const archive=join(out,`frontend-test-${id}.tar.gz`),sha=b=>createHash('sha256').update(b).digest('hex');
const digest=sha(readFileSync(archive));if(digest!==readFileSync(archive.replace(/\.tar.gz$/,'.sha256'),'utf8').split(' ')[0])throw Error('Transfer digest mismatch');
const temp=mkdtempSync(join(tmpdir(),'pepbits-receipt-'));
try{
 execFileSync('python3',['-c',`import sys,tarfile
with tarfile.open(sys.argv[1]) as t:
 assert {m.name.split('/')[0] for m in t.getmembers()} == {sys.argv[3]}
 assert all(m.isfile() or m.isdir() for m in t.getmembers())
 t.extractall(sys.argv[2],filter='data')`,archive,temp,id],{stdio:['ignore','inherit','inherit']});
 const root=join(temp,id),build=JSON.parse(readFileSync(join(root,'BUILD.json'))),release=JSON.parse(readFileSync(join(root,'web/release.json')));
 if(build.release!==id||release.id!==id||release.webApiUrl!=='/api'||release.desktopApiUrl!=='/api'||release.schemaVersion!==2)throw Error('Receiver identity/API check failed');
 const files=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())walk(p);else {if(!e.isFile())throw Error('Unexpected link');files.push(relative(root,p));}}}walk(root);
 if(files.length!==build.files.length+1||new Set(build.files.map(e=>e.path)).size!==build.files.length)throw Error('Incomplete payload inventory');
 const fileSet=new Set(files);
 for(const f of build.files)if(!fileSet.has(f.path)||sha(readFileSync(join(root,f.path)))!==f.sha256)throw Error('Changed/missing payload file: '+f.path);
 for(const demo of release.demos){const marker=join(root,'web',demo==='desktop'?'desktop':`demos/${demo}/demo-apps/${demo}/public`,'__nexora-release.json');if(JSON.parse(readFileSync(marker)).id!==id)throw Error('Demo marker mismatch');}
 if(!files.includes('src/mock-api/server.mjs')||!files.includes('mock/mockpay/__main__.py'))throw Error('Missing API/simulators');
 if(!files.includes('src/allyvora-backend/dist/server.js')||!files.includes('src/allyvora-backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node'))throw Error('Missing packaged AllyVora backend/native runtime');
 await smokeApi(join(root,'src/mock-api'),apiUrl=>withAllyVoraBackend(join(root,'src/allyvora-backend'),allyvoraUrl=>smokeRelease(join(root,'web'),undefined,apiUrl,allyvoraUrl)));
 console.log(JSON.stringify({status:'passed',scope:'local archive extraction, receiver identity, complete file digests every demo marker, isolated servers/assets/proxies and packaged AllyVora HTTP workflows; no deployment',release:id,sha256:digest,files:build.files.length,bytes:lstatSync(archive).size,mockServicesCommit:build.mockServicesCommit}));
}finally{rmSync(temp,{recursive:true,force:true});}
