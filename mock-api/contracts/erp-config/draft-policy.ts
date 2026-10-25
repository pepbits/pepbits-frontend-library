/** Server storage only. Tenant rules are mandatory, never personal overrides. */
export interface DraftPolicy {revision:number;enabled:boolean;retentionDays:number;excludedFields:string[]}
export const DEFAULT_DRAFT_POLICY:DraftPolicy={revision:0,enabled:true,retentionDays:7,excludedFields:[]};
export const PROTECTED_DRAFT_FIELDS=['password','passwordConfirmation','token','accessToken','refreshToken','secret','apiKey','ssn','nationalId','cardNumber','cvv'];
export function parseDraftPolicy(input:unknown):DraftPolicy {
 const p=input as DraftPolicy;
 if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['revision','enabled','retentionDays','excludedFields'].includes(k))||!Number.isSafeInteger(p.revision)||p.revision<0||typeof p.enabled!=='boolean'||!Number.isInteger(p.retentionDays)||p.retentionDays<1||p.retentionDays>30||!Array.isArray(p.excludedFields)||p.excludedFields.length>100||p.excludedFields.some(k=>typeof k!=='string'||!/^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(k)))throw new Error('Invalid draft policy.');
 return {...p,excludedFields:[...new Set(p.excludedFields)]};
}
/** Field names match at any depth; dotted paths address a particular nested field.
 * Array indices are omitted so lines.secret excludes the field in every line. */
export function filterDraftValues<T>(values:T,policy:DraftPolicy):{values:T;excludedFields:string[]} {
 const names=new Set([...PROTECTED_DRAFT_FIELDS,...policy.excludedFields].map(k=>k.toLowerCase()));const removed=new Set<string>();
 function visit(value:unknown,path:string[]):unknown {
  if(Array.isArray(value))return value.map(v=>visit(v,path));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>{
   const exclude=['__proto__','constructor','prototype'].includes(key)||names.has(key.toLowerCase())||names.has([...path,key].join('.').toLowerCase());if(exclude)removed.add([...path,key].join('.'));return !exclude;
  }).map(([key,v])=>[key,visit(v,[...path,key])]));
  return value;
 }
 return {values:visit(policy.enabled?values:{} ,[]) as T,excludedFields:[...removed]};
}
/** Restore omitted fields from the current saved record (or the editor defaults). */
export function mergeDraftValues<T>(baseline:T,partial:unknown):T {
 if(Array.isArray(partial))return partial.map((value,i)=>mergeDraftValues(Array.isArray(baseline)?baseline[i]??baseline[0]:undefined,value)) as T;
 if(partial&&typeof partial==='object')return {...(baseline&&typeof baseline==='object'?baseline:{}),...Object.fromEntries(Object.entries(partial).filter(([key])=>!['__proto__','constructor','prototype'].includes(key)).map(([key,value])=>[key,mergeDraftValues((baseline as any)?.[key],value)]))} as T;
 return partial as T;
}
