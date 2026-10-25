import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export function createRecordPanelsStore(file) {
 let state={};try{state=JSON.parse(readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const fail=(status,error)=>({status,body:{error}});
 return {handle(user,body){
  const {scope,action}=body??{};
  if(!Array.isArray(scope)||scope.length!==3||scope.some(v=>typeof v!=='string'||!v||v.length>200))return fail(400,'A product, page and saved record are required.');
  const key=JSON.stringify([user.tenantId,...scope]);
  const current=state[key]??{attachments:[],comments:[],related:[],activity:[],operations:[]};
  const publicData=data=>({...data,permissions:{write:["enterprise-admin","finance-manager"].includes(user.role)},attachments:data.attachments.map(({content,...meta})=>meta),operations:undefined});
  if(action==='list')return {status:200,body:publicData(current)};
  if(action==='download'){
   const item=current.attachments.find(v=>v.id===body.id);return item?{status:200,body:item}:fail(404,'Attachment is no longer available.');
  }
  if(!['enterprise-admin','finance-manager'].includes(user.role))return fail(403,'Your role cannot change record panels.');
  if(typeof body.operationId!=='string'||body.operationId.length<8||body.operationId.length>100)return fail(400,'An operation identifier is required.');
  const fingerprint=createHash("sha256").update(JSON.stringify({...body,operationId:undefined})).digest("hex");
  const previous=current.operations.find(v=>v.id===body.operationId);
  if(previous)return previous.fingerprint===fingerprint?{status:200,body:publicData(current)}:fail(409,'Operation identifier was already used for another change.');
  const next=structuredClone(current),now=new Date().toISOString();let detail;
  const meta={id:randomUUID(),authorId:user.id,author:user.name??user.id,createdAt:now};
  if(action==='comment'){
   if(typeof body.text!=='string'||!body.text.trim()||body.text.length>4000)return fail(400,'Enter a comment of 1–4000 characters.');
   if(next.comments.length>=200)return fail(400,'This demo supports 200 comments per record.');
   next.comments.push({...meta,text:body.text.trim()});detail='Added a comment';
  }else if(action==='upload'){
   if(typeof body.name!=='string'||!body.name.trim()||body.name.length>200||typeof body.content!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.content))return fail(400,'Invalid attachment.');
   const size=Buffer.from(body.content,'base64').length;
   if(!size||size>2*1024*1024)return fail(413,'Choose a file between 1 byte and 2 MB.');
   if(next.attachments.length>=20)return fail(400,'This demo supports 20 attachments per record.');
   next.attachments.push({...meta,name:body.name.replace(/[\r\n\\/]/g,'_'),size,content:body.content});detail='Added an attachment';
  }else if(action==='link'){
   if(typeof body.pageId!=='string'||!body.pageId||body.pageId.length>100||typeof body.recordId!=='string'||!body.recordId.trim()||body.recordId.length>200||typeof body.label!=='string'||!body.label.trim()||body.label.length>200)return fail(400,'Choose a page, record ID and label.');
   if(body.pageId===scope[1]&&body.recordId===scope[2])return fail(400,'A record cannot link to itself.');
   if(next.related.some(v=>v.pageId===body.pageId&&v.recordId===body.recordId))return fail(409,'This record is already linked.');
   if(next.related.length>=100)return fail(400,'This demo supports 100 links per record.');
   next.related.push({...meta,pageId:body.pageId,recordId:body.recordId.trim(),label:body.label.trim()});detail='Linked a related record';
  }else if(action==='remove'){
   if(!['attachments','comments','related'].includes(body.collection))return fail(400,'Unknown record panel.');
   const item=next[body.collection].find(v=>v.id===body.id);
   if(!item)return fail(409,'This item has already been removed. Refresh the panel.');
   if(body.collection==='comments'&&item.authorId!==user.id&&user.role!=='enterprise-admin')return fail(403,'Only the author or an administrator can remove this comment.');
   next[body.collection]=next[body.collection].filter(v=>v.id!==body.id);detail=`Removed an item from ${body.collection}`;
  }else return fail(400,'Unknown panel operation.');
  next.activity.unshift({...meta,id:randomUUID(),detail});
  next.operations.push({id:body.operationId,fingerprint});
  next.operations=next.operations.slice(-500);next.activity=next.activity.slice(0,500);
  const updated={...state,[key]:next};
  mkdirSync(dirname(file),{recursive:true,mode:0o700});writeFileSync(file+'.tmp',JSON.stringify(updated),{mode:0o600});renameSync(file+'.tmp',file);state=updated;
  return {status:200,body:publicData(next)};
 }};
}
