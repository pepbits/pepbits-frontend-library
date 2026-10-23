import {readJson,type Request,API_PRODUCT} from './http';
import type {JsonRequest} from '@pepbits/patterns/resources';
import type {Variant} from '../navigation';
/** Module and branch headers are routing metadata; authenticated API identity owns authority. */
export function createKeystoneRequest(request:Request,variant:Variant,branch:string):JsonRequest {
 return async <T,>(path:string,init?:RequestInit)=>{
  if((!path.startsWith('/api/')&&path!=='/exports')||path.includes('..'))throw new Error('Invalid ERP API path');
  const headers=new Headers(init?.headers);headers.set('Content-Type','application/json');headers.set('X-Product-Id',API_PRODUCT);headers.set('X-Reference-Module','reference-'+variant);headers.set('X-Reference-Branch',branch);
  return readJson<T>(await request(path==='/exports'?path:'/reference-modules/'+variant+path,{...init,headers}));
 };
}
