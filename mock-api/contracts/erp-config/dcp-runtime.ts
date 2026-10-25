/** The supplied DCP v1 wire contract. This is separate from tenant authoring metadata. */
export const DCP_RUNTIME_TYPES=['TEXT','INTEGER','DECIMAL','BOOLEAN','DATE','DATETIME','CHOICE','COLLECTION'] as const;
export type DcpRuntimeType=typeof DCP_RUNTIME_TYPES[number];
export type DcpValue=string|number|boolean|null|DcpRow[];
export interface DcpRow {[key:string]:DcpValue|undefined;_id?:string;_delete?:boolean}
export interface DcpRuntimeField {code:string;label:string;type:DcpRuntimeType;required:boolean;writable:boolean;masked:boolean;maxLength:number;minimum:number|null;maximum:number|null;options:{code:string;label:string}[];children:DcpRuntimeField[];maxItems:number}
export interface DcpRuntimeView {contractVersion:1;label:string;definitionVersion:number;checksum:string;sections:{code:string;label:string;fields:DcpRuntimeField[]}[];values:Record<string,DcpValue>;violations:{path:string;code:string;message:string}[];rowFields:Record<string,DcpRuntimeField[]>}
export interface DcpLoaded {version:string;mode:'LIVE'|'PINNED';view:DcpRuntimeView}
export interface DcpSaved {version:string;view:DcpRuntimeView;changedPaths:string[]}
export interface DcpSave {expectedVersion:string;checksum:string;mode:'LIVE'|'PINNED';patch:Record<string,DcpValue>}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=10000):v is string=>typeof v==='string'&&v.length<=max;
const key=(v:unknown):v is string=>text(v,100)&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
export const isDcpRevision=(v:unknown):v is string=>typeof v==='string'&&/^(?:-1|0|[1-9]\d{0,18})$/.test(v)&&BigInt(v)<=9223372036854775807n;
/** v1 cannot carry lossless arbitrary decimals. Reject numeric precision outside its browser profile. */
export const isDcpNumber=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&(!Number.isInteger(v)||Number.isSafeInteger(v))&&String(v).split(/[eE]/)[0].replace(/[-.]/g,'').replace(/^0+/,'').length<=15;
function fields(v:unknown,depth=0,budget={n:0}):v is DcpRuntimeField[]{
 if(!Array.isArray(v)||v.length>100||depth>5)return false;const ids=new Set();
 return v.every(f=>{if(!obj(f)||Object.keys(f).some(k=>!['code','label','type','required','writable','masked','maxLength','minimum','maximum','options','children','maxItems'].includes(k))||!key(f.code)||ids.has(f.code)||++budget.n>1000)return false;ids.add(f.code);
 return text(f.label,160)&&DCP_RUNTIME_TYPES.includes(f.type as DcpRuntimeType)&&['required','writable','masked'].every(k=>typeof f[k]==='boolean')&&Number.isInteger(f.maxLength)&&Number(f.maxLength)>=0&&Number(f.maxLength)<=10000&&Number.isInteger(f.maxItems)&&Number(f.maxItems)>=0&&Number(f.maxItems)<=1000&&(f.minimum===null||isDcpNumber(f.minimum))&&(f.maximum===null||isDcpNumber(f.maximum))&&Array.isArray(f.options)&&f.options.length<=1000&&f.options.every(o=>obj(o)&&text(o.code,100)&&text(o.label,160))&&new Set(f.options.map(o=>o.code)).size===f.options.length&&fields(f.children,depth+1,budget)&&(f.type==='COLLECTION'||f.children.length===0);
 });
}
export function isDcpValues(v:unknown,depth=0,budget={n:0}):v is Record<string,DcpValue>{
 if(!obj(v)||Object.keys(v).length>100||depth>5)return false;
 if(v._id!==undefined&&(!text(v._id,100)||!v._id||/[\[\].]/.test(v._id)))return false;
 if(v._delete!==undefined&&typeof v._delete!=='boolean')return false;
 return Object.entries(v).every(([k,x])=>++budget.n<=10000&&(key(k)||k==='_id'||k==='_delete')&&(x===null||typeof x==='boolean'||text(x)||isDcpNumber(x)||Array.isArray(x)&&x.length<=1000&&x.every(r=>isDcpValues(r,depth+1,budget))));
}
export function isDcpRuntimeView(v:unknown):v is DcpRuntimeView{
 if(!obj(v)||Object.keys(v).some(k=>!['contractVersion','label','definitionVersion','checksum','sections','values','violations','rowFields'].includes(k))||v.contractVersion!==1||!text(v.label,160)||!Number.isSafeInteger(v.definitionVersion)||Number(v.definitionVersion)<1||!text(v.checksum,128)||!v.checksum||!Array.isArray(v.sections)||v.sections.length>20||!isDcpValues(v.values)||!Array.isArray(v.violations)||v.violations.length>1000||!obj(v.rowFields)||Object.keys(v.rowFields).length>1000)return false;
 const all=new Set(),sections=new Set(),budget={n:0};
 if(!v.sections.every(s=>{if(!obj(s)||!key(s.code)||sections.has(s.code)||!text(s.label,160)||!fields(s.fields,0,budget))return false;sections.add(s.code);return s.fields.every(f=>{if(all.has(f.code))return false;all.add(f.code);return true;});}))return false;
 return v.violations.every(e=>obj(e)&&text(e.path,600)&&text(e.code,100)&&text(e.message,2000))&&Object.entries(v.rowFields).every(([path,fs])=>text(path,600)&&fields(fs));
}
export const isDcpLoaded=(v:unknown):v is DcpLoaded=>obj(v)&&isDcpRevision(v.version)&&['LIVE','PINNED'].includes(String(v.mode))&&isDcpRuntimeView(v.view);
export const isDcpSaved=(v:unknown):v is DcpSaved=>obj(v)&&isDcpRevision(v.version)&&isDcpRuntimeView(v.view)&&Array.isArray(v.changedPaths)&&v.changedPaths.length<=1000&&v.changedPaths.every(p=>text(p,600));
/** Only changed, currently writable values become patches. Hidden values are never cleared implicitly. */
export function dcpWritablePatch(view:DcpRuntimeView,patch:Record<string,DcpValue>):Record<string,DcpValue>{
 function clean(fs:DcpRuntimeField[],data:Record<string,DcpValue|undefined>,source:Record<string,DcpValue|undefined>,prefix=''):Record<string,DcpValue>{
  const out:Record<string,DcpValue>={};for(const f of fs){if(!f.writable||f.masked||data[f.code]===undefined)continue;const value=data[f.code]!;
   if(f.type!=='COLLECTION'){out[f.code]=value;continue;}if(value===null){out[f.code]=null;continue;}if(!Array.isArray(value))continue;
   const rows=Array.isArray(source[f.code])?source[f.code] as DcpRow[]:[];
   out[f.code]=value.flatMap(r=>{const old=r._id?rows.find(x=>x._id===r._id):undefined;if(r._id&&!old)return [];const path=prefix+f.code+'['+r._id+']';
    // Existing rows must use the server's per-row authorized fields; absent metadata fails closed.
    const allowed=old?view.rowFields[path]:f.children;if(!allowed)return [];
    if(r._delete)return r._id?[{_id:r._id,_delete:true}]:[];
    const values=clean(allowed,r,old??{},path+'.');return [{...(r._id?{_id:r._id}:{}),...values}];
   });
  }return out;
 }return clean(view.sections.flatMap(s=>s.fields),patch,view.values);
}
