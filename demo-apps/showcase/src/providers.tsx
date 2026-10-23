"use client";
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {SessionProvider, useSession, WindowPortProvider, type SessionValue, type NavigationPort, type NavigationTarget, type WindowPort} from '@pepbits/platform';
import {PreferenceHost, usePreferences} from '@pepbits/preferences/react';
import {EMPTY_PREFERENCE_POLICY, type PreferencePolicy, type UserPreferences} from '@pepbits/preferences';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {ShellProvider, ShellAppearance, createWorkspace, documentFromTarget, useWorkspaceNavigation, type WorkspacePolicyLevel, type WorkspacePolicyRule} from '@pepbits/shell';
import {LoginScreen} from '@pepbits/shell/login';
import {AiShellExtension, type AiHost} from '@pepbits/ai/ui';
import {catalogs} from './catalogs';
import {areas} from './areas';
import {brand,product,documentation,tours} from './host-config';
import {createAiSimulation} from './ai-simulation';
import {DemoContext,WorkspaceContext} from './demo-state';
export {useDemoPolicy} from './demo-state';
const user={id:'demo-editor',name:'Fictional Editor',email:'editor@example.invalid',initials:'FE',title:'Demo editor',role:'editor',branch:'sample',tenantId:'fictional-gallery'};
// No OS or browser window is opened. The shell still exercises its window lifecycle.
function createFictionalWindows():WindowPort {return {available:true,open:async()=>true,close:async()=>{},focus:async()=>{},onClosed:()=>()=>{}};}
/** Controlled session and accepted preferences are fictional and lost on reload. */
export function DemoProviders({children,area='foundations',navigate,initialPreferences={},initialPolicy=EMPTY_PREFERENCE_POLICY,initialAiEnabled=false,aiHost}:{children:React.ReactNode;area?:string;navigate?:(path:string)=>void;initialPreferences?:Partial<UserPreferences>;initialPolicy?:PreferencePolicy;initialAiEnabled?:boolean;aiHost?:AiHost}) {
 const [preferences,setPreferences]=useState<Partial<UserPreferences>>(initialPreferences),[policy,setPolicy]=useState(initialPolicy);
 const [aiEnabled,setAiEnabled]=useState(initialAiEnabled),[expired,setExpired]=useState(false),[signedIn,setSignedIn]=useState(true),[branch,setBranch]=useState('sample');
 const [ai]=useState(()=>aiHost??createAiSimulation());
 const session=useMemo<SessionValue>(()=>({status:signedIn?'authenticated':'anonymous',user:signedIn?{...user,branch}:null,expired,
  // Values are ignored, never stored or transmitted. No credentials are configured.
  login:async()=>{setSignedIn(true);setExpired(false);return null;},logout:async()=>{setSignedIn(false);setExpired(false);setAiEnabled(false);}}),[signedIn,expired,branch]);
 return <SessionProvider value={session}><PreferenceHost preferences={preferences} preferencePolicy={policy} preferencesAvailable update={patch=>setPreferences(previous=>({...previous,...patch}))}>
  <DemoContext.Provider value={{policy,setPolicy,aiEnabled,setAiEnabled,expireSession:()=>setExpired(true)}}><Localized>
   <AiShellExtension value={{...ai,userEnabled:aiEnabled}}>{signedIn?<WorkspaceOwner key={branch} area={area} navigate={navigate} setBranch={setBranch}>{children}</WorkspaceOwner>:<><ShellAppearance/><main><LoginScreen brand={brand} description="Demo only — changes disappear on reload" notice="Simulation: input is ignored; no sign-in request is sent."/></main></> }</AiShellExtension>
  </Localized></DemoContext.Provider>
 </PreferenceHost></SessionProvider>;
}
function Localized({children}:{children:React.ReactNode}) {
 const {preferences}=usePreferences(),format=useFormatters();
 const value=useMemo(()=>({language:preferences.language,direction:directionOf(preferences.language),t:createTranslator({language:preferences.language,catalogs}),dateTime:format.dateTime}),[preferences.language,format]);
 return <LocalizationProvider value={value}>{children}</LocalizationProvider>;
}
function WorkspaceOwner({children,area,navigate,setBranch}:{children:React.ReactNode;area:string;navigate?: (path:string)=>void;setBranch:(branch:string)=>void}) {
 const {preferences}=usePreferences(),{user}=useSession();
 const [windows]=useState(createFictionalWindows);
 const rules=useMemo<Partial<Record<WorkspacePolicyLevel,WorkspacePolicyRule>>>(()=>({platform:{modes:['TAB','SINGLE','SPLIT','WINDOW'],allowDetach:true,limits:{maxOpenDocuments:12,maxWarmDocuments:2}},user:{modes:preferences.openRecordsInTabs?['TAB','SPLIT','WINDOW']:['SINGLE']}}),[preferences.openRecordsInTabs]);
 const [workspace]=useState(()=>{const store=createWorkspace({session:{tenantId:user!.tenantId,userId:user!.id,roleId:user!.role,branchId:user!.branch},policy:rules});store.openDocument(documentFromTarget({pageId:area},product.pages));return store;});
 useEffect(()=>workspace.setPolicy(rules),[workspace,rules]);
 const navigation=useWorkspaceNavigation(workspace,{product});
 const current=navigation.port.current.pageId;
 // The URL follows confirmed workspace changes, including tab/palette navigation.
 // A new route (back/forward or direct navigation) is accepted once, avoiding loops.
 const previousArea=useRef(area),lastSent=useRef(area);
 useEffect(()=>{
  if(area!==previousArea.current){previousArea.current=area;if(area!==lastSent.current){navigation.port.open({pageId:area});lastSent.current=area;return;}}
  if(current!==lastSent.current){lastSent.current=current;navigate?.('/'+current);}
 },[area,current,navigate,navigation.port]);
 const port=useMemo<NavigationPort>(()=>{
  // Example record targets resolve to their gallery, not a duplicate gallery document per record.
  const targetFor=(target:NavigationTarget)=>({pageId:areas.some(a=>a.id===target.pageId)?target.pageId:'page-engines'});
  const open=(target:NavigationTarget)=>navigation.port.open(targetFor(target));
  return {...navigation.port,open,openInNewContext:open,hrefFor:target=>'/'+targetFor(target).pageId};
 },[navigation.port]);
 return <WindowPortProvider value={windows}><WorkspaceContext.Provider value={navigation}><ShellProvider navigation={port} product={product} workspace={workspace} branches={[{value:'sample',label:'Fictional North'},{value:'sample-south',label:'Fictional South'}]} onBranchChange={setBranch} roles={[{value:'editor',label:'Demo editor'}]} brand={brand} preferencesPageId="playground" quickPages={[{id:'shell',label:'Shell'},{id:'ai',label:'AI'}]} timezoneForBranch={()=>'UTC'} documentation={documentation} tours={tours}>{children}</ShellProvider></WorkspaceContext.Provider></WindowPortProvider>;
}
