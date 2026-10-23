'use client';
import {useFormatters} from '../screen-host';
import React from 'react';
import {SearchSelect,RadioGroup,Segmented,Toggle,RangeField} from '@pepbits/ui';
import {DataValue} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {DesignerField,TemplateValue} from '@pepbits/data/dcp-designer';
import type {TemplateFieldState} from './template-fields';
export function DesignerPresentationField({field,value,state,error,disabled,change}:{field:DesignerField;value:TemplateValue|undefined;state?:TemplateFieldState;error?:string;disabled?:boolean;change:(value:TemplateValue)=>void}){
 const {t}=useLocalization(),format=useFormatters();const off=disabled||state?.disabled,options=state?.options??field.options??[],common={label:field.label,required:field.required,error,disabled:off};
 if(field.control==='readonly')return <div><p>{t(field.label)}</p><DataValue value={value==null?null:field.type==='number'?format.number(Number(value)):field.type==='date'?format.date(String(value)):field.type==='time'?format.time('2000-01-01T'+String(value)):value}/></div>;
 if(field.control==='search')return <SearchSelect {...common} options={options} value={String(value??'')} onChange={change}/>;
 if(field.control==='radio'||field.control==='rating')return <RadioGroup {...common} options={field.control==='rating'?Array.from({length:Math.min(11,(field.rules?.max??10)-(field.min??0)+1)},(_,i)=>({value:String((field.min??0)+i),label:String((field.min??0)+i)})):options} value={String(value??'')} onChange={v=>change(field.control==='rating'?Number(v):v)}/>;
 if(field.control==='segmented')return <div><Segmented label={field.label} options={options.map(o=>({...o,disabled:off}))} value={String(value??'')} onChange={v=>{if(!off)change(v);}}/>{error&&<p role="alert">{error}</p>}</div>;
 if(field.control==='toggle')return <div><Toggle label={field.label} checked={value===true} disabled={off} onChange={change}/>{error&&<p role="alert">{error}</p>}</div>;
 if(field.control==='slider')return <RangeField {...common} min={field.min??0} max={field.rules?.max??10} step={field.rules?.integer?1:0.1} value={typeof value==='number'?value:undefined} onChange={v=>change(v??'')}/>;
 return null;
}
