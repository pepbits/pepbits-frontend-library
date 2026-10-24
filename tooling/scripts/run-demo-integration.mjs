import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const demo=process.argv[2];if(!['healthcare','erp','school','tenant-admin','reports','desktop'].includes(demo))throw new Error('Pass a demo app name');
// Environment prefixes use underscores: tenant-admin reads TENANT_ADMIN_API_NODE, TENANT_ADMIN_RESULT and so on.
const prefix=demo.toUpperCase().replaceAll('-','_');
const root=fileURLToPath(new URL('../../',import.meta.url));
const app=join(root,'demo-apps',demo),temp=mkdtempSync(join(tmpdir(),demo+'-integration-'));
const children=[],cleanup=[];
let stopping;
function stopChildren(){return stopping??=(async()=>{for(const child of [...children].reverse()){
 try{process.kill(-child.pid,'SIGTERM');}catch{}
 await Promise.race([new Promise(resolve=>child.exitCode!==null||child.signalCode!==null?resolve():child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);
 try{process.kill(-child.pid,'SIGKILL');}catch{}
 await new Promise(resolve=>setTimeout(resolve,100));
 let groupAlive=false;try{process.kill(-child.pid,0);groupAlive=true;}catch{}
 cleanup.push({label:child.serviceLabel,pid:child.pid,exitCode:child.exitCode,signal:child.signalCode,groupAlive});
}})();}
let cancellationStarted=false;
function cancel(reason){if(cancellationStarted)return;cancellationStarted=true;void stopChildren().finally(()=>{identity.interrupted=reason;identity.cleanup=cleanup;writeFileSync(process.env[prefix+'_IDENTITY']??'/tmp/'+demo+'-integration-identity.json',JSON.stringify(identity,null,2)+'\n');rmSync(temp,{recursive:true,force:true});process.exit(1);});}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>cancel(signal));
// A shared stop file remains reachable when the execution wrapper has its own PID namespace.
const stopFile=process.env[prefix+'_STOP_FILE'];
const deadline=setTimeout(()=>cancel('deadline'),Number(process.env[prefix+'_TIMEOUT_MS']??1800000));deadline.unref();
const cancellation=stopFile?setInterval(()=>{if(existsSync(stopFile))cancel('stop-file');},500):null;cancellation?.unref();
const freePort=()=>new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const apiPort=await freePort(),appPort=await freePort();
const node=process.env[prefix+'_API_NODE']??process.execPath;
const major=Number(execFileSync(node,['-p','process.versions.node.split(".")[0]'],{encoding:'utf8'}));
if(major<24)throw new Error('The unchanged demo API requires Node 24. Set the demo API_NODE variable to a Node 24 executable.');
const artifactRoot=process.env[prefix+'_RUNTIME_ARTIFACTS'];
const apiArgs=[];const identity={sourceBase:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),apiPort,appPort,nodeVersion:execFileSync(node,['--version'],{encoding:'utf8'}).trim(),runtimeArtifacts:null};
if(artifactRoot){
 const built=resolve(artifactRoot),files=execFileSync('git',['ls-files','dummy-api','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 const mismatches=files.filter(p=>!existsSync(join(built,p.slice('dummy-api/'.length)))||sha(join(root,p))!==sha(join(built,p.slice('dummy-api/'.length))));
 if(mismatches.length)throw new Error(`Runtime artifact source differs in ${mismatches.length} tracked API files`);
 const loader=join(temp,'runtime-loader.mjs'),artifactLog=join(temp,'runtime-artifacts.ndjson');
 writeFileSync(loader,`import {existsSync,readFileSync,appendFileSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';const source=${JSON.stringify(join(root,'dummy-api/'))},built=${JSON.stringify(built+'/')};const seen=new Set();function record(result){if(result.url?.startsWith('file:')){const path=fileURLToPath(result.url);if(path.startsWith(built)&&/^[\\w-]+\\/dist\\//.test(path.slice(built.length))&&!seen.has(path)){seen.add(path);appendFileSync(${JSON.stringify(artifactLog)},JSON.stringify({path:path.slice(built.length),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})+'\\n');}}return result;}export async function resolve(specifier,context,next){const entry=new URL(specifier,context.parentURL??'file://'+source).href;if(entry==='file://'+source+'access-runtime/medband-worker.mjs')return next('file://'+built+'access-runtime/medband-worker.mjs',context);try{return record(await next(specifier,context));}catch(error){if(!specifier.startsWith('.')&&!specifier.startsWith('/')&&context.parentURL?.startsWith('file://'+source)){return record(await next(specifier,{...context,parentURL:context.parentURL.replace('file://'+source,'file://'+built)}));}if(['pharmacy-runtime/','access-runtime/','quality-runtime/'].some(dir=>context.parentURL?.startsWith(new URL(dir, 'file://'+source).href))){const mapped={...context,parentURL:context.parentURL.replace('file://'+source,'file://'+built)};return record(await next(specifier,mapped));}const url=new URL(specifier,context.parentURL);if(url.protocol==='file:'){const path=fileURLToPath(url),rel=path.slice(source.length);if(path.startsWith(source)&&/^[\\w-]+\\/dist\\//.test(rel)&&existsSync(built+rel)){appendFileSync(${JSON.stringify(artifactLog)},JSON.stringify({path:rel,sha256:createHash('sha256').update(readFileSync(built+rel)).digest('hex')})+'\\n');return record(await next(pathToFileURL(built+rel).href,context));}}throw error;}}`);
 apiArgs.push('--loader',loader);identity.runtimeArtifacts={sourceFilesCompared:files.length,mismatches:0,artifactLog};
 // Diagnostic workers use CommonJS and inherit --require. Resolve only missing diagnostic runtime dependencies
 // against the verified checkout, while the worker and public API still run from this worktree.
 const commonLoader=join(temp,'diagnostic-runtime.cjs');
 writeFileSync(commonLoader,`const Module=require('node:module');const resolve=Module._resolveFilename;const source=${JSON.stringify(join(root,'dummy-api/diagnostics-runtime/'))},built=${JSON.stringify(join(built,'diagnostics-runtime/'))};Module._resolveFilename=function(specifier,parent,...rest){try{return resolve.call(this,specifier,parent,...rest);}catch(error){if(parent?.filename?.startsWith(source)){return resolve.call(this,specifier,{...parent,filename:built+parent.filename.slice(source.length),paths:Module._nodeModulePaths(built)},...rest);}throw error;}};`);
 apiArgs.push('--require',commonLoader);
 const runtimeFiles=[];function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())walk(path);else runtimeFiles.push({path:path.slice(built.length+1),sha256:sha(path)});}}
 walk(join(built,'diagnostics-runtime/dist'));
 const pharmacyStart=runtimeFiles.length;walk(join(built,'pharmacy-runtime/dist'));
 identity.runtimeArtifacts.pharmacyBuild=runtimeFiles.splice(pharmacyStart).sort((a,b)=>a.path.localeCompare(b.path));
 const qualityStart=runtimeFiles.length;walk(join(built,'quality-runtime/dist'));
 identity.runtimeArtifacts.qualityBuild=runtimeFiles.splice(qualityStart).sort((a,b)=>a.path.localeCompare(b.path));
 // MedBand discovers route modules with readdir, so its identical worker must run beside the verified build.
 identity.runtimeArtifacts.medbandWorker={path:'access-runtime/medband-worker.mjs',sha256:sha(join(built,'access-runtime/medband-worker.mjs')),reason:'Source-identical worker directory discovery requires the reused dist tree beside its entry point.'};
 const accessStart=runtimeFiles.length;walk(join(built,'access-runtime/dist'));
 identity.runtimeArtifacts.accessBuild=runtimeFiles.splice(accessStart).sort((a,b)=>a.path.localeCompare(b.path));
 identity.runtimeArtifacts.diagnosticBuild=runtimeFiles.sort((a,b)=>a.path.localeCompare(b.path));
}
function start(command,args,env,cwd,label){
 const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe'],detached:true});children.push(child);child.serviceLabel=label;
 identity.startedServices??=[];identity.startedServices.push({label,pid:child.pid});writeFileSync(process.env[prefix+'_IDENTITY']??'/tmp/'+demo+'-integration-identity.json',JSON.stringify(identity,null,2)+'\n');
 const output=[];child.stdout.on('data',d=>output.push(String(d)));child.stderr.on('data',d=>output.push(String(d)));
 child.on('exit',code=>{if(code)console.error(`${label} exited ${code}`);});return {child,output};
}
async function ready(url,process){for(let i=0;i<120;i++){if(process.child.exitCode!==null)throw new Error('Local service exited before readiness. '+process.output.join('').split('\n').filter(l=>!/(account|password|token|credential)/i.test(l)).slice(-8).join('\n'));try{const r=await fetch(url);if(r.status<500)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('Local service readiness timed out');}
try{
 const api=start(node,[...apiArgs,'dummy-api/server.mjs'],{HOST:'127.0.0.1',PORT:String(apiPort),NEXORA_DATA_DIR:join(temp,'data'),RECORD_DATA_DIR:join(temp,'records')},root,'API');
 await ready(`http://127.0.0.1:${apiPort}/auth/session`,api);
 // Vite apps (the desktop demo) serve their production build with `vite preview`, which proxies /api to <PREFIX>_API_URL.
 const vite=existsSync(join(app,'vite.config.ts'));
 const next=start(process.execPath,vite?[join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(appPort),'--strictPort']:[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(appPort)],{[prefix+'_API_URL']:`http://127.0.0.1:${apiPort}`},app,vite?'Vite':'Next');
 await ready(`http://127.0.0.1:${appPort}/`,next);
 const browser=start(process.execPath,[join(app,'scripts/smoke.mjs')],{[prefix+'_BASE']:`http://127.0.0.1:${appPort}`,[prefix+'_EXAMPLES']:'1',[prefix+'_FLOW']:'1'},root,'Browser');
 browser.child.stdout.pipe(process.stdout);browser.child.stderr.pipe(process.stderr);
 const code=await new Promise(r=>browser.child.on('exit',r));process.exitCode=code??1;identity.integrationExit=code;
 if(identity.runtimeArtifacts){identity.runtimeArtifacts.resolved=existsSync(identity.runtimeArtifacts.artifactLog)?readFileSync(identity.runtimeArtifacts.artifactLog,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];identity.runtimeArtifacts.resolved=[...new Map(identity.runtimeArtifacts.resolved.map(entry=>[entry.path,entry])).values()].sort((a,b)=>a.path.localeCompare(b.path));delete identity.runtimeArtifacts.artifactLog;}
 writeFileSync(process.env[prefix+'_IDENTITY']??'/tmp/'+demo+'-integration-identity.json',JSON.stringify(identity,null,2)+'\n');
 console.log(JSON.stringify({integrationExit:code,sourceBase:identity.sourceBase,apiPort,appPort}));
}finally{clearTimeout(deadline);if(cancellation)clearInterval(cancellation);await stopChildren();identity.cleanup=cleanup;writeFileSync(process.env[prefix+'_IDENTITY']??'/tmp/'+demo+'-integration-identity.json',JSON.stringify(identity,null,2)+'\n');rmSync(temp,{recursive:true,force:true});}
