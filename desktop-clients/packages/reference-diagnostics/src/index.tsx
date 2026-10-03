'use client';
import React, {createContext,useContext,useMemo,useEffect,useState,useRef,useCallback} from 'react';
import {useReferenceHost,useReferenceFormat} from '@pepbits/reference-host';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';

export {ReferenceLink, useReferenceRouter, useReferencePathname, useReferenceSearchParams} from '@pepbits/reference-host';
export {SourceInput as DiagnosticInput, SourceDateInput as DiagnosticDateInput, SourceTextarea as DiagnosticTextarea, SourceButton as DiagnosticButton, SourceSelect as DiagnosticSelect, Table as DiagnosticTable, TableHeader, TableBody, TableRow, TableHead, TableCell} from '@pepbits/ops-ui';
export class ApiError extends Error {constructor(message:string,public status:number,public body?:unknown){super(message);}}
export const qs=(params:Record<string,unknown>={})=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v));return p.size?'?'+p:'';};
export type DiagnosticUser={id:number;username:string;fullName:string;full_name:string;name:string;role:string;department_id:number|null};
const Params=createContext<Record<string,string>>({});
export const DiagnosticParams=Params.Provider;
export const useParams=<T extends Record<string,string>>()=>useContext(Params) as T;
export function notFound():never {throw new Error('Diagnostic record not found');}
/** Each mounted module owns its transport, identity and caches; no global tokens or patient cache. */
export function useDiagnosticClient(){
 const host=useReferenceHost();
 return useMemo(()=>{
  const fetch=(path:string,init?:RequestInit)=>{if(!host.fetch)throw new Error('Authenticated fetch is required');return host.fetch(path.startsWith('/api/')||path==='/api'?path:'/api'+path,init);};
  async function request<T=any>(path:string,opts:{method?:string;body?:any;json?:unknown;headers?:HeadersInit;raw?:boolean;signal?:AbortSignal}={}):Promise<T>{
   const payload=opts.json!==undefined?opts.json:opts.body,headers=new Headers(opts.headers);
   if(payload!==undefined&&typeof payload!=='string'&&!(payload instanceof FormData))headers.set('Content-Type','application/json');
   const response=await fetch(path,{method:opts.method??(payload!==undefined?'POST':'GET'),headers,signal:opts.signal,body:payload===undefined?undefined:typeof payload==='string'||payload instanceof FormData?payload:JSON.stringify(payload)});
   const text=await response.text();let data:any=text;try{data=text?JSON.parse(text):null;}catch{}
   if(!response.ok)throw new ApiError(Array.isArray(data?.message)?data.message.join('; '):data?.message??data?.error??`Request failed (${response.status})`,response.status,data);
   return (opts.raw?text:data) as T;
  }
  const methods={get:<T=any,>(path:string,params?:Record<string,unknown>)=>request<T>(path+qs(params)),post:<T=any,>(path:string,body?:unknown)=>request<T>(path,{method:'POST',body:body??{}}),put:<T=any,>(path:string,body?:unknown)=>request<T>(path,{method:'PUT',body:body??{}}),del:<T=any,>(path:string)=>request<T>(path,{method:'DELETE'})};
  return {...methods,api:Object.assign(request,methods),fetch,open:(path:string)=>host.openInNewContext?.(path),href:(path:string)=>host.hrefFor?.(path)??path};
 },[host.fetch,host.request,host.openInNewContext,host.hrefFor]);
}
export function useDiagnosticResource<T=any>(path:string|null,params?:Record<string,unknown>,poll?:number){
 const {get}=useDiagnosticClient(),[data,setData]=useState<T|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(!!path),seq=useRef(0);
 const key=JSON.stringify(params??{});
 const reload=useCallback(async()=>{if(!path)return;const n=++seq.current;setLoading(true);try{const value=await get<T>(path,JSON.parse(key));if(n===seq.current){setData(value);setError(null);}}catch(e){if(n===seq.current)setError((e as Error).message);}finally{if(n===seq.current)setLoading(false);}},[get,path,key]);
 useEffect(()=>{setData(null);void reload();const timer=poll?setInterval(()=>void reload(),poll):undefined;return()=>{seq.current++;if(timer)clearInterval(timer);};},[reload,poll]);
 return {data,error,loading,reload,setData};
}
export function useDiagnosticFormat(){const f=useReferenceFormat();return {fmtDate:(v?:string|Date|null)=>v?f.date(v instanceof Date?v.toISOString():v):'—',fmtDateTime:(v?:string|Date|null)=>v?f.dateTime(v instanceof Date?v.toISOString():v):'—',fmtTime:(v?:string|Date|null)=>v?f.time(v instanceof Date?v.toISOString():v):'—',money:(n?:number|null,_currency?:string)=>f.money(n??0)};}
export {matchDiagnosticRoute} from './routes';
const Worklist=createContext<{ids:number[];setIds:(ids:number[])=>void}|null>(null);
export function useDiagnosticWorklist(){const value=useContext(Worklist);if(!value)throw new Error('Diagnostic session required');return value;}
const Session=createContext<DiagnosticUser|null>(null);
export function useDiagnosticUser(){return useContext(Session);}
export function DiagnosticSession({children}:{children:React.ReactNode}){const [ids,setIds]=useState<number[]>([]);const {data,error}=useDiagnosticResource<{user:DiagnosticUser}>('/api/session');if(error)return <p role="alert">{error}</p>;if(!data)return <p role="status"><ReferenceText message="Loading diagnostic workspace…" /></p>;return <Session.Provider value={data.user}><Worklist.Provider value={{ids,setIds}}>{children}</Worklist.Provider></Session.Provider>;}
export function DiagnosticBarcode({value,height=34,className}:{value:string;height?:number;className?:string}){
 const referenceT = useReferenceLocalization().t;

 const {data,error}=useDiagnosticResource<{svg:string}>('/api/barcode',{value,height});
 if(error)return <span role="alert"><ReferenceText message="Barcode unavailable" /></span>;
 return data?<img className={className} height={height} alt={referenceT("Barcode {value0}", {value0: value})} src={'data:image/svg+xml;base64,'+data.svg}/>:<span role="status"><ReferenceText message="Loading barcode…" /></span>;
}
