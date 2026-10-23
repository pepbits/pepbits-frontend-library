import type {Request} from './http';
/** Configured HTTP only. Scope headers are routing metadata; the API authorizes the actor. */
export function createMedbandTransport(request:Request,branch:string){
 const fetch:Request=async(path,init)=>{
  try{if(!path.startsWith('/')||path.startsWith('//')||/[\\\u0000-\u001f#]/.test(path)||path.split('?')[0]!.split('/').some(part=>/[\\/]/.test(decodeURIComponent(part))||['.','..'].includes(decodeURIComponent(part))))throw new Error();}
  catch{throw new Error('Invalid Medband API path');}
  const headers=new Headers(init?.headers);
  headers.set('X-Product-Id','nexora');headers.set('X-Reference-Module','reference-medband');headers.set('X-Reference-Branch',branch);
  return request('/reference-modules/medband/api'+path,{...init,headers});
 };
 return {fetch,request:async<T>(path:string,init?:RequestInit):Promise<T>=>{
  const response=await fetch(path,init),body=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error('Medband request failed'),{status:response.status,details:body});
  if(body===null)throw Object.assign(new Error('Invalid Medband response'),{status:502});
  return body as T;
 }};
}
