'use client';
import React from 'react';
import {Button,Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {DesignerField,DesignerCatalog} from '@pepbits/data/dcp-designer';
import {CatalogMapping} from './catalog-field';
export function MultiParentProperties({field,parents,catalog,disabled,change}:{field:DesignerField;parents:DesignerField[];catalog:DesignerCatalog;disabled:boolean;change:(field:DesignerField)=>void}){
 const {t}=useLocalization();if(!field.dependsOn)return null;
 const extra=field.additionalParents??[],remaining=parents.filter(p=>p.id!==field.dependsOn&&!extra.some(e=>e.fieldId===p.id));
 return <div className="space-y-3"><p>{t('designer.multiParentHelp')}</p>{extra.map((p,i)=><div key={p.fieldId} className="space-y-2"><p>{t(parents.find(x=>x.id===p.fieldId)?.label??p.fieldId)}</p>
 {field.valueSet?<CatalogMapping field={{...field,dependsOn:p.fieldId,relationship:p.relationship}} parent={parents.find(x=>x.id===p.fieldId)} catalog={catalog} disabled={disabled} change={f=>change({...field,additionalParents:extra.map((x,j)=>j===i?{...x,relationship:f.relationship}:x)})}/>:field.options?.map((o,index)=><Select key={index} label={t('designer.parentFor',{label:t(o.label)})} value={o.parentValues?.[p.fieldId]??''} options={parents.find(x=>x.id===p.fieldId)?.options??[]} disabled={disabled} onChange={e=>change({...field,options:field.options?.map((x,j)=>j===index?{...x,parentValues:{...x.parentValues,[p.fieldId]:e.target.value}}:x)})}/>)}
 <Button disabled={disabled} onClick={()=>change({...field,additionalParents:extra.filter((_,j)=>j!==i),options:field.options?.map(o=>({...o,parentValues:Object.fromEntries(Object.entries(o.parentValues??{}).filter(([id])=>id!==p.fieldId))}))})}>{t('designer.removeParent')}</Button>
 </div>)}<Select label={t('designer.addParent')} value="" options={remaining.map(p=>({value:p.id,label:p.label}))} disabled={disabled||extra.length>=3||!remaining.length} onChange={e=>{if(remaining.some(p=>p.id===e.target.value))change({...field,additionalParents:[...extra,{fieldId:e.target.value}]});}}/></div>;
}
