"use client";
import React from 'react';
import {Button} from '@pepbits/ui';
import {Modal} from '@pepbits/components';
import {LocalizedText} from '@pepbits/i18n/react';
import {useWindowPort} from '@pepbits/platform/windows';
import {useERP} from '../shell-context';
import {EnterpriseShell} from '../enterprise-shell';
import {Footer} from '../footer';
import {WorkspaceCanvas} from './workspace-canvas';
import {WorkspaceTabs} from './workspace-tabs';
import {MdiTaskbar} from './mdi-taskbar';
import {useMdiWorkspace} from './use-mdi-workspace';
import {useDetachedWindows} from './use-detached-windows';
import type {WorkspaceNavigation} from './use-workspace-navigation';
import type {WorkspaceDocument} from './types';

/** Mount inside ShellProvider with navigation.port and the same workspace.
 * The host resolves workspace policy, including openRecordsInTabs, before opening documents.
 * Floating frames are geometry over that store; they never grant native-window capability.
 */
export function WorkspaceShell({navigation,renderDocument,allowFloatingWindows=true}: {
 navigation: WorkspaceNavigation;
 renderDocument(document:WorkspaceDocument):React.ReactNode;
 allowFloatingWindows?:boolean;
}){
 const {preferences,setCommandOpen,toast,t}=useERP();
 const windowPort=useWindowPort();
 const mdi=useMdiWorkspace(navigation.workspace,allowFloatingWindows&&preferences.floatingWindows);
 useDetachedWindows(navigation.workspace);
 const report=(result:{ok:boolean;reason?:string})=>{if(!result.ok&&result.reason)toast({title:t(result.reason),type:'warning'});};
 const focus=(id:string)=>{
  if(navigation.detachedIds.includes(id)){void windowPort.focus(id).catch(()=>toast({title:t('Could not open window.'),type:'error'}));return;}
  navigation.focusDocument(id);
 };
 return <EnterpriseShell tabs={!mdi?<WorkspaceTabs documents={navigation.documents} activeDocumentId={navigation.activeDocument?.documentId??null}
  onActivate={focus} onClose={navigation.closeDocument} onCloseOthers={navigation.closeOthers} onOpenCommand={()=>setCommandOpen(true)}
  onSplit={()=>report(navigation.splitCurrent())} onSwap={navigation.swapSplit} onExitSplit={navigation.exitSplit} isSplit={navigation.splitIds.length>1}
  onDetach={windowPort.available?id=>report(navigation.detach(id)):undefined} detachedIds={navigation.detachedIds}/>:undefined}
  footer={<>{mdi?<MdiTaskbar documents={navigation.localDocuments} frames={mdi.frames} activeDocumentId={navigation.activeDocument?.documentId??null} onSelect={mdi.onSelect}/>:null}<Footer/></>}>
  <WorkspaceCanvas documents={navigation.localDocuments} splitIds={navigation.splitIds} activeDocumentId={navigation.activeDocument?.documentId??null}
   onFocusPane={navigation.focusDocument} onClosePane={navigation.closeDocument} onSwap={navigation.swapSplit} onExitSplit={navigation.exitSplit} renderDocument={renderDocument} mdi={mdi??undefined}/>
  <Modal open={!!navigation.pending} onClose={navigation.cancelPending} title={navigation.pending?.label??'Discard changes?'} size="sm">
   <div className="space-y-4 p-4"><p>{navigation.pending&&t(navigation.pending.message)}</p><div className="flex justify-end gap-2">
    <Button variant="secondary" onClick={navigation.cancelPending}><LocalizedText message="Cancel"/></Button>
    <Button onClick={navigation.confirmPending}>{t(navigation.pending?.confirmLabel??'Discard and close')}</Button>
   </div></div>
  </Modal>
 </EnterpriseShell>;
}
