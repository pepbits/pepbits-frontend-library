"use client";
import React from 'react';
import {Card, CardHeader, CardTitle, CardContent, CardGrid, DataValue, DescriptionList} from "@pepbits/components";
import {Input, Textarea, Select, Checkbox, DateInput, TimeInput, Badge, Button} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import type {TemplateDocument, TemplateSection, TemplateValue, TemplateLine} from "../types";
export interface TemplateFieldState {disabled?:boolean;options?:{value:string;label:string}[];hint?:string;placeholder?:string}
export function TemplateFields({section,values,errors,onChange,disabled=false,fieldStates={},columns=2,renderField}: {section:TemplateSection;values:TemplateDocument['values'];errors:Record<string,string>;onChange:(id:string,value:TemplateValue)=>void;disabled?:boolean;fieldStates?:Record<string,TemplateFieldState>;columns?:1|2|3;renderField?:(field:TemplateSection['fields'][number])=>React.ReactNode|undefined}) {
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
export function TemplateTimeline({rows}: {rows:TemplateDocument['rows']}) {
 const {t,dateTime}=useLocalization();
 return <div className="space-y-3" data-template-timeline>{rows.map((row,index)=><Card key={String(row.code)}><CardContent className="flex items-start gap-4"><span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] font-bold text-[var(--primary)]">{index+1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><b>{row.name}</b><Badge>{t(`template.status.${row.status}`)}</Badge></div><p className="mt-1 text-sm text-[var(--text-muted)]">{dateTime(String(row.date)+'T09:00:00')}</p><p className="mt-2 text-sm">{row.owner??row.resource??row.code}</p></div></CardContent></Card>)}</div>;
}
export function TemplateChecklist({lines,onChange,disabled}: {lines:TemplateLine[];onChange:(lines:TemplateLine[])=>void;disabled:boolean}) {
 const {t}=useLocalization();
 return <Card><CardHeader><CardTitle title="template.checklist"/></CardHeader><CardContent className="space-y-3">{lines.map(line=><Checkbox key={line.id} label={line.description} checked={line.checked} disabled={disabled} onChange={event=>onChange(lines.map(item=>item.id===line.id?{...item,checked:event.target.checked}:item))}/>)}<p className="text-sm text-[var(--text-muted)]">{t('template.checkedCount',{count:lines.filter(line=>line.checked).length,total:lines.length})}</p></CardContent></Card>;
}
export function TemplateSummary({document}: {document:TemplateDocument}) {
 return <Card><CardHeader><CardTitle title="template.summary"/></CardHeader><CardContent><DescriptionList layout="stacked" items={[{id:'code',label:'template.field.code',value:<DataValue value={document.values.code}/>},{id:'name',label:'template.field.name',value:<DataValue value={document.values.name??document.values.party}/>},{id:'owner',label:'template.field.owner',value:<DataValue value={document.values.owner}/>},{id:'version',label:'template.version',value:<DataValue value={document.version} numeric/>}]}/></CardContent></Card>;
}
export function TemplateBoard({rows,stages,onMove,disabled=false}: {rows:TemplateDocument['rows'];stages:string[];onMove?:(code:string,status:string)=>void;disabled?:boolean}) {
 const {t}=useLocalization();
 return <CardGrid columns={4} data-template-board>{stages.map((stage,index)=><Card key={stage} tone="muted"><CardHeader><CardTitle title={t(`template.status.${stage}`)} action={<Badge>{rows.filter(row=>row.status===stage).length}</Badge>}/></CardHeader><CardContent className="space-y-3">{rows.filter(row=>row.status===stage).map(row=><Card key={String(row.code)}><CardContent className="space-y-2"><b className="block">{row.name}</b><DataValue value={row.code}/>{onMove&&index<stages.length-1?<Button disabled={disabled} onClick={()=>onMove(String(row.code),stages[index+1]!)}>{t('template.advance')}</Button>:null}</CardContent></Card>)}</CardContent></Card>)}</CardGrid>;
}
