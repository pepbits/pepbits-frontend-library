import {useCallback, type ReactNode} from 'react';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useLocalization} from '@pepbits/i18n/react';
export function ToastProvider({children}:{children:ReactNode}) {return children;}
export function useToast() {
 const {notify}=useScreenHost(),{t}=useLocalization();
 return useCallback((notice:{tone:'ok'|'error'|'info';title:string;body?:string})=>notify([t(notice.title),notice.body&&t(notice.body)].filter(Boolean).join(' — '),{tone:notice.tone==='ok'?'success':notice.tone==='error'?'error':'info'}),[notify,t]);
}
