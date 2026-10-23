"use client";
import React from 'react';
import {Badge, Button} from "@pepbits/ui";
import {CardGrid, StatCard} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {RecordSectionLayout} from '../record-layout';
import {TemplateFields,TemplateChecklist} from './template-parts';
import {TemplateLines,TemplateList,type TemplateEngineProps} from './template-engines';
import {lineTotals} from './template-state';
import styles from './registry-template.module.css';

/** Presentation only: state, validation, saves and policy resolution remain in the shared engine. */
export function RegistryTemplateBody({section,onSection,dirty,busy,onSave,onDiscard,...props}:TemplateEngineProps & {section:string;onSection:(id:string)=>void;dirty:boolean;busy:boolean;onSave:()=>void;onDiscard:()=>void}) {
 const {definition,document,preferences,format,disabled,errors,update}=props,{t}=useLocalization();
 const totals=lineTotals(document.lines,preferences.decimalPlaces);
 const sections=[...definition.sections,...(definition.engine==='order'?[{id:'lines',title:'template.lineItems',fields:[]}]:definition.engine==='case'?[{id:'checklist',title:'template.checklist',fields:[]}]:[])];
 const active=sections.findIndex(item=>item.id===section),index=Math.max(0,active);
 const identity=<div className={styles.identity}><div><span className={styles.eyebrow}>{t('template.field.code')}</span><strong>{String(document.values.code??document.id)}</strong></div><div><span className={styles.eyebrow}>{t('template.field.name')}</span><strong>{String(document.values.name??document.values.party??'')}</strong></div>{definition.engine==='order'?<div className={styles.amount}><span className={styles.eyebrow}>{t('template.total')}</span><strong>{format.money(totals.amount)}</strong></div>:null}<Badge tone={dirty?'warning':'success'}>{t(dirty?'template.unsaved':'template.ready')}</Badge></div>;
 const metrics=definition.engine==='list'?<CardGrid columns={3}><StatCard label="template.records" value={format.number(document.rows.length)}/><StatCard label="template.status.review" value={format.number(document.rows.filter(row=>row.status==='review').length)}/><StatCard label="template.status.completed" value={format.number(document.rows.filter(row=>row.status==='completed').length)}/></CardGrid>:null;
 return <div className={styles.family} data-registry-template={definition.id} data-tour="template-body" data-density={preferences.density}>
 {definition.engine==='list'?<div className={styles.worklist}>{metrics}<TemplateList {...props}/><div className={styles.actions}><Badge tone={dirty?'warning':'success'}>{t(dirty?'template.unsaved':'template.ready')}</Badge><Button disabled={!dirty||busy} onClick={onDiscard}>{t('template.clinical.discard')}</Button><Button data-tour="template-actions" variant="primary" disabled={disabled} loading={busy} onClick={onSave}>{t('template.save')}</Button></div></div>:<RecordSectionLayout sections={sections} active={sections[index]!.id} onActive={onSection}
 identity={identity} railHeader={<strong>{t(definition.title)}</strong>}
 isDone={id=>{const item=sections.find(s=>s.id===id)!;if(id==='lines')return document.lines.length>0&&!errors.lines;return item.fields.every(field=>!errors[field.id]&&(!field.required||String(document.values[field.id]??'').trim()!==''));}}
 renderSection={item=><div className={styles.section}><div className={styles.content}>{item.id==='lines'?<TemplateLines {...props}/>:item.id==='checklist'?<TemplateChecklist lines={document.lines} disabled={disabled} onChange={lines=>update({...document,lines})}/>:<TemplateFields section={item} values={document.values} errors={errors} disabled={disabled} onChange={(id,value)=>update({...document,values:{...document.values,[id]:value}})}/>}</div></div>}
 footer={<div className={styles.actions}><Badge tone={dirty?'warning':'success'}>{t(dirty?'template.unsaved':'template.ready')}</Badge><Button disabled={!dirty||busy} onClick={onDiscard}>{t('template.clinical.discard')}</Button><div className={styles.spacer}/>{preferences.formNavigation==='wizard'?<><Button disabled={index===0} onClick={()=>onSection(sections[index-1]!.id)}>{t('template.previous')}</Button>{index<sections.length-1?<Button onClick={()=>onSection(sections[index+1]!.id)}>{t('template.next')}</Button>:null}</>:null}<Button data-tour="template-actions" variant="primary" disabled={disabled} loading={busy} onClick={onSave}>{t('template.save')}</Button></div>}/>}</div>;
}
