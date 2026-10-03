'use client';
import {useDiagnosticResource} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';

import { Select } from './ui';

export function useOptions(key:string,params:Record<string,any>={}){
 const {data,error}=useDiagnosticResource<{id:number;label:string}[]>(`/masters/${key}/options`,params);
 return {options:data??[],error};
}

/** Select populated from a master (e.g. departments, analyzers). */
export function RefSelect({ entity, value, onChange, placeholder = 'All', params, className, disabled, id }: {
  entity: string; value: any; onChange: (v: string) => void; placeholder?: string; params?: Record<string, any>; className?: string; disabled?: boolean; id?: string;
}) {
  const {options: opts,error} = useOptions(entity, params);
  return <><Select id={id} className={className} disabled={disabled} value={value ?? ''} onChange={onChange} placeholder={placeholder} options={opts.map((o) => ({ value: o.id, label: o.label }))} />{error && <span role="alert">{error}</span>}</>;
}
