"use client";
import React,{useEffect,type ReactNode} from 'react';
import {Button} from '@pepbits/ui';
import {ArrowLeft,ChevronLeft,ChevronRight,ListChecks,Save} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import type {UserPreferences} from '@pepbits/preferences';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {RecordSectionLayout,type RecordFormSection,type RecordSectionProgress} from './index';
export interface RecordFormContext<V> {
 values:V; mode:'new'|'edit'|'view'; readOnly:boolean; preferences:UserPreferences;
 /** Hosts validate domain fields at this effective timing. */
 validateOn:UserPreferences['formValidateOn']; keepUnsaved:boolean; columns:2|3|4;
}
export interface RecordFormProps<V,T extends RecordFormSection=RecordFormSection> {
 mode:'new'|'edit'|'view';values:V;sections:readonly T[];active:string;onActive:(id:string)=>void;
 progress:Record<string,RecordSectionProgress>;renderSection:(section:T,context:RecordFormContext<V>)=>ReactNode;
 summary?:ReactNode;children?:ReactNode;status?:ReactNode;dirty?:boolean;onDirtyChange?:(dirty:boolean)=>void;
 onBack?:()=>void;onCheckRules?:()=>void;onSave?:()=>void|Promise<void>;onNext?:()=>void;onPrevious?:()=>void;
 saving?:boolean;saveDisabled?:boolean;backLabel?:string;saveLabel?:string;rulesLabel?:string;uid?:string;className?:string;
}
/** Controlled record engine. The host owns values, validation, adapters and draft persistence. */
export function RecordForm<V,T extends RecordFormSection>({mode,values,sections,active,onActive,progress,renderSection,summary,children,status,dirty=false,onDirtyChange,onBack,onCheckRules,onSave,onNext,onPrevious,saving=false,saveDisabled=false,backLabel='Back',saveLabel='Save',rulesLabel='Check form rules',uid,className}:RecordFormProps<V,T>){
 const {preferences}=usePreferences(),{t}=useLocalization(),host=useScreenHost();
 const reportDirty=host.document.reportDirty;
 useEffect(()=>{reportDirty(mode!=='view'&&dirty);onDirtyChange?.(mode!=='view'&&dirty);},[dirty,mode,reportDirty,onDirtyChange]);
 const index=sections.findIndex(section=>section.id===active),last=index>=sections.length-1,stepped=['tabs','wizard','stepper'].includes(preferences.formNavigation);
 const context:RecordFormContext<V>={values,mode,readOnly:mode==='view',preferences,validateOn:preferences.formValidateOn,keepUnsaved:preferences.formKeepUnsaved,columns:preferences.formColumns};
 return <div style={{"--fs-scale":"var(--fs-form, 1)"} as React.CSSProperties} className={`flex h-full min-h-0 flex-col gap-2 ${className??''}`} data-record-form={mode} data-form-layout={preferences.formNavigation}>
 {preferences.formShowSummary?summary:null}{children}
 <RecordSectionLayout headingLevel={2} sections={sections} active={active} onActive={onActive} progress={progress} isDone={id=>progress[id]?.state==='complete'} keepMounted sizing="container" uid={uid} onNext={onNext} renderSection={section=>renderSection(section,context)}/>
 <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 shadow-[var(--shadow-sm)] sm:px-3" data-form-actions="">
 {onBack?<Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true"/>{t(backLabel)}</Button>:null}
 <span className="hidden text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)] lg:inline" aria-live="polite">{status}</span>
 <div className="ms-auto flex items-center gap-2">
 {onCheckRules?<Button variant="secondary" onClick={onCheckRules}><ListChecks className="size-4" aria-hidden="true"/>{t(rulesLabel)}</Button>:null}
 {stepped?<Button variant="secondary" disabled={index<=0} aria-label={t('Previous section')} onClick={onPrevious??(()=>onActive(sections[index-1]!.id))}><ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true"/><span className="hidden xl:inline">{t('Previous')}</span></Button>:null}
 {stepped&&!last?<Button variant={preferences.formNavigation==='wizard'?'primary':'secondary'} onClick={onNext??(()=>onActive(sections[index+1]!.id))}>{t('Next: {section}',{section:t(sections[index+1]!.short??sections[index+1]!.title)})}<ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true"/></Button>:null}
 {mode!=='view'&&onSave?<Button variant={preferences.formNavigation==='wizard'&&!last?'secondary':'primary'} disabled={saving||saveDisabled} aria-busy={saving||undefined} onClick={()=>void onSave()}><Save className="size-4" aria-hidden="true"/>{t(saving?'Saving…':saveLabel)}</Button>:null}
 </div></div></div>;
}
