import type {Request} from './http';
/** Fixed namespace and scope metadata; the unchanged API authenticates and authorizes the actor. */
export function createPharmacyTransport(request:Request,branch:string) {
 return async <T>(path:string,init?:RequestInit):Promise<T>=>{
  try {
   if(!path.startsWith('/')||path.startsWith('//')||/[\\\u0000-\u001f#]/.test(path)||path.split("?")[0]!.split("/").some(part=>/[\\/]/.test(decodeURIComponent(part))||['.','..'].includes(decodeURIComponent(part))))throw new Error();
  } catch {throw new Error('Invalid pharmacy API path');}
  const headers=new Headers(init?.headers);
  headers.set('X-Product-Id','nexora');headers.set('X-Reference-Branch',branch);headers.set('X-Reference-Module','reference-pharmacy');
  const response=await request('/reference-modules/pharmacy/api'+path,{...init,headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error('Pharmacy request failed'),{status:response.status,details:body});
  if(body===null)throw Object.assign(new Error('Invalid pharmacy response'),{status:502});
  return body as T;
 };
}
