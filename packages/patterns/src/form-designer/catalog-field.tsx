'use client';
import React from 'react';
import {Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {sameCatalogRef,type DesignerCatalog,type DesignerField} from '@pepbits/data/dcp-designer';
export function CatalogSource({field,catalog,disabled,change}:{field:DesignerField;catalog:DesignerCatalog;disabled:boolean;change:(f:DesignerField)=>void}){
 const {t}=useLocalization();return <Select label={t('designer.catalogSource')} aria-label={t('designer.catalogSource')} value={field.valueSet?`${field.valueSet.id}@${field.valueSet.revision}`:''} disabled={disabled} placeholder={t('designer.catalogInline')} options={catalog.sets.map(s=>({value:`${s.id}@${s.revision}`,label:t('designer.catalogVersion',{name:t(s.name),version:s.revision})}))} onChange={e=>{const set=catalog.sets.find(s=>`${s.id}@${s.revision}`===e.target.value);change({...field,valueSet:set?{id:set.id,revision:set.revision}:undefined,relationship:undefined,dependsOn:undefined,additionalParents:undefined,options:set?undefined:[{value:'option1',label:t('designer.option')}]});}}/>;
}
export function CatalogMapping({field,parent,catalog,disabled,change}:{field:DesignerField;parent?:DesignerField;catalog:DesignerCatalog;disabled:boolean;change:(f:DesignerField)=>void}){
 const {t}=useLocalization();return <><Select label={t('designer.catalogRelationship')} aria-label={t('designer.catalogRelationship')} value={field.relationship?`${field.relationship.id}@${field.relationship.revision}`:''} disabled={disabled} options={catalog.relationships.filter(r=>sameCatalogRef(r.child,field.valueSet)&&sameCatalogRef(r.parent,parent?.valueSet)).map(r=>({value:`${r.id}@${r.revision}`,label:t('designer.catalogVersion',{name:t(r.name),version:r.revision})}))} onChange={e=>{const r=catalog.relationships.find(r=>`${r.id}@${r.revision}`===e.target.value);change({...field,relationship:r?{id:r.id,revision:r.revision}:undefined});}}/><p>{t('designer.catalogPinned')}</p></>;
}
