import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {ShellTestHost,session} from './test/host';
import {useScreenHost,type ScreenHost} from '@pepbits/patterns/screen-host';
import {createWorkspace} from './workspace';

afterEach(()=>vi.restoreAllMocks());
test('session lock opens a modal, preserves the mounted workspace and submits only to platform session',async()=>{
  const show=vi.spyOn(HTMLDialogElement.prototype,'showModal').mockImplementation(function(this:HTMLDialogElement){this.setAttribute('open','');});
  const close=vi.spyOn(HTMLDialogElement.prototype,'close').mockImplementation(function(this:HTMLDialogElement){this.removeAttribute('open');});
  const login=vi.fn().mockResolvedValue('Try again'),workspace=createWorkspace({session:{tenantId:'t',userId:'u'},policy:{platform:{modes:['TAB']}}});
  const owner=workspace.openDocument({module:'operations',documentType:'item',entityId:'a',title:'Record'}).document!;let host!:ScreenHost;
  function Form(){host=useScreenHost();return <input aria-label="Unsaved" defaultValue="Keep this"/>;}
  const tree=(expired:boolean)=><ShellTestHost workspace={workspace} session={{...session,expired,login}}><Form/></ShellTestHost>;
  const view=render(tree(false));act(()=>host.document.reportDirty(true));view.rerender(tree(true));expect(show).toHaveBeenCalledOnce();expect(screen.getByLabelText('Unsaved')).toHaveValue('Keep this');expect(workspace.getDocument(owner.documentId)?.dirty).toBe(true);expect(host.can('edit')).toBe(false);
  const dialog=screen.getByRole('dialog'),cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);expect(cancel.defaultPrevented).toBe(true);
  fireEvent.change(screen.getByLabelText(/^Username/),{target:{value:' editor '}});fireEvent.change(screen.getByLabelText(/^Password/),{target:{value:'synthetic-password'}});fireEvent.submit(dialog.querySelector('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');expect(login).toHaveBeenCalledWith('editor','synthetic-password');expect(screen.getByLabelText(/^Password/)).toHaveValue('');
  view.rerender(tree(false));expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByLabelText('Unsaved')).toHaveValue('Keep this');
});
test('identity changes close workspace documents and clear transient state',()=>{
  const workspace=createWorkspace({session:{tenantId:'t',userId:'u'},policy:{platform:{modes:['TAB']}}});workspace.openDocument({module:'operations',documentType:'item',entityId:'a',title:'Record'});
  let host!:ScreenHost;function Probe(){host=useScreenHost();return null;}
  const view=render(<ShellTestHost workspace={workspace}><Probe/></ShellTestHost>);act(()=>host.document.setDraftState('note','Private'));expect(host.document.draftState.note).toBe('Private');
  view.rerender(<ShellTestHost workspace={workspace} session={{...session,user:{...session.user!,id:'other'}}}><Probe/></ShellTestHost>);
  expect(workspace.getOpenDocuments()).toEqual([]);expect(host.document.draftState).toEqual({});
});
