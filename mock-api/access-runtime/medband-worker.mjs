import {readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {serve,dbFile,absent,failure} from './command-host.mjs';
process.env.MEDBAND_DB=dbFile;process.env.NODE_ENV='test';
const routes=[];
await serve({
 async initialize(){
  const {getDb}=await import('./dist/medband/server/db.js');const db=getDb();
  if(!db.prepare('PRAGMA table_info(audit_log)').all().some(column=>column.name==='actor_id'))db.exec('ALTER TABLE audit_log ADD COLUMN actor_id TEXT');
  if(absent){db.exec('CREATE TABLE host_bootstrap(id INTEGER PRIMARY KEY CHECK(id=1),ready INTEGER NOT NULL)');db.prepare('INSERT INTO host_bootstrap VALUES(1,0)').run();globalThis.__accessAllowSeed=true;try{db.transaction((await import('./dist/medband/server/services.js')).bootstrap)();db.prepare('UPDATE host_bootstrap SET ready=1').run();}finally{globalThis.__accessAllowSeed=false;}}
  else if(!db.prepare("SELECT name FROM sqlite_master WHERE name='host_bootstrap'").get()||db.prepare('SELECT ready FROM host_bootstrap WHERE id=1').get()?.ready!==1)throw Error('Existing MedBand database was not reseeded.');
  const root=new URL('./dist/medband/routes/',import.meta.url).pathname;
  async function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else if(item.name==='route.js'){const segments=relative(root,dir).split('/').filter(Boolean);routes.push({segments,handlers:await import(path)});}}}await walk(root);return db;
 },
 identity(_db,user){return {id:user.id,name:user.name,role:user.role,initials:user.initials};},
 async dispatch(req){
  const url=new URL(req.path,'http://medband.internal');const parts=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
  const route=routes.find(r=>r.segments.length===parts.length&&r.segments.every((part,index)=>/^\[\w+\]$/.test(part)||part===parts[index]));
  if(!route)return failure(404,'NOT_FOUND','No such MedBand endpoint.');const handler=route.handlers[req.method];if(!handler)return failure(405,'METHOD_NOT_ALLOWED','This method is unavailable.');
  const params=Object.fromEntries(route.segments.flatMap((part,index)=>/^\[\w+\]$/.test(part)?[[part.slice(1,-1),parts[index]]]:[]));
  const request=new Request(url,{method:req.method,headers:{'content-type':'application/json'},...(!['GET','HEAD'].includes(req.method)?{body:JSON.stringify(req.body??{})}:{})});const response=await handler(request,{params:Promise.resolve(params)});return {status:response.status,body:await response.json()};
 },
 decorate(result,req,actor,scope){if(new URL(req.path,'http://reference.internal').pathname==='/api/bootstrap'){Object.assign(result.body,{currentUser:actor,hostManagedIdentity:true,demo:true,scope:{branchId:scope.branchId}});}},
});
