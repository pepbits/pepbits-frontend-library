import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

export function nextOccurrence(anchor, frequency, after) {
  const start = new Date(anchor);
  if(!Number.isFinite(start.getTime()) || !['daily','weekly','monthly','quarterly'].includes(frequency))throw new Error('Invalid schedule');
  if(start.getTime()>after)return start.getTime();
  if(frequency==='daily'||frequency==='weekly') {
    const interval=(frequency==='daily'?1:7)*86400000;
    return start.getTime()+(Math.floor((after-start.getTime())/interval)+1)*interval;
  }
  const step=frequency==='monthly'?1:3;
  const date=new Date(after);
  let n=Math.max(0,Math.floor(((date.getUTCFullYear()-start.getUTCFullYear())*12+date.getUTCMonth()-start.getUTCMonth())/step));
  for(;;n++) {
    const candidate=new Date(start);candidate.setUTCDate(1);candidate.setUTCMonth(start.getUTCMonth()+n*step);
    const last=new Date(Date.UTC(candidate.getUTCFullYear(),candidate.getUTCMonth()+1,0)).getUTCDate();
    candidate.setUTCDate(Math.min(start.getUTCDate(),last));
    if(candidate.getTime()>after)return candidate.getTime();
  }
}

/** One worker per process, transactional claims across processes; delivery lives
 * in the authenticated inbox. No arbitrary email address or webhook is accepted.
 */
export function createReportScheduler(file,{render, audit, now=Date.now}) {
  mkdirSync(dirname(file),{recursive:true,mode:0o700});
  const db=new DatabaseSync(file);chmodSync(file,0o600);
  db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS schedules(id TEXT PRIMARY KEY,tenant TEXT NOT NULL,owner TEXT NOT NULL,spec TEXT NOT NULL,next INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY,schedule TEXT NOT NULL,tenant TEXT NOT NULL,owner TEXT NOT NULL,due INTEGER NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,lease INTEGER NOT NULL DEFAULT 0,content TEXT,error TEXT,UNIQUE(schedule,due));
    CREATE INDEX IF NOT EXISTS delivery_owner ON deliveries(tenant,owner,due);`);
  let running=false;
  const identity=user=>[user.tenantId,user.id];
  const view=row=>({...row,spec:JSON.parse(row.spec)});
  const api={
    create(user,spec) {
      if(!spec || typeof spec.name!=='string'||!spec.name.trim()||spec.name.length>100||!['en','ar','hi','ml'].includes(spec.language)||!['daily','weekly','monthly','quarterly'].includes(spec.frequency)||!Number.isFinite(Date.parse(spec.startAt))||Date.parse(spec.startAt)<now()-60000||Date.parse(spec.startAt)>now()+366*86400000)throw new Error('Invalid schedule');
      if(db.prepare('SELECT count(*) AS count FROM schedules WHERE tenant=? AND owner=?').get(...identity(user)).count>=50)throw new Error('Schedule limit reached');
      const canonical={name:spec.name.trim(),productId:spec.productId,pageId:spec.pageId,language:spec.language,frequency:spec.frequency,startAt:new Date(spec.startAt).toISOString(),format:'csv',delivery:'inbox',timezone:'UTC'};
      const id=randomUUID();
      audit(user,'report.schedule-create',201,{pageId:spec.pageId,jobId:id});
      db.prepare('INSERT INTO schedules(id,tenant,owner,spec,next) VALUES(?,?,?,?,?)').run(id,...identity(user),JSON.stringify(canonical),Date.parse(canonical.startAt));
      return id;
    },
    list(user,productId,pageId) {
      return {
        schedules:db.prepare('SELECT * FROM schedules WHERE tenant=? AND owner=? ORDER BY next').all(...identity(user)).map(view).filter(row=>row.spec.productId===productId&&row.spec.pageId===pageId),
        deliveries:db.prepare('SELECT d.id,d.schedule,d.due,d.state,d.attempts,d.error,s.spec FROM deliveries d JOIN schedules s ON s.id=d.schedule WHERE d.tenant=? AND d.owner=? ORDER BY d.due DESC LIMIT 100').all(...identity(user)).map(view).filter(row=>row.spec.productId===productId&&row.spec.pageId===pageId),
      };
    },
    owned(user,id) {return db.prepare('SELECT * FROM schedules WHERE id=? AND tenant=? AND owner=?').get(id,...identity(user));},
    enabled(user,id,enabled) {
      if(!api.owned(user,id))return false;
      audit(user,'report.schedule-toggle',200,{jobId:id});
      return db.prepare('UPDATE schedules SET enabled=? WHERE id=? AND tenant=? AND owner=?').run(enabled?1:0,id,...identity(user)).changes===1;
    },
    retry(user,id) {
      audit(user,'report.retry',202,{jobId:id});
      return db.prepare("UPDATE deliveries SET state='pending',attempts=0,lease=0,error=NULL WHERE id=? AND tenant=? AND owner=? AND state='failed'").run(id,...identity(user)).changes===1;
    },
    download(user,id) {
      return db.prepare("SELECT d.content,d.id,s.spec FROM deliveries d JOIN schedules s ON s.id=d.schedule WHERE d.id=? AND d.tenant=? AND d.owner=? AND d.state='ready'").get(id,...identity(user));
    },
    async tick() {
      if(running)return;running=true;
      try {
        db.prepare('DELETE FROM deliveries WHERE due<?').run(now()-30*86400000);
        db.exec('BEGIN IMMEDIATE');
        try {
          for(const row of db.prepare('SELECT * FROM schedules WHERE enabled=1 AND next<=? LIMIT 100').all(now())) {
            const spec=JSON.parse(row.spec);
            db.prepare("INSERT OR IGNORE INTO deliveries(id,schedule,tenant,owner,due,state) VALUES(?,?,?,?,?,'pending')").run(randomUUID(),row.id,row.tenant,row.owner,row.next);
            db.prepare('UPDATE schedules SET next=? WHERE id=?').run(nextOccurrence(spec.startAt,spec.frequency,now()),row.id);
          }
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        for(const job of db.prepare("SELECT d.*,s.spec FROM deliveries d JOIN schedules s ON s.id=d.schedule WHERE (state='pending' OR state='failed' OR state='processing') AND lease<=? AND attempts<5 LIMIT 20").all(now())) {
          const claimed=db.prepare("UPDATE deliveries SET state='processing',attempts=attempts+1,lease=? WHERE id=? AND lease<=? AND state!='ready'").run(now()+300000,job.id,now()).changes;
          if(!claimed)continue;
          const user={tenantId:job.tenant,id:job.owner};
          try {
            const content=await render(user,JSON.parse(job.spec));
            if(typeof content!=='string'||Buffer.byteLength(content)>5000000)throw new Error('Invalid report output');
            audit(user,'report.delivered',200,{jobId:job.id,pageId:JSON.parse(job.spec).pageId});
            db.prepare("UPDATE deliveries SET state='ready',content=?,error=NULL,lease=0 WHERE id=?").run(content,job.id);
          }catch {
            db.prepare("UPDATE deliveries SET state='failed',error='Report generation failed.',lease=? WHERE id=?").run(now()+Math.min(3600000,30000*2**job.attempts),job.id);
          }
        }
      }finally{running=false;}
    },
    close(){db.close();},
  };
  return api;
}
