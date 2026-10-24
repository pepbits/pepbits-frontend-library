import React from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {useScreenHost,useScreenDraftState, type ScreenHost} from '@pepbits/patterns/screen-host';
import {LifecycleConfigurationPage, type LifecycleApi} from '@pepbits/patterns/lifecycle';
import {DynamicRecordForm} from '@pepbits/page-engines/forms';
import {RecordAdapterProvider} from '@pepbits/page-engines/records';
import type {EntitySchema} from '@pepbits/page-engines/types';
import {createMemoryRecordAdapter} from '@pepbits/data';
import {ShellDocumentProvider} from './screen-host';
import {createWorkspace} from './workspace';
import {ToastViewport} from './layers';
import {ShellTestHost,product,session} from './test/host';
import {metadataFixture,summaryOf,versionDetail} from './test/lifecycle';

const make=()=>createWorkspace({session:{tenantId:'t',userId:'u',branchId:'north'},policy:{platform:{modes:['TAB','SPLIT'],limits:{maxWarmDocuments:1}}}});
const open=(workspace:ReturnType<typeof make>,id:string)=>workspace.openDocument({module:'operations',documentType:'items',entityId:id,title:`Record ${id}`}).document!;
test('ScreenHost fails closed without action grants, unknown action, role or an active session',()=>{
  let host!:ScreenHost;function Probe(){host=useScreenHost();return null;}
  const tree=(access=product.access,value=session)=><ShellTestHost product={{...product,access}} session={value}><Probe/></ShellTestHost>;
  const view=render(tree());expect(host.can('edit')).toBe(true);expect(host.can('unknown')).toBe(false);
  view.rerender(tree({}));expect(host.can('edit')).toBe(false);
  view.rerender(<ShellTestHost product={{...product,access:undefined}}><Probe/></ShellTestHost>);expect(host.can('edit')).toBe(false);
  view.rerender(tree(product.access,{...session,user:{...session.user!,role:'viewer'}}));expect(host.can('edit')).toBe(false);
  view.rerender(tree(product.access,{...session,status:'anonymous',user:null}));expect(host.can('edit')).toBe(false);
});
test('each pane keeps its identity, focus, scope and dirty owner when another pane becomes active',()=>{
  const workspace=make(),a=open(workspace,'a'),b=open(workspace,'b'),hosts:Record<string,ScreenHost>={};
  function Probe({name}:{name:string}){hosts[name]=useScreenHost();return null;}
  render(<ShellTestHost workspace={workspace} branch="south"><ShellDocumentProvider documentId={a.documentId}><Probe name="a"/></ShellDocumentProvider><ShellDocumentProvider documentId={b.documentId}><Probe name="b"/></ShellDocumentProvider></ShellTestHost>);
  expect(hosts.a!.document.id).toBe(a.documentId);expect(hosts.a!.document.focused).toBe(false);expect(hosts.b!.document.focused).toBe(true);
  expect(hosts.a!.scope).toEqual({module:'operations',branch:'north'});
  act(()=>hosts.a!.document.reportDirty(true));expect(workspace.getDocument(a.documentId)?.dirty).toBe(true);expect(workspace.getDocument(b.documentId)?.dirty).toBe(false);
  act(()=>workspace.moveToSplit(a.documentId));expect(hosts.a!.document.focused).toBe(true);expect(hosts.b!.document.focused).toBe(false);
});
test('transient state survives suspension, close is distinct from unmount, and close deletes it',()=>{
  const workspace=make(),a=open(workspace,'a'),closed=vi.fn();let host!:ScreenHost;
  function Editor(){host=useScreenHost();const [value,setValue]=useScreenDraftState('note','');return <input aria-label="Note" value={value} onChange={e=>setValue(e.target.value)}/>;}
  const tree=(visible:boolean)=><ShellTestHost workspace={workspace}><ShellDocumentProvider documentId={a.documentId}>{visible&&<Editor/>}</ShellDocumentProvider></ShellTestHost>;
  const view=render(tree(true));host.document.subscribeClose!(closed);fireEvent.change(screen.getByLabelText('Note'),{target:{value:'Retained'}});
  act(()=>host.document.reportDirty(true));view.rerender(tree(false));act(()=>workspace.suspendDocument(a.documentId));expect(closed).not.toHaveBeenCalled();
  view.rerender(tree(true));expect(screen.getByLabelText('Note')).toHaveValue('Retained');expect(workspace.closeDocument(a.documentId).ok).toBe(false);
  act(()=>{workspace.closeDocument(a.documentId,{discardChanges:true});});expect(closed).toHaveBeenCalledOnce();expect(host.document.draftState).toEqual({});expect(JSON.stringify(workspace.restoreMetadata())).not.toContain('Retained');
});
test('explicit close subscribers can unsubscribe and transient state supports multiple same-turn writes',()=>{
  const workspace=make(),a=open(workspace,'a');let host!:ScreenHost;function Probe(){host=useScreenHost();return null;}
  render(<ShellTestHost workspace={workspace}><ShellDocumentProvider documentId={a.documentId}><Probe/></ShellDocumentProvider></ShellTestHost>);
  const close=vi.fn(),stop=host.document.subscribeClose!(close);stop();
  act(()=>{host.document.setDraftState('one',1);host.document.setDraftState('two',2);});expect(host.document.draftState).toEqual({one:1,two:2});
  act(()=>{workspace.closeDocument(a.documentId);});expect(close).not.toHaveBeenCalled();expect(host.document.draftState).toEqual({});
});
test('page engine saves reach shell toasts and edits survive suspension until explicit document close',async()=>{
  const workspace=make(),a=open(workspace,'a'),adapter=createMemoryRecordAdapter(),save=vi.spyOn(adapter,'save');
  const schema:EntitySchema={id:'item',singular:'Item',plural:'Items',description:'Records',sections:[{id:'details',title:'Details',description:'',fields:[{id:'name',label:'Name',type:'text',required:true,defaultValue:'Record A'}]}]};
  const form=<RecordAdapterProvider value={{adapter,identity:'t:u',applicationId:'example',sessionAvailable:true}}><DynamicRecordForm page={product.pages.items!} schema={schema} target={{pageId:'items',mode:'edit',recordId:'a'}}/></RecordAdapterProvider>;
  const tree=(visible:boolean)=><ShellTestHost workspace={workspace}><ShellDocumentProvider documentId={a.documentId}>{visible&&form}</ShellDocumentProvider><ToastViewport/></ShellTestHost>;
  const view=render(tree(true));await waitFor(()=>expect(screen.getByRole('textbox',{name:/Name/})).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox',{name:/Name/}),{target:{value:'Retained edit'}});expect(workspace.getDocument(a.documentId)?.dirty).toBe(true);
  expect(workspace.closeDocument(a.documentId).ok).toBe(false);view.rerender(tree(false));view.rerender(tree(true));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:/Name/})).toHaveValue('Retained edit'));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Save'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());
  expect(await screen.findByText(/Changes saved/)).toBeVisible();expect(workspace.getDocument(a.documentId)?.dirty).toBe(false);
  act(()=>{workspace.closeDocument(a.documentId);});expect(workspace.getOpenDocuments()).toHaveLength(0);
});
test('patterns lifecycle screen reports dirty changes and localized success through the shell',async()=>{
  const workspace=make(),a=open(workspace,'a');
  const api:LifecycleApi={metadata:vi.fn().mockResolvedValue({...metadataFixture(),available:true}),list:vi.fn().mockResolvedValue({items:[summaryOf(versionDetail().version)],nextCursor:null}),detail:vi.fn().mockResolvedValue(versionDetail()),createDraft:vi.fn(),saveDraft:vi.fn().mockResolvedValue(versionDetail({revision:4})),approve:vi.fn(),publish:vi.fn(),activation:vi.fn(),activate:vi.fn(),validate:vi.fn(),validateVersion:vi.fn(),resolve:vi.fn()};
  render(<ShellTestHost workspace={workspace}><ShellDocumentProvider documentId={a.documentId}><LifecycleConfigurationPage api={api} scopeKey="test" application={{code:'application',label:'Application'}} permissions={{read:true,edit:true,approve:true,publish:true,activate:true,resolve:true}}/></ShellDocumentProvider><ToastViewport/></ShellTestHost>);
  fireEvent.click(await screen.findByRole('button',{name:/Open sample-record version 1/}));fireEvent.change(await screen.findByLabelText(/^Name/),{target:{value:'Changed'}});
  expect(workspace.getDocument(a.documentId)?.dirty).toBe(true);fireEvent.change(screen.getByLabelText(/^Change reason/),{target:{value:'Reviewed'}});fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
  expect(await within(document.querySelector('[data-shell-toasts]') as HTMLElement).findByText('Saved sample-record version 1.')).toBeVisible();expect(workspace.getDocument(a.documentId)?.dirty).toBe(false);
});
test('notifications honor toast style, duration, placement, limits and dismiss',()=>{
  vi.useFakeTimers();let host!:ScreenHost;function Probe(){host=useScreenHost();return null;}
  const view=render(<ShellTestHost settings={{preferences:{toastPosition:'bottom-left',toastStyle:'solid',toastDuration:2000,maxVisibleToasts:1}}}><Probe/><ToastViewport/></ShellTestHost>);
  act(()=>{host.notify('First',{tone:'info'});host.notify('Last',{tone:'success'});});expect(screen.queryByText('First')).toBeNull();expect(screen.getByText('Last').closest('[style]')).toHaveStyle({background:'color-mix(in srgb, var(--success) 40%, #000)'});
  expect(view.container.querySelector('.bottom-12.left-4')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Dismiss'}));expect(screen.queryByText('Last')).toBeNull();
  act(()=>host.notify('Temporary',{tone:'warning'}));act(()=>vi.advanceTimersByTime(2000));expect(screen.queryByText('Temporary')).toBeNull();view.unmount();vi.useRealTimers();
});
