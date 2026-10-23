import type {Request} from './http';
/** Scope headers request a view; the unchanged API authenticates and authorizes it. */
export function createTeleconsultTransport(request:Request, variant:'provider'|'patient', branch:string):Request {
 return (path,init)=>{
  try {
   const pathname=path.split('?')[0]!;
   if(!(pathname==='/api'||pathname.startsWith('/api/'))||/[\\\u0000-\u001f#]/.test(path)||pathname.split('/').some(part=>/[\\/]/.test(decodeURIComponent(part))||['.','..'].includes(decodeURIComponent(part))))throw new Error();
  } catch {return Promise.reject(new Error('Invalid Teleconsult API path'));}
  const headers=new Headers(init?.headers);
  headers.set('X-Product-Id','nexora');headers.set('X-Reference-Module','reference-teleconsult-'+variant);headers.set('X-Reference-Branch',branch);
  return request('/reference-modules/teleconsult-'+variant+path,{...init,headers});
 };
}
