import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {parseCsv,writeCsvSnapshot} from './clinical-template-csv.ts';
const config=JSON.parse(readFileSync(new URL('./config/device-integrations/devices.json',import.meta.url),'utf8'));
const [headers,...rows]=parseCsv(readFileSync(new URL('./config/device-integrations/records.csv',import.meta.url),'utf8'));
const records=rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
const fail=(status,error)=>({status,body:{error}}),ok=body=>({status:200,body});
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const validId=x=>typeof x==='string'&&/^[\w.-]{1,100}$/.test(x);
export function createDeviceStore(file){
 function read(){try{const [h,...r]=parseCsv(readFileSync(file,'utf8'));if(h.join(',')!=='scope,data')throw Error('Invalid device store');return Object.fromEntries(r.map(([k,v])=>[k,JSON.parse(v)]));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
 function write(all){const cell=v=>'"'+String(v).replaceAll('"','""')+'"';writeCsvSnapshot(file,'scope,data\n'+Object.entries(all).map(([k,v])=>cell(k)+','+cell(JSON.stringify(v))).join('\n')+'\n');}
 return {handle(user,product,input,admin=false){
 if(!user?.id||!user.tenantId)return fail(403,'devices.denied');
 if(!input||!validId(input.stationId))return fail(400,'devices.invalid');
 const all=read(),scope=JSON.stringify([user.tenantId,product]);const b=all[scope]??{policy:structuredClone(config.policy),rules:structuredClone(config.rules),jobs:[],preferences:{},receipts:{}};
 const own=j=>j.owner===user.id&&j.stationId===input.stationId;
 const pref=JSON.stringify([user.id,input.stationId]);
 if(input.action==='library')return ok({...config,rules:b.rules,records,policy:b.policy,jobs:b.jobs.filter(own),defaultDevice:b.policy.lockedDevice||b.preferences[pref]||'browser',stationId:input.stationId,canManage:admin});
 if(input.action==='lookup'){if(typeof input.code!=='string'||input.code.length>256)return fail(400,'devices.invalid');const found=records.find(r=>r.code===input.code.trim()&&r.context===input.context);return found?ok(found):fail(404,'devices.notFound');}
 if(!['enqueue','event','dispatch','cancel','preference','policy','rule'].includes(input.action)||!validId(input.operationId))return fail(400,'devices.invalid');
 if(['policy','rule','event'].includes(input.action)&&!admin)return fail(403,'devices.denied');
 const rk=JSON.stringify([user.id,input.stationId,input.operationId]),old=b.receipts[rk];
 if(old)return old.hash===digest(input)?ok(old.result):fail(409,'devices.conflict');
 const device=id=>config.devices.find(d=>d.id===id);
 let result;
 if(input.action==='policy'){
 const p=input.policy;if(!p||p.version!==b.policy.version)return fail(409,'devices.conflict');
 if(typeof p.automatic!=='boolean'||typeof p.lockedDevice!=='string'||(p.lockedDevice&&!device(p.lockedDevice))||!Number.isInteger(p.maxCopies)||p.maxCopies<1||p.maxCopies>100)return fail(400,'devices.invalid');
 b.policy={version:p.version+1,automatic:p.automatic,lockedDevice:p.lockedDevice,maxCopies:p.maxCopies};result=b.policy;
 }else if(input.action==='rule'){
 if(input.version!==b.policy.version)return fail(409,'devices.conflict');const r=input.rule,index=b.rules.findIndex(x=>x.id===r?.id),original=b.rules[index];
 if(!original||r.event!==original.event||r.capability!==original.capability||typeof r.enabled!=='boolean'||!device(r.deviceId)?.capabilities.includes(r.capability))return fail(400,'devices.incompatible');
 b.rules[index]={...original,deviceId:r.deviceId,enabled:r.enabled};b.policy.version++;result=b.rules[index];
 }else if(input.action==='preference'){
 if(b.policy.lockedDevice)return fail(403,'devices.locked');if(!device(input.deviceId))return fail(400,'devices.invalid');b.preferences[pref]=input.deviceId;result={saved:true};
 }else if(input.action==='enqueue'||input.action==='event'){
 let target=input.deviceId,capability=input.capability,copies=input.copies;
 if(input.action==='event'){
 if(!b.policy.automatic)return fail(403,'devices.automaticOff');
 if(!validId(input.eventId))return fail(400,'devices.invalid');
 const existing=b.jobs.find(j=>own(j)&&j.eventId===input.eventId);if(existing){if(existing.event!==input.event||existing.recordId!==input.recordId)return fail(409,'devices.conflict');return ok(existing);}
 const rule=b.rules.find(r=>r.event===input.event&&r.enabled);if(!rule)return fail(400,'devices.invalid');target=rule.deviceId;capability=rule.capability;copies=1;
 }
 target=b.policy.lockedDevice||target;const d=device(target),r=records.find(r=>r.id===input.recordId);
 if(!r||!d||!['receipt','label','report','drawer'].includes(capability)||!d.capabilities.includes(capability))return fail(400,'devices.incompatible');
 if(!Number.isInteger(copies)||copies<1||copies>b.policy.maxCopies)return fail(400,'devices.invalid');
 result={id:randomUUID(),owner:user.id,stationId:input.stationId,deviceId:target,capability,recordId:r.id,eventId:input.action==='event'?input.eventId:'',event:input.event||'',status:input.action==='event'&&d.transport==='demo'?'simulated':'queued',copies,createdAt:new Date().toISOString(),title:r.title,lines:[r.code,r.context,'devices.synthetic'],attempts:input.action==='event'&&d.transport==='demo'?1:0};b.jobs.unshift(result);
 }else{
 const j=b.jobs.find(j=>j.id===input.jobId&&own(j));if(!j)return fail(404,'devices.notFound');
 if(j.status!=='queued')return fail(409,'devices.conflict');
 if(input.action==='cancel'){j.status='cancelled';result=j;}else{
 if((b.policy.lockedDevice&&b.policy.lockedDevice!==j.deviceId)||j.copies>b.policy.maxCopies)return fail(403,'devices.locked');
 const d=device(j.deviceId);if(d.transport==='native')return fail(503,'devices.unavailable');
 j.status=d.transport==='browser'?'print-requested':'simulated';j.attempts++;result=j;
 }
 }
 b.receipts[rk]={hash:digest(input),result:structuredClone(result)};all[scope]=b;write(all);return ok(result);
 }};
}
