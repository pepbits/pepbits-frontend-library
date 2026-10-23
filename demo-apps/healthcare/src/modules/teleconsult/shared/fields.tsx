import {LocalizedText} from "@pepbits/i18n/react";
import {SourceDateField} from "./controls";
import {TemplateFields} from '@pepbits/page-engines/templates';
import type {TemplateField} from '@pepbits/page-engines/types';
/** Product field definitions rendered by the library form engine. */
export function TeleconsultFields({fields,values,onChange}:{fields:TemplateField[];values:Record<string,string|number|boolean>;onChange:(id:string,value:any)=>void}){
 return <TemplateFields section={{id:'teleconsult-details',title:'Details',fields}} values={values} errors={{}} onChange={onChange} renderField={field=>field.type==='date'?<label><span><LocalizedText message={field.label}/></span><SourceDateField value={String(values[field.id]??'')} onChange={e=>onChange(field.id,e.target.value)} className="w-full rounded-md border border-line bg-white px-2.5 h-9"/></label>:undefined}/>;
}
