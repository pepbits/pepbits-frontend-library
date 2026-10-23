import React from 'react';
import {Button} from '@pepbits/ui';
import {useNavigation} from '@pepbits/platform';
import {useWorkspace, useSplit, documentFromTarget} from '@pepbits/shell/workspace';
import {useShell} from '@pepbits/shell';
import {usePreferences} from '@pepbits/preferences/react';
export function ShellWorkspaceDemo(){
 const navigation=useNavigation(),workspace=useWorkspace(),split=useSplit(),{product,toast}=useShell(),{preferences}=usePreferences();
 const report=(result:{ok:boolean;reason?:string})=>{if(!result.ok)toast({title:result.reason??'Unavailable',type:'warning'});};
 return <div className="space-y-3"><p>The tabs and canvas above belong to the full shell. Open Foundations beside this page, focus either pane, then exit split.</p><div className="flex flex-wrap gap-2">
 <Button onClick={()=>navigation.open({pageId:'foundations'})}>Open Foundations tab</Button>
 <Button disabled={!preferences.openRecordsInTabs} onClick={()=>{
  const original=workspace.getActiveDocument();workspace.openDocument(documentFromTarget({pageId:'foundations'},product.pages));if(original)workspace.focusDocument(original.documentId);report(workspace.splitWithPrevious('right'));
 }}>Split with Foundations</Button>
 <Button disabled={!split.length} onClick={()=>workspace.exitSplit()}>Exit split canvas</Button></div></div>;
}
