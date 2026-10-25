import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {parsePreferencePolicy,validPreference,effectivePreferences,EMPTY_PREFERENCE_POLICY} from '../desktop-clients/packages/erp-config/src/preference-policy.ts';

export const canManagePreferences=user=>Array.isArray(user?.permissions)&&user.permissions.includes('preferences:manage');
export function createPreferenceStore(file,{legacy=()=>({}),audit=()=>{},modules=()=>[]}={}) {
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS preference_policy(tenant TEXT,product TEXT,revision INTEGER,rules TEXT,PRIMARY KEY(tenant,product));
 CREATE TABLE IF NOT EXISTS personal_preference(tenant TEXT,product TEXT,owner TEXT,revision INTEGER,overrides TEXT,PRIMARY KEY(tenant,product,owner));
 CREATE TABLE IF NOT EXISTS preference_history(tenant TEXT,product TEXT,revision INTEGER,actor TEXT,at TEXT,rules TEXT,PRIMARY KEY(tenant,product,revision));`);
 const allowedModule=(user,product,value)=>value===undefined||value===""||modules(user,product).includes(value);
 const scope=(user,product)=>[user.tenantId,product];
 const policy=(user,product)=>{
  const held=db.prepare('SELECT revision,rules FROM preference_policy WHERE tenant=? AND product=?').get(...scope(user,product));
  return held?{revision:held.revision,rules:JSON.parse(held.rules)}:EMPTY_PREFERENCE_POLICY;
 };
 const read=(user,product)=>{
  const applied=policy(user,product),held=db.prepare('SELECT revision,overrides FROM personal_preference WHERE tenant=? AND product=? AND owner=?').get(...scope(user,product),user.id);
  const overrides=held?JSON.parse(held.overrides):Object.fromEntries(Object.entries(legacy(user,product)).filter(([key,value])=>validPreference(key,value)));
  if (!allowedModule(user,product,overrides.defaultModule)) delete overrides.defaultModule;
  const resolved=effectivePreferences(overrides,applied);
  if (!allowedModule(user,product,resolved.defaultModule)) resolved.defaultModule="";
  return {preferences:resolved,overrides,policy:applied,userRevision:held?.revision??0,canManage:canManagePreferences(user)};
 };
 const transaction=run=>{db.exec('BEGIN IMMEDIATE');try{const result=run();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 const failure=(status,error)=>({status,body:{error}});
 return {
  read,
  policy(user,product){return {policy:policy(user,product),canManage:canManagePreferences(user),history:db.prepare('SELECT revision,actor,at,rules FROM preference_history WHERE tenant=? AND product=? ORDER BY revision DESC LIMIT 20').all(...scope(user,product)).map(row=>({...row,rules:JSON.parse(row.rules)}))};},
  writePolicy(user,product,input){
   if(!canManagePreferences(user))return failure(403,'Only a tenant administrator can manage preference policies.');
   let next;try{next=parsePreferencePolicy(input);}catch{return failure(400,'Invalid preference policy.');}
   if(!allowedModule(user,product,next.rules.defaultModule?.value))return failure(400,'preference.defaultModule.denied');
   return transaction(()=>{
    if(next.revision!==policy(user,product).revision)return failure(409,'Preference policy changed. Reload before saving.');
    next={...next,revision:next.revision+1};
    audit(user,'preferences.policy-update',200,{fieldKeys:Object.keys(next.rules)});
    db.prepare('INSERT OR REPLACE INTO preference_policy VALUES(?,?,?,?)').run(...scope(user,product),next.revision,JSON.stringify(next.rules));
    db.prepare('INSERT INTO preference_history VALUES(?,?,?,?,?,?)').run(...scope(user,product),next.revision,user.id,new Date().toISOString(),JSON.stringify(next.rules));
    return {status:200,body:{policy:next}};
   });
  },
  write(user,product,body){
   const values=body?.preferences;
   if(!values||typeof values!=='object'||Array.isArray(values)||Object.entries(values).some(([key,value])=>!validPreference(key,value)))return failure(400,'Invalid preference values.');
   if(!allowedModule(user,product,values.defaultModule))return failure(400,'preference.defaultModule.denied');
   return transaction(()=>{
    const current=read(user,product);
    if(body.policyRevision!==current.policy.revision && !(body.policyRevision===undefined&&current.policy.revision===0))return failure(409,'Preference policy changed. Reload before saving.');
    if(body.userRevision!==undefined&&body.userRevision!==current.userRevision)return failure(409,'Preferences changed in another session. Reload before saving.');
    if(Object.keys(values).some(key=>current.policy.rules[key]?.locked))return failure(403,'This preference is managed by your administrator.');
    // Preserve dormant personal choices under locks; unlocking restores those choices.
    const held=Object.fromEntries(Object.entries(current.overrides).filter(([key])=>current.policy.rules[key]?.locked));
    const overrides={...held,...values};
    db.prepare('INSERT OR REPLACE INTO personal_preference VALUES(?,?,?,?,?)').run(...scope(user,product),user.id,current.userRevision+1,JSON.stringify(overrides));
    return {status:200,body:read(user,product)};
   });
  },
  close(){db.close();},
 };
}
