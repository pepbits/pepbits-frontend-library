import React,{type ReactNode} from 'react';
import {TestHost} from '@pepbits/patterns/testing';
import type {PreferenceHostProps} from '@pepbits/preferences/react';
import {HostSessionProvider,type SessionValue,type NavigationPort} from '@pepbits/platform';
import {FileQuestion} from '@pepbits/icons';
import {ShellProvider,defineProduct,type Workspace} from '@pepbits/shell';
import {AiShellExtension,type AiHost} from '../ui';
import {messages} from './messages';
const module={id:'operations',label:'Operations',shortLabel:'OPS',description:'Workspace',accent:'var(--primary)',icon:FileQuestion,navigation:[]};
export const product=defineProduct({id:'example',name:'Example',tagline:'Workspace',defaultModule:'operations',enabledModules:['operations'],access:{actions:{edit:['editor'],create:['editor']}},navigation:{defaultModule:'operations',modules:{operations:module},pages:{'items-a':{id:'items-a',title:'Items A',subtitle:'Items',kind:'form',module:'operations'}}}});
export const session:SessionValue={status:'authenticated',user:{id:'u',tenantId:'t',name:'Example Person',email:'example@example.invalid',initials:'EP',title:'Editor',role:'editor',branch:'north'},login:async()=>null,logout:async()=>{}};
export const navigation:NavigationPort={current:{pageId:'items-a'},open:()=>{},openInNewContext:()=>{},hrefFor:()=> '#'};
export function AiTestHost({value,children,workspace,settings,session:sessionValue=session}:{value:AiHost;children:ReactNode;workspace?:Workspace;settings?:Partial<PreferenceHostProps>;session?:SessionValue}){
 return <HostSessionProvider value={sessionValue}><TestHost messages={messages} {...settings}><AiShellExtension value={value}>
  <ShellProvider product={product} navigation={navigation} branches={[]} roles={[]} brand={{name:'Example',tagline:'Workspace'}} workspace={workspace}>{children}</ShellProvider>
 </AiShellExtension></TestHost></HostSessionProvider>;
}
