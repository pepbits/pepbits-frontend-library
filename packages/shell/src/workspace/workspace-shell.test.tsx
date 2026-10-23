import React from 'react';
import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {WindowPortProvider,NULL_WINDOW_PORT} from '@pepbits/platform/windows';
import {createWorkspace} from './document-manager';
import {useWorkspaceNavigation} from './use-workspace-navigation';
import {WorkspaceShell} from './workspace-shell';
import {useScreenHost,useScreenDraftState} from '@pepbits/patterns/screen-host';
import {ShellTestHost,product} from '../test/host';
const make=()=>createWorkspace({session:{tenantId:'t',userId:'u'},policy:{platform:{modes:['TAB','SPLIT','WINDOW'],allowDetach:true}}});
function Editor(){const host=useScreenHost();const [value,setValue]=useScreenDraftState('text','');return <input aria-label="Draft" value={value} onChange={e=>{setValue(e.target.value);host.document.reportDirty(true);}}/>;}
function Host({workspace,floatingWindows=false}:{workspace:ReturnType<typeof make>;floatingWindows?:boolean}){
 const navigation=useWorkspaceNavigation(workspace,{product});return <ShellTestHost workspace={workspace} navigation={navigation.port} settings={{preferences:{floatingWindows}}}><WorkspaceShell navigation={navigation} renderDocument={doc=>doc.documentType==='ITEMS'?<Editor/>:<p>Home</p>}/></ShellTestHost>;
}
test('workspace frame keeps dirty work until its confirmation, then removes the owning document',()=>{
 const workspace=make();render(<Host workspace={workspace}/>);
 let id='';act(()=>{id=workspace.openDocument({module:'operations',documentType:'items',entityId:'a',title:'Record A'}).document!.documentId;});
 fireEvent.change(screen.getByRole('textbox',{name:'Draft'}),{target:{value:'Unfinished'}});expect(workspace.getDocument(id)?.dirty).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Close Record A'}));expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.getByRole('textbox',{name:'Draft'})).toHaveValue('Unfinished');
 fireEvent.click(screen.getByRole('button',{name:'Close Record A'}));fireEvent.click(screen.getByRole('button',{name:'Discard and close'}));expect(workspace.getDocument(id)).toBeNull();expect(screen.queryByRole('textbox',{name:'Draft'})).toBeNull();
});
test('effective floating preference replaces tabs with frames and taskbar without losing screen state',()=>{
 const workspace=make();const view=render(<Host workspace={workspace}/>);act(()=>{workspace.openDocument({module:'operations',documentType:'items',entityId:'a',title:'Record A'});});
 fireEvent.change(screen.getByRole('textbox',{name:'Draft'}),{target:{value:'Retained'}});view.rerender(<Host workspace={workspace} floatingWindows/>);
 expect(screen.queryByRole('tablist')).toBeNull();expect(screen.getByRole('toolbar',{name:'Open windows'})).toBeVisible();expect(screen.getByRole('textbox',{name:'Draft'})).toHaveValue('Retained');
 fireEvent.click(screen.getByRole('button',{name:'Minimise Record A'}));expect(screen.queryByRole('textbox',{name:'Draft'})).toBeNull();fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button',{name:/Record A.*minimised/}));expect(screen.getByRole('textbox',{name:'Draft'})).toHaveValue('Retained');
});
test('native detach is hidden without a window port and uses only the supplied port when available',async()=>{
 const workspace=make(),open=vi.fn().mockResolvedValue(true),focus=vi.fn().mockResolvedValue(undefined);
 const view=render(<Host workspace={workspace}/>);act(()=>{workspace.openDocument({module:'operations',documentType:'items',entityId:'a',title:'Record A'});});
 fireEvent.click(screen.getByRole('button',{name:'Tab options'}));expect(screen.queryByRole('button',{name:'Open in its own window'})).toBeNull();fireEvent.keyDown(document,{key:'Escape'});
 view.rerender(<WindowPortProvider value={{...NULL_WINDOW_PORT,available:true,open,focus}}><Host workspace={workspace}/></WindowPortProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Tab options'}));await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Open in its own window'}));});
 expect(open).toHaveBeenCalledOnce();expect(open.mock.calls[0]![0].title).not.toContain('Record A');expect(screen.queryByRole('textbox',{name:'Draft'})).toBeNull();
 fireEvent.click(screen.getByRole('tab',{name:/Record A.*in its own window/}));expect(focus).toHaveBeenCalledOnce();
});
