import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const roles=['enterprise-admin','finance-manager','operations-analyst'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const defaultConfig={version:0,stages:[{name:'Finance review',roles:['finance-manager','enterprise-admin']}]};
export function createApprovalStore(file,{record}) {
 let state={configs:{},items:{},notifications:[],operations:{}};
 try{state=JSON.parse(readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const commit=next=>{mkdirSync(dirname(file),{recursive:true,mode:0o700});writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(file+'.tmp',file);state=next;};
 const failure=(status,error)=>({status,body:{error}});
 return {handle(user,body){
  if(!body||!Array.isArray(body.scope)||body.scope.length!==2||body.scope.some(s=>typeof s!=='string'||!s||s.length>100)||body.scope[1]!=='customer-master')return failure(400,'Choose a supported product and page.');
  const scope=JSON.stringify([user.tenantId,...body.scope]);
  const key=id=>JSON.stringify([scope,id]);
  const visible=item=>item.scope===scope&&(item.requesterId===user.id||user.role==='enterprise-admin'||item.stages.some(stage=>stage.roles.includes(user.role)));
  const canAct=item=>item.status==='pending'&&item.requesterId!==user.id&&item.stages[item.stage].roles.includes(user.role);
  const read=()=>({config:state.configs[scope]??defaultConfig,canConfigure:user.role==='enterprise-admin',items:Object.values(state.items).filter(visible).filter(item=>!body.recordId||item.recordId===body.recordId).map(item=>{const current=record(user,...body.scope,item.recordId),recordChanged=!current||hash(current)!==item.snapshot;return {...item,recordChanged,canAct:canAct(item)&&!recordChanged,canSubmit:item.requesterId===user.id};}),notifications:state.notifications.filter(n=>n.scope===scope&&n.recipientId===user.id).slice(-100).reverse()});
  if(body.action==='read')return {status:200,body:read()};
  if(!roles.includes(user.role))return failure(403,'Your role cannot use approvals.');
  if(typeof body.operationId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(body.operationId))return failure(400,'An operation identifier is required.');
  const operationKey=JSON.stringify([scope,user.id,body.operationId]),fingerprint=hash(body);
  const prior=state.operations[operationKey];if(prior)return prior.fingerprint===fingerprint?{status:200,body:{...read(),results:prior.results}}:failure(409,'This operation identifier was already used.');
  const next=structuredClone(state);let results=[];
  const event=(item,action,comment)=>{item.history.push({id:randomUUID(),action,comment,actor:user.name??user.username??user.id,actorId:user.id,at:new Date().toISOString(),stage:item.stages[item.stage]?.name??''});};
  const notify=(item,message)=>next.notifications.push({id:randomUUID(),scope,recipientId:item.requesterId,recordId:item.recordId,message,read:false,at:new Date().toISOString()});
  if(body.action==='configure'){
   if(user.role!=='enterprise-admin')return failure(403,'Only administrators can configure approval stages.');
   const config=next.configs[scope]??defaultConfig;if(body.version!==config.version)return failure(409,'Configuration changed. Refresh before saving.');
   if(!Array.isArray(body.stages)||body.stages.length<1||body.stages.length>5||body.stages.some(s=>!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||!Array.isArray(s.roles)||!s.roles.length||s.roles.some(r=>!roles.includes(r))||new Set(s.roles).size!==s.roles.length))return failure(422,'Use 1–5 named stages with at least one supported approver role.');
   next.configs[scope]={version:config.version+1,stages:body.stages.map(s=>({name:s.name.trim(),roles:s.roles}))};
  }else if(body.action==='submit'){
   if(typeof body.recordId!=='string'||!body.recordId||body.recordId.length>200)return failure(400,'Select a saved record.');
   const current=record(user,...body.scope,body.recordId);if(!current)return failure(404,'Save or select an existing record first.');
   const old=next.items[key(body.recordId)];if(body.version!==(old?.version??0))return failure(409,'Approval changed. Refresh before submitting.');
   if(old&&old.requesterId!==user.id)return failure(403,'Only the requester can resubmit this record.');
   const snapshot=hash(current);
   if(old&&old.snapshot===snapshot&&['pending','approved'].includes(old.status))return failure(409,'This saved version is already pending or approved.');
   if(typeof body.comment!=='string'||!body.comment.trim()||body.comment.length>4000)return failure(422,'Add a submission comment (up to 4000 characters).');
   const item={scope,recordId:body.recordId,requesterId:user.id,requester:user.name??user.username??user.id,version:(old?.version??0)+1,status:'pending',stage:0,stages:structuredClone((next.configs[scope]??defaultConfig).stages),snapshot,history:old?.history??[]};
   event(item,old?'resubmitted':'submitted',body.comment.trim());next.items[key(body.recordId)]=item;notify(item,'Submitted for '+item.stages[0].name);
  }else if(body.action==='decide'){
   if(!['approve','reject','request-changes'].includes(body.decision)||typeof body.comment!=='string'||!body.comment.trim()||body.comment.length>4000||!Array.isArray(body.items)||!body.items.length||body.items.length>100||body.items.some(i=>!i||typeof i.recordId!=='string'||!Number.isInteger(i.version))||new Set(body.items.map(i=>i.recordId)).size!==body.items.length)return failure(422,'Choose 1–100 distinct records and add a decision comment.');
   results=body.items.map(selection=>{
    const item=next.items[key(selection.recordId)];const fail=error=>({recordId:selection.recordId,ok:false,error});
    if(!item||!visible(item))return fail('Approval unavailable.');
    if(item.version!==selection.version)return fail('Approval changed. Refresh and review again.');
    if(!canAct(item))return fail('Your role cannot decide this stage, or you are the requester.');
    const current=record(user,...body.scope,item.recordId);if(!current||hash(current)!==item.snapshot)return fail('Saved record changed. Ask the requester to resubmit it.');
    event(item,body.decision,body.comment.trim());item.version++;
    if(body.decision==='approve'){if(item.stage+1<item.stages.length)item.stage++;else item.status='approved';}
    else item.status=body.decision==='reject'?'rejected':'changes-requested';
    notify(item,body.decision==='approve'?(item.status==='approved'?'Approved':'Advanced to '+item.stages[item.stage].name):body.decision==='reject'?'Rejected':'Changes requested');
    return {recordId:item.recordId,ok:true};
   });
  }else if(body.action==='mark-read'){
   if(!Array.isArray(body.ids)||body.ids.length>100)return failure(400,'Choose up to 100 notifications.');
   for(const n of next.notifications)if(n.scope===scope&&n.recipientId===user.id&&body.ids.includes(n.id))n.read=true;
  }else return failure(400,'Unknown approval action.');
  next.operations[operationKey]={fingerprint,results};commit(next);return {status:200,body:{...read(),results}};
 }};
}
