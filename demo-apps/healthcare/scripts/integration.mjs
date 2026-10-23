import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const app=join(root,'demo-apps/healthcare'),temp=mkdtempSync(join(tmpdir(),'healthcare-integration-'));
const children=[];
const freePort=()=>new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const apiPort=await freePort(),appPort=await freePort();
const node=process.env.HEALTHCARE_API_NODE??process.execPath;
const major=Number(execFileSync(node,['-p','process.versions.node.split(".")[0]'],{encoding:'utf8'}));
if(major<24)throw new Error('The unchanged demo API requires Node 24. Set HEALTHCARE_API_NODE to a Node 24 executable.');
const artifactRoot=process.env.HEALTHCARE_RUNTIME_ARTIFACTS;
const apiArgs=[];const identity={sourceBase:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),apiPort,appPort,nodeVersion:execFileSync(node,['--version'],{encoding:'utf8'}).trim(),runtimeArtifacts:null};
if(artifactRoot){
 const built=resolve(artifactRoot),files=execFileSync('git',['ls-files','dummy-api','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 const mismatches=files.filter(p=>!existsSync(join(built,p.slice('dummy-api/'.length)))||sha(join(root,p))!==sha(join(built,p.slice('dummy-api/'.length))));
 if(mismatches.length)throw new Error(`Runtime artifact source differs in ${mismatches.length} tracked API files`);
 const loader=join(temp,'runtime-loader.mjs'),artifactLog=join(temp,'runtime-artifacts.ndjson');
 writeFileSync(loader,`import {existsSync,readFileSync,appendFileSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';const source=${JSON.stringify(join(root,'dummy-api/'))},built=${JSON.stringify(built+'/')};const seen=new Set();function record(result){if(result.url?.startsWith('file:')){const path=fileURLToPath(result.url);if(path.startsWith(built)&&/^[\\w-]+\\/dist\\//.test(path.slice(built.length))&&!seen.has(path)){seen.add(path);appendFileSync(${JSON.stringify(artifactLog)},JSON.stringify({path:path.slice(built.length),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})+'\\n');}}return result;}export async function resolve(specifier,context,next){try{return record(await next(specifier,context));}catch(error){const url=new URL(specifier,context.parentURL);if(url.protocol==='file:'){const path=fileURLToPath(url),rel=path.slice(source.length);if(path.startsWith(source)&&/^[\\w-]+\\/dist\\//.test(rel)&&existsSync(built+rel)){appendFileSync(${JSON.stringify(artifactLog)},JSON.stringify({path:rel,sha256:createHash('sha256').update(readFileSync(built+rel)).digest('hex')})+'\\n');return record(await next(pathToFileURL(built+rel).href,context));}}throw error;}}`);
 apiArgs.push('--loader',loader);identity.runtimeArtifacts={sourceFilesCompared:files.length,mismatches:0,artifactLog};
}
function start(command,args,env,cwd,label){
 const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe'],detached:true});children.push(child);
 const output=[];child.stdout.on('data',d=>output.push(String(d)));child.stderr.on('data',d=>output.push(String(d)));
 child.on('exit',code=>{if(code)console.error(`${label} exited ${code}`);});return {child,output};
}
async function ready(url,process){for(let i=0;i<120;i++){if(process.child.exitCode!==null)throw new Error('Local service exited before readiness. '+process.output.join('').split('\n').filter(l=>!/(account|password|token|credential)/i.test(l)).slice(-8).join('\n'));try{const r=await fetch(url);if(r.status<500)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('Local service readiness timed out');}
try{
 const api=start(node,[...apiArgs,'dummy-api/server.mjs'],{HOST:'127.0.0.1',PORT:String(apiPort),NEXORA_DATA_DIR:join(temp,'data'),RECORD_DATA_DIR:join(temp,'records')},root,'API');
 await ready(`http://127.0.0.1:${apiPort}/auth/session`,api);
 const next=start(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(appPort)],{HEALTHCARE_API_URL:`http://127.0.0.1:${apiPort}`},app,'Next');
 await ready(`http://127.0.0.1:${appPort}/patient-query`,next);
 const browser=start(process.execPath,[join(app,'scripts/smoke.mjs')],{HEALTHCARE_BASE:`http://127.0.0.1:${appPort}`,HEALTHCARE_EXAMPLES:'1',HEALTHCARE_FLOW:'1'},root,'Browser');
 browser.child.stdout.pipe(process.stdout);browser.child.stderr.pipe(process.stderr);
 const code=await new Promise(r=>browser.child.on('exit',r));process.exitCode=code??1;
 if(identity.runtimeArtifacts){identity.runtimeArtifacts.resolved=existsSync(identity.runtimeArtifacts.artifactLog)?readFileSync(identity.runtimeArtifacts.artifactLog,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];identity.runtimeArtifacts.resolved=[...new Map(identity.runtimeArtifacts.resolved.map(entry=>[entry.path,entry])).values()].sort((a,b)=>a.path.localeCompare(b.path));delete identity.runtimeArtifacts.artifactLog;}
 writeFileSync(process.env.HEALTHCARE_IDENTITY??'/tmp/phase6b-integration-identity.json',JSON.stringify(identity,null,2)+'\n');
 console.log(JSON.stringify({integrationExit:code,sourceBase:identity.sourceBase,apiPort,appPort}));
}finally{for(const child of children.reverse())try{process.kill(-child.pid,'SIGTERM');}catch{}}
