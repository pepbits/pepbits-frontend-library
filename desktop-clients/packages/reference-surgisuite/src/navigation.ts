export {useReferenceRouter as useRouter,useReferencePathname as usePathname,useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import {useReferencePathname} from '@pepbits/reference-host';
export function useParams<T extends {id:string}>():T{return {id:useReferencePathname().split('/')[2]??''} as T;}
