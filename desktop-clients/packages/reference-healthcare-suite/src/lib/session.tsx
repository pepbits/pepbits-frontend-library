'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useReferenceHost } from '@pepbits/reference-host';
import { ApiProvider } from './api';
import { useApi } from './hooks';
import type { Row } from './types';
export type FormLayout = 'tabs' | 'pages';
interface Session { canWrite:boolean;canWriteRcm?:boolean; user: {id:string;name:string;role:string;email:string;initials:string}|null; facilities:Row[];currency:string;today:string;defaultFacilityId:string }
interface Ctx { session:Session|null;error:string|null;facilityId:string;setFacilityId:(id:string)=>void;facility:Row|null;formLayout:FormLayout;setFormLayout:(layout:FormLayout)=>void;currency:string;header:{title:string;subtitle?:string};setHeader:(header:{title:string;subtitle?:string})=>void }
const Context = createContext<Ctx|null>(null);
export function SessionProvider({children}:{children:ReactNode}) {
  const host = useReferenceHost();
  const {data,error} = useApi<Session>('/session');
  const [selected,setSelected] = useState('');
  const [header,setHeader] = useState<{title:string;subtitle?:string}>({title:''});
  const facilities = data?.facilities.filter(f=>f.status !== 'Inactive') ?? [];
  const facilityId = facilities.some(f=>f.id === selected) ? selected : facilities.some(f=>f.id === data?.defaultFacilityId) ? data!.defaultFacilityId : facilities[0]?.id ?? '';
  const formLayout:FormLayout = host.preferences.openRecordsInTabs ? 'tabs' : 'pages';
  const value = useMemo<Ctx>(()=>({session:data,error:error?.message??null,facilityId,setFacilityId:id=>{if(data?.facilities.some(f=>f.id===id && f.status !== 'Inactive'))setSelected(id);},facility:facilities.find(f=>f.id===facilityId)??null,formLayout,setFormLayout:layout=>{
    const ph=host.preferenceHost, rule=ph?.preferencePolicy?.rules.openRecordsInTabs;
    const next=layout==='tabs';
    if(ph?.onPreferenceChange && ph.preferencesAvailable!==false && !rule?.locked && (!rule?.allowedValues || rule.allowedValues.includes(next))) ph.onPreferenceChange('openRecordsInTabs',next);
  },currency:host.preferences.currencyCode,header,setHeader}),[data,error,facilityId,formLayout,host,header]);
  return <Context.Provider value={value}><ApiProvider facilityId={facilityId} canWrite={data?.canWrite===true} canWriteRcm={data?.canWriteRcm===true}>{children}</ApiProvider></Context.Provider>;
}
export function useSession() {const session=useContext(Context);if(!session)throw new Error('Healthcare Suite session required');return session;}
export function usePageHeader(title:string,subtitle?:string) {const {setHeader}=useSession();useEffect(()=>{setHeader({title,subtitle});},[title,subtitle,setHeader]);}

export function useWriteAccess() {return useSession().session?.canWrite === true;}
