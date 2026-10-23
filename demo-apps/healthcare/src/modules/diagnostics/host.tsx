'use client';
import React, {createContext, useContext, useMemo} from 'react';
import {PresentationProvider} from '@pepbits/components';
import {useFormatters} from '@pepbits/patterns/screen-host';
import type {UserPreferences} from '@pepbits/preferences';
import type {Request} from '../../adapters/http';
export interface ReferenceHost {
 scope: {tenantId:string; applicationId:string; branchId:string; moduleId:string; userId:string; roles:readonly string[]};
 preferences: UserPreferences; fetch:Request; request?:unknown; path?:string;
 navigate:(path:string)=>void; hrefFor?:(path:string)=>string; openInNewContext?:(path:string)=>void;
}
export interface ReferenceModuleProps {path:string;host:ReferenceHost}
const Context=createContext<ReferenceHost|null>(null);
export function ReferenceHostProvider({host,children}:{host:ReferenceHost;children:React.ReactNode}) {
 return <Context.Provider value={host}><PresentationProvider value={host.preferences}><div className="diagnostics" data-density={host.preferences.density} data-reduced-motion={host.preferences.reducedMotion}>{children}</div></PresentationProvider></Context.Provider>;
}
export function useReferenceHost(){const host=useContext(Context);if(!host)throw new Error('Diagnostic host is missing');return host;}
export function referenceScopeKey(scope:ReferenceHost['scope']){return JSON.stringify(scope);}
export const useReferenceFormat=useFormatters;
export function useReferenceRouter(){const host=useReferenceHost();return useMemo(()=>({push:host.navigate,replace:host.navigate,back:()=>host.navigate('/'),refresh:()=>host.navigate(host.path??'/')}),[host]);}
export function useReferencePathname(){return (useReferenceHost().path??'/').split('?')[0]!;}
export function useReferenceSearchParams(){const query=(useReferenceHost().path??'').split('?')[1]??'';return useMemo(()=>new URLSearchParams(query),[query]);}
export function ReferenceLink({href,onClick,...props}:React.ComponentProps<'a'>&{href:string}) {
 const host=useReferenceHost();return <a {...props} href={host.hrefFor?.(href)??href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.shiftKey&&!props.target){event.preventDefault();host.navigate(href);}}}/>;
}
