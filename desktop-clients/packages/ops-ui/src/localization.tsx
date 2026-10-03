"use client";
import React, { createContext, useContext, useMemo } from 'react';
import { ENGLISH_MESSAGES } from './messages.en';
export type MessageValues = Record<string, string | number>;
export interface Localization {
    language: string;
    direction: 'ltr' | 'rtl';
    t: (message: string, values?: MessageValues) => string;
    dateTime: (value: string | Date) => string;
}
const defaults: Localization = { language: 'en', direction: 'ltr', t: (message, values) => (Object.hasOwn(ENGLISH_MESSAGES, message) ? ENGLISH_MESSAGES[message] : message).replace(/\{(\w+)\}/g, (match, key) => values?.[key] === undefined ? match : String(values[key])), dateTime: value => new Date(value).toLocaleString('en-US') };
const Context = createContext<Localization>(defaults);
/** UI-only translation boundary. Never transforms input values or service payloads. */
export function LocalizationProvider({ value, children }: {
    value: Localization;
    children: React.ReactNode;
}) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export const useLocalization = () => useContext(Context);
export function LocalizedText({ message, values }: {
    message?: string;
    values?: MessageValues;
}) { return <>{useLocalization().t(message ?? "", values)}</>; }

/** Scope an imported page's literal presentation labels to canonical host message keys. No record values are transformed. */
export function LocalizationAliasProvider({aliases,children}:{aliases:Readonly<Record<string,string>>;children:React.ReactNode}) {
 const parent=useLocalization();
 const value=useMemo<Localization>(()=>({...parent,t:(message,values)=>{
  const key=Object.hasOwn(aliases,message)?aliases[message]:message;
  const translated=parent.t(key,values);
  return key!==message&&translated===key?parent.t(message,values):translated;
 }}),[parent,aliases]);
 return <LocalizationProvider value={value}>{children}</LocalizationProvider>;
}
