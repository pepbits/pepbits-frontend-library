import type {Request} from './http';

/** Namespace of the unchanged demo API. The configured base URL and session token come from the shared host request. */
export const TENANT_ADMIN_API_NAMESPACE = '/reference-modules/tenant-admin';
export const TENANT_ADMIN_MODULE_ID = 'reference-tenant-admin';

function invalid(path:string){
 if(!path.startsWith('/')||path.startsWith('//')||/[\\\u0000-\u001f#]/.test(path))return true;
 try{return path.split('?')[0]!.split('/').some(part=>{const value=decodeURIComponent(part);return /[\\/]/.test(value)||value==='.'||value==='..';});}catch{return true;}
}

/**
 * Configured HTTP only. Module and branch headers are routing metadata; the API derives the actor and its authority from the
 * authenticated session. A non-2xx answer rejects with `status` and the parsed body as `details` (the source error shape).
 */
export function createTenantAdminTransport(request:Request,branch:string){
 return {request:async<T,>(path:string,init?:RequestInit):Promise<T>=>{
  if(invalid(path))throw new Error('Invalid Tenant Admin API path');
  const headers=new Headers(init?.headers);
  headers.set('X-Reference-Module',TENANT_ADMIN_MODULE_ID);headers.set('X-Reference-Branch',branch);
  const response=await request(TENANT_ADMIN_API_NAMESPACE+path,{...init,headers});
  if(response.status===204)return null as T;
  const body=await response.json().catch(()=>undefined);
  if(!response.ok)throw Object.assign(new Error('Tenant Admin request failed'),{status:response.status,details:body??null});
  if(body===undefined)throw Object.assign(new Error('Invalid Tenant Admin response'),{status:502,details:null});
  return body as T;
 }};
}
