import type {Request} from './http';
/** Fixed namespace and scope metadata; the unchanged API authenticates and authorizes the actor. */
export function createRcmTransport(request:Request,branch:string) {
 return async <T>(path:string,init?:RequestInit):Promise<T>=>{
  try {
   if(!path.startsWith('/')||path.startsWith('//')||/[\\\u0000-\u001f#]/.test(path)||path.split("?")[0]!.split("/").some(part=>/[\\/]/.test(decodeURIComponent(part))||['.','..'].includes(decodeURIComponent(part))))throw new Error();
  } catch {throw new Error('Invalid rcm API path');}
  const headers=new Headers(init?.headers);
  headers.set('X-Product-Id','nexora');headers.set('X-Reference-Branch',branch);headers.set('X-Reference-Module','reference-rcm');
  const response=await request('/reference-modules/rcm/api'+path,{...init,headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error('Rcm request failed'),{status:response.status,details:body});
  if(body===null)throw Object.assign(new Error('Invalid rcm response'),{status:502});
  return body as T;
 };
}
