"use client";
import React from 'react';
import {Button,useLocalization} from '@pepbits/ops-ui';
import type {UserPreferences} from '@pepbits/erp-config';
import {RecordSectionLayout,RecordSectionCard} from '../clinical-templates/record-layout';
import styles from './record-page.module.css';
export interface RecordPageSection {id:string;title:string;heading:string;subtitle?:string;icon?:React.ReactNode}
export interface RecordPageAction {id:string;label:string;onClick:()=>void;disabled?:boolean;primary?:boolean;hidden?:boolean}
/** All wording, permissions and handlers come from the application. */
export function RecordActionBar({actions}:{actions:RecordPageAction[]}){
 const {t}=useLocalization();
 return <div className={styles.actions}>{actions.filter(a=>!a.hidden).map(a=><Button key={a.id} size="sm" variant={a.primary?'primary':'secondary'} disabled={a.disabled} onClick={a.onClick}>{t(a.label)}</Button>)}</div>;
}
export function RecordIdentity({label,name,reference}:{label:string;name:string;reference?:string}){
 const {t}=useLocalization();
 return <><p className={styles.identityLabel}>{t(label)}</p><p className={styles.identityName}>{name}</p>{reference&&<p className={styles.identityReference}>{reference}</p>}</>;
}
export function RecordNotice({children,variant='banner',role}:{children:React.ReactNode;variant?:'banner'|'message'|'muted';role?:'status'|'alert'}){
 return <div className={styles.notice} data-variant={variant} role={role}>{children}</div>;
}
/** Shared record presentation; no patient contracts, API traffic, persisted drafts or permission inference. */
export function RecordPage<T extends RecordPageSection>({sections,active,onActive,preferences,isDone,identity,actions,renderSection,isReading,onRead,feedback,showCompletion=true}:{
 sections:T[];active:string;onActive:(id:string)=>void;preferences:UserPreferences;isDone:(id:string)=>boolean;
 identity:React.ReactNode;actions:RecordPageAction[];renderSection:(section:T)=>React.ReactNode;
 isReading?:(id:string)=>boolean;onRead?:(id:string)=>void;feedback?:React.ReactNode;showCompletion?:boolean;
}){
 return <div className={styles.page} data-record-page>{feedback}
  <RecordSectionLayout sections={sections} active={active} onActive={onActive} preferences={preferences} keepMounted sizing="container" showCompletion={showCompletion} isDone={isDone} railHeader={identity} footer={<RecordActionBar actions={actions}/>}
   renderSection={s=><RecordSectionCard id={s.id} index={sections.indexOf(s)} title={s.heading} subtitle={s.subtitle??''} icon={s.icon} reading={isReading?.(s.id)} onRead={onRead?()=>onRead(s.id):undefined}>{renderSection(s)}</RecordSectionCard>}/>
 </div>;
}
