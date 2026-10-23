import React from 'react';
import {Button} from '@pepbits/ui';
import {usePreferences} from '@pepbits/preferences/react';
import {useWorkspace, useDetachedIn, documentFromTarget} from '@pepbits/shell/workspace';
import {useShell} from '@pepbits/shell';
import {useWindowPort} from '@pepbits/platform/windows';
export function ShellDetachedDemo(){const {preferences}=usePreferences(),workspace=useWorkspace(),detached=useDetachedIn(workspace),port=useWindowPort(),{product,toast}=useShell();return <div className="space-y-3"><p>Fictional WindowPort: open, focus and close resolve in browser memory. No child window, OS process or record transfer exists. Reattach restores the page in this canvas.</p><Button disabled={!port.available||!preferences.openRecordsInTabs} onClick={()=>{const current=workspace.getActiveDocument();const opened=workspace.openDocument(documentFromTarget({pageId:'foundations'},product.pages));if(current)workspace.focusDocument(current.documentId);if(opened.document){const result=workspace.detachDocument(opened.document.documentId);if(!result.ok)toast({title:result.reason??'Unavailable',type:'warning'});}}}>Simulate detach Foundations</Button><p role="status">Detached documents: {detached.length}</p>{detached.map(id=><Button key={id} onClick={()=>workspace.attachDocument(id)}>Reattach {workspace.getDocument(id)?.title}</Button>)}</div>;}
