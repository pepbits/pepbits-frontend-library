import type {DesignerBinding,DesignerStatus,DesignerAudit,DesignerRuntime} from './dcp-lifecycle';
import {validDesignerRules,resolveDesignerValues,matchesDesignerCondition,designerRuleError,type DesignerRules} from './dcp-rules.ts';
import {validCatalogRef,isDesignerCatalog,type CatalogRef,type DesignerCatalog,type CatalogSetInput,type CatalogRelationshipInput} from './dcp-catalog.ts';
import type {TemplateField,TemplateSection} from './designer-fields';
export const DESIGNER_TYPES=['text','textarea','email','number','date','time','select','checkbox'] as const;
/** Frontend template authoring draft, not the backend DCP wire schema. */
export interface DesignerOption {value:string;label:string;labels?:DesignerLabels;parentValue?:string;parentValues?:Record<string,string>}
export interface DesignerField extends Omit<TemplateField,'options'> {control?:'search'|'radio'|'segmented'|'toggle'|'slider'|'rating'|'readonly';labels?:DesignerLabels;options?:DesignerOption[];dependsOn?:string;additionalParents?:{fieldId:string;relationship?:CatalogRef}[];valueSet?:CatalogRef;relationship?:CatalogRef;rules?:DesignerRules}
export interface DesignerSection extends Omit<TemplateSection,'fields'> {repeatable?:boolean;minItems?:number;maxItems?:number;labels?:DesignerLabels;fields:DesignerField[]}
export interface DesignerDefinition {title:string;labels?:DesignerLabels;sections:DesignerSection[];binding?:DesignerBinding;layout?:'stacked'|'tabs'|'steps';columns?:1|2|3}
export type DesignerRow={_id:string}&Record<string,string|number|boolean>;
export type DesignerValue=string|number|boolean|DesignerRow[];
export type DesignerValues=Record<string,DesignerValue>;
export interface DesignerLookup {fieldId:string;state:'ready'|'missing-parent';options:DesignerOption[]}

