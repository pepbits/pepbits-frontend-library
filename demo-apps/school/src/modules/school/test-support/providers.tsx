import React,{useState} from 'react';
import {PreferenceHost} from '@pepbits/preferences/react';
import {ScreenHostProvider} from '@pepbits/patterns/screen-host';
import {createTranslator} from '@pepbits/i18n';
import {readFileSync} from 'node:fs';
import {LocalizedText,LocalizationProvider,useLocalization} from '@pepbits/i18n/react';
import {ReferenceHostProvider as Host,type ReferenceHost} from '../host';
export function TestProviders({host,children}:{host:ReferenceHost;children:React.ReactNode}){
 const parent=useLocalization();const fallback=createTranslator({language:"en",catalogs:{en:JSON.parse(readFileSync(process.cwd()+"/../../dummy-api/config/localization/shared/en.json","utf8")).messages}});
 const [messages,setMessages]=useState<{text:string;tone:string}[]>([]);
 return <PreferenceHost preferences={host.preferences} preferencePolicy={host.preferenceHost?.preferencePolicy} preferencesAvailable={host.preferenceHost?.preferencesAvailable} update={patch=>{for(const [k,v] of Object.entries(patch))host.preferenceHost?.onPreferenceChange?.(k as keyof typeof host.preferences,v as never);}}><LocalizationProvider value={{...parent,t:(key,values)=>{const text=parent.t(key,values);return text===key?fallback(key,values):text;}}}><ScreenHostProvider value={{can:()=>true,notify:(text,{tone})=>setMessages(previous=>[...previous,{text,tone}])}}>{children}{messages.map((message,i)=><div key={i} role={message.tone==='error'?'alert':'status'}><LocalizedText message={message.text}/></div>)}</ScreenHostProvider></LocalizationProvider></PreferenceHost>;
}
export function ReferenceHostProvider({host,children}:{host:ReferenceHost;children:React.ReactNode}){return <TestProviders host={host}><Host host={host}>{children}</Host></TestProviders>;}
