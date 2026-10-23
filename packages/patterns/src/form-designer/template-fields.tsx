"use client";
import React from 'react';
import {Card,CardHeader,CardTitle,CardContent,CardGrid,DataValue,DescriptionList} from '@pepbits/components';
import {Input,Textarea,Select,Checkbox,DateInput,TimeInput,Badge,Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {TemplateSection,TemplateValue} from '@pepbits/data/dcp-designer';
export interface TemplateFieldState {disabled?:boolean;options?:{value:string;label:string}[];hint?:string;placeholder?:string}
export function TemplateFields({section,values,errors,onChange,disabled=false,fieldStates={},columns=2,renderField}: {section:TemplateSection;values:Record<string,TemplateValue>;errors:Record<string,string>;onChange:(id:string,value:TemplateValue)=>void;disabled?:boolean;fieldStates?:Record<string,TemplateFieldState>;columns?:1|2|3;renderField?:(field:TemplateSection['fields'][number])=>React.ReactNode|undefined}) {
 return <Card data-template-section={section.id}><CardHeader><CardTitle title={section.title}/></CardHeader><CardContent><CardGrid columns={columns}>
  {section.fields.map(field=>{const rendered=renderField?.(field);if(rendered!==undefined)return <React.Fragment key={field.id}>{rendered}</React.Fragment>;const value=values[field.id];const state=fieldStates[field.id];const common={label:field.label,"aria-label":field.label,required:field.required,error:errors[field.id],disabled:disabled||state?.disabled,hint:state?.hint};
   if(field.type==='checkbox')return <Checkbox key={field.id} label={field.label} checked={!!value} disabled={common.disabled} onChange={event=>onChange(field.id,event.target.checked)}/>;
   if(field.type==='textarea')return <Textarea key={field.id} {...common} value={String(value??'')} onChange={event=>onChange(field.id,event.target.value)}/>;
   if(field.type==='select')return <Select key={field.id} {...common} options={state?.options??field.options??[]} placeholder={state?.placeholder} value={String(value??'')} onChange={event=>onChange(field.id,event.target.value)}/>;
   if(field.type==='date')return <DateInput key={field.id} {...common} value={String(value??'')} onChange={event=>onChange(field.id,event.target.value)}/>;
   if(field.type==='time')return <TimeInput key={field.id} {...common} value={String(value??'')} onChange={event=>onChange(field.id,event.target.value)}/>;
   return <Input key={field.id} {...common} type={field.type} min={field.min} value={String(value??'')} onChange={event=>onChange(field.id,field.type==='number'?event.target.value===''?'':Number(event.target.value):event.target.value)}/>;
  })}
 </CardGrid></CardContent></Card>;
}
