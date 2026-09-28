"use client";
import React, {createContext, useContext, useMemo} from "react";
import {createFormatters, LANGUAGE_OPTIONS, type PreferenceKey, type PreferencePolicy, type UserPreferences} from "@pepbits/erp-config";
import {PresentationProvider, useLocalization} from "@pepbits/ops-ui";
export interface ReferenceScope {moduleId?:string;tenantId:string;applicationId:string;branchId:string;userId:string;roles:readonly string[]}
export interface ReferencePreferenceHost {preferences:UserPreferences;preferencePolicy?:PreferencePolicy;preferencesAvailable?:boolean;onPreferenceChange?:<K extends PreferenceKey>(key:K,value:UserPreferences[K])=>void}
/** Scope comes from authenticated host identity. It is metadata, never server authority. */
export interface ReferenceHost {scope:ReferenceScope;preferences:UserPreferences;preferenceHost?:ReferencePreferenceHost;request:<T>(path:string,init?:RequestInit)=>Promise<T>;fetch?:(path:string,init?:RequestInit)=>Promise<Response>;navigate:(path:string)=>void;hrefFor?:(path:string)=>string;href?:(path:string)=>string;openInNewContext?:(path:string)=>void;path?:string}
export interface ReferenceRoute {path:string;title:string}
export interface ReferenceModuleProps {path:string;host:ReferenceHost}
const HostContext=createContext<ReferenceHost|null>(null);
export function useReferenceHost():ReferenceHost {const host=useContext(HostContext);if(!host)throw new Error("Reference module requires an authenticated host adapter");return host;}
export function ReferenceHostProvider({host,children}:{host:ReferenceHost;children:React.ReactNode}) {
 const p=host.preferences;
 return <HostContext.Provider value={host}><PresentationProvider value={p}><div className="pepbits-reference-module library-preferences" lang={p.language} dir={LANGUAGE_OPTIONS.find(language=>language.value===p.language)?.dir??"ltr"} data-theme={p.theme} data-density={p.density} data-reduced-motion={p.reducedMotion} style={{"--reference-page-size":p.pageSize,"--fs-shell":p.fontSizeBase/13,"--fs-form":p.fontSizeForm/13,"--fs-result":p.fontSizeResult/13,"--radius":`${p.cornerRadius}px`} as React.CSSProperties}>{children}</div></PresentationProvider></HostContext.Provider>;
}
export function ReferenceLink({href,onClick,...props}:React.ComponentProps<"a">&{href:string}) {const host=useReferenceHost();return <a {...props} href={host.hrefFor?.(href)??host.href?.(href)??href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented && event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey && href.startsWith("/")){event.preventDefault();host.navigate(href);}}}/>;}
export function useReferenceRouter(){const host=useReferenceHost();return useMemo(()=>({push:host.navigate,replace:host.navigate,refresh:()=>host.navigate(host.path??"/"),back:()=>host.navigate("/")}),[host]);}
export function useReferencePathname(){return (useReferenceHost().path??"/").split("?")[0];}
export function useReferenceSearchParams(){return new URLSearchParams((useReferenceHost().path??"").split("?")[1]??"");}
export function useReferenceFormat(){const host=useReferenceHost();const {t}=useLocalization();const formatter=useMemo(()=>createFormatters(host.preferences),[host.preferences]);return {...formatter,formatDate:formatter.date,formatNumber:formatter.number,formatCurrency:formatter.money,t};}
export function referenceScopeKey(scope:ReferenceScope){return JSON.stringify([scope.tenantId,scope.applicationId,scope.branchId,scope.userId,scope.roles,scope.moduleId]);}

export {createReferenceTransport,type ReferenceTransportOptions} from "./transport";
