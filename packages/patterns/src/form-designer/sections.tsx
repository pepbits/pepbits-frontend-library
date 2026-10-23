'use client';
import {usePreferences} from '@pepbits/preferences/react';
import React,{useEffect,useState} from 'react';
import {Tabs} from '@pepbits/components';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {matchesDesignerCondition,localizeDesignerDefinition,type DesignerDefinition,type DesignerValues,type TemplateValue,type DesignerValue} from '@pepbits/data/dcp-designer';
import {RepeatingDesignerSection} from './repeating-section';
import {DesignerPresentationField} from './presentation-fields';
import {TemplateFields,type TemplateFieldState} from './template-fields';
/** The same section renderer is used for authoring preview and entity-bound runtime. */
export function DesignerSections({definition,values,errors,states,disabled=false,change}:{definition:DesignerDefinition;values:DesignerValues;errors:Record<string,string>;states:Record<string,TemplateFieldState>;disabled?:boolean;change:(id:string,value:DesignerValue)=>void}){
 const {preferences,isLocked}=usePreferences();if(isLocked('formNavigation'))definition={...definition,layout:preferences.formNavigation==='rail'?'stacked':preferences.formNavigation==='wizard'?'steps':'tabs'};
 const {t,language}=useLocalization();definition=localizeDesignerDefinition(definition,language);const [selected,setSelected]=useState(definition.sections[0]!.id),active=definition.sections.find(s=>s.id===selected)??definition.sections[0]!,index=definition.sections.indexOf(active);
 useEffect(()=>{const section=definition.sections.find(s=>!!errors[s.id]||s.fields.some(f=>errors[f.id])||Object.keys(errors).some(path=>path.startsWith(s.id+'[')));if(section)setSelected(section.id);},[errors]);
 const sections=definition.layout&&definition.layout!=='stacked'?[active]:definition.sections;
 return <div className="space-y-4">{definition.layout==='tabs'&&<Tabs value={active.id} onChange={setSelected} items={definition.sections.map(s=>({id:s.id,label:s.title,badge:s.fields.filter(f=>errors[f.id]).length||undefined}))}/>}
 {sections.map(section=>section.repeatable?<RepeatingDesignerSection key={section.id} definition={definition} section={section} values={values} errors={errors} disabled={disabled} change={rows=>change(section.id,rows)}/>:<TemplateFields key={section.id} columns={definition.columns??2} section={{...section,fields:section.fields.filter(f=>matchesDesignerCondition(f.rules?.visibleWhen,values)).map(f=>({...f,required:f.required||!!(f.rules?.requiredWhen&&matchesDesignerCondition(f.rules.requiredWhen,values))}))}} renderField={field=>{const f=definition.sections.flatMap(s=>s.fields).find(f=>f.id===field.id)!;return f.control?<DesignerPresentationField field={{...f,required:field.required}} value={Array.isArray(values[f.id])?undefined:values[f.id] as TemplateValue} state={states[f.id]} error={errors[f.id]} disabled={disabled} change={v=>change(f.id,v)}/>:undefined;}} values={Object.fromEntries(Object.entries(values).filter(([,v])=>!Array.isArray(v))) as Record<string,TemplateValue>} errors={errors} fieldStates={states} onChange={change} disabled={disabled}/>)}
 {definition.layout==='steps'&&<div className="flex flex-wrap items-center gap-3"><Button disabled={index===0} onClick={()=>setSelected(definition.sections[index-1]!.id)}>{t('Previous')}</Button><p>{t('designer.stepOf',{step:index+1,total:definition.sections.length})}</p><Button disabled={index===definition.sections.length-1} onClick={()=>setSelected(definition.sections[index+1]!.id)}>{t('Next')}</Button></div>}</div>;
}
