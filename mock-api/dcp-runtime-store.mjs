import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {isDcpRevision,isDcpValues,isDcpNumber,dcpWritablePatch} from '../desktop-clients/packages/erp-config/src/dcp-runtime.ts';
const seed=JSON.parse(readFileSync(new URL('./config/dcp-designer/runtime-v1.json',import.meta.url),'utf8'));
export const runtimeActions=['backend-load','backend-preview','backend-save'];
/** Synthetic adapter only. Server expressions and product permissions require the real host engine. */
export function applyRuntimeDemo(bucket,input){
 const current=bucket.runtimeV1??structuredClone(seed);
 if(input.action==='backend-load')return {status:200,body:current};
 const cmd=input.command;
 if(!cmd||!isDcpRevision(cmd.expectedVersion)||!isDcpValues(cmd.patch)||!['PINNED','LIVE'].includes(cmd.mode))return {status:400,body:{code:'INVALID'}};
 if(cmd.expectedVersion!==current.version||cmd.checksum!==current.view.checksum)return {status:409,body:{code:'CONFLICT'}};
 const safe=dcpWritablePatch(current.view,cmd.patch);
 if(JSON.stringify(safe)!==JSON.stringify(cmd.patch))return {status:403,body:{code:'FORBIDDEN'}};
 const view=structuredClone(current.view),violations=[];
 function apply(fields,target,patch,prefix=''){
  for(const f of fields){const path=prefix+f.code;let value=patch[f.code];
   if(value!==undefined){if(f.type==='COLLECTION'&&Array.isArray(value)){
    const existing=Array.isArray(target[f.code])?target[f.code]:[];let rows=structuredClone(existing);
    for(const r of value){if(r._delete){rows=rows.filter(x=>x._id!==r._id);continue;}const row=r._id?rows.find(x=>x._id===r._id):{_id:'row-'+randomUUID()};if(!row){violations.push({path,code:'INVALID',message:'Unknown row'});continue;}
     const rowPath=path+'['+row._id+']';apply(f.children,row,r,rowPath+'.');if(!r._id)rows.push(row);view.rowFields[rowPath]=f.children;
    }value=rows;
   }else if(f.type==='TEXT'&&typeof value==='string')value=value.trim();target[f.code]=value;}
   value=target[f.code];let code='';if(f.required&&(value===undefined||value===null||value===''))code='REQUIRED';
   if(value!==undefined&&value!==null){
    if(f.type==='TEXT'&&(typeof value!=='string'||Array.from(value).length>f.maxLength))code='TYPE';
    if(f.type==='INTEGER'&&(!isDcpNumber(value)||!Number.isInteger(value))||f.type==='DECIMAL'&&!isDcpNumber(value))code='TYPE';
    if((f.type==='INTEGER'||f.type==='DECIMAL')&&typeof value==='number'){if(f.minimum!==null&&value<f.minimum)code='MINIMUM';if(f.maximum!==null&&value>f.maximum)code='MAXIMUM';}
    if(f.type==='BOOLEAN'&&typeof value!=='boolean')code='TYPE';
    if(f.type==='DATE'&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))code='TYPE';
    if(f.type==='DATETIME'&&(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)||Number.isNaN(Date.parse(value))))code='TYPE';
    if(f.type==='CHOICE'&&!f.options.some(o=>o.code===value))code='CHOICE';
    if(f.type==='COLLECTION'&&(!Array.isArray(value)||value.length>f.maxItems))code='TYPE';
   }
   if(code)violations.push({path,code,message:'Synthetic validation failure'});
  }
 }
 apply(view.sections.flatMap(s=>s.fields),view.values,safe);view.violations=violations;
 const save=input.action==='backend-save'&&!violations.length;
 const version=save&&Object.keys(safe).length?(BigInt(current.version)+1n).toString():current.version;
 if(save)bucket.runtimeV1={version,mode:cmd.mode,view};
 return {status:violations.length?422:200,body:{version,view,changedPaths:violations.length?[]:Object.keys(safe)},persist:save};
}
