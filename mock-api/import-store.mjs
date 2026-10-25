import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateImportRow,importIdentity} from '../desktop-clients/packages/erp-config/src/imports.ts';
/** Each record has a deterministic job/row identity, making job receipt recovery safe. */
export function createImportStore(file,{definition,existing,alreadySaved,save}) {
 let jobs={};try{jobs=JSON.parse(readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const commit=next=>{mkdirSync(dirname(file),{recursive:true,mode:0o700});writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(file+'.tmp',file);jobs=next;};
 const fail=(status,error)=>({status,body:{error}});
 const result=job=>({status:200,body:{job:job?{id:job.id,productId:job.productId,pageId:job.pageId,rows:job.rows,confirmed:job.confirmed,createdAt:job.createdAt}:null}});
 const owns=(user,job)=>job&&job.tenantId===user.tenantId&&job.userId===user.id;
 return {handle(user,body){
  if(!body||typeof body!=='object')return fail(400,'Invalid import request.');
  const {action,productId,pageId}=body;
  if(action==='latest'){
   if(typeof productId!=='string'||typeof pageId!=='string')return fail(400,'Choose a product and page.');
   return result(Object.values(jobs).filter(job=>owns(user,job)&&job.productId===productId&&job.pageId===pageId).sort((a,b)=>(b.order??0)-(a.order??0))[0]??null);
  }
  if(!['enterprise-admin','finance-manager'].includes(user.role))return fail(403,'Your role cannot import records.');
  if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id))return fail(400,'A valid import identifier is required.');
  if(action==='preview') {
   if(typeof productId!=='string'||!productId||productId.length>100||typeof pageId!=='string'||!pageId||pageId.length>100)return fail(400,'Choose a product and page.');
   const def=definition(pageId);if(!def)return fail(400,'This page does not have an import definition.');
   if(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>500||body.rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length>80||Object.values(row).some(value=>typeof value!=='string'||value.length>4000)))return fail(400,'Provide 1–500 mapped rows with cells up to 4000 characters.');
   const fingerprint=createHash('sha256').update(JSON.stringify([productId,pageId,body.rows])).digest('hex');
   const prior=jobs[body.id];if(prior)return owns(user,prior)&&prior.fingerprint===fingerprint?result(prior):fail(409,'This import identifier has already been used.');
   const keys=body.rows.map(row=>importIdentity(row[def.uniqueField]));
   const duplicate=new Set(keys.filter((key,index)=>key&&keys.indexOf(key)!==index));
   const present=new Set(existing(user,productId,pageId).map(importIdentity));
   const rows=body.rows.map((row,index)=>{
    const {values,errors}=validateImportRow(def,row);const key=importIdentity(values[def.uniqueField]);
    if(duplicate.has(key))errors[def.uniqueField]='Duplicate value within this CSV';
    if(present.has(key))errors[def.uniqueField]='A record with this value already exists';
    return {row:index+1,values,errors,status:Object.keys(errors).length?'invalid':'pending'};
   });
   const job={order:Math.max(0,...Object.values(jobs).map(job=>job.order??0))+1,id:body.id,tenantId:user.tenantId,userId:user.id,productId,pageId,rows,confirmed:false,fingerprint,createdAt:new Date().toISOString()};
   const next={...jobs};const scope=Object.values(jobs).filter(job=>owns(user,job)&&job.productId===productId&&job.pageId===pageId).sort((a,b)=>(a.order??0)-(b.order??0));
   // Keep a bounded demo history, preserving every unfinished confirmed job.
   if(scope.length>=20){const removable=scope.find(job=>!job.confirmed||!job.rows.some(row=>row.status==='pending'||row.status==='failed'&&row.retryable));if(!removable)return fail(400,'Finish or retry earlier imports before creating another.');delete next[removable.id];}
   next[job.id]=job;commit(next);return result(job);
  }
  if(action!=='run')return fail(400,'Unknown import operation.');
  const source=jobs[body.id];if(!owns(user,source))return fail(404,'Import not available.');
  const job=structuredClone(source),def=definition(job.pageId);if(!def)return fail(400,'The import definition is no longer available.');
  job.confirmed=true;
  if(body.retry===true)for(const row of job.rows)if(row.status==='failed'&&row.retryable){row.status='pending';row.errors={};}
  const present=new Set(existing(user,job.productId,job.pageId).map(importIdentity));
  for(const row of job.rows.filter(row=>row.status==='pending').slice(0,10)){
   const recordId=`import-${job.id}-${row.row}`;
   try{
    if(alreadySaved(user,job,recordId)){row.status='success';row.errors={};row.recordId=recordId;continue;}
    const key=importIdentity(row.values[def.uniqueField]);
    if(present.has(key)){row.status='failed';row.retryable=false;row.errors={[def.uniqueField]:'This value was created after validation. Correct the CSV and validate again.'};continue;}
    save(user,job,recordId,row.values);
    present.add(key);row.status='success';row.errors={};row.recordId=recordId;row.retryable=false;
   }catch{row.status='failed';row.retryable=true;row.errors={service:'The row could not be confirmed. Retry failed rows.'};}
  }
  commit({...jobs,[job.id]:job});return result(job);
 }};
}
