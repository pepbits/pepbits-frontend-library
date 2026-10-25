import {createHash} from 'node:crypto';
import inject from 'light-my-request';
import {serve,dbFile,absent,failure} from './command-host.mjs';
process.env.DB_PATH=dbFile;process.env.NODE_ENV='test';
let app;
await serve({
 async initialize(){
  const {db,migrate}=await import('./dist/tenant-admin/db.js');migrate();
  if(absent){db.exec('CREATE TABLE host_bootstrap (id INTEGER PRIMARY KEY CHECK(id=1), ready INTEGER NOT NULL)');db.prepare('INSERT INTO host_bootstrap VALUES(1,0)').run();db.transaction((await import('./dist/tenant-admin/seed.js')).seedIfEmpty)();db.prepare('UPDATE host_bootstrap SET ready=1').run();}
  else if(!db.prepare("SELECT name FROM sqlite_master WHERE name='host_bootstrap'").get()||db.prepare('SELECT ready FROM host_bootstrap WHERE id=1').get()?.ready!==1)throw Error('Existing Tenant Admin database was not reseeded.');
  app=(await import('./dist/tenant-admin/index.js')).app;return db;
 },
 identity(db,user){const id=parseInt(createHash('sha256').update(user.id).digest('hex').slice(0,12),16)+100000;db.prepare('INSERT INTO app_user(id,name,title,email,initials,tone) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,title=excluded.title,email=excluded.email,initials=excluded.initials').run(id,user.name,user.role,user.email??user.id+'@demo.example',user.initials||user.name.slice(0,2).toUpperCase(),'jade');return {id,name:user.name,title:user.role,email:user.email,initials:user.initials,tone:'jade'};},
 async dispatch(req){
  const url=new URL(req.path,'http://tenant-admin.internal');for(const [name,max] of [['limit',1000],['page',100000],['pageSize',200]]){const value=url.searchParams.get(name);if(value!==null&&(!/^\d+$/.test(value)||Number(value)>max))return failure(400,'VALIDATION_FAILED','Choose a valid bounded page range.');}
  const response=await inject(app,{method:req.method,url:req.path,headers:{'content-type':'application/json'},payload:!['GET','HEAD'].includes(req.method)?JSON.stringify(req.body??{}):undefined});return {status:response.statusCode,body:JSON.parse(response.payload||'null')};
 },
 decorate(result,req,actor,scope){if(new URL(req.path,'http://reference.internal').pathname==='/api/meta'){result.body.currentUser=actor;result.body.hostManagedIdentity=true;result.body.demo=true;result.body.scope={branchId:scope.branchId};}},
});
