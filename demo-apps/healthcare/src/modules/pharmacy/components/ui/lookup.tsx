'use client';
import {useCallback,type ReactNode} from 'react';
import {AsyncLookup} from '@pepbits/ui';
import {useApiClient} from '../../lib/api';
/** Pharmacy lookup adapter: public combobox behavior, product endpoints and row content. */
export function Lookup<T extends {id:string}>({endpoint,placeholder,render,onPick,autoFocus,className,value,minChars=1,inputClassName}:{
 endpoint:(query:string)=>string;placeholder:string;render:(item:T,active:boolean)=>ReactNode;onPick:(item:T)=>void;autoFocus?:boolean;className?:string;value?:string;minChars?:number;inputClassName?:string;
}){
 const api=useApiClient();
 const load=useCallback((query:string,signal:AbortSignal)=>api.get<T[]>(endpoint(query),{signal}),[api,endpoint]);
 return <AsyncLookup loadOptions={load} getKey={item=>item.id} renderOption={render} onPick={onPick} label={placeholder} placeholder={placeholder}
  autoFocus={autoFocus} className={className} initialQuery={value} minChars={minChars} inputClassName={inputClassName}/>;
}
