/** Owner-only metadata projection; draft values never leave the store via this API. */
export function createDraftCenter({records,policy,access,context=()=>undefined,labels=()=>({}),now=()=>Date.now()}) {
 const failure=(status,error)=>({status,body:{error}});
 function project(user,product,row){
  let logical;try{logical=JSON.parse(row.key)[1];}catch{return null;}
  let kind,pageId,recordId;
  if(logical.startsWith('$draft:')){
   const match=logical.match(/^\$draft:(import|approval|dcp):(.*)$/);if(!match)return null;
   kind=match[1];try{[pageId,recordId]=JSON.parse(match[2]);}catch{return null;}
  }else{const match=logical.match(/^(form|billing|consultation):([^:]+):(.+)$/);if(!match)return null;kind='form';pageId=match[2];recordId=match[3];}
  if(typeof pageId!=='string'||typeof recordId!=='string')return null;
  const allowed=access(user,product,{kind,pageId,recordId});
  const current=allowed&&kind==='approval'?context(user,product,pageId,recordId):undefined;
  const outdated=row.schemaVersion!==1||(kind==='form'?row.baseVersion!==row.recordVersion:row.payloadVersion!==1)||(current!==undefined&&row.context!==current);
  return {id:row.id,productId:product,kind,version:row.version,savedAt:row.savedAt,expiresAt:new Date(Date.parse(row.savedAt)+policy(user,product).retentionDays*86400000).toISOString(),status:!allowed?'unavailable':outdated?'outdated':kind==='import'?'file-required':'ready',pageId:allowed?pageId:null,recordId:allowed?recordId:null};
 }
 return {handle(user,product,input){
  if(!input||!['list','open','discard'].includes(input.action))return failure(400,'Invalid draft request.');
  const rows=records.draftIndex(user,product);
  if(input.action==='list'){
   if((input.query!==undefined&&(typeof input.query!=='string'||input.query.length>200))||(input.kind&&!['form','import','approval','dcp'].includes(input.kind))||(input.status&&!['ready','outdated','unavailable','file-required'].includes(input.status))||!Number.isSafeInteger(input.offset??0)||(input.offset??0)<0)return failure(400,'Invalid draft request.');
   if(input.language&&!['en','ar','hi','ml'].includes(input.language))return failure(400,'Invalid draft request.');
   const pageLabels=labels(user,product,input.language??'en');
   const q=(input.query??'').trim().toLowerCase(),offset=input.offset??0;
   const all=rows.map(row=>project(user,product,row)).filter(Boolean).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||a.id.localeCompare(b.id));
   const filtered=all.filter(row=>(!input.kind||row.kind===input.kind)&&(!input.status||row.status===input.status)&&(!q||`${row.pageId??''} ${row.recordId??''} ${row.pageId?pageLabels[row.pageId]??'':''}`.toLowerCase().includes(q)));
   const start=Math.min(offset,Math.max(0,Math.floor((filtered.length-1)/25)*25));
   return {status:200,body:{items:filtered.slice(start,start+25),total:filtered.length,offset:start,policy:policy(user,product),counts:{all:all.length,outdated:all.filter(r=>r.status==='outdated').length,unavailable:all.filter(r=>r.status==='unavailable').length},serverTime:new Date(now()).toISOString()}};
  }
  if(typeof input.id!=='string'||!/^[a-f0-9]{64}$/.test(input.id)||!Number.isSafeInteger(input.version)||input.version<1)return failure(400,'Invalid draft request.');
  const row=rows.find(row=>row.id===input.id);if(!row){const key=input.action==='discard'?records.draftKey(user,product,input.id):null;return key?records.handle(user,key,'discard',{version:input.version,operationId:input.operationId}):failure(404,'Draft is no longer available.');}
  if(row.version!==input.version)return failure(409,'Draft changed. Refresh the recovery center.');
  const item=project(user,product,row);if(!item)return failure(404,'Draft is no longer available.');
  if(input.action==='open')return item.status==='unavailable'?failure(403,'Draft page is not available.'):{status:200,body:{item}};
  return records.handle(user,row.key,'discard',{version:input.version,operationId:input.operationId});
 }};
}
