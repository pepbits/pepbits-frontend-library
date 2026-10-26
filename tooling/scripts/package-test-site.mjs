import {buildAllyVoraBackend} from '../deployment/allyvora-backend.mjs';
import {withAllyVoraBackend} from '../deployment/allyvora-smoke.mjs';
import {mkdtemp,cp,rm,mkdir,writeFile,readFile,readdir,lstat} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceIdentity} from './source-identity.mjs';
import {packageRelease} from '../deployment/release.mjs';
import {smokeApi} from '../deployment/api-smoke.mjs';
import {smokeRelease} from '../deployment/process.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),mock=resolve(process.argv[2]??process.env.HC_RCM_MOCK_REPO??'test-dependencies/mock-services'),out=resolve(process.argv[3]??'release');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const pin='5ced4f8b021aa317859e6999d7c96ef14af63ee1';
if(git(mock,'rev-parse','HEAD')!==pin||git(mock,'status','--porcelain','--','mockpay','pyproject.toml'))throw Error('Simulator source must be clean and pinned');
const base=git(root,'rev-parse','HEAD'),dirty=git(root,'status','--porcelain');
const id=new Date().toISOString().replace(/\D/g,'').slice(0,17)+'-'+base.slice(0,8);
await mkdir(out,{recursive:true});const staging=await mkdtemp(join(tmpdir(),'pepbits-release-')),payload=join(staging,id);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 await mkdir(payload);await packageRelease(root,join(payload,'web'),{webApiUrl:'/api',desktopApiUrl:'/api'},id);
 await mkdir(join(payload,'src'));await mkdir(join(payload,'mock'));
 await cp(join(root,'mock-api'),join(payload,'src/mock-api'),{recursive:true,dereference:true,filter:p=>!['.data','data'].includes(relative(join(root,'mock-api'),p).split('/')[0])&&!relative(join(root,'mock-api'),p).split('/').some(part=>['.git','__pycache__','.npmrc'].includes(part)||part.startsWith('.env')||part.endsWith('.log')||part.endsWith('.tsbuildinfo'))});
 for(const name of ['mockpay','pyproject.toml'])await cp(join(mock,name),join(payload,'mock',name),{recursive:true,filter:p=>!p.includes('__pycache__')});
 await buildAllyVoraBackend(root,join(payload,'src/allyvora-backend'));
 const entries=[];async function walk(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isSymbolicLink())throw Error('Payload must be self-contained: '+p);else entries.push({path:relative(payload,p),sha256:sha(await readFile(p))});}}
 await walk(payload);
 const build={schemaVersion:2,release:id,frontendCommit:base,workingTree:!!dirty,sourceDigest:sourceIdentity(root).digest,mockServicesCommit:pin,node:process.versions.node,built:new Date().toISOString(),files:entries};
 await writeFile(join(payload,'BUILD.json'),JSON.stringify(build,null,2)+'\n');
 await smokeApi(join(payload,'src/mock-api'),apiUrl=>withAllyVoraBackend(join(payload,'src/allyvora-backend'),allyvoraUrl=>smokeRelease(join(payload,'web'),undefined,apiUrl,allyvoraUrl)));
 const archive=join(out,`frontend-test-${id}.tar.gz`);
 execFileSync('tar',['-C',staging,'-czf',archive,id],{stdio:['ignore','inherit','inherit']});
 await writeFile(archive.replace(/\.tar.gz$/,'.sha256'),sha(await readFile(archive))+'  '+`frontend-test-${id}.tar.gz\n`);
 await writeFile(join(out,'id'),id+'\n');
 console.log(JSON.stringify({release:id,archive,files:entries.length,bytes:(await lstat(archive)).size}));
}finally{await rm(staging,{recursive:true,force:true});}
