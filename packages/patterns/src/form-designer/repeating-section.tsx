'use client';
import React from 'react';
import {Card,CardHeader,CardTitle,CardContent} from '@pepbits/components';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {designerOptions,changeDesignerValue,matchesDesignerCondition,resolveDesignerValues,type DesignerDefinition,type DesignerSection,type DesignerRow,type DesignerValues} from '@pepbits/data/dcp-designer';
import {DesignerSections} from './sections';
export function RepeatingDesignerSection({definition,section,values,errors,disabled,change}:{definition:DesignerDefinition;section:DesignerSection;values:DesignerValues;errors:Record<string,string>;disabled?:boolean;change:(rows:DesignerRow[])=>void}){
 const {t}=useLocalization(),rows=Array.isArray(values[section.id])?values[section.id] as DesignerRow[]:[];
 return <Card><CardHeader><CardTitle title={section.title}/></CardHeader><CardContent className="space-y-3">{errors[section.id]&&<p role="alert">{errors[section.id]}</p>}{rows.map((row,index)=>{
 const local={...definition,layout:'stacked' as const,sections:[{...section,repeatable:false}]},effective=resolveDesignerValues(local,{...values,...row});
 const states=Object.fromEntries(section.fields.map(f=>{const lookup=f.type==='select'?designerOptions(definition,f.id,effective):null;return [f.id,{options:lookup?.options,disabled:lookup?.state==='missing-parent'||!!f.rules?.calculation||!!(f.rules?.readOnlyWhen&&matchesDesignerCondition(f.rules.readOnlyWhen,effective))}];}));
 return <Card key={row._id}><CardContent className="space-y-2"><DesignerSections definition={local} values={effective} errors={Object.fromEntries(section.fields.map(f=>[f.id,errors[section.id+'['+row._id+'].'+f.id]]).filter(([,e])=>e))} states={states} disabled={disabled} change={(id,value)=>{if(Array.isArray(value))return;const next=changeDesignerValue(definition,{...values,...row},id,value);change(rows.map((r,i)=>i===index?Object.fromEntries([['_id',r._id],...section.fields.filter(f=>next[f.id]!==undefined).map(f=>[f.id,next[f.id]])]) as DesignerRow:r));}}/><Button disabled={disabled||rows.length<=(section.minItems??0)} onClick={()=>change(rows.filter((_,i)=>i!==index))}>{t('designer.v1.removeRow')}</Button></CardContent></Card>;
 })}<Button disabled={disabled||rows.length>=(section.maxItems??10)} onClick={()=>change([...rows,{_id:'row_'+crypto.randomUUID().replaceAll('-','')}])}>{t('designer.v1.addRow')}</Button></CardContent></Card>;
}
