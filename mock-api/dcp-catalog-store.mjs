import {randomUUID} from 'node:crypto';
import {validCatalogSet,validCatalogRelationship} from '../desktop-clients/packages/erp-config/src/dcp-catalog.ts';
export function writeCatalogVersion(catalog,user,input){
 const isSet=input.action==='save-value-set',collection=isSet?catalog.sets:catalog.relationships,value=isSet?input.catalogSet:input.catalogRelationship;
 if(!(isSet?validCatalogSet(value):validCatalogRelationship(value,catalog.sets)))return {status:400,error:'designer.invalid'};
 if(isSet&&catalog.sets.reduce((n,s)=>n+s.options.length,0)+value.options.length>10000)return {status:400,error:'designer.datasetBudget'};
 if(collection.length>=100)return {status:400,error:'designer.catalogLimit'};
 const versions=collection.filter(r=>r.id===input.id),head=versions.reduce((n,r)=>Math.max(n,r.revision),0);
 if(input.id&&!head)return {status:404,error:'designer.notFound'};
 if(input.id&&input.revision!==head)return {status:409,error:'designer.conflict'};
 const record={...structuredClone(value),id:input.id??(isSet?'set_':'rel_')+randomUUID().replaceAll('-',''),revision:head+1,updatedAt:new Date().toISOString(),updatedBy:user.id};
 collection.push(record);return {status:200};
}
