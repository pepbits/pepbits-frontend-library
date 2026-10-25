import {createHash} from 'node:crypto';
import inject from 'light-my-request';
import {serve,dbFile,absent,failure} from './command-host.mjs';
process.env.DB_FILE=dbFile;
let app,db,flushNotifications,runReminders;
await serve({
 async initialize(){
  ({db}=await import('./dist/medslot/db.js'));
  if(absent){(await import('./dist/medslot/db.js')).migrate();db.exec('CREATE TABLE host_bootstrap(id INTEGER PRIMARY KEY CHECK(id=1),ready INTEGER NOT NULL);CREATE TABLE host_identity(host_id TEXT PRIMARY KEY,user_id INTEGER NOT NULL UNIQUE REFERENCES users(id));');db.prepare('INSERT INTO host_bootstrap VALUES(1,0)').run();await import('./dist/medslot/seed.js');db.prepare('UPDATE host_bootstrap SET ready=1').run();}
  else if(!db.prepare("SELECT name FROM sqlite_master WHERE name='host_bootstrap'").get()||db.prepare('SELECT ready FROM host_bootstrap WHERE id=1').get()?.ready!==1)throw Error('Existing MedSlot database not reseeded');
  ({app}=await import('./dist/medslot/index.js'));({flushNotifications}=await import('./dist/medslot/lib/notify.js'));({runReminders}=await import('./dist/medslot/jobs/reminders.js'));return db;
 },
 background:[{id:'medslot-reminders',intervalMs:60000,firstDelayMs:5000,run:()=>runReminders()}],
 identity(db,user){
  const id=parseInt(createHash('sha256').update(user.id).digest('hex').slice(0,12),16)+100000;
  // Only the named synthetic demo provider has a preapproved resource association. Other providers fail closed.
  const resource=user.role==='provider'&&user.id==='ACCESS-MEDSLOT-PROVIDER'?db.prepare("SELECT id FROM resources WHERE name='Dr. Meera Iyer'").get()?.id:null;
  db.prepare('INSERT INTO users(id,name,email,password_hash,role,resource_id,active) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,resource_id=excluded.resource_id,email=excluded.email').run(id,user.name,'host-'+id+'@identity.invalid','HOST-ONLY',user.role,resource);
  db.prepare('INSERT INTO host_identity(host_id,user_id) VALUES(?,?) ON CONFLICT(host_id) DO NOTHING').run(user.id,id);
  return {id,name:user.name,email:user.email,role:user.role,resource_id:resource};
 },
 async dispatch(req){
  const url=new URL(req.path,'http://medslot.internal'),actor=globalThis.__accessHostActor;
  for(const key of ['limit','offset','page','pageSize']){const v=url.searchParams.get(key);if(v!==null&&(!/^\d+$/.test(v)||Number(v)>10000))return failure(400,'VALIDATION_FAILED','Choose a valid bounded page range.');}
  if(url.pathname==='/api/auth/me')return {status:200,body:{user:actor}};
  if(actor.role==='provider'){
   if(!actor.resource_id)return failure(403,'RESOURCE_REQUIRED','An approved provider resource mapping is required.');
   const match=url.pathname.match(/^\/api\/(patients|appointments|resources)\/(\d+)(?:\/(?:status|duration))?$/);
   if(match){const [_,entity,id]=match;const linked=entity==='resources'?Number(id)===actor.resource_id:entity==='appointments'?db.prepare('SELECT 1 FROM appointment_resources WHERE appointment_id=? AND resource_id=?').get(Number(id),actor.resource_id):db.prepare('SELECT 1 FROM appointments a JOIN appointment_resources ar ON ar.appointment_id=a.id WHERE a.patient_id=? AND ar.resource_id=?').get(Number(id),actor.resource_id);if(!linked)return failure(403,'RESOURCE_DENIED','The record is outside your assigned resource.');}
   if(url.pathname==='/api/availability')url.searchParams.set('resource_id',String(actor.resource_id));
   if(url.pathname==='/api/appointments/calendar')url.searchParams.set('resource_ids',String(actor.resource_id));
  }
  let result;
  try{const r=await inject(app,{method:req.method,url:url.pathname+url.search,headers:{'content-type':'application/json'},payload:!['GET','HEAD'].includes(req.method)?JSON.stringify(req.body??{}):undefined});result={status:r.statusCode,body:r.payload?JSON.parse(r.payload):null};await flushNotifications(result.status<400);}
  catch(error){await flushNotifications(false);throw error;}
  if(actor.role==='provider'&&url.pathname==='/api/resources'&&Array.isArray(result.body))result.body=result.body.filter(r=>r.id===actor.resource_id);
  return result;
 }
});
