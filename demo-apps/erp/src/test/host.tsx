import React,{useMemo,useState,type ReactNode} from 'react';
import {PreferenceHost as Preferences} from '@pepbits/preferences/react';
import {type UserPreferences,type PreferencePolicy} from '@pepbits/preferences';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {createTranslator,directionOf} from '@pepbits/i18n';
import {ScreenHostProvider} from '@pepbits/patterns/screen-host';
import {NavigationProvider} from '@pepbits/platform/navigation';
import {KeystoneProvider} from '../modules/keystone/context';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {readFileSync} from 'node:fs';
import {hrefFor,type Variant} from '../navigation';
export interface TestHostValue {scope:{tenantId:string;applicationId:string;branchId:string;userId:string;roles:string[];permissions?:string[];moduleId?:string};preferences:UserPreferences;request:JsonRequest;navigate:(path:string)=>void;can?:(action:string)=>boolean;preferenceHost?:{preferences:UserPreferences;preferencePolicy:PreferencePolicy;preferencesAvailable?:boolean;onPreferenceChange?:(key:keyof UserPreferences,value:any)=>void}}
export const sharedMessages=JSON.parse(readFileSync(process.cwd()+'/../../mock-api/config/localization/shared/en.json','utf8')).messages;
export function TestHostProvider({host,children}:{host:TestHostValue;children:ReactNode}){
 const [patch,setPatch]=useState<Partial<UserPreferences>>({});const variant=(host.scope.moduleId?.endsWith('erp2')?'erp2':'erp1') as Variant,scopeKey=JSON.stringify(host.scope),p=host.preferenceHost;
 const catalogs={en:sharedMessages,ar:JSON.parse(readFileSync(process.cwd()+'/../../mock-api/config/localization/shared/ar.json','utf8')).messages};const t=createTranslator({language:host.preferences.language,catalogs});
 const navigation=useMemo(()=>({current:{pageId:'test'},hrefFor,open:(target:Parameters<typeof hrefFor>[0])=>host.navigate(hrefFor(target)),openInNewContext:(target:Parameters<typeof hrefFor>[0])=>host.navigate(hrefFor(target))}),[host.navigate]);
 return <Preferences preferences={{...host.preferences,...patch}} preferencePolicy={p?.preferencePolicy} preferencesAvailable={p?.preferencesAvailable??!!p?.onPreferenceChange} update={changes=>{setPatch(v=>({...v,...changes}));for(const [k,v] of Object.entries(changes))p?.onPreferenceChange?.(k as keyof UserPreferences,v);}}><LocalizationProvider value={{t,language:host.preferences.language,direction:directionOf(host.preferences.language),dateTime:String}}><NavigationProvider value={navigation}><ScreenHostProvider value={{can:host.can??(()=>true),notify:()=>{},scope:{module:variant}}}><KeystoneProvider variant={variant} scopeKey={scopeKey} actor={{role:host.scope.roles[0]??'',permissions:host.scope.permissions}} request={host.request}>{children}</KeystoneProvider></ScreenHostProvider></NavigationProvider></LocalizationProvider></Preferences>;
}
