import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import bwipjs from 'bwip-js';
import {labelFitsProfile} from '../desktop-clients/packages/erp-config/src/label-printing.ts';
import {parseCsv,writeCsvSnapshot} from './clinical-template-csv.ts';
const base=JSON.parse(readFileSync(new URL('./config/label-printing/templates.json',import.meta.url),'utf8'));
const [headers,...rows]=parseCsv(readFileSync(new URL('./config/label-printing/records.csv',import.meta.url),'utf8'));
const records=rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]]))).map(r=>({...r,...(r.amount?{amount:Number(r.amount)}:{})}));
const fail=(status,key,field)=>({status,body:{error:key,...(field?{fieldErrors:{[field]:key}}:{})}});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function createLabelStore(file,clock=()=>new Date()){
 function read(){try{const [h,...rows]=parseCsv(readFileSync(file,'utf8'));if(h.join(',')!=='scope,data')throw Error('Invalid label store');return Object.fromEntries(rows.map(([scope,data])=>[scope,JSON.parse(data)]));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
 function write(all){const cell=v=>'"'+String(v).replaceAll('"','""')+'"';writeCsvSnapshot(file,'scope,data\n'+Object.entries(all).map(([k,v])=>cell(k)+','+cell(JSON.stringify(v))).join('\n')+'\n');}
 function status(job){return {...job,...(job.paymentStatus==='pending'&&job.expiresAt&&job.expiresAt<=clock().toISOString()?{paymentStatus:'expired'}:{})};}
 return {handle(user,product,input,canManage=false){
  if(!user?.id||!user.tenantId)return fail(403,'labels.denied');
  if(!input||typeof input!=='object')return fail(400,'labels.invalid');
  const all=read(),scope=JSON.stringify([user.tenantId,product]),bucket=all[scope]??={jobs:[],preferences:{},receipts:{},policy:structuredClone(base.policy)};
  const own=()=>bucket.jobs.filter(j=>j.owner===user.id||canManage).map(status);
  if(input.action==='library')return {status:200,body:{...base,policy:bucket.policy,records,jobs:own(),defaultProfile:bucket.policy.lockedProfile||bucket.preferences[user.id]||'sheet-a4',canManage}};
  const job=bucket.jobs.find(j=>j.id===input.jobId&&(j.owner===user.id||canManage));
  if(input.action==='job')return job?{status:200,body:status(job)}:fail(404,'labels.missing');
  if(!['create','print','simulate','preference','policy'].includes(input.action)||typeof input.operationId!=='string'||!input.operationId||input.operationId.length>100)return fail(400,'labels.invalid');
  if(['policy','simulate'].includes(input.action)&&!canManage)return fail(403,'labels.denied');
  const receiptKey=JSON.stringify([user.id,input.operationId]),receipt=bucket.receipts[receiptKey];
  if(receipt&&input.action==='print'&&job?.paymentStatus&&status(job).paymentStatus!=='pending')return fail(409,'labels.expired');
  if(receipt)return receipt.hash===hash(input)?{status:200,body:receipt.body}:fail(409,'labels.conflict');
  let result;
  if(input.action==='policy'){
   if(!canManage)return fail(403,'labels.denied');const p=input.policy;
   if(!p||p.version!==bucket.policy.version)return fail(409,'labels.conflict');
   if(!Number.isInteger(p.maxCopies)||p.maxCopies<1||p.maxCopies>100||typeof p.reprintAllowed!=='boolean'||typeof p.lockedProfile!=='string'||(p.lockedProfile&&!base.profiles.some(x=>x.id===p.lockedProfile)))return fail(400,'labels.invalid');
   bucket.policy={version:p.version+1,maxCopies:p.maxCopies,reprintAllowed:p.reprintAllowed,lockedProfile:p.lockedProfile};result=bucket.policy;
  }else if(input.action==='preference'){
   if(bucket.policy.lockedProfile||!base.profiles.some(p=>p.id===input.profileId))return fail(403,'labels.locked');
   bucket.preferences[user.id]=input.profileId;result={saved:true};
  }else if(input.action==='create'){
   const template=base.templates.find(t=>t.id===input.templateId),profile=base.profiles.find(p=>p.id===(bucket.policy.lockedProfile||input.profileId));
   if(!template||!profile||!Number.isInteger(input.copies)||input.copies<1||input.copies>bucket.policy.maxCopies||!Array.isArray(input.recordIds)||!input.recordIds.length||input.recordIds.length>25||new Set(input.recordIds).size!==input.recordIds.length)return fail(400,'labels.invalid');
   if(template.category==='payment'&&(input.recordIds.length!==1||input.copies!==1))return fail(400,'labels.invalid');
   const selected=input.recordIds.map(id=>records.find(r=>r.id===id&&r.category===template.category));if(selected.some(r=>!r))return fail(400,'labels.invalid');
   if(!labelFitsProfile(template,profile))return fail(400,'labels.fit','profileId');
   const id=randomUUID(),expiry=new Date(clock().getTime()+5*60000).toISOString();
   let labels;try{labels=selected.map(r=>{
    const code=template.symbology.startsWith('gs1')?`(01)${r.identifier.padStart(14,'0')}(10)DEMOLOT01`:template.category==='payment'?`https://payments.example.invalid/${template.id==='payment-static'?'merchant/DEMO':`invoice/${id}`}`:template.category==='qr'?`https://documents.example.invalid/${r.identifier}`:r.identifier;
    const svg=bwipjs.toSVG({bcid:template.symbology,text:code,scale:3,...(template.symbology==='code128'||template.symbology==='ean13'?{height:10}:{}),padding:12,backgroundcolor:'FFFFFF',barcolor:'000000',includetext:false});
    return {recordId:r.id,title:r.name,lines:[r.identifier,r.detail,...(template.category==='payment'?[`${r.currency} ${Number(r.amount).toFixed(2)}`]:[])],code,image:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),widthMm:template.widthMm,heightMm:template.heightMm};
   });}catch{return fail(400,'labels.encoding');}
   result={id,owner:user.id,templateId:template.id,templateVersion:template.version,profile,copies:input.copies,labels,createdAt:clock().toISOString(),attempts:[],...(template.category==='payment'?{paymentStatus:'pending',expiresAt:expiry}:{})};bucket.jobs.unshift(result);
  }else{
   if(!job)return fail(404,'labels.missing');
   if(input.action==='simulate'){
    if(!canManage)return fail(403,'labels.denied');if(status(job).paymentStatus!=='pending'||!['paid','failed'].includes(input.paymentStatus))return fail(409,'labels.conflict');job.paymentStatus=input.paymentStatus;
   }else{
    if(job.copies>bucket.policy.maxCopies||(bucket.policy.lockedProfile&&job.profile.id!==bucket.policy.lockedProfile))return fail(403,'labels.locked');
    if(job.paymentStatus&&status(job).paymentStatus!=='pending')return fail(409,'labels.expired');
    if(job.attempts.length&&(!bucket.policy.reprintAllowed||typeof input.reason!=='string'||input.reason.trim().length<5))return fail(403,'labels.reprint');
    job.attempts.push({id:randomUUID(),at:clock().toISOString(),reason:String(input.reason??'').slice(0,500),status:'requested'});
   }result=status(job);
  }
  bucket.receipts[receiptKey]={hash:hash(input),body:structuredClone(result)};all[scope]=bucket;write(all);return {status:200,body:result};
 }};
}
