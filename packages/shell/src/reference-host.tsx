'use client';
import React, {createContext, useContext, useMemo} from 'react';
import {PresentationProvider} from '@pepbits/components';
import {createFormatters} from '@pepbits/i18n';
import {useLocalization} from '@pepbits/i18n/react';
import type {PreferenceKey, PreferencePolicy, UserPreferences} from '@pepbits/preferences';

/**
 * Host contract for an imported product module that renders inside an application shell. The application owns session,
 * navigation, preferences, notifications and the configured HTTP transport; the module receives only this product context.
 * Scope values are routing/isolation metadata, never proof of authority: the API authorizes every request.
 */
export interface ReferenceRoute {path:string;title:string}
/** The accepted preference host for modules that expose local preference choices (central update path, policy locks). */
export interface ReferencePreferenceHost {
 preferences:UserPreferences;
 preferencePolicy?:PreferencePolicy;
 preferencesAvailable?:boolean;
 onPreferenceChange?:<K extends PreferenceKey>(key:K,value:UserPreferences[K])=>void;
}
export interface ReferenceHost {
 scope:{tenantId:string;applicationId:string;branchId:string;moduleId:string;userId:string;roles:readonly string[]};
 preferences:UserPreferences; preferenceHost?:ReferencePreferenceHost; path?:string;
 /** Optional raw transport for modules that need response headers or bodies other than JSON. */
 fetch?:(path:string,init?:RequestInit)=>Promise<Response>;
 /** JSON transport. A non-2xx answer rejects with `status` and the parsed body as `details`. */
 request:<T>(path:string,init?:RequestInit)=>Promise<T>;
 navigate:(path:string)=>void; hrefFor?:(path:string)=>string;
}
export type ReferenceScope = ReferenceHost['scope'];
export interface ReferenceModuleProps {path:string;host:ReferenceHost}

const Context=createContext<ReferenceHost|null>(null);
/** Supplies the host and its effective presentation preferences to the module tree. */
export function ReferenceHostProvider({host,children}:{host:ReferenceHost;children:React.ReactNode}) {
 return <Context.Provider value={host}><PresentationProvider value={host.preferences}>{children}</PresentationProvider></Context.Provider>;
}
/** Throws when unprovided: a module without its host has no session or transport. */
export function useReferenceHost(){const host=useContext(Context);if(!host)throw new Error('Reference module host is missing');return host;}
/** Stable key of the authenticated scope. Remount module state under it so nothing crosses tenant, branch, user or role. */
export function referenceScopeKey(scope:ReferenceScope){return JSON.stringify([scope.tenantId,scope.applicationId,scope.branchId,scope.moduleId,scope.userId,[...scope.roles].sort()]);}
/** Effective date/time/number formatters plus the host translator. */
export function useReferenceFormat(){const {preferences}=useReferenceHost(),{t}=useLocalization();return useMemo(()=>({...createFormatters(preferences),t}),[preferences,t]);}
/** Module-relative pathname without the query. */
export function useReferencePathname(){return (useReferenceHost().path??'/').split('?')[0]!;}
/** Module-relative query; identity is stable while the query text is unchanged. */
export function useReferenceSearchParams(){const query=(useReferenceHost().path??'').split('?')[1]??'';return useMemo(()=>new URLSearchParams(query),[query]);}
/** An anchor with a real href that routes plain left clicks through the host navigator. */
export function ReferenceLink({href,onClick,...props}:React.ComponentProps<'a'>&{href:string}) {
 const host=useReferenceHost();return <a {...props} href={host.hrefFor?.(href)??href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.shiftKey&&!props.target){event.preventDefault();host.navigate(href);}}}/>;
}
/** `push`/`replace` mapped onto the host navigator; the host owns the address bar. */
export function useReferenceRouter(){const host=useReferenceHost();return useMemo(()=>({push:host.navigate,replace:host.navigate}),[host.navigate]);}
