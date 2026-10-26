"use client";
import React from 'react';
import {SECTIONS, describeFieldRule, isEmptyValue, isVisible, ruleFields, type FieldErrors, type FormValues, type Lookups, type SectionId, type SectionProgress} from '@allyvora/shared';
import {FormRulesDrawer} from '@pepbits/patterns/record-form';
export function RulesDrawer({open,onClose,values,errors,lookups,progress,onJump,onRevealAll}: {
 open:boolean;onClose:()=>void;values:FormValues;errors:FieldErrors;lookups:Lookups;progress:Record<SectionId,SectionProgress>;onJump:(section:SectionId,field:string)=>void;onRevealAll:()=>void;
}) {
 return <FormRulesDrawer open={open} onClose={onClose} onRevealAll={onRevealAll} onJump={(section,field)=>onJump(section as SectionId,field)}
 sections={SECTIONS.map(section=>({id:section.id,title:section.title,progress:progress[section.id],rules:ruleFields(section.id).map(field=>({id:field.id,label:field.label,description:describeFieldRule(field,lookups),visible:isVisible(field,values),filled:field.type==='switch'?values[field.id]===true:!isEmptyValue(values[field.id]),error:errors[field.id]}))}))}/>;
}
