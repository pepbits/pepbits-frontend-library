import type {DesignerDefinition} from './dcp-designer';
export interface CatalogRef {id:string;revision:number}
export interface CatalogSet extends CatalogRef {name:string;options:{value:string;label:string}[];updatedAt:string;updatedBy:string}
export interface CatalogRelationship extends CatalogRef {name:string;parent:CatalogRef;child:CatalogRef;pairs:{parentValue:string;childValue:string}[];updatedAt:string;updatedBy:string}
export interface DesignerCatalog {sets:CatalogSet[];relationships:CatalogRelationship[]}
export type CatalogSetInput=Pick<CatalogSet,'name'|'options'>;
export type CatalogRelationshipInput=Pick<CatalogRelationship,'name'|'parent'|'child'|'pairs'>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=160)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export const validCatalogRef=(v:unknown):v is CatalogRef=>object(v)&&typeof v.id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(v.id)&&Number.isInteger(v.revision)&&Number(v.revision)>0;
export const sameCatalogRef=(a:CatalogRef|undefined,b:CatalogRef|undefined)=>!!a&&!!b&&a.id===b.id&&a.revision===b.revision;
export function validCatalogSet(v:unknown):v is CatalogSetInput{return object(v)&&text(v.name)&&Array.isArray(v.options)&&v.options.length>0&&v.options.length<=1000&&v.options.every(o=>object(o)&&text(o.value,80)&&text(o.label)&&o.parentValue===undefined)&&new Set(v.options.map(o=>o.value)).size===v.options.length;}
export function validCatalogRelationship(v:unknown,sets:CatalogSet[]):v is CatalogRelationshipInput{
 if(!object(v)||!text(v.name)||!validCatalogRef(v.parent)||!validCatalogRef(v.child)||!Array.isArray(v.pairs)||v.pairs.length>1000)return false;
 const parent=sets.find(s=>sameCatalogRef(s,v.parent as CatalogRef)),child=sets.find(s=>sameCatalogRef(s,v.child as CatalogRef));
 return !!parent&&!!child&&v.pairs.length===child.options.length&&v.pairs.every(p=>object(p)&&parent.options.some(o=>o.value===p.parentValue)&&child.options.some(o=>o.value===p.childValue))&&new Set(v.pairs.map(p=>p.childValue)).size===v.pairs.length;
}
export function isDesignerCatalog(v:unknown):v is DesignerCatalog{
 if(!object(v)||!Array.isArray(v.sets)||!Array.isArray(v.relationships)||v.sets.length>100||v.relationships.length>100)return false;
 if(v.sets.reduce((n:number,s:unknown)=>n+(object(s)&&Array.isArray(s.options)?s.options.length:0),0)>10000)return false;
 const metadata=(r:unknown)=>object(r)&&validCatalogRef(r)&&typeof r.updatedAt==='string'&&typeof r.updatedBy==='string';
 return v.sets.every(s=>metadata(s)&&validCatalogSet(s))&&v.relationships.every(r=>metadata(r)&&validCatalogRelationship(r,v.sets as CatalogSet[]))&&new Set(v.sets.map(s=>`${s.id}:${s.revision}`)).size===v.sets.length&&new Set(v.relationships.map(s=>`${s.id}:${s.revision}`)).size===v.relationships.length;
}
/** Resolve only pinned revisions. Never trust client-supplied option copies. */
export function resolveDesignerCatalog(definition:DesignerDefinition,catalog:DesignerCatalog):DesignerDefinition|null{
 const fields=definition.sections.flatMap(s=>s.fields);let valid=true;
 const sections=definition.sections.map(s=>({...s,fields:s.fields.map(f=>{
  if(!f.valueSet)return f;
  const set=catalog.sets.find(s=>sameCatalogRef(s,f.valueSet));if(!set){valid=false;return f;}
  const {valueSet,relationship,additionalParents,...field}=f;
  if(!f.dependsOn)return {...field,options:set.options};
  const parent=fields.find(p=>p.id===f.dependsOn),mapping=catalog.relationships.find(r=>sameCatalogRef(r,relationship));
  if(!mapping||!sameCatalogRef(mapping.child,valueSet)||!sameCatalogRef(mapping.parent,parent?.valueSet)){valid=false;return f;}
  const extra=(additionalParents??[]).map(p=>{const source=fields.find(x=>x.id===p.fieldId),r=catalog.relationships.find(r=>sameCatalogRef(r,p.relationship));if(!r||!sameCatalogRef(r.child,valueSet)||!sameCatalogRef(r.parent,source?.valueSet))valid=false;return {fieldId:p.fieldId,mapping:r};});
  return {...field,...(extra.length?{additionalParents:extra.map(p=>({fieldId:p.fieldId}))}:{}),options:set.options.map(o=>({...o,parentValue:mapping.pairs.find(p=>p.childValue===o.value)?.parentValue,...(extra.length?{parentValues:Object.fromEntries(extra.map(p=>[p.fieldId,p.mapping?.pairs.find(pair=>pair.childValue===o.value)?.parentValue??'']))}:{})}))};
 })}));return valid?{...definition,sections}:null;
}
