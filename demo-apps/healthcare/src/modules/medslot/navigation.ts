export {useReferencePathname as usePathname,useReferenceSearchParams as useSearchParams} from './host';
import {useReferencePathname} from './host';
export function useParams<T extends {id:string}>():T{return {id:useReferencePathname().split('/')[2]??''} as T;}

import {useReferenceRouter} from "./host";
export function useRouter(){const r=useReferenceRouter();return {...r,replace:(path:string,_options?:{scroll?:boolean})=>r.replace(path)};}
