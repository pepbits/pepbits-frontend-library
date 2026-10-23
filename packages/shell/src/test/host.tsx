import React, {type ReactNode} from 'react';
import {TestHost} from '@pepbits/patterns/testing';
import type {PreferenceHostProps} from '@pepbits/preferences/react';
import {HostSessionProvider, type SessionValue} from '@pepbits/platform';
import {FileQuestion} from '@pepbits/icons';
import {ShellProvider, type ShellProviderProps} from '../shell-context';
import type {ShellNavigation} from '../navigation';
import {defineProduct} from '../products';
import {messages} from './messages';

export const catalog: ShellNavigation = {
  defaultModule: 'operations',
  modules: {
    operations: {id:'operations',label:'Operations',shortLabel:'OPS',description:'Workspace',accent:'var(--primary)',icon:FileQuestion,
      navigation:[{id:'main',label:'Main',items:[{id:'home',label:'Overview',pageId:'operations-dashboard'}, {id:'items',label:'Items',pageId:'items'}, {id:'shared',label:'Preferences',pageId:'preferences'}]}]},
    resources: {id:'resources',label:'Resources',shortLabel:'RES',description:'Workspace',accent:'var(--primary)',icon:FileQuestion,
      navigation:[{id:'main',label:'Main',items:[{id:'overview',label:'Resources overview',pageId:'resources-dashboard'}]}]},
  },
  pages: {
    'operations-dashboard': {id:'operations-dashboard',title:'Overview',subtitle:'Workspace',kind:'dashboard',module:'operations'},
    'resources-dashboard': {id:'resources-dashboard',title:'Resources overview',subtitle:'Workspace',kind:'dashboard',module:'resources'},
    items: {id:'items',title:'Items',subtitle:'Records',kind:'form',module:'operations',entity:'item'},
    preferences: {id:'preferences',title:'Preferences',subtitle:'Settings',kind:'preferences',module:'shared'},
  },
};
export const product = defineProduct({navigation:catalog,id:'example',name:'Example',tagline:'Work together',defaultModule:'operations',enabledModules:['operations','resources'],
  access:{actions:{edit:['editor'],create:['editor'],export:['editor']}}});
export const session: SessionValue = {status:'authenticated',user:{id:'u',tenantId:'t',name:'Alex Example',email:'alex@example.invalid',initials:'AE',title:'Editor',role:'editor',branch:'north'},login:async()=>null,logout:async()=>{}};
export const port: ShellProviderProps['navigation'] = {current:{pageId:'items'},open:()=>{},openInNewContext:()=>{},hrefFor:()=> '#'};
export function ShellTestHost({children, settings, session: sessionValue = session, ...props}: Partial<ShellProviderProps> & {
  children?: ReactNode; settings?: Partial<PreferenceHostProps>; session?: SessionValue;
}) {
  return <HostSessionProvider value={sessionValue}><TestHost messages={messages} {...settings}>
    <ShellProvider navigation={port} product={product} branches={[{value:'north',label:'North'}]} roles={[{value:'editor',label:'Editor'}]}
      brand={{name:'Example',tagline:'Work together'}} preferencesPageId="preferences" {...props}>{children}</ShellProvider>
  </TestHost></HostSessionProvider>;
}
