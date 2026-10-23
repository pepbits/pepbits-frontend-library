"use client";
import {useMemo,type ReactNode} from 'react';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useLocalization} from '@pepbits/i18n/react';
export function ToastProvider({children}:{children:ReactNode}){return <>{children}</>;}
export function useToast(){const {notify}=useScreenHost(),{t}=useLocalization();return useMemo(()=>({
 success:(title:string,body?:string)=>notify(t(title)+(body?' · '+body:''),{tone:'success'}),
 error:(error:unknown,title="That didn't work")=>notify(t(title)+' · '+((error as Error)?.message??String(error)),{tone:'error'})
}),[notify,t]);}