export interface DesignerRecord {id:string;revision:number;updatedAt:string;definition:DesignerDefinition;status?:DesignerStatus;history?:DesignerAudit[]}
export interface DesignerView {initial:DesignerDefinition;canDesign:boolean;records:DesignerRecord[];record:DesignerRecord|null;types:TemplateField['type'][];catalog?:DesignerCatalog;runtime?:DesignerRuntime;examples?:DesignerDefinition[];lookup?:DesignerLookup;validation?:Record<string,string>}
export interface DesignerCommand {action:'load'|'save'|'options'|'validate'|'save-value-set'|'save-relationship'|'review'|'approve'|'reject'|'publish'|'retire'|'revise'|'runtime-load'|'answer-save'|'answer-submit';comment?:string;releaseId?:string;entityId?:string;answerRevision?:number;catalogSet?:CatalogSetInput;catalogRelationship?:CatalogRelationshipInput;fieldId?:string;values?:DesignerValues;id?:string;revision?:number;operationId?:string;definition?:DesignerDefinition}
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const title=(x:unknown)=>typeof x==='string'&&x.trim().length>0&&x.length<=160;
const key=(x:unknown)=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
export function isDesignerDefinition(x:unknown):x is DesignerDefinition {
 if(!object(x)||!title(x.title)||!validLabels(x.labels)||!Array.isArray(x.sections)||x.sections.length<1||x.sections.length>20)return false;
 if(x.layout!==undefined&&!['stacked','tabs','steps'].includes(String(x.layout)))return false;
 if(x.columns!==undefined&&(typeof x.columns!=='number'||![1,2,3].includes(x.columns)))return false;
 if(x.binding!==undefined&&(!object(x.binding)||!key(x.binding.entityType)||!key(x.binding.trigger)))return false;
 const ids=new Set<string>();let count=0;
 for(const s of x.sections){if(!object(s)||!key(s.id)||!title(s.title)||!validLabels(s.labels)||!Array.isArray(s.fields)||ids.has(s.id as string))return false;ids.add(s.id as string);
 if(s.repeatable!==undefined&&typeof s.repeatable!=='boolean')return false;
 for(const k of ['minItems','maxItems'])if(s[k]!==undefined&&(!s.repeatable||!Number.isInteger(s[k])||Number(s[k])<0||Number(s[k])>100))return false;
 if(s.repeatable&&Number(s.minItems??0)>Number(s.maxItems??10))return false;
 for(const f of s.fields){if(!object(f)||!key(f.id)||!title(f.label)||!validLabels(f.labels)||!DESIGNER_TYPES.includes(f.type as typeof DESIGNER_TYPES[number])||ids.has(f.id as string)||++count>100)return false;ids.add(f.id as string);
 if(f.control!==undefined&&!(f.control==='readonly'||f.type==='select'&&['search','radio','segmented'].includes(String(f.control))||f.type==='checkbox'&&f.control==='toggle'||f.type==='number'&&['slider','rating'].includes(String(f.control))))return false;
 if(f.control==='segmented'&&Array.isArray(f.options)&&f.options.length>4)return false;
 if(['slider','rating'].includes(String(f.control))&&(typeof f.min!=='number'||typeof (f.rules as DesignerRules|undefined)?.max!=='number'))return false;
 if(f.control==='rating'&&(!Number.isInteger(f.min)||!Number.isInteger((f.rules as DesignerRules|undefined)?.max)||Number((f.rules as DesignerRules|undefined)?.max)-Number(f.min)>10))return false;
 if(f.required!==undefined&&typeof f.required!=='boolean')return false;
 if(f.min!==undefined&&(f.type!=='number'||typeof f.min!=='number'||!Number.isFinite(f.min)))return false;
 if(f.valueSet!==undefined&&(!validCatalogRef(f.valueSet)||f.type!=='select'||f.options!==undefined))return false;
 if(f.relationship!==undefined&&(!validCatalogRef(f.relationship)||!f.valueSet||!f.dependsOn))return false;
 if(f.valueSet&&f.dependsOn&&!f.relationship)return false;
 if(f.options!==undefined){if(f.type!=='select'||!Array.isArray(f.options)||f.options.length>1000)return false;const keys=new Set();for(const o of f.options){if(!object(o)||!title(o.label)||!validLabels(o.labels)||typeof o.value!=='string'||!o.value.trim()||o.value.length>80||keys.has(o.value))return false;keys.add(o.value);}}
 if(f.type==='select'&&!f.valueSet&&(!Array.isArray(f.options)||!f.options.length))return false;
 }}return validDesignerDependencies(x as unknown as DesignerDefinition)&&validDesignerRules(x as unknown as DesignerDefinition);
}
export function isDesignerView(x:unknown):x is DesignerView {
 if(!object(x)||!isDesignerDefinition(x.initial)||typeof x.canDesign!=='boolean'||!Array.isArray(x.types)||x.types.some(t=>!DESIGNER_TYPES.includes(t as never))||!Array.isArray(x.records))return false;
 const record=(r:unknown)=>object(r)&&typeof r.id==='string'&&Number.isInteger(r.revision)&&Number(r.revision)>0&&typeof r.updatedAt==='string'&&isDesignerDefinition(r.definition)&&(r.status===undefined||['draft','review','approved','published','retired'].includes(String(r.status)))&&(r.history===undefined||(Array.isArray(r.history)&&r.history.length<=100&&r.history.every(h=>object(h)&&typeof h.action==='string'&&typeof h.actor==='string'&&typeof h.comment==='string'&&typeof h.at==='string'&&!Number.isNaN(Date.parse(h.at)))));
 if(x.runtime!==undefined){const r=x.runtime;
 const answer=(a:unknown)=>object(a)&&typeof a.id==='string'&&typeof a.entityId==='string'&&typeof a.releaseId==='string'&&Number.isInteger(a.revision)&&Number(a.revision)>0&&['draft','submitted'].includes(String(a.status))&&typeof a.updatedAt==='string'&&typeof a.updatedBy==='string'&&object(a.values)&&Object.keys(a.values).length<=100&&isDesignerValues(a.values);
 if(!object(r)||!Array.isArray(r.entities)||r.entities.length>100||!Array.isArray(r.releases)||r.releases.length>100||r.entities.some(e=>!object(e)||typeof e.id!=='string'||typeof e.entityType!=='string'||typeof e.label!=='string'||!Array.isArray(e.triggers)||e.triggers.some(t=>typeof t!=='string'))||r.releases.some(v=>!object(v)||typeof v.id!=='string'||typeof v.recordId!=='string'||!Number.isInteger(v.version)||Number(v.version)<1||typeof v.publishedAt!=='string'||typeof v.actor!=='string'||(v.retired!==undefined&&typeof v.retired!=='boolean')||!isDesignerDefinition(v.definition))||(r.answer!==undefined&&r.answer!==null&&!answer(r.answer))||(r.answerHistory!==undefined&&(!Array.isArray(r.answerHistory)||r.answerHistory.length>1000||!r.answerHistory.every(answer))))return false;
 }
 if(x.catalog!==undefined&&!isDesignerCatalog(x.catalog))return false;
 if(x.examples!==undefined&&(!Array.isArray(x.examples)||!x.examples.every(isDesignerDefinition)))return false;
 if(x.lookup!==undefined&&(!object(x.lookup)||typeof x.lookup.fieldId!=='string'||!['ready','missing-parent'].includes(String(x.lookup.state))||!Array.isArray(x.lookup.options)||x.lookup.options.length>1000||x.lookup.options.some(o=>!object(o)||typeof o.value!=='string'||!title(o.label))))return false;
 if(x.validation!==undefined&&(!object(x.validation)||Object.entries(x.validation).some(([k,v])=>!(/^[A-Za-z][\w-]*(?:\[[A-Za-z0-9_-]+\]\.[A-Za-z][\w-]*)?$/.test(k))||typeof v!=='string')))return false;
 return x.records.length<=100&&x.records.every(record)&&(x.record===null||record(x.record));
}
function flatPreviewErrors(def:DesignerDefinition,values:DesignerValues,lookupDefinition=def):Record<string,string>{
 values=resolveDesignerValues(def,values);const errors:Record<string,string>={};for(const s of def.sections)for(const f of s.fields){if(!matchesDesignerCondition(f.rules?.visibleWhen,values))continue;const v=values[f.id];if((f.required||(f.rules?.requiredWhen&&matchesDesignerCondition(f.rules.requiredWhen,values)))&&(v===undefined||v===false||String(v).trim()===''))errors[f.id]='designer.requiredError';else if(v!==undefined&&v!==''){if(f.type==='checkbox'&&typeof v!=='boolean'||['text','textarea','email','date','time'].includes(f.type)&&typeof v!=='string')errors[f.id]='designer.invalidValues';if(f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(v))||Number.isNaN(Date.parse(String(v)))||new Date(String(v)).toISOString().slice(0,10)!==v))errors[f.id]='designer.formatError';if(f.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(v)))errors[f.id]='designer.formatError';if(f.type==='number'&&(typeof v!=='number'||!Number.isFinite(Number(v))||(f.min!==undefined&&Number(v)<f.min)))errors[f.id]='designer.numberError';if(f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))errors[f.id]='designer.emailError';if(f.type==='select'&&!designerOptions(lookupDefinition,f.id,values).options.some(o=>o.value===v))errors[f.id]='designer.optionError';}const ruleError=designerRuleError(f,v);if(ruleError)errors[f.id]=ruleError;}return errors;
}

