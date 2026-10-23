import {useCallback, type ReactNode} from 'react';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useLocalization} from '@pepbits/i18n/react';
export function ToastProvider({children}:{children:ReactNode}) {return children;}
export function useToast() {
 const {notify}=useScreenHost(),{t}=useLocalization();
 return useCallback((notice:{tone:'success'|'error'|'info';title:string;detail?:string})=>notify([t(notice.title),notice.detail&&t(notice.detail)].filter(Boolean).join(' — '),{tone:notice.tone==='success'?'success':notice.tone==='error'?'error':'info'}),[notify,t]);
}
