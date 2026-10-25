import {createHash} from 'node:crypto';
import inject from 'light-my-request';
import {serve,dbFile,absent,failure} from './command-host.mjs';
process.env.DB_FILE=dbFile;
let app,hashPin;
await serve({
 async initialize(){
  const {db,migrate}=await import('./dist/surgisuite/db.js');
  if(absent){migrate();db.exec('CREATE TABLE host_bootstrap(id INTEGER PRIMARY KEY CHECK(id=1),ready INTEGER NOT NULL)');db.prepare('INSERT INTO host_bootstrap VALUES(1,0)').run();(await import('./dist/surgisuite/seed.js')).seed(false);db.prepare('UPDATE host_bootstrap SET ready=1').run();}
  else if(!db.prepare("SELECT name FROM sqlite_master WHERE name='host_bootstrap'").get()||db.prepare('SELECT ready FROM host_bootstrap WHERE id=1').get()?.ready!==1)throw Error('Existing SurgiSuite database not reseeded');
  hashPin=(await import('./dist/surgisuite/auth.js')).hashPin;app=(await import('./dist/surgisuite/index.js')).app;return db;
 },
 identity(db,user){
  const id=parseInt(createHash('sha256').update(user.id).digest('hex').slice(0,12),16)+100000;
  const old=db.prepare('SELECT id FROM staff WHERE id=?').get(id);
  if(!old)db.prepare('INSERT INTO staff(id,emp_code,name,role,email,pin_hash,privileges,active) VALUES(?,?,?,?,?,?,?,1)').run(id,'HOST-'+id,user.name,user.role,user.email,hashPin('1234'),'[]');
  else db.prepare('UPDATE staff SET name=?,role=?,email=? WHERE id=?').run(user.name,user.role,user.email,id);
  const {pin_hash,...actor}=db.prepare('SELECT * FROM staff WHERE id=?').get(id);return actor;
 },
 async dispatch(req){
  const url=new URL(req.path,'http://surgisuite.internal');
  for(const key of ['limit','page','pageSize']){const v=url.searchParams.get(key);if(v!==null&&(!/^\d+$/.test(v)||Number(v)>1000))return failure(400,'VALIDATION_FAILED','Choose a valid bounded page range.');}
  if(url.pathname==='/api/auth/me')return {status:200,body:globalThis.__accessHostActor};
  const r=await inject(app,{method:req.method,url:req.path,headers:{'content-type':'application/json'},payload:!['GET','HEAD'].includes(req.method)?JSON.stringify(req.body??{}):undefined});return {status:r.statusCode,body:r.payload?JSON.parse(r.payload):null};
 }
});
