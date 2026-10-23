"use client";
import React, {createContext, useContext, useMemo, useState} from 'react';
import {SessionProvider, type SessionValue, type NavigationPort} from '@pepbits/platform';
import {PreferenceHost, usePreferences} from '@pepbits/preferences/react';
import {EMPTY_PREFERENCE_POLICY, type PreferencePolicy, type UserPreferences} from '@pepbits/preferences';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {PresentationProvider, presentationFromPreferences} from '@pepbits/components';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {ShellProvider, defineProduct, type ShellNavigation} from '@pepbits/shell';
import {FileQuestion} from '@pepbits/icons';
import {catalogs} from './catalogs';
import {areas} from './areas';

const session: SessionValue = {status:'authenticated',user:{id:'demo-editor',name:'Fictional Editor',email:'editor@example.invalid',initials:'FE',title:'Demo editor',role:'editor',branch:'sample',tenantId:'fictional-gallery'},login:async()=>null,logout:async()=>{}};
const navigation: ShellNavigation = {defaultModule:'gallery',modules:{gallery:{id:'gallery',label:'Showcase',shortLabel:'UI',description:'Component gallery',accent:'var(--primary)',icon:FileQuestion,navigation:[{id:'areas',label:'Areas',items:areas.map(area=>({id:area.id,pageId:area.id,label:area.title}))}]}},pages:Object.fromEntries(areas.map(area=>[area.id,{id:area.id,title:area.title,subtitle:'Library examples',kind:'gallery',module:'gallery',ai:{enabled:false,useCases:[]}}]))};
const product = defineProduct({id:'showcase',name:'Showcase',tagline:'Library examples',navigation,defaultModule:'gallery',enabledModules:['gallery'],access:{actions:{create:['editor'],edit:['editor'],export:['editor'],archive:['editor']}}});
const PolicyContext = createContext<{policy:PreferencePolicy;setPolicy:(policy:PreferencePolicy)=>void}|null>(null);
export function useDemoPolicy(){const value=useContext(PolicyContext);if(!value)throw new Error('Demo policy host is missing');return value;}

/** Session/preferences are fictional, accepted synchronously in memory, and lost on reload. */
export function DemoProviders({children,area='foundations',navigate,initialPreferences={},initialPolicy=EMPTY_PREFERENCE_POLICY}:{children:React.ReactNode;area?:string;navigate?:(path:string)=>void;initialPreferences?:Partial<UserPreferences>;initialPolicy?:PreferencePolicy}) {
 const [preferences,setPreferences]=useState<Partial<UserPreferences>>(initialPreferences);
 const [policy,setPolicy]=useState(initialPolicy);
 const port=useMemo<NavigationPort>(()=>({current:{pageId:area},open:target=>navigate?.('/'+(areas.some(a=>a.id===target.pageId)?target.pageId:'page-engines')),openInNewContext:target=>navigate?.('/'+target.pageId),hrefFor:target=>'/'+target.pageId}),[area,navigate]);
 return <SessionProvider value={session}><PreferenceHost preferences={preferences} preferencePolicy={policy} preferencesAvailable update={patch=>setPreferences(previous=>({...previous,...patch}))}>
  <PolicyContext.Provider value={{policy,setPolicy}}><Localized port={port}>{children}</Localized></PolicyContext.Provider>
 </PreferenceHost></SessionProvider>;
}
function Localized({children,port}:{children:React.ReactNode;port:NavigationPort}) {
 const {preferences}=usePreferences(),format=useFormatters();
 const value=useMemo(()=>({language:preferences.language,direction:directionOf(preferences.language),t:createTranslator({language:preferences.language,catalogs}),dateTime:format.dateTime}),[preferences.language,format]);
 return <LocalizationProvider value={value}><ShellProvider navigation={port} product={product} branches={[{value:'sample',label:'Fictional branch'}]} roles={[{value:'editor',label:'Demo editor'}]} brand={{name:'Showcase',tagline:'Library examples'}} preferencesPageId="playground">
  {/* ShellProvider already mounts the public ScreenHostProvider through ShellScreenHost. */}
  <PresentationProvider value={presentationFromPreferences(preferences)}><div dir={value.direction}>{children}</div></PresentationProvider>
 </ShellProvider></LocalizationProvider>;
}
