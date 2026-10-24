import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {ResourceScope,type JsonRequest} from '@pepbits/patterns/resources';
import {LocalizationAliasProvider} from '@pepbits/i18n/react';
import aliases from './aliases.json';
import type {ErpActor} from './access';
import type {Variant} from '../../navigation';
const Context=createContext<{variant:Variant;scopeKey:string;actor?:ErpActor}>(null!);
export const useKeystone=()=>useContext(Context);
export function KeystoneProvider({variant,scopeKey,request,children,actor}:{variant:Variant;scopeKey:string;request:JsonRequest;children:ReactNode;actor?:ErpActor}){const value=useMemo(()=>({variant,scopeKey,actor}),[variant,scopeKey,actor]);return <Context.Provider value={value}><LocalizationAliasProvider aliases={aliases}><ResourceScope key={scopeKey} scopeKey={scopeKey} request={request} statePath="/api/view-state">{children}</ResourceScope></LocalizationAliasProvider></Context.Provider>;}
