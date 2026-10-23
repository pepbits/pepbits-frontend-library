'use client';
import React, {createContext,useContext,useMemo,useRef,type ReactNode} from 'react';
import {useSession,readToken,recoveryRequest,RequestFailure,expireCurrentSession} from '@pepbits/platform';
import {localizeApiMessage} from '@pepbits/i18n';
import {policyDefaults} from '@pepbits/preferences';
import {usePreferences} from '@pepbits/preferences/react';
import {useERP} from '../shell-context';

export interface PreferencePageServices {
  request?: (path:string,init?:RequestInit)=>Promise<Response>;
  canManagePreferencePolicy?: boolean;
  saveError?: string;
  reload?: ()=>void|Promise<void>;
}
const Context=createContext<PreferencePageServices>({});
export function PreferencePageProvider({services,children}:{services?:PreferencePageServices;children?:ReactNode}) {
  return <Context.Provider value={services??{}}>{children}</Context.Provider>;
}
export function usePreferencePage(){
  const {status,expired}=useSession();
  const settings=usePreferences(),shell=useERP(),services=useContext(Context);
  return {...shell,...settings,canManagePreferencePolicy:status === "authenticated" && !expired && services.canManagePreferencePolicy===true && !!services.request,
    preferenceSaveError:services.saveError,refreshPreferences:services.reload??(()=>{}),
    resetPreferences:()=>settings.update(policyDefaults(settings.preferencePolicy))};
}
/** Host-only transport, session fencing, recovery and localized server diagnostics. */
export function usePreferenceRequest(){
  const {request}=useContext(Context),{t}=useERP();
  const token=useRef(readToken());token.current=readToken();
  const translate=useRef(t);translate.current=t;
  return useMemo(()=>(path:string,init?:RequestInit)=>{
    if(!request||!token.current||token.current!==readToken())return Promise.reject(new RequestFailure(401));
    const requestToken=token.current;
    return recoveryRequest(request,path,init).then(async response=>{
      if(response.status===401)expireCurrentSession(requestToken);
      if(response.ok||!response.headers.get('Content-Type')?.includes('application/json'))return response;
      const body=await response.clone().json().catch(()=>null);
      if(!body||typeof body.error!=='string'||!body.errorMessage)return response;
      const headers=new Headers(response.headers);headers.delete('Content-Length');headers.delete('Content-Encoding');
      return new Response(JSON.stringify({...body,error:localizeApiMessage(body.errorMessage,body.error,translate.current)}),{status:response.status,statusText:response.statusText,headers});
    });
  },[request]);
}
