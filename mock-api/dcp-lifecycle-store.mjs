import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isDesignerDefinition,previewErrors,validDesignerPayload} from '../desktop-clients/packages/erp-config/src/dcp-designer.ts';
import {resolveDesignerCatalog} from '../desktop-clients/packages/erp-config/src/dcp-catalog.ts';
import {resolveDesignerValues} from '../desktop-clients/packages/erp-config/src/dcp-rules.ts';
export const designerEntities=JSON.parse(readFileSync(new URL('./config/dcp-designer/entities.json',import.meta.url),'utf8'));
export function validBinding(binding){return !binding||designerEntities.some(e=>e.entityType===binding.entityType&&e.triggers.includes(binding.trigger));}
export const lifecycleActions=['review','approve','reject','publish','retire','revise','runtime-load','answer-save','answer-submit'];
const fail=(status,error)=>({status,error});
export function applyDesignerLifecycle(bucket,shared,catalog,user,input){
 shared.releases??=[];shared.answers??=[];shared.answerRevisions??=[];
 const record=bucket.records.find(r=>r.id===input.id),now=new Date().toISOString();
 if(['runtime-load','answer-save','answer-submit'].includes(input.action)){
  const entity=designerEntities.find(e=>e.id===input.entityId),release=shared.releases.find(r=>r.id===input.releaseId);
  if(!entity||!release||release.definition.binding?.entityType!==entity.entityType||!entity.triggers.includes(release.definition.binding.trigger))return fail(404,'designer.notFound');
  const prior=shared.answers.find(a=>a.entityId===entity.id&&a.releaseId===release.id);
  if(input.action==='runtime-load')return {status:200,answer:prior??null,answerHistory:shared.answerRevisions.filter(a=>a.entityId===entity.id&&a.releaseId===release.id)};
  if(release.retired||prior?.status==='submitted')return fail(409,'designer.lifecycleConflict');
  if((prior?.revision??0)!==(input.answerRevision??0))return fail(409,'designer.conflict');
  const def=resolveDesignerCatalog(release.definition,catalog),values=input.values;
  if(!def||!isDesignerDefinition(def)||!validDesignerPayload(def,values))return fail(400,'designer.invalid');
  const normalized=resolveDesignerValues(def,values),validation=previewErrors(def,normalized);
  if(input.action==='answer-submit'&&Object.keys(validation).length)return {status:200,validation,answer:prior??null};
  if(shared.answerRevisions.length>=1000)return fail(400,'designer.limit');
  if(!prior&&shared.answers.length>=100)return fail(400,'designer.limit');
  const answer={id:prior?.id??randomUUID(),releaseId:release.id,entityId:entity.id,revision:(prior?.revision??0)+1,values:normalized,updatedAt:now,updatedBy:user.id,status:input.action==='answer-submit'?'submitted':'draft'};
  if(prior)shared.answers[shared.answers.indexOf(prior)]=answer;else shared.answers.push(answer);
  shared.answerRevisions.push(structuredClone(answer));
  return {status:200,answer,answerHistory:shared.answerRevisions.filter(a=>a.id===answer.id),validation:input.action==='answer-save'?validation:{}};
 }
 if(user.role!=='enterprise-admin')return fail(403,'designer.denied');if(!record)return fail(404,'designer.notFound');if(record.revision!==input.revision)return fail(409,'designer.conflict');
 const status=record.status??'draft',transitions={review:['draft','review'],approve:['review','approved'],reject:['review','draft'],publish:['approved','published'],retire:['published','retired']};
 if(input.action==='revise'){if(!['published','retired'].includes(status))return fail(409,'designer.lifecycleConflict');record.status='draft';}
 else {const transition=transitions[input.action];if(!transition||transition[0]!==status)return fail(409,'designer.lifecycleConflict');
  if(['reject','retire'].includes(input.action)&&(typeof input.comment!=='string'||!input.comment.trim()))return fail(400,'designer.commentRequired');
  if(input.action==='review'||input.action==='publish'){const resolved=resolveDesignerCatalog(record.definition,catalog);if(!resolved||!isDesignerDefinition(resolved)||!record.definition.binding||!validBinding(record.definition.binding))return fail(400,'designer.bindingRequired');}
  if(input.action==='publish'){if(shared.releases.length>=100)return fail(400,'designer.limit');shared.releases.push({id:randomUUID(),recordId:record.id,version:record.revision,definition:structuredClone(record.definition),publishedAt:now,actor:user.id});}
  if(input.action==='retire')for(const release of shared.releases)if(release.recordId===record.id)release.retired=true;
  record.status=transition[1];
 }
 record.revision++;record.updatedAt=now;record.history=[...(record.history??[]),{action:input.action,at:now,actor:user.id,comment:typeof input.comment==='string'?input.comment:'',revision:record.revision}].slice(-100);
 return {status:200,record};
}
