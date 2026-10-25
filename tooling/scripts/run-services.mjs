import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,rmSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {services,aliases,servicePort,hostApiVariable,demoBuildEnv} from '../services.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const state=resolve(process.env.NEXORA_RUN_DIR??join(root,'.run'));
const action=process.argv[2],args=process.argv.slice(3),host=process.env.RUN_HOST??'127.0.0.1';
const targets=[...new Set((args.length?args:services).map(s=>aliases[s]??s))];
if(targets.some(s=>!services.includes(s)))throw Error('Unknown service; use ./run.sh help');
const starting=new Set();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void (async()=>{for(const s of starting)await stop(s);process.exit(1);})();});
const file=s=>join(state,s+'.json'),log=s=>join(state,s+'.log');
function birth(pid){try{return readFileSync(`/proc/${pid}/stat`,'utf8').split(') ').at(-1).split(' ')[19];}catch{return null;}}
function owned(s){try{const r=JSON.parse(readFileSync(file(s),'utf8'));if(r.root===root&&r.birth&&birth(r.pid)===r.birth){process.kill(r.pid,0);return r;}}catch{}return null;}
async function stop(s){const r=owned(s);if(!r){console.log(s+': no owned process');return;}
 for(const signal of ['SIGTERM','SIGKILL']){try{process.kill(-r.pid,signal);}catch{}for(let i=0;i<30;i++){try{process.kill(-r.pid,0);}catch{break;}await delay(100);}}
 rmSync(file(s),{force:true});console.log(s+': stopped owned process group');
}
function npm(argv){execFileSync('npm',argv,{cwd:root,env:demoBuildEnv(),stdio:['ignore','inherit','inherit']});}
function install(){if(targets.some(s=>s!=='api'))npm(['ci','--no-audit','--no-fund']);if(targets.includes('api'))execFileSync('bash',['tooling/scripts/install-api.sh'],{cwd:root,stdio:['ignore','inherit','inherit']});}
function build(s){if(s==='api')npm(['run','build','--prefix','mock-api']);else npm(['run','build','-w','@pepbits-demo/'+s]);}
async function start(s){if(owned(s)){console.log(s+': already running');return;}
 const port=servicePort(s),probe=createServer();await new Promise((res,rej)=>{probe.once('error',rej);probe.listen(port,host,res);});await new Promise(res=>probe.close(res));
 const dev=process.env.MODE==='dev';
 if(s!=='api'&&!dev&&!existsSync(join(root,'demo-apps',s,s==='desktop'?'dist/index.html':'.next/BUILD_ID')))throw Error(s+': run ./run.sh build '+s+' first');
 if(s==='api'&&Number(process.versions.node.split('.')[0])<24)throw Error('API requires Node 24');
 mkdirSync(state,{recursive:true});const fd=openSync(log(s),'w');
 const env={...demoBuildEnv(),HOST:host,PORT:String(port),[hostApiVariable(s)]:process.env[hostApiVariable(s)]??`http://127.0.0.1:${servicePort('api')}`};
 const child=spawn(s==='api'?process.execPath:'npm',s==='api'?['mock-api/server.mjs']:['run',dev?'dev':'start','-w','@pepbits-demo/'+s,'--',...(s==='desktop'?['--host',host,'--strictPort']:['--hostname',host]),'--port',String(port)],{cwd:root,env,detached:true,stdio:['ignore',fd,fd]});closeSync(fd);
 await new Promise((res,rej)=>{child.once('spawn',res);child.once('error',rej);});
 const started=birth(child.pid);if(!started){child.kill();throw Error('Process ownership requires Linux /proc');}
 starting.add(s);
 writeFileSync(file(s),JSON.stringify({root,pid:child.pid,birth:started,port,host}));child.unref();
 try{for(let i=0;i<90;i++){if(!owned(s))throw Error(s+': exited; see '+log(s));try{const r=await fetch(`http://${host}:${port}/${s==='api'?'health':''}`,{signal:AbortSignal.timeout(1000)});if(r.ok){starting.delete(s);console.log(s+': ready on '+host+':'+port);return;}}catch{}await delay(500);}throw Error(s+': readiness timeout');}catch(error){await stop(s);throw error;}
}
if(['help','--help','-h',undefined].includes(action))console.log('Usage: ./run.sh start|stop|restart|status|logs|install|build [services...]\n'+services.map(s=>s+': '+servicePort(s)).join('\n')+'\nAliases: web=showcase, nexora=erp, vantage=erp; desktop=desktop demo.\nProduction builds required. RUN_HOST defaults to loopback; <SERVICE>_PORT overrides ports.\nNEXORA_RUN_DIR isolates process records; stop only signals recorded process groups.');
else if(action==='logs'){if(args.length!==1)throw Error('logs requires one service');const child=spawn('tail',['-n','100','-f',log(targets[0])],{stdio:['ignore','inherit','inherit']});await new Promise(r=>child.once('exit',r));}
else if(action==='status')for(const s of targets){const r=owned(s);console.log(s+': '+(r?'owned pid '+r.pid+' port '+r.port:'not owned/running'));}
else if(action==='install')install();
else if(['start','stop','restart','build'].includes(action)){
 if(action==='stop'||action==='restart')for(const s of [...targets].reverse())await stop(s);
 for(const s of targets){if(action==='start'||action==='restart')await start(s);else if(action==='build')build(s);}
}else throw Error('Unknown action: '+action);
