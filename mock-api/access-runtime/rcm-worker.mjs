import {createHash} from 'node:crypto';
import inject from 'light-my-request';
import {rcmResourceWritable} from '../reference-rcm-store.mjs';
import {serve,dbFile,absent,failure} from './command-host.mjs';
process.env.DB_PATH=dbFile;process.env.NODE_ENV='test';
let app,validScope;
await serve({
 fingerprint:req=>[req.method,req.path,req.body,req.headers?.['x-rcm-scope']??'ALL:SAR'],
 async initialize(){
  const {db,migrate}=await import('./dist/rcm/db.js');migrate();
  if(absent){db.exec('CREATE TABLE host_bootstrap(id INTEGER PRIMARY KEY CHECK(id=1),ready INTEGER NOT NULL,version INTEGER NOT NULL)');db.prepare('INSERT INTO host_bootstrap VALUES(1,0,1)').run();db.transaction((await import('./dist/rcm/seed.js')).seedIfEmpty)();db.prepare('UPDATE host_bootstrap SET ready=1').run();}
  else if(!db.prepare("SELECT name FROM sqlite_master WHERE name='host_bootstrap'").get()||db.prepare('SELECT ready,version FROM host_bootstrap WHERE id=1').get()?.ready!==1||db.prepare('SELECT version FROM host_bootstrap WHERE id=1').get()?.version!==1)throw Error('Existing RCM database was not reseeded.');
  validScope=(await import('./dist/rcm/registry.js')).isScope;app=(await import('./dist/rcm/index.js')).app;return db;
 },
 identity(db,user){const id=parseInt(createHash('sha256').update(user.id).digest('hex').slice(0,12),16)+100000;db.prepare('INSERT INTO app_user(id,name,title,email,initials,tone,home_branch) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,title=excluded.title,email=excluded.email,initials=excluded.initials').run(id,user.name,user.role,user.email??user.id+'@demo.example',user.initials||user.name.slice(0,2).toUpperCase(),'harbor',null);return {id,name:user.name,title:user.role,email:user.email,initials:user.initials,tone:'harbor',homeBranch:null};},
 async dispatch(req){
  const url=new URL(req.path,'http://rcm.internal');for(const [name,max]of [['limit',1000],['page',100000],['pageSize',300]]){const value=url.searchParams.get(name);if(value!==null&&(!/^\d+$/.test(value)||Number(value)>max))return failure(400,'VALIDATION_FAILED','Choose a valid bounded page range.');}
  const sourceScope=req.headers?.['x-rcm-scope']??'ALL:SAR';if(typeof sourceScope!=='string'||!validScope(sourceScope))return failure(400,'INVALID_RCM_SCOPE','Choose a valid reference scope.');
  const r=await inject(app,{method:req.method,url:req.path,headers:{'content-type':'application/json','x-branch':sourceScope},payload:!['GET','HEAD'].includes(req.method)?JSON.stringify(req.body??{}):undefined});return {status:r.statusCode,body:JSON.parse(r.payload||'null')};
 },
 decorate(result,req,actor,scope){if(new URL(req.path,'http://rcm.internal').pathname==='/api/meta'){result.body.resources=result.body.resources.map(r=>({...r,create:r.create&&rcmResourceWritable(actor.title,r),editable:rcmResourceWritable(actor.title,r)?r.editable:[],actions:rcmResourceWritable(actor.title,r)?r.actions.filter(a=>actor.title!=='clerk'||!a.independent):[]}));result.body.currentUser=actor;result.body.hostManagedIdentity=true;result.body.demo=true;result.body.scope={branchId:scope.branchId};}},
});
