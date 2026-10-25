import {readFileSync} from 'node:fs';import {randomUUID,createHash} from 'node:crypto';import {parseCsv,writeCsvSnapshot} from './clinical-template-csv.ts';
const base=JSON.parse(readFileSync(new URL('./config/identity-devices/devices.json',import.meta.url),'utf8'));const [h,...rows]=parseCsv(readFileSync(new URL('./config/identity-devices/patients.csv',import.meta.url),'utf8'));const patients=rows.map(r=>Object.fromEntries(h.map((v,i)=>[v,r[i]])));
const fail=(status,error)=>({status,body:{error}}),ok=body=>({status:200,body});const id=x=>typeof x==='string'&&/^[\w.-]{1,100}$/.test(x);const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function createIdentityStore(file,clock=()=>new Date()){
 function read(){try{const [h,...rows]=parseCsv(readFileSync(file,'utf8'));if(h.join(',')!=='scope,data')throw Error('Invalid identity store');return Object.fromEntries(rows.map(([k,v])=>[k,JSON.parse(v)]));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
 function write(all){const cell=v=>'"'+String(v).replaceAll('"','""')+'"';writeCsvSnapshot(file,'scope,data\n'+Object.entries(all).map(([k,v])=>cell(k)+','+cell(JSON.stringify(v))).join('\n')+'\n');}
 const status=a=>a.status==='pending'&&a.expiresAt<=clock().toISOString()?{...a,status:'expired'}:a;
 return {handle(user,product,input,admin=false){
 if(!user?.id||!user.tenantId)return fail(403,'identity.denied');
 // Reject unexpected capture fields: no image, fingerprint, template or arbitrary document input is accepted.
 const keys=['action','stationId','operationId','patientId','deviceId','consent','attemptId','scenarioId','policy'];
 if(!input||!id(input.stationId)||Object.keys(input).some(k=>!keys.includes(k)))return fail(400,'identity.invalid');
 const all=read(),scope=JSON.stringify([user.tenantId,product]),b=all[scope]??{attempts:[],receipts:{},preferences:{},policy:structuredClone(base.policy)};
 const own=a=>a.owner===user.id&&a.stationId===input.stationId,pref=JSON.stringify([user.id,input.stationId]),device=value=>base.devices.find(d=>d.id===value);
 if(input.action==='library')return ok({...base,patients:patients.map(({id,name,birthDate})=>({id,name,birthDate})),policy:b.policy,attempts:b.attempts.filter(own).map(status),canManage:admin,defaultDevice:b.policy.lockedDevice||b.preferences[pref]||'demo-card'});
 if(!['start','simulate','manual','cancel','preference','policy'].includes(input.action)||!id(input.operationId))return fail(400,'identity.invalid');
 if(input.action==='policy'&&!admin)return fail(403,'identity.denied');
 const receiptKey=JSON.stringify([user.id,input.stationId,input.operationId]),receipt=b.receipts[receiptKey];
 const attempt=b.attempts.find(a=>a.id===input.attemptId&&own(a));
 // Expired capture results and changed current policy are never replayed as a fresh success.
 if(attempt&&((input.patientId&&input.patientId!==attempt.patientId)||(input.deviceId&&input.deviceId!==attempt.deviceId)))return fail(409,'identity.conflict');
 if(['simulate'].includes(input.action)&&attempt){const d=device(attempt.deviceId);if(attempt.expiresAt<=clock().toISOString())return fail(409,'identity.expired');if((['face','fingerprint'].includes(d.method)&&!b.policy.biometricsEnabled)||(b.policy.lockedDevice&&b.policy.lockedDevice!==d.id))return fail(403,'identity.locked');}
 if(receipt){if(receipt.hash!==hash(input))return fail(409,'identity.conflict');return ok(input.action==='start'?status(b.attempts.find(a=>a.id===receipt.result.id)):receipt.result);}
 let result;
 if(input.action==='policy'){const p=input.policy;if(!p||p.version!==b.policy.version)return fail(409,'identity.conflict');if(typeof p.biometricsEnabled!=='boolean'||typeof p.lockedDevice!=='string'||(p.lockedDevice&&!device(p.lockedDevice)))return fail(400,'identity.invalid');b.policy={version:p.version+1,biometricsEnabled:p.biometricsEnabled,lockedDevice:p.lockedDevice};result=b.policy;}
 else if(input.action==='preference'){if(b.policy.lockedDevice)return fail(403,'identity.locked');if(!device(input.deviceId))return fail(400,'identity.invalid');b.preferences[pref]=input.deviceId;result={saved:true};}
 else if(input.action==='manual'&&!input.attemptId){
 const patient=patients.find(p=>p.id===input.patientId);if(!patient)return fail(400,'identity.invalid');
 if(b.attempts.some(a=>own(a)&&status(a).status==='pending'))return fail(409,'identity.active');
 result={id:randomUUID(),owner:user.id,patientId:patient.id,deviceId:'manual',stationId:input.stationId,expiresAt:clock().toISOString(),status:'manual-review',authenticated:false,createdAt:clock().toISOString()};b.attempts.unshift(result);
 }else if(input.action==='start'){
 const d=device(b.policy.lockedDevice||input.deviceId),patient=patients.find(p=>p.id===input.patientId);if(!d||!patient)return fail(400,'identity.invalid');
 if(input.consent!==true)return fail(400,'identity.consentRequired');
 if(['face','fingerprint'].includes(d.method)&&!b.policy.biometricsEnabled)return fail(403,'identity.locked');
 if(d.transport==='native')return fail(503,'identity.unavailable');
 const active=b.attempts.find(a=>own(a)&&status(a).status==='pending');if(active)return fail(409,'identity.active');
 result={id:randomUUID(),owner:user.id,patientId:patient.id,deviceId:d.id,stationId:input.stationId,expiresAt:new Date(clock().getTime()+120000).toISOString(),status:'pending',authenticated:false,createdAt:clock().toISOString(),consent:true};b.attempts.unshift(result);
 }else{
 if(!attempt)return fail(404,'identity.notFound');if(status(attempt).status!=='pending')return fail(409,'identity.expired');
 if(input.action==='cancel')attempt.status='cancelled';else if(input.action==='manual')attempt.status='manual-review';else{
 if(!base.scenarios.some(s=>s.id===input.scenarioId))return fail(400,'identity.invalid');const d=device(attempt.deviceId);if(input.scenarioId==='expired'&&['face','fingerprint'].includes(d.method))return fail(400,'identity.invalid');if(d.transport!=='demo')return fail(503,'identity.unavailable');
 const source=patients.find(p=>p.id===(input.scenarioId==='mismatch'?patients.find(p=>p.id!==attempt.patientId).id:attempt.patientId));
 attempt.status=input.scenarioId==='match'?'demo-match':input.scenarioId==='mismatch'?'demo-mismatch':'demo-expired-document';
 if(['card','eid','passport'].includes(d.method))attempt.document={reference:source.documentReference,name:source.name,birthDate:source.birthDate,expiry:input.scenarioId==='expired'?'2000-01-01':source.expiry};
 }result=attempt;
 }
 b.receipts[receiptKey]={hash:hash(input),result:structuredClone(result)};all[scope]=b;write(all);return ok(result);
 }};
}
