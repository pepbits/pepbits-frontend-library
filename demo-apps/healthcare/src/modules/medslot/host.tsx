'use client';
import React, {createContext, useContext, useMemo} from 'react';
import {PresentationProvider} from '@pepbits/components';
import {createFormatters} from '@pepbits/i18n';
import {useLocalization} from '@pepbits/i18n/react';
import type {UserPreferences} from '@pepbits/preferences';
import type {PreferenceHost} from '../preference-choice';
export interface ReferenceRoute {path:string;title:string}
/** Product context only. Session, navigation, preferences and notifications belong to the application host. */
export interface ReferenceHost {
 scope:{tenantId:string;applicationId:string;branchId:string;moduleId:string;userId:string;roles:readonly string[]};
 preferences:UserPreferences; preferenceHost?:PreferenceHost; path?:string;
 fetch?:(path:string,init?:RequestInit)=>Promise<Response>;
 request:<T>(path:string,init?:RequestInit)=>Promise<T>;
 navigate:(path:string)=>void; hrefFor?:(path:string)=>string;
}
export interface ReferenceModuleProps {path:string;host:ReferenceHost}
const Context=createContext<ReferenceHost|null>(null);
export function ReferenceHostProvider({host,children}:{host:ReferenceHost;children:React.ReactNode}) {
 return <Context.Provider value={host}><PresentationProvider value={host.preferences}>{children}</PresentationProvider></Context.Provider>;
}
export function useReferenceHost(){const host=useContext(Context);if(!host)throw new Error('MedSlot host is missing');return host;}
export function referenceScopeKey(scope:ReferenceHost['scope']){return JSON.stringify([scope.tenantId,scope.applicationId,scope.branchId,scope.moduleId,scope.userId,[...scope.roles].sort()]);}
export function useReferenceFormat(){const {preferences}=useReferenceHost(),{t}=useLocalization();return useMemo(()=>({...createFormatters(preferences),t}),[preferences,t]);}
export function useReferencePathname(){return (useReferenceHost().path??'/').split('?')[0]!;}
export function useReferenceSearchParams(){const query=(useReferenceHost().path??'').split('?')[1]??'';return useMemo(()=>new URLSearchParams(query),[query]);}
export function ReferenceLink({href,onClick,...props}:React.ComponentProps<'a'>&{href:string}) {
 const host=useReferenceHost();return <a {...props} href={host.hrefFor?.(href)??href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.shiftKey&&!props.target){event.preventDefault();host.navigate(href);}}}/>;
}

export function useReferenceRouter(){const host=useReferenceHost();return useMemo(()=>({push:host.navigate,replace:host.navigate}),[host.navigate]);}
