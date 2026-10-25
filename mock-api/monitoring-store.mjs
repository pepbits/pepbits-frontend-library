import {DatabaseSync} from 'node:sqlite';import {mkdirSync,chmodSync} from 'node:fs';import {dirname} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {sanitizeSentinelEvent} from '../desktop-clients/packages/auth/src/sentinel.ts';
export const canMonitor=user=>user?.permissions?.includes('monitoring:manage')===true;
export function createMonitoringStore(file,{now=()=>Date.now()}={}){
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS monitoring_incidents(id TEXT PRIMARY KEY,tenant TEXT,product TEXT,fingerprint TEXT,status TEXT,revision INTEGER,first_seen TEXT,last_seen TEXT,occurrences INTEGER,diagnostic TEXT,UNIQUE(tenant,product,fingerprint));
 CREATE TABLE IF NOT EXISTS monitoring_receipts(tenant TEXT,product TEXT,event_id TEXT,at INTEGER,incident_id TEXT,PRIMARY KEY(tenant,product,event_id));
 CREATE TABLE IF NOT EXISTS monitoring_history(id TEXT,tenant TEXT,product TEXT,actor TEXT,status TEXT,at TEXT);
 CREATE TABLE IF NOT EXISTS monitoring_limits(tenant TEXT,owner TEXT,minute INTEGER,count INTEGER,PRIMARY KEY(tenant,owner,minute));`);
 const fail=(status,error)=>({status,body:{error}});
 const scoped=(user,product,id)=>db.prepare('SELECT * FROM monitoring_incidents WHERE tenant=? AND product=? AND id=?').get(user.tenantId,product,id);
 const convert=row=>({id:row.id,status:row.status,revision:row.revision,firstSeen:row.first_seen,lastSeen:row.last_seen,occurrences:row.occurrences,diagnostic:JSON.parse(row.diagnostic)});
 return {
  ingest(user,product,body,allowedPages){
   if(!user)return fail(401,'Not signed in.');
   if(!Array.isArray(body?.events)||!body.events.length||body.events.length>10)return fail(400,'Invalid monitoring events.');
   const events=body.events.map(sanitizeSentinelEvent);if(events.some(e=>!e||!allowedPages.has(e.pageId)||e.breadcrumbs.some(id=>!allowedPages.has(id))))return fail(400,'Invalid monitoring events.');
   db.exec('BEGIN IMMEDIATE');try{
    const time=now(),minute=Math.floor(time/60000),at=new Date(time).toISOString();
    db.prepare('DELETE FROM monitoring_limits WHERE minute<?').run(minute-2);
    const held=db.prepare('SELECT count FROM monitoring_limits WHERE tenant=? AND owner=? AND minute=?').get(user.tenantId,user.id,minute)?.count??0;
    if(held+events.length>60){db.exec('ROLLBACK');return fail(429,'Monitoring rate limit reached.');}
    db.prepare('INSERT INTO monitoring_limits VALUES(?,?,?,?) ON CONFLICT(tenant,owner,minute) DO UPDATE SET count=excluded.count').run(user.tenantId,user.id,minute,held+events.length);
    // Bounded demo retention: incidents and receipts expire after 30 days.
    const cutoff=time-30*86400000;
    db.prepare('DELETE FROM monitoring_incidents WHERE last_seen<?').run(new Date(cutoff).toISOString());db.prepare('DELETE FROM monitoring_receipts WHERE at<?').run(cutoff);db.prepare('DELETE FROM monitoring_history WHERE at<?').run(new Date(cutoff).toISOString());
    const ids=[];
    for(const event of events){
     const fingerprint=createHash('sha256').update(JSON.stringify([event.kind,event.code,event.pageId,event.release,event.platform,event.status??null,event.line??null,event.column??null])).digest('hex');
     let row=db.prepare('SELECT * FROM monitoring_incidents WHERE tenant=? AND product=? AND fingerprint=?').get(user.tenantId,product,fingerprint);
     const receiptId=row?.id??randomUUID();
     const inserted=db.prepare('INSERT OR IGNORE INTO monitoring_receipts VALUES(?,?,?,?,?)').run(user.tenantId,product,event.id,time,receiptId).changes;
     if(inserted){
      const id=receiptId;
      // Store only the diagnostic allowlist; client IDs are delivery receipts, not incident identifiers.
      const {id:clientId,...diagnostic}=event;
      db.prepare(`INSERT INTO monitoring_incidents VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant,product,fingerprint) DO UPDATE SET last_seen=excluded.last_seen,occurrences=occurrences+1,status=CASE WHEN status='resolved' THEN 'new' ELSE status END,revision=revision+1`).run(id,user.tenantId,product,fingerprint,'new',1,at,at,1,JSON.stringify(diagnostic));
      row=scoped(user,product,id);
     }
     if(row)ids.push({eventId:event.id,incidentId:row.id});
    }
    db.exec('COMMIT');return {status:202,body:{accepted:ids}};
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  list(user,product,params){
   if(!canMonitor(user))return fail(403,'Monitoring administrator permission is required.');
   const status=params.get('status'),page=params.get('pageId'),reference=params.get('reference');const offset=Number(params.get('offset')??0);if(!Number.isSafeInteger(offset)||offset<0||status&&!['new','investigating','resolved'].includes(status))return fail(400,'Invalid monitoring filter.');
   const where='tenant=? AND product=?'+(status?' AND status=?':'')+(page?' AND json_extract(diagnostic,\'$.pageId\')=?':'')+(reference?' AND id IN (SELECT incident_id FROM monitoring_receipts WHERE tenant=monitoring_incidents.tenant AND product=monitoring_incidents.product AND event_id=?)':'');const args=[user.tenantId,product,...(status?[status]:[]),...(page?[page]:[]),...(reference?[reference]:[])];
   const rows=db.prepare(`SELECT * FROM monitoring_incidents WHERE ${where} ORDER BY last_seen DESC,id LIMIT 50 OFFSET ?`).all(...args,offset);
   const total=db.prepare(`SELECT count(*) AS count FROM monitoring_incidents WHERE ${where}`).get(...args).count;
   return {status:200,body:{incidents:rows.map(convert),total,nextOffset:offset+50<total?offset+50:null}};
  },
  detail(user,product,id){if(!canMonitor(user))return fail(403,'Monitoring administrator permission is required.');const row=scoped(user,product,id);return row?{status:200,body:{incident:convert(row),references:db.prepare('SELECT event_id FROM monitoring_receipts WHERE tenant=? AND product=? AND incident_id=? ORDER BY at DESC LIMIT 10').all(user.tenantId,product,id).map(r=>r.event_id),history:db.prepare('SELECT actor,status,at FROM monitoring_history WHERE id=? AND tenant=? AND product=? ORDER BY at DESC LIMIT 50').all(id,user.tenantId,product)}}:fail(404,'Monitoring incident is unavailable.');},
  update(user,product,id,body){
   if(!canMonitor(user))return fail(403,'Monitoring administrator permission is required.');
   if(!body||!['new','investigating','resolved'].includes(body.status)||!Number.isSafeInteger(body.revision))return fail(400,'Invalid monitoring update.');
   db.exec('BEGIN IMMEDIATE');try{const row=scoped(user,product,id);if(!row){db.exec('ROLLBACK');return fail(404,'Monitoring incident is unavailable.');}if(row.revision!==body.revision){db.exec('ROLLBACK');return fail(409,'Monitoring incident changed. Reload before saving.');}
    db.prepare('UPDATE monitoring_incidents SET status=?,revision=revision+1 WHERE id=?').run(body.status,id);db.prepare('INSERT INTO monitoring_history VALUES(?,?,?,?,?,?)').run(id,user.tenantId,product,user.id,body.status,new Date(now()).toISOString());db.exec('COMMIT');return {status:200,body:{incident:convert(scoped(user,product,id))}};
   }catch(error){db.exec('ROLLBACK');throw error;}
  },close(){db.close();}
 };
}
