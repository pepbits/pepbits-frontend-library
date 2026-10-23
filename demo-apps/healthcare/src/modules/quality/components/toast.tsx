"use client";
import {useCallback,type ReactNode} from 'react';
import {useScreenHost} from '@pepbits/patterns';
import {useLocalization,type MessageValues} from '@pepbits/i18n/react';
export function ToastProvider({children}:{children:ReactNode}){return <>{children}</>;}
export function useToast(){const {notify}=useScreenHost(),{t}=useLocalization();return useCallback((message:string,tone:'success'|'error'='success',values?:MessageValues)=>notify(t(message,values),{tone}),[notify,t]);}
