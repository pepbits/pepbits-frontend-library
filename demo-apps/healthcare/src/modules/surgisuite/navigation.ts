export {useReferenceRouter as useRouter,useReferencePathname as usePathname,useReferenceSearchParams as useSearchParams} from './host';
import {useReferencePathname} from './host';
export function useParams<T extends {id:string}>():T{return {id:useReferencePathname().split('/')[2]??''} as T;}
