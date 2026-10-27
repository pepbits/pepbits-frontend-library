import {useId} from 'react';
import {Input, Select, DateInput, TimeInput, Textarea, Toggle} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useFetch, listUrl} from '../client';
import type {Field, ListResponse} from '../types';

/** Source master field metadata, composed from public preference-aware controls. */
export function MasterField({field, value, onChange, compact=false, disabled=false, suggestions=false, error}:{field:Field;value:unknown;onChange:(value:unknown)=>void;compact?:boolean;disabled?:boolean;suggestions?:boolean;error?:string}) {
 const {t}=useLocalization(),id=useId(),refs=useFetch<ListResponse>(field.type==='ref'&&field.ref?listUrl(field.ref,{size:500}):null);
 const common={label:compact?undefined:field.label,'aria-label':t(field.label),required:field.required,error,disabled:disabled||field.readOnly};
 const pool=suggestions?field.pool:undefined;
 const text=String(value??''),change=(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>onChange(event.target.value);
 if(field.type==='boolean')return <Toggle label={field.label} checked={!!value} onChange={onChange} disabled={common.disabled}/>;
 if(field.type==='select'||field.type==='status')return <Select {...common} value={text} placeholder="Select…" options={[...new Set([...(field.options??[]),...(text?[text]:[])])].map(value=>({value,label:value}))} onChange={change}/>;
 if(field.type==='date')return <DateInput {...common} value={text} onChange={change}/>;
 if(field.type==='time')return <TimeInput {...common} value={text} step={1800} onChange={change}/>;
 if(field.type==='textarea')return <Textarea {...common} rows={compact?2:3} value={text} onChange={change}/>;
 if(['number','currency','percent'].includes(field.type))return <Input {...common} type="number" step={field.type==='currency'?'0.01':'any'} value={text} onChange={event=>onChange(event.target.value===''?'':Number(event.target.value))}/>;
 return <><Input {...common} value={text} type={field.type==='email'?'email':field.type==='phone'?'tel':'text'} list={field.type==='ref'||pool?id:undefined} onChange={change}/>{(field.type==='ref'||pool)&&<datalist id={id}>{pool?.map(value=><option key={value} value={value}/>)}{refs.data?.rows.map(row=><option key={row.id} value={String(row.name??row.code)}/>)}</datalist>}</>;
}
