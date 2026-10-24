import React from 'react';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {TemplateFields} from './template-parts';
import type {TemplateSection,TemplateValue} from '../types';
export interface FieldRow {id:string;values:Record<string,TemplateValue>}
/** Controlled rows: the host owns validation, defaults and domain calculations. */
export function FieldRows({title,fields,rows,onChange,createRow,disabled=false,readOnlyKeys=[]}:{title:string;fields:TemplateSection['fields'];rows:FieldRow[];onChange:(rows:FieldRow[])=>void;createRow:()=>FieldRow;disabled?:boolean;readOnlyKeys?:string[]}){
 const {t}=useLocalization();return <section aria-label={t(title)} className="space-y-3"><h3>{t(title)}</h3>{rows.map((row,index)=><div key={row.id}><TemplateFields section={{id:row.id,title:t('Line')+' '+(index+1),fields}} values={row.values} errors={{}} disabled={disabled} fieldStates={Object.fromEntries(readOnlyKeys.map(k=>[k,{disabled:true}]))} onChange={(key,value)=>onChange(rows.map(r=>r.id===row.id?{...r,values:{...r.values,[key]:value}}:r))}/>{!disabled&&<Button onClick={()=>onChange(rows.filter(r=>r.id!==row.id))}>{t('Remove line {value0}',{value0:index+1})}</Button>}</div>)}{!disabled&&<Button onClick={()=>onChange([...rows,createRow()])}>{t('Add line')}</Button>}</section>;
}
