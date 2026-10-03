'use client';
import {createContext,useContext,useEffect,useCallback,useRef,useState,useMemo,type ReactNode,createElement} from 'react';
import {useReferenceHost} from '@pepbits/reference-host';
export type User={id:number;emp_code:string;name:string;role:string;specialty:string|null;title:string|null};
export class ApiError extends Error{constructor(public status:number,message:string,public data:Record<string,any>={}){super(message);}get blockers():string[]{return this.data.blockers??this.data.conflicts?.map((x:{message:string})=>x.message)??[];}}
interface Client{user:User|null;call:<T=any>(path:string,init?:{method?:string;body?:unknown})=>Promise<T>;controllers:Set<AbortController>;masters:Map<string,Promise<unknown>>;masterListeners:Set<()=>void>;bootstrapError:ApiError|null;retry:()=>void}
const Context=createContext<Client|null>(null);
export function useClient(){const v=useContext(Context);if(!v)throw new Error('Authenticated SurgiSuite host required');return v;}
export function SurgiSuiteDataProvider({children}:{children:ReactNode}){
 const host=useReferenceHost(),[user,setUser]=useState<User|null>(null),[bootstrapError,setBootstrapError]=useState<ApiError|null>(null);
 const value=useRef<Client|null>(null);
 if(!value.current){const pending=new Map<string,string>();const controllers=new Set<AbortController>();value.current={user:null,bootstrapError:null,retry:()=>{},controllers,masters:new Map(),masterListeners:new Set(),async call<T=any>(path:string,init:{method?:string;body?:unknown}={}){
  const method=init.method??(init.body!==undefined?'POST':'GET'),write=!['GET','HEAD'].includes(method),payload=init.body===undefined?undefined:JSON.stringify(init.body),sig=JSON.stringify([method,path,payload]),key=pending.get(sig)??crypto.randomUUID();const controller=new AbortController();controllers.add(controller);
  try{const result=await host.request<T>('/api'+path,{method,headers:{'Content-Type':'application/json',...(write?{'Idempotency-Key':key}:{})},body:payload,signal:controller.signal});pending.delete(sig);return result;}
  catch(error){const e=error as any;const status=e.status??0;if(write&&[0,408,502,503,504].includes(status))pending.set(sig,key);const data=e.details??{};throw new ApiError(status,typeof data.error==='string'?data.error:typeof data.error?.message==='string'?data.error.message:e.message??'The service is unavailable. Try again.',data);}
  finally{controllers.delete(controller);}
 }};}
 const client=value.current;client.user=user;client.bootstrapError=bootstrapError;client.retry=()=>{setBootstrapError(null);client.call<User>("/auth/me").then(setUser).catch(setBootstrapError);};
 useEffect(()=>{let alive=true;client.call<User>('/auth/me').then(u=>alive&&setUser(u)).catch(e=>alive&&setBootstrapError(e));return()=>{alive=false;for(const c of client.controllers)c.abort();client.masters.clear();};},[client]);
 const provided=useMemo(()=>({...client,user,bootstrapError}),[client,user,bootstrapError]);
 return createElement(Context.Provider,{value:provided},children);
}
export function useSourceApi(){return useClient().call;}
export function useApi<T=any>(path:string|null,intervalMs?:number){
 const client=useClient(),[data,setData]=useState<T|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(!!path),seq=useRef(0);
 const load=useCallback(async(quiet=false)=>{if(!path)return;const n=++seq.current;if(!quiet)setLoading(true);try{const d=await client.call<T>(path);if(n===seq.current){setData(d);setError(null);}}catch(e){if(n===seq.current)setError(e as ApiError);}finally{if(n===seq.current)setLoading(false);}},[client,path]);
 useEffect(()=>{setData(null);setError(null);void load();const t=intervalMs?setInterval(()=>void load(true),intervalMs):null;return()=>{seq.current++;if(t)clearInterval(t);};},[load,intervalMs]);
 return {data,error,loading,reload:()=>load(true),setData};
}
