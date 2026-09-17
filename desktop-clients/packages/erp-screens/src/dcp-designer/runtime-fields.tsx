'use client';
import React from 'react';
import {Card,CardHeader,CardTitle,CardContent,CardGrid,Input,DateInput,Select,Button,DataValue,useLocalization} from '@pepbits/ops-ui';
import type {DcpRuntimeField,DcpRuntimeView,DcpValue} from '@pepbits/erp-config';
/** Server-filtered controls; no client execution of server expressions or permission inference. */
export type DcpFieldRenderer=(input:{field:DcpRuntimeField;path:string;value:DcpValue|undefined;disabled:boolean;error:string;change:(value:DcpValue)=>void})=>React.ReactNode|undefined;
export function DcpRuntimeFields({fields,values,view,change,disabled=false,prefix='',renderField,columns=2}:{fields:DcpRuntimeField[];values:Record<string,DcpValue|undefined>;view:DcpRuntimeView;change:(code:string,value:DcpValue)=>void;disabled?:boolean;prefix?:string;renderField?:DcpFieldRenderer;columns?:1|2|3|4|"auto"}){
 const {t}=useLocalization();
 return <CardGrid columns={columns}>{fields.map(f=>{
  const value=values[f.code],path=prefix+f.code,error=view.violations.filter(e=>e.path===path).map(e=>t('designer.v1.error.'+e.code)===('designer.v1.error.'+e.code)?t('designer.invalidValues'):t('designer.v1.error.'+e.code)).join(' '),off=disabled||!f.writable||f.masked;
  const common={name:path,label:f.label,"aria-label":f.label,required:f.required,error,disabled:off};
  if(f.masked)return <div key={f.code}><p>{t(f.label)}</p><p>{t('designer.v1.masked')}</p></div>;
  if(f.type==='COLLECTION'){
   const rows=Array.isArray(value)?value:[];
   return <Card key={f.code} className="col-span-full"><div tabIndex={-1} data-dcp-collection={path}><CardHeader><CardTitle title={f.label}/></CardHeader><CardContent className="space-y-3">{error&&<p role="alert">{error}</p>}{rows.map((row,i)=>{
    if(row._delete)return <div key={row._id??i}><p>{t('designer.v1.removed')}</p><Button disabled={off} onClick={()=>change(f.code,rows.map((r,j)=>j===i?{...r,_delete:false}:r))}>{t('designer.v1.undo')}</Button></div>;
    const rowPath=path+'['+(row._id??row._localKey??i)+']',allowed=row._id?view.rowFields[rowPath]:f.children;
    return <Card key={row._id??String(row._localKey??i)}><CardContent className="space-y-2">{allowed?<DcpRuntimeFields fields={allowed} columns={columns} values={row} view={view} prefix={rowPath+'.'} disabled={off} renderField={renderField} change={(id,v)=>change(f.code,rows.map((r,j)=>j===i?{...r,[id]:v}:r))}/>:<p role="alert">{t('designer.v1.rowUnavailable')}</p>}
    <Button disabled={off||!allowed||(f.required&&rows.filter(r=>!r._delete).length<=1)} onClick={()=>change(f.code,row._id?rows.map((r,j)=>j===i?{...r,_delete:true}:r):rows.filter((_,j)=>i!==j))}>{t('designer.v1.removeRow')}</Button></CardContent></Card>;
   })}<Button disabled={off||rows.filter(r=>!r._delete).length>=f.maxItems} onClick={()=>change(f.code,[...rows,{_localKey:crypto.randomUUID()}])}>{t('designer.v1.addRow')}</Button></CardContent></div></Card>;
  }
  if(!f.writable)return <div key={f.code}><p>{t(f.label)}</p><DataValue value={value as string|number|boolean|null}/></div>;
  const custom=renderField?.({field:f,path,value,disabled:off,error,change:v=>{if(!off)change(f.code,v);}});
  if(custom!==undefined)return <React.Fragment key={f.code}>{custom}</React.Fragment>;
  if(f.type==='BOOLEAN')return <Select key={f.code} {...common} value={value===true?'true':value===false?'false':''} options={[{value:'true',label:t('Yes')},{value:'false',label:t('No')}]} onChange={e=>change(f.code,e.target.value===''?null:e.target.value==='true')}/>;
  if(f.type==='CHOICE')return <Select key={f.code} {...common} value={String(value??'')} options={f.options.map(o=>({value:o.code,label:o.label}))} onChange={e=>change(f.code,e.target.value||null)}/>;
  if(f.type==='DATE')return <DateInput key={f.code} {...common} value={String(value??'')} onChange={e=>change(f.code,e.target.value||null)}/>;
  // An instant is not a local wall clock: explicit offset is retained without guessing the host timezone.
  if(f.type==='DATETIME')return <Input key={f.code} {...common} value={String(value??'')} hint={t('designer.v1.instant')} onChange={e=>change(f.code,e.target.value||null)}/>;
  if(f.type==='INTEGER'||f.type==='DECIMAL')return <Input key={f.code} {...common} type="number" step={f.type==='INTEGER'?1:'any'} min={f.minimum??undefined} max={f.maximum??undefined} value={String(value??'')} onChange={e=>change(f.code,e.target.value===''?null:Number(e.target.value))}/>;
  return <Input key={f.code} {...common} maxLength={f.maxLength} value={String(value??'')} onChange={e=>change(f.code,e.target.value)}/>;
 })}</CardGrid>;
}
