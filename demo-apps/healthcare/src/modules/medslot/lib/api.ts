'use client';
import {createContext,useContext,useEffect,useRef,createElement,type ReactNode} from 'react';
import {useReferenceHost} from '../host';
export class ApiError extends Error{constructor(public status:number,message:string,public details: {fields?:Record<string,string>;problems?:{message:string}[];[k:string]:unknown}={}){super(message);}get fields(){return this.details.fields??{};}}
type Api=<T=unknown>(path:string,init?:RequestInit&{json?:unknown})=>Promise<T>;
const Ctx=createContext<Api|null>(null);
/** Host-scoped transport. Only ambiguous writes retain their key for an identical explicit retry. */
export function MedslotApiProvider({children}:{children:ReactNode}){
 const host=useReferenceHost(),hostRef=useRef(host);hostRef.current=host;
 const pending=useRef(new Map<string,string>()),controllers=useRef(new Set<AbortController>()),generation=useRef(0),fn=useRef<Api|null>(null);
 if(!fn.current)fn.current=async<T,>(path:string,init:RequestInit&{json?:unknown}={}):Promise<T>=>{
  const {json,...rest}=init,method=(init.method??(json===undefined?'GET':'POST')).toUpperCase(),write=!['GET','HEAD'].includes(method),payload=json===undefined?init.body:JSON.stringify(json),sig=JSON.stringify([method,path,payload]),key=pending.current.get(sig)??crypto.randomUUID(),ctrl=new AbortController(),version=generation.current;
  controllers.current.add(ctrl);if(write)pending.current.set(sig,key);
  const abort=()=>ctrl.abort();rest.signal?.addEventListener('abort',abort,{once:true});if(rest.signal?.aborted)ctrl.abort();
  const headers=new Headers(rest.headers);headers.set('Content-Type','application/json');if(write)headers.set('Idempotency-Key',key);
  try{const data=await hostRef.current.request<T>(path,{...rest,method,body:payload,headers,signal:ctrl.signal});
   if(ctrl.signal.aborted||generation.current!==version)throw new DOMException('Obsolete MedSlot operation','AbortError');
   pending.current.delete(sig);return data;
  }catch(err){
   if(generation.current!==version||ctrl.signal.aborted)throw new DOMException('Obsolete MedSlot operation','AbortError');
   const e=err as {status?:number;details?:any;message?:string},status=e.status??0;
   if(write&&![0,408,502,503,504].includes(status))pending.current.delete(sig);
   const d=e.details??{};throw new ApiError(status,typeof d.error==='string'?d.error:e.message??'The service is unavailable. Try again.',d.details??d);
  }finally{controllers.current.delete(ctrl);rest.signal?.removeEventListener('abort',abort);}
 };
 useEffect(()=>()=>{generation.current++;for(const c of controllers.current)c.abort();pending.current.clear();},[]);
 return createElement(Ctx.Provider,{value:fn.current},children);
}
export function useSourceApi(){const api=useContext(Ctx);if(!api)throw Error('Authenticated MedSlot host required');return api;}
export const qs=(values:Record<string,string|number|boolean|null|undefined>)=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(values))if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v));return p.size?'?'+p.toString():'';};
