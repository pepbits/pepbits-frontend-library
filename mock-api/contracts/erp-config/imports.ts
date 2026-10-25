import {getEntitySchema} from "./entity-schemas.ts";
import {fieldOptions,isFieldVisible,validateForm,type FormValues} from "./form-rules.ts";
import type {EntitySchema} from "./types.ts";
export interface ImportDefinition {id:string;label:string;schema:EntitySchema;uniqueField:string}
export function getImportDefinition(entity?:string):ImportDefinition|null {
 return entity==='customer'?{id:'customer',label:'Customers',schema:getEntitySchema('customer','Customer Master'),uniqueField:'customerCode'}:null;
}
/** CSV values remain strings until this boundary. Empty unmapped fields use schema defaults. */
export function validateImportRow(definition:ImportDefinition,input:Record<string,string>) {
 const values:FormValues={},errors:Record<string,string>={};
 for(const field of definition.schema.sections.flatMap(section=>section.fields)) {
  const raw=input[field.id]?.trim();
  let value:FormValues[string]=field.defaultValue??(field.type==='toggle'?false:field.type==='multiselect'?[]:'');
  if(raw!==undefined) {
   value=raw;
   if(field.type==='number'&&raw) {if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))errors[field.id]='Use a number without currency symbols or grouping separators';else value=Number(raw);}
   if(field.type==='toggle') {if(/^(true|yes|1)$/i.test(raw))value=true;else if(/^(false|no|0|)$/i.test(raw))value=false;else errors[field.id]='Use true/false, yes/no or 1/0';}
   if(field.type==='multiselect')value=raw?raw.split(';').map(item=>item.trim()):[];
   if(field.type==='date'&&raw&&(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw))||new Date(raw).toISOString().slice(0,10)!==raw))errors[field.id]='Use a valid date in YYYY-MM-DD format';
  }
  values[field.id]=value;
 }
 Object.assign(errors,validateForm(definition.schema,values));
 for(const field of definition.schema.sections.flatMap(section=>section.fields)) {
  if(!isFieldVisible(field,values)) {delete errors[field.id];continue;}
  const value=values[field.id],options=fieldOptions(field,values);
  if((field.type==='select'||field.type==='multiselect')&&value!==''&&(!Array.isArray(value)||value.length)) {
   const selected=Array.isArray(value)?value:[value];
   if(selected.some(item=>!options.some(option=>option.value===item)))errors[field.id]='Choose a supported option value';
  }
 }
 return {values,errors};
}
export const importIdentity=(value:unknown)=>String(value??'').trim().toLocaleLowerCase('en-US');
