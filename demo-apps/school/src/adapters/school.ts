import {readJson,type Request} from '@pepbits/platform/http';
/** Portal/branch headers route requests. The unchanged API independently checks the account's grants. */
export function createSchoolRequest(request:Request,moduleId:string,branchId:string){
 return async <T,>(path:string,init?:RequestInit):Promise<T>=>{
  if(!path.startsWith('/api/')||/[\\\u0000-\u001f]/.test(path)||path.split('?')[0]!.split('/').some(part=>{try{return /[\/\\]/.test(decodeURIComponent(part))||['.','..'].includes(decodeURIComponent(part));}catch{return true;}}))throw new Error('Invalid school API path');
  const headers=new Headers(init?.headers);headers.set('X-Reference-Module',moduleId);headers.set('X-Reference-Branch',branchId);
  return readJson<T>(await request('/reference-modules/school'+path,{...init,headers}));
 };
}