/** Up to four conjunctive dropdown parents; five dependency edges per path. */
export function designerParents(field:DesignerField):string[]{return [...(field.dependsOn?[field.dependsOn]:[]),...(field.additionalParents??[]).map(p=>p.fieldId)];}
export function validDesignerDependencies(def:DesignerDefinition):boolean {
 const fields=def.sections.flatMap(s=>s.fields),byId=new Map(fields.map(f=>[f.id,f]));
 for(const f of fields){
  if(f.additionalParents!==undefined&&(!Array.isArray(f.additionalParents)||f.additionalParents.length>3||!f.dependsOn||f.additionalParents.some(p=>!p||typeof p.fieldId!=='string'||(p.relationship!==undefined&&!validCatalogRef(p.relationship)))))return false;
  const parents=designerParents(f);if(new Set(parents).size!==parents.length)return false;
  if(parents.length&&f.type!=='select')return false;
  for(const id of parents){const parent=byId.get(id);if(!parent||parent.type!=='select'||parent===f||!!f.valueSet!==!!parent.valueSet)return false;
   if(f.valueSet&&id!==f.dependsOn&&!f.additionalParents?.find(p=>p.fieldId===id)?.relationship)return false;
   if(!f.valueSet&&f.options?.some(o=>!parent.options?.some(p=>p.value===(id===f.dependsOn?o.parentValue:o.parentValues?.[id]))))return false;
  }
  if(!parents.length&&f.options?.some(o=>o.parentValue!==undefined||o.parentValues!==undefined))return false;
  function visit(id:string,seen:Set<string>,depth:number):boolean{if(seen.has(id)||depth>5)return false;const next=new Set(seen).add(id);return designerParents(byId.get(id)!).every(p=>byId.has(p)&&visit(p,next,depth+1));}
  if(!visit(f.id,new Set(),0))return false;
 }return true;
}
export function designerDescendants(def:DesignerDefinition,id:string):Set<string>{
 const result=new Set<string>(),queue=[id];for(let i=0;i<queue.length;i++)for(const f of def.sections.flatMap(s=>s.fields))if(designerParents(f).includes(queue[i]!)&&!result.has(f.id)&&f.id!==id){result.add(f.id);queue.push(f.id);}return result;
}
export function changeDesignerValue(def:DesignerDefinition,values:DesignerValues,id:string,value:DesignerValue):DesignerValues{
 const next={...values,[id]:value},children=designerDescendants(def,id);for(const child of children)delete next[child];for(const section of def.sections)if(section.repeatable&&Array.isArray(next[section.id]))next[section.id]=(next[section.id] as DesignerRow[]).map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!children.has(key))) as DesignerRow);return next;
}
export function designerParentValues(def:DesignerDefinition,id:string,values:DesignerValues):DesignerValues{
 const byId=new Map(def.sections.flatMap(s=>s.fields).map(f=>[f.id,f])),result:DesignerValues={},seen=new Set<string>();
 function collect(id:string){if(seen.has(id))return;seen.add(id);for(const p of designerParents(byId.get(id)!)){if(values[p]!==undefined)result[p]=values[p];if(byId.has(p))collect(p);}}if(byId.has(id))collect(id);return result;
}
export function designerOptions(def:DesignerDefinition,id:string,values:DesignerValues):DesignerLookup{
 const fields=new Map(def.sections.flatMap(s=>s.fields).map(f=>[f.id,f]));
 function resolve(fieldId:string,seen:Set<string>):DesignerLookup{
  const empty:DesignerLookup={fieldId,state:'missing-parent',options:[]},f=fields.get(fieldId);if(!f||f.type!=='select'||seen.has(fieldId))return empty;
  const parents=designerParents(f);if(!parents.length)return {fieldId,state:'ready',options:f.options??[]};
  const next=new Set(seen).add(fieldId);for(const id of parents){const parent=resolve(id,next),value=values[id];if(typeof value!=='string'||!parent.options.some(o=>o.value===value))return empty;}
  return {fieldId,state:'ready',options:(f.options??[]).filter(o=>parents.every(id=>(id===f.dependsOn?o.parentValue:o.parentValues?.[id])===values[id]))};
 }return resolve(id,new Set());
}
export type DesignerLabels=Partial<Record<'en'|'ar'|'hi'|'ml',string>>;
export function designerLabel(fallback:string,labels:DesignerLabels|undefined,language:string):string{return labels?.[language as keyof DesignerLabels]||labels?.en||fallback;}
export function localizeDesignerDefinition(def:DesignerDefinition,language:string):DesignerDefinition{return {...def,title:designerLabel(def.title,def.labels,language),sections:def.sections.map(s=>({...s,title:designerLabel(s.title,s.labels,language),fields:s.fields.map(f=>({...f,label:designerLabel(f.label,f.labels,language),options:f.options?.map(o=>({...o,label:designerLabel(o.label,o.labels,language)}))}))}))};}
const validLabels=(labels:unknown)=>labels===undefined||object(labels)&&Object.entries(labels).every(([k,v])=>['en','ar','hi','ml'].includes(k)&&title(v));

