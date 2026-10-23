import type {PageTemplateDefinition, TemplateDocument, TemplateLine} from "../types";
export interface TemplateScope {tenantId:string;applicationId:string;userId:string;pageId:string;recordId:string}
export interface TemplateSaveRequest {scope:TemplateScope;templateId:string;document:TemplateDocument;expectedVersion:number;operationId:string}
/** Implement authorization, version checks and operation receipts on the server. */
export interface PageTemplateAdapter {save(request:TemplateSaveRequest):Promise<TemplateDocument>;load?(scope:TemplateScope,templateId:string):Promise<TemplateDocument>}
export function lineTotals(lines:TemplateLine[],precision=2) {
 const scale=10**precision;
 const sum=(get:(line:TemplateLine)=>number)=>lines.reduce((total,line)=>total+Math.round(get(line)*scale),0)/scale;
 const debit=sum(line=>line.debit),credit=sum(line=>line.credit);
 return {amount:sum(line=>line.quantity*line.price),debit,credit,difference:Math.round((debit-credit)*scale)/scale};
}
export function validateTemplate(definition:PageTemplateDefinition,document:TemplateDocument):Record<string,string> {
 const errors:Record<string,string>={};
 for(const section of definition.sections)for(const field of section.fields){
  const value=document.values[field.id];
  if(field.required&&(value===undefined||String(value).trim()===''))errors[field.id]='template.validation.required';
  else if(field.type==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))errors[field.id]='template.validation.email';
  else if(field.type==='number'&&value!==undefined&&(!Number.isFinite(Number(value))||(field.min!==undefined&&Number(value)<field.min)))errors[field.id]='template.validation.number';
 }
 if(document.values.dueDate&&document.values.effectiveDate&&String(document.values.dueDate)<String(document.values.effectiveDate))errors.dueDate='template.validation.date';
 if(definition.engine==='booking'&&String(document.values.endTime??'')<=String(document.values.startTime??''))errors.endTime='template.validation.time';
 if(['order','finance'].includes(definition.engine)){
  if(!document.lines.length)errors.lines='template.validation.lines';
  if(document.lines.some(line=>!line.description.trim()||![line.quantity,line.price,line.debit,line.credit].every(value=>Number.isFinite(value)&&value>=0)||(definition.engine==='order'&&line.quantity<=0)))errors.lines='template.validation.lines';
 }
 if(definition.engine==='finance'){
  const totals=lineTotals(document.lines);
  if(totals.difference!==0||totals.debit<=0||document.lines.some(line=>line.debit>0&&line.credit>0))errors.balance='template.validation.balance';
 }
 if(definition.id==='template-hierarchical-master'){for(const row of document.rows){const visited=new Set<string>();let id=String(row.code);while(id){if(visited.has(id)){errors.hierarchy='template.validation.hierarchy';break;}visited.add(id);id=String(document.values[`parent.${id}`]??'');}}}
 return errors;
}
