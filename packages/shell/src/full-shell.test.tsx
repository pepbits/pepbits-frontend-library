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

import {EnterpriseShell} from "./enterprise-shell";
const make=()=>createWorkspace({session:{tenantId:'t',userId:'u',branchId:'north'},policy:{platform:{modes:['TAB','SPLIT'],limits:{maxWarmDocuments:1}}}});
const open=(workspace:ReturnType<typeof make>,id:string)=>workspace.openDocument({module:'operations',documentType:'items',entityId:id,title:`Record ${id}`}).document!;
test('page engine inside the full frame saves to toasts and edits survive suspension until explicit document close',async()=>{
  const workspace=make(),a=open(workspace,'a'),adapter=createMemoryRecordAdapter(),save=vi.spyOn(adapter,'save');
  const schema:EntitySchema={id:'item',singular:'Item',plural:'Items',description:'Records',sections:[{id:'details',title:'Details',description:'',fields:[{id:'name',label:'Name',type:'text',required:true,defaultValue:'Record A'}]}]};
  const form=<RecordAdapterProvider value={{adapter,identity:'t:u',applicationId:'example',sessionAvailable:true}}><DynamicRecordForm page={product.pages.items!} schema={schema} target={{pageId:'items',mode:'edit',recordId:'a'}}/></RecordAdapterProvider>;
  const tree=(visible:boolean)=><ShellTestHost workspace={workspace}><EnterpriseShell><ShellDocumentProvider documentId={a.documentId}>{visible&&form}</ShellDocumentProvider></EnterpriseShell></ShellTestHost>;
  const view=render(tree(true));await waitFor(()=>expect(screen.getByRole('textbox',{name:/Name/})).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox',{name:/Name/}),{target:{value:'Retained edit'}});expect(workspace.getDocument(a.documentId)?.dirty).toBe(true);
  expect(workspace.closeDocument(a.documentId).ok).toBe(false);view.rerender(tree(false));view.rerender(tree(true));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:/Name/})).toHaveValue('Retained edit'));
  fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());
  expect(await screen.findByText(/Changes saved/)).toBeVisible();await waitFor(()=>expect(workspace.getDocument(a.documentId)?.dirty).toBe(false));
  act(()=>{workspace.closeDocument(a.documentId);});expect(workspace.getOpenDocuments()).toHaveLength(0);
});
test('patterns screen inside the full frame reports dirty changes and localized success through the shell',async()=>{
  const workspace=make(),a=open(workspace,'a');
  const api:LifecycleApi={metadata:vi.fn().mockResolvedValue({...metadataFixture(),available:true}),list:vi.fn().mockResolvedValue({items:[summaryOf(versionDetail().version)],nextCursor:null}),detail:vi.fn().mockResolvedValue(versionDetail()),createDraft:vi.fn(),saveDraft:vi.fn().mockResolvedValue(versionDetail({revision:4})),approve:vi.fn(),publish:vi.fn(),activation:vi.fn(),activate:vi.fn(),validate:vi.fn(),validateVersion:vi.fn(),resolve:vi.fn()};
  render(<ShellTestHost workspace={workspace}><EnterpriseShell><ShellDocumentProvider documentId={a.documentId}><LifecycleConfigurationPage api={api} scopeKey="test" application={{code:'application',label:'Application'}} permissions={{read:true,edit:true,approve:true,publish:true,activate:true,resolve:true}}/></ShellDocumentProvider></EnterpriseShell></ShellTestHost>);
  fireEvent.click(await screen.findByRole('button',{name:/Open sample-record version 1/}));fireEvent.change(await screen.findByLabelText(/^Name/),{target:{value:'Changed'}});
  expect(workspace.getDocument(a.documentId)?.dirty).toBe(true);fireEvent.change(screen.getByLabelText(/^Change reason/),{target:{value:'Reviewed'}});fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
  expect(await within(document.querySelector('[data-shell-toasts]') as HTMLElement).findByText('Saved sample-record version 1.')).toBeVisible();await waitFor(()=>expect(workspace.getDocument(a.documentId)?.dirty).toBe(false));
});