export function isDesignerValues(input:unknown):input is DesignerValues {
 if(!object(input)||Object.keys(input).length>100)return false;let total=0;
 const scalar=(v:unknown)=>typeof v==='boolean'||typeof v==='string'&&v.length<=10000||typeof v==='number'&&Number.isFinite(v);
 return Object.entries(input).every(([id,v])=>key(id)&&(scalar(v)||Array.isArray(v)&&v.length<=100&&new Set(v.map(r=>object(r)?r._id:undefined)).size===v.length&&v.every(row=>object(row)&&typeof row._id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(row._id)&&Object.keys(row).length<=101&&Object.entries(row).every(([k,x])=>++total<=10000&&(k==='_id'||key(k))&&scalar(x)))));
}
export function previewErrors(def:DesignerDefinition,values:DesignerValues):Record<string,string>{
 const plain={...def,sections:def.sections.filter(s=>!s.repeatable)},errors=flatPreviewErrors(plain,values);
 for(const section of def.sections.filter(s=>s.repeatable)){
  const rows=values[section.id];if(rows!==undefined&&!Array.isArray(rows)){errors[section.id]='designer.invalidValues';continue;}
  if((rows?.length??0)<(section.minItems??0)||(rows?.length??0)>(section.maxItems??10)){errors[section.id]='designer.rowLimit';continue;}
  for(const row of rows??[]){const rowErrors=flatPreviewErrors({...def,sections:[{...section,repeatable:false}]},{...values,...row},def);for(const [id,error] of Object.entries(rowErrors))errors[section.id+'['+row._id+'].'+id]=error;}
 }return errors;
}
/** Answer keys are fields or repeating sections. Lookup calls may carry row-local parent values. */
export function validDesignerPayload(def:DesignerDefinition,values:unknown,lookup=false):values is DesignerValues{
 if(!isDesignerValues(values))return false;
 return Object.entries(values).every(([id,value])=>{
  const section=def.sections.find(s=>s.id===id&&s.repeatable);
  if(section)return Array.isArray(value)&&value.every(row=>Object.keys(row).every(k=>k==='_id'||section.fields.some(f=>f.id===k)));
  return !Array.isArray(value)&&def.sections.some(s=>(!s.repeatable||lookup)&&s.fields.some(f=>f.id===id));
 });
}

/** Copy an approved example without retaining references to its original field identity. */
export function cloneDesignerSections(def:DesignerDefinition,newId:()=>string):DesignerSection[]{
 const ids=new Map(def.sections.flatMap(s=>[s.id,...s.fields.map(f=>f.id)]).map(id=>[id,newId()]));
 const ref=(id:string)=>ids.get(id)??id;
 return def.sections.map(s=>({...s,id:ref(s.id),fields:s.fields.map(f=>{
  const rules=f.rules?structuredClone(f.rules):undefined;
  if(rules){for(const key of ['visibleWhen','requiredWhen','readOnlyWhen'] as const)if(rules[key])rules[key]!.fieldId=ref(rules[key]!.fieldId);
   if(rules.calculation){rules.calculation.left=ref(rules.calculation.left);rules.calculation.right=ref(rules.calculation.right);}}
  return {...f,id:ref(f.id),rules,dependsOn:f.dependsOn?ref(f.dependsOn):undefined,additionalParents:f.additionalParents?.map(p=>({...p,fieldId:ref(p.fieldId)})),options:f.options?.map(o=>({...o,parentValues:o.parentValues?Object.fromEntries(Object.entries(o.parentValues).map(([id,v])=>[ref(id),v])):undefined}))};
 })}));
}
