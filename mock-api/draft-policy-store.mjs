import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {DEFAULT_DRAFT_POLICY,parseDraftPolicy} from '../desktop-clients/packages/erp-config/src/draft-policy.ts';
import {canManagePreferences} from './preference-store.mjs';
export function createDraftPolicyStore(file,{scrub=()=>{},audit=()=>{}}={}) {
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS policies(tenant TEXT,product TEXT,body TEXT,PRIMARY KEY(tenant,product));');
 const read=(user,product)=>{const row=db.prepare('SELECT body FROM policies WHERE tenant=? AND product=?').get(user.tenantId,product);return row?JSON.parse(row.body):{...DEFAULT_DRAFT_POLICY};};
 return {read,write(user,product,input){
  if(!canManagePreferences(user))return {status:403,body:{error:'Only a tenant administrator can manage preference policies.'}};
  let policy;try{policy=parseDraftPolicy(input);}catch{return {status:400,body:{error:'Invalid draft policy.'}};}
  db.exec('BEGIN IMMEDIATE');try {
   if(policy.revision!==read(user,product).revision){db.exec('ROLLBACK');return {status:409,body:{error:'Draft policy changed. Reload before saving.'}};}
   policy={...policy,revision:policy.revision+1};
   // Erase newly forbidden draft data before acknowledging the stricter policy.
   scrub(user,product,policy);audit(user,'drafts.policy-update',200,{fieldKeys:policy.excludedFields});
   db.prepare('INSERT OR REPLACE INTO policies VALUES(?,?,?)').run(user.tenantId,product,JSON.stringify(policy));db.exec('COMMIT');return {status:200,body:{policy}};
  }catch(e){db.exec('ROLLBACK');throw e;}
 },close(){db.close();}};
}
