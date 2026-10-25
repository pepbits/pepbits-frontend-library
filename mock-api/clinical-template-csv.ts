import {readFileSync,writeFileSync,mkdirSync,renameSync,openSync,fsyncSync,closeSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {PatientRecord,PatientCareRow,PatientSavedSearch} from '../desktop-clients/packages/erp-config/src/clinical-templates.ts';
export type ClinicalBucket={records:PatientRecord[];care:Record<string,PatientCareRow[]>;searches:Record<string,PatientSavedSearch[]>;receipts:Record<string,{hash:string;result:{status:number;body:unknown}}> ;exports:Array<{userId:string;at:string;count:number}>};
export type ClinicalData=Record<string,ClinicalBucket>;
/** RFC 4180 quoting, including commas, embedded quotes and multiline cells. */
export function parseCsv(source:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 source=source.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('Invalid CSV quote');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){rows.push(row);row=[];if(c==='\r'&&source[i+1]==='\n')i++;}}
  else {if(closed)throw Error('Invalid text after CSV quote');cell+=c;}
 }
 if(quoted)throw Error('Unterminated CSV cell');
 if(cell||row.length||closed){row.push(cell);rows.push(row);}
 return rows;
}
export function encodeClinicalCsv(data:ClinicalData):string {
 const rows:Record<string,string>[]=[];
 for(const [scope,bucket] of Object.entries(data)){
  const [tenant,application]=JSON.parse(scope) as string[];
  const add=(entity:string,owner:string,id:string,fields:Record<string,string>)=>rows.push({tenant,application,entity,owner,id,...fields});
  add('scope','','',{});
  for(const record of bucket.records){
   const fields:Record<string,string>={mrn:record.mrn,internalCode:record.internalCode,version:String(record.version),collections:JSON.stringify(record.collections),activity:JSON.stringify(record.activity)};
   for(const [key,value] of Object.entries(record.values))fields[(typeof value==='boolean'?'boolean.':'value.')+key]=String(value);
   add('record','',record.id,fields);
  }
  for(const [owner,care] of Object.entries(bucket.care))for(const item of care){const fields:Record<string,string>={};for(const [key,value] of Object.entries(item))if(key!=='id'&&value!==undefined)fields['care.'+key]=String(value);add('care',owner,item.id,fields);}
  for(const [owner,searches] of Object.entries(bucket.searches))for(const item of searches)add('search',owner,item.id,{details:JSON.stringify(item)});
  for(const [id,item] of Object.entries(bucket.receipts))add('receipt','',id,{details:JSON.stringify(item)});
  bucket.exports.forEach((item,i)=>add('export','',String(i),{details:JSON.stringify(item)}));
 }
 const headers=[...new Set(['tenant','application','entity','owner','id',...rows.flatMap(row=>Object.keys(row))])];
 const quote=(value:string)=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value;
 return [headers,...rows.map(row=>headers.map(key=>row[key]??''))].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
export function decodeClinicalCsv(source:string):ClinicalData {
 const [headers,...rows]=parseCsv(source);if(!headers||new Set(headers).size!==headers.length||!['tenant','application','entity','owner','id'].every(key=>headers.includes(key)))throw Error('Invalid clinical CSV header');
 const data:ClinicalData=Object.create(null),seen=new Set<string>();
 for(const cells of rows){
  if(cells.length!==headers.length)throw Error('Invalid clinical CSV row width');
  const row=Object.fromEntries(headers.map((key,i)=>[key,cells[i]]));if(!row.tenant||!row.application)throw Error('Missing clinical CSV scope');
  const scope=JSON.stringify([row.tenant,row.application]),identity=JSON.stringify([scope,row.entity,row.owner,row.id]);if(seen.has(identity))throw Error('Duplicate clinical CSV entity');seen.add(identity);
  const bucket=data[scope]??={records:[],care:Object.create(null),searches:Object.create(null),receipts:Object.create(null),exports:[]};
  if(row.entity==='scope')continue;
  if(!row.id)throw Error('Missing clinical CSV entity ID');
  if(row.entity==='record'){
   if(!row.id||!Number.isSafeInteger(Number(row.version))||Number(row.version)<1)throw Error('Invalid clinical CSV record');
   const values:PatientRecord['values']={};
   for(const [key,value] of Object.entries(row)){if(key.startsWith('value.'))values[key.slice(6)]=value;else if(key.startsWith('boolean.')&&value!==''){if(!['true','false'].includes(value))throw Error('Invalid CSV boolean');values[key.slice(8)]=value==='true';}}
   const collections=JSON.parse(row.collections),activity=JSON.parse(row.activity);
   if(!collections||typeof collections!=='object'||Array.isArray(collections)||!Object.values(collections).every(Array.isArray)||!Array.isArray(activity))throw Error('Invalid clinical CSV record structure');
   bucket.records.push({id:row.id,mrn:row.mrn,internalCode:row.internalCode,version:Number(row.version),values,collections,activity});
  }else if(row.entity==='care'){
   const item=Object.fromEntries(Object.entries(row).filter(([key,value])=>key.startsWith('care.')&&value!=='').map(([key,value])=>[key.slice(5),key==='care.amount'?Number(value):value])) as unknown as PatientCareRow;
   if(!row.owner||!['encounter','appointment','episode','order','billing','pharmacy','team','location','clinical'].includes(item.kind)||!Number.isFinite(Date.parse(item.date))||(item.amount!==undefined&&!Number.isFinite(item.amount)))throw Error('Invalid clinical CSV care row');
   // Empty cells are not stored, but detail is a required string in the contract (a booking without notes).
   item.detail??='';item.id=row.id;(bucket.care[row.owner]??=[]).push(item);
  }else if(row.entity==='search')(bucket.searches[row.owner]??=[]).push(JSON.parse(row.details));
  else if(row.entity==='receipt')bucket.receipts[row.id]=JSON.parse(row.details);
  else if(row.entity==='export')bucket.exports.push(JSON.parse(row.details));
  else throw Error('Unknown clinical CSV entity');
 }
 for(const bucket of Object.values(data)){const ids=new Set(bucket.records.map(record=>record.id));for(const owner of Object.keys(bucket.care))if(!ids.has(owner))throw Error('Unknown clinical CSV care owner');for(const record of bucket.records)bucket.care[record.id]??=[];}
 return data;
}
export const readClinicalCsv=(file:string)=>decodeClinicalCsv(readFileSync(file,'utf8'));
/** One atomic snapshot contains records, related data and retry receipts together. */
export function writeClinicalCsv(file:string,data:ClinicalData):void {
 writeCsvSnapshot(file,encodeClinicalCsv(data));
}
export function writeCsvSnapshot(file:string,source:string):void {
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const temporary=file+'.'+randomUUID()+'.tmp';
 try {writeFileSync(temporary,source,{mode:0o600});const fd=openSync(temporary,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temporary,file);const directory=openSync(dirname(file),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}
 finally {try{unlinkSync(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
}
