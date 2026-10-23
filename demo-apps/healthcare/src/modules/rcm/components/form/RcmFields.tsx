"use client";
import {TemplateFields} from "@pepbits/page-engines/templates";
import type {TemplateSection} from "@pepbits/page-engines/types";
import type {FieldDef} from "../../lib/types";
import {FieldInput} from "./FieldInput";
export function RcmFields({fields,values,errors={},onChange,labels={},disabled=false,prefix="rcm"}:{fields:FieldDef[];values:Record<string,any>;errors?:Record<string,string>;onChange:(id:string,value:any)=>void;labels?:Record<string,string>;disabled?:boolean;prefix?:string}) {
 const section:TemplateSection={id:prefix,title:"Details",fields:fields.map(f=>({id:f.key,label:f.label,type:f.type==='textarea'?'textarea':f.type==='select'?'select':f.type==='date'?'date':f.type==='number'?'number':f.type==='boolean'?'checkbox':'text',required:f.required,options:f.options}))};
 return <TemplateFields section={section} values={values} errors={errors} disabled={disabled} onChange={onChange} fieldStates={Object.fromEntries(fields.map(f=>[f.key,{hint:f.help,placeholder:f.placeholder}]))} renderField={field=>{
  const f=fields.find(f=>f.key===field.id)!;
  if(!f.upper&&f.span!==2&&['text','textarea','date','number','boolean','select'].includes(f.type))return undefined;
  return <div className={f.span===2||f.type==='lines'||f.type==='textarea'?'col-span-2':undefined}><label className="field-label" htmlFor={prefix+'-'+f.key}>{f.label}{f.required?' *':''}</label><FieldInput field={f} id={prefix+'-'+f.key} value={values[f.key]} labelHint={labels[f.key]} disabled={disabled} invalid={!!errors[f.key]} onChange={value=>onChange(f.key,value)}/>{errors[f.key]?<p role="alert">{errors[f.key]}</p>:f.help?<p className="field-help">{f.help}</p>:null}</div>;
 }}/>;
}
