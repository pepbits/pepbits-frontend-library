import {runtimeActions,applyRuntimeDemo} from './dcp-runtime-store.mjs';
import {applyDesignerLifecycle,lifecycleActions,designerEntities,validBinding} from './dcp-lifecycle-store.mjs';
import {resolveDesignerCatalog} from '../desktop-clients/packages/erp-config/src/dcp-catalog.ts';
import {writeCatalogVersion} from './dcp-catalog-store.mjs';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {parseCsv,writeCsvSnapshot} from './clinical-template-csv.ts';
import {DESIGNER_TYPES,isDesignerDefinition,designerOptions,previewErrors,validDesignerPayload} from '../desktop-clients/packages/erp-config/src/dcp-designer.ts';
const initial=JSON.parse(readFileSync(new URL('./config/dcp-designer/initial.json',import.meta.url),'utf8'));
const examples=JSON.parse(readFileSync(new URL('./config/dcp-designer/examples.json',import.meta.url),'utf8'));
const seedCatalog=JSON.parse(readFileSync(new URL('./config/dcp-designer/catalog.json',import.meta.url),'utf8'));
const fail=(status,error)=>({status,body:{error}});
export function createDesignerStore(file){return {handle(user,product,input){
 if(!user?.id||!user?.tenantId)return fail(403,'designer.denied');
 if(!input||!['load','save','options','validate','save-value-set','save-relationship',...lifecycleActions,...runtimeActions].includes(input.action))return fail(400,'designer.invalid');
 let all={};try{const [header,...rows]=parseCsv(readFileSync(file,'utf8'));if(header.join(',')!=='scope,data')throw Error('Invalid designer store');all=Object.fromEntries(rows.map(([k,v])=>[k,JSON.parse(v)]));}catch(e){if(e.code!=='ENOENT')throw e;}
 const scope=JSON.stringify([user.tenantId,product,user.id]),bucket=all[scope]??{records:[],receipts:{}};
 const catalogKey=JSON.stringify({kind:'designer-catalog',tenant:user.tenantId,application:product}),shared=all[catalogKey]??{...structuredClone(seedCatalog),receipts:{}};
 const catalog={sets:shared.sets,relationships:shared.relationships};
 const flush=()=>{const q=s=>'"'+String(s).replaceAll('"','""')+'"';writeCsvSnapshot(file,'scope,data\n'+Object.entries(all).map(([k,v])=>q(k)+','+q(JSON.stringify(v))).join('\n')+'\n');};
 if(runtimeActions.includes(input.action)){const result=applyRuntimeDemo(bucket,input);if(result.persist){all[scope]=bucket;flush();}return result;}
 const view=record=>({runtime:{releases:shared.releases??[],entities:designerEntities},canDesign:user.role==='enterprise-admin',types:[...DESIGNER_TYPES],examples,catalog,records:bucket.records,record});
 if(input.action==='load'){const r=input.id?bucket.records.find(r=>r.id===input.id):null;if(input.id&&!r)return fail(404,'designer.notFound');return {status:200,body:{...view(r),initial}};}
 if(lifecycleActions.includes(input.action)){
  if(input.action!=='runtime-load'&&(typeof input.operationId!=='string'||! /^[\w-]{1,100}$/.test(input.operationId)))return fail(400,'designer.invalid');
  if(input.comment!==undefined&&(typeof input.comment!=='string'||input.comment.length>2000))return fail(400,'designer.invalid');
  const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),prior=bucket.receipts[input.operationId];
  if(input.action!=='runtime-load'&&prior)return prior.hash===hash?{status:200,body:prior.result}:fail(409,'designer.conflict');
  const result=applyDesignerLifecycle(bucket,shared,catalog,user,input);if(result.status!==200)return fail(result.status,result.error);
  const body={...view(result.record??null),initial,...(result.answer!==undefined?{runtime:{...view(null).runtime,answer:result.answer,answerHistory:result.answerHistory??[]}}:{}),...(result.validation?{validation:result.validation}:{})};
  if(input.action!=='runtime-load'){bucket.receipts[input.operationId]={hash,result:body};const keys=Object.keys(bucket.receipts);while(keys.length>100)delete bucket.receipts[keys.shift()];all[scope]=bucket;all[catalogKey]=shared;flush();}
  return {status:200,body};
 }
 if(input.action==='save-value-set'||input.action==='save-relationship'){
  if(user.role!=='enterprise-admin')return fail(403,'designer.denied');
  if(typeof input.operationId!=='string'||! /^[\w-]{1,100}$/.test(input.operationId))return fail(400,'designer.invalid');
  const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),receiptKey=JSON.stringify([user.id,input.operationId]),prior=shared.receipts[receiptKey];
  if(prior)return prior===hash?{status:200,body:{...view(null),initial}}:fail(409,'designer.conflict');
  const result=writeCatalogVersion(catalog,user,input);if(result.status!==200)return fail(result.status,result.error);
  shared.receipts[receiptKey]=hash;const keys=Object.keys(shared.receipts);while(keys.length>100)delete shared.receipts[keys.shift()];all[catalogKey]=shared;flush();return {status:200,body:{...view(null),initial}};
 }
 if(input.action==='options'||input.action==='validate'){
  const record=input.id?bucket.records.find(r=>r.id===input.id):null;
  if(input.id&&!record)return fail(404,'designer.notFound');
  if(record&&input.revision!==record.revision)return fail(409,'designer.conflict');
  if(record&&input.definition!==undefined)return fail(400,'designer.invalid');
  const definition=input.definition??record?.definition??initial;
  if(input.definition&&user.role!=='enterprise-admin'&&JSON.stringify(input.definition)!==JSON.stringify(record?.definition??initial))return fail(403,'designer.denied');
  if(!isDesignerDefinition(definition)||!validDesignerPayload(definition,input.values,input.action==='options'))return fail(400,'designer.invalid');
  const resolved=resolveDesignerCatalog(definition,catalog);if(!resolved||!isDesignerDefinition(resolved))return fail(400,'designer.invalid');
  const result={...view(record),initial};
  if(input.action==='validate')return {status:200,body:{...result,validation:previewErrors(resolved,input.values)}};
  if(!definition.sections.some(s=>s.fields.some(f=>f.id===input.fieldId&&f.type==='select')))return fail(400,'designer.invalid');
  return {status:200,body:{...result,lookup:designerOptions(resolved,input.fieldId,input.values)}};
 }
 if(user.role!=='enterprise-admin')return fail(403,'designer.denied');
 if(typeof input.operationId!=='string'||! /^[\w-]{1,100}$/.test(input.operationId)||(!isDesignerDefinition(input.definition)||!validBinding(input.definition.binding)))return fail(400,'designer.invalid');
 const resolved=resolveDesignerCatalog(input.definition,catalog);if(!resolved||!isDesignerDefinition(resolved))return fail(400,'designer.invalid');
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),receipt=bucket.receipts[input.operationId];
 if(receipt)return receipt.hash===hash?{status:200,body:receipt.result}:fail(409,'designer.conflict');
 const prior=input.id?bucket.records.find(r=>r.id===input.id):null;
 if(input.id&&!prior)return fail(404,'designer.notFound');
 if(prior&&prior.status&&prior.status!=='draft')return fail(409,'designer.lifecycleConflict');
 if(prior&&input.revision!==prior.revision)return fail(409,'designer.conflict');
 if(!prior&&bucket.records.length>=100)return fail(400,'designer.limit');
 const r={status:'draft',history:prior?.history??[],id:prior?.id??randomUUID(),revision:(prior?.revision??0)+1,updatedAt:new Date().toISOString(),definition:structuredClone(input.definition)};
 if(prior)bucket.records[bucket.records.indexOf(prior)]=r;else bucket.records.push(r);
 const result={...view(r),initial};bucket.receipts[input.operationId]={hash,result};const keys=Object.keys(bucket.receipts);while(keys.length>100)delete bucket.receipts[keys.shift()];all[scope]=bucket;
 flush();return {status:200,body:result};
 }};}
