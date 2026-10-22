import {parseDraftPolicy,type DraftPolicy} from './draft-policy';
import {RecordRequestFailure} from './records';
export interface DraftScope {productId:string;pageId:string;recordId:string;kind:'import'|'approval'|'dcp'}
export interface DraftPayload<T> {schemaVersion:number;context:string;data:T}
export interface SharedDraft<T> {values:DraftPayload<T>;version:number;savedAt:string;excludedFields?:string[];disabled?:boolean}
export interface SharedDraftBundle<T> {draft:SharedDraft<T>|null;draftVersion:number;draftPolicy:DraftPolicy}
export interface DraftAdapter {
 load<T>(scope:DraftScope):Promise<SharedDraftBundle<T>>;
 save<T>(scope:DraftScope,values:DraftPayload<T>,version:number,operationId:string):Promise<SharedDraft<T>>;
 discard(scope:DraftScope,version:number,operationId:string):Promise<void>;
}
export function createHttpDraftAdapter(request:(path:string,init?:RequestInit)=>Promise<Response>):DraftAdapter {
 async function call(scope:DraftScope,action:string,body={}){
  const {productId,...target}=scope;
  const response=await request('/drafts',{method:'POST',headers:{'Content-Type':'application/json','X-Product-Id':productId},body:JSON.stringify({...target,action,...body})});
  if(!response.ok)throw new RecordRequestFailure(response.status,response.headers.get('X-Sentinel-Reference')??undefined);
  if(response.status===204)return;
  const value=await response.json();
  const snapshot=(d:any)=>d&&Number.isSafeInteger(d.version)&&d.version>=0&&Number.isFinite(Date.parse(d.savedAt))&&(d.disabled||d.values&&typeof d.values.context==='string'&&typeof d.values.schemaVersion==='number'&&d.values.data&&typeof d.values.data==='object');
  if(action==='load'?(!value||!Number.isSafeInteger(value.draftVersion)||value.draftVersion<0||!value.draftPolicy||(value.draft!==null&&!snapshot(value.draft))):!snapshot(value))throw new RecordRequestFailure(502);
  return value;
 }
 return {load:scope=>call(scope,'load'),save:(scope,values,version,operationId)=>call(scope,'draft',{values,version,operationId}),discard:(scope,version,operationId)=>call(scope,'discard',{version,operationId})};
}
/** Contexts are hashes, never raw headers, record values or approval histories. */
export async function draftContext(value:unknown):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export interface DraftCenterItem {id:string;productId:string;kind:'form'|'import'|'approval'|'dcp';version:number;savedAt:string;expiresAt:string;status:'ready'|'outdated'|'unavailable'|'file-required';pageId:string|null;recordId:string|null}
export interface DraftCenterQuery {language?:string;query?:string;kind?:string;status?:string;offset?:number}
export interface DraftCenterData {items:DraftCenterItem[];total:number;offset:number;policy:DraftPolicy;counts:{all:number;outdated:number;unavailable:number};serverTime:string}
export interface DraftCenterAdapter {list(productId:string,query:DraftCenterQuery):Promise<DraftCenterData>;open(productId:string,item:DraftCenterItem):Promise<DraftCenterItem>;discard(productId:string,item:DraftCenterItem,operationId:string):Promise<void>}
export function createHttpDraftCenterAdapter(request:(path:string,init?:RequestInit)=>Promise<Response>):DraftCenterAdapter {
 const call=async(productId:string,body:object)=>{
  const r=await request('/draft-center',{method:'POST',headers:{'Content-Type':'application/json','X-Product-Id':productId},body:JSON.stringify(body)});
  if(!r.ok)throw new RecordRequestFailure(r.status,r.headers.get('X-Sentinel-Reference')??undefined);
  return r.status===204?undefined:r.json();
 };
 const validItem=(item:any,productId:string)=>item&&/^[a-f0-9]{64}$/.test(item.id)&&item.productId===productId&&['form','import','approval','dcp'].includes(item.kind)&&['ready','outdated','unavailable','file-required'].includes(item.status)&&Number.isSafeInteger(item.version)&&item.version>0&&Number.isFinite(Date.parse(item.savedAt))&&Number.isFinite(Date.parse(item.expiresAt))&&(item.status==='unavailable'?item.pageId===null&&item.recordId===null:typeof item.pageId==='string'&&!!item.pageId&&typeof item.recordId==='string'&&!!item.recordId);
 return {
  list:async(productId,query)=>{
   const value=await call(productId,{...query,action:'list'});
   if(!value||!Array.isArray(value.items)||value.items.length>25||value.items.some((item:unknown)=>!validItem(item,productId))||!Number.isSafeInteger(value.total)||value.total<0||!Number.isSafeInteger(value.offset)||value.offset<0||!value.counts||Object.values(value.counts).some(n=>!Number.isSafeInteger(n)||Number(n)<0)||!Number.isFinite(Date.parse(value.serverTime)))throw new RecordRequestFailure(502);
   try{value.policy=parseDraftPolicy(value.policy);}catch{throw new RecordRequestFailure(502);}return value;
  },
  open:async(productId,item)=>{const value=await call(productId,{action:'open',id:item.id,version:item.version});if(!validItem(value?.item,productId)||value.item.status==='unavailable'||value.item.id!==item.id)throw new RecordRequestFailure(502);return value.item;},
  discard:(productId,item,operationId)=>call(productId,{action:'discard',id:item.id,version:item.version,operationId}),
 };
}
