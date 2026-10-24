import React from 'react';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import type {Request} from '@pepbits/platform/http';
import type {NavigationPort,NavigationTarget} from '@pepbits/platform/navigation';
import {WindowPortProvider,type WindowPort} from '@pepbits/platform/windows';
import {useScreenHost} from '@pepbits/patterns/screen-host';
vi.setConfig({testTimeout:30000});
import {ApplicationProviders,defaultWorkspacePolicy,type ApplicationWorkspace} from './application-providers';
import {product,session} from './test/host';
import {messages} from './test/messages';
import {preferenceMessages} from './test/preference-messages';
const catalogs={...messages,...preferenceMessages};
function api(preferences:Record<string,unknown>={}):Request{
 return vi.fn<Request>(async path=>path.startsWith('/localization')?Response.json({messages:catalogs,fallbackMessages:catalogs}):Response.json({preferences,overrides:preferences,policy:{revision:1,rules:{}},userRevision:1,canManage:false}));
}
function Page({target}:{target:NavigationTarget}){const host=useScreenHost();return <section aria-label={'Page '+target.pageId}><p>{[target.pageId,target.mode,target.recordId].filter(Boolean).join(' ')}</p><input aria-label={'Draft '+target.pageId} onChange={()=>host.document.reportDirty(true)}/></section>;}
const render$=(target:NavigationTarget)=><Page target={target}/>;
function port(current:NavigationTarget,open=vi.fn()):NavigationPort{return {current,open,openInNewContext:open,hrefFor:target=>'/'+target.pageId};}
function host(navigation:NavigationPort,workspace:Partial<ApplicationWorkspace>={},request=api(),windows?:WindowPort){
 const tree=<ApplicationProviders productId="example" brand={{name:'Example',tagline:'Fictional'}} productForRole={()=>product} apiBaseUrl="/api" navigation={navigation} request={request} session={session} workspace={{render:render$,...workspace}}/>;
 return windows?<WindowPortProvider value={windows}>{tree}</WindowPortProvider>:tree;
}
const tabs=()=>within(screen.getByRole('tablist')).getAllByRole('tab').map(tab=>tab.textContent);

test('opens the address target as a document beside the module home and follows later addresses',async()=>{
 const open=vi.fn(),view=render(host(port({pageId:'items',mode:'edit',recordId:'A-1'},open)));
 await screen.findByText('items edit A-1');await waitFor(()=>expect(tabs()).toHaveLength(2));expect(open).not.toHaveBeenCalled();
 view.rerender(host(port({pageId:'operations-dashboard'},open)));await waitFor(()=>expect(screen.getByRole('tab',{selected:true})).toHaveTextContent('Overview'));
 expect(tabs()).toHaveLength(2);expect(open).not.toHaveBeenCalled();
});
test('focusing another document writes its target back through the host navigation port',async()=>{
 const open=vi.fn();render(host(port({pageId:'items',recordId:'A-1',mode:'view'},open)));await screen.findByText('items view A-1');
 fireEvent.click(screen.getByRole('tab',{name:/Overview/}));await waitFor(()=>expect(open).toHaveBeenCalledWith(expect.objectContaining({pageId:'operations-dashboard'})));
});
test('cancelling an address-driven module change restores the active address and retains edits',async()=>{
 const open=vi.fn(),request=api(),original={pageId:'items',recordId:'A-1',mode:'edit' as const};
 const view=render(host(port(original,open),{},request));
 fireEvent.change(await screen.findByRole('textbox',{name:'Draft items'}),{target:{value:'Retained draft'}});
 view.rerender(host(port({pageId:'resources-dashboard'},open),{},request));
 await screen.findByRole('dialog',{name:'Leave Operations?'});
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 await waitFor(()=>expect(open).toHaveBeenCalledWith(expect.objectContaining(original)));
 expect(screen.getByRole('textbox',{name:'Draft items'})).toHaveValue('Retained draft');
 expect(tabs()).toHaveLength(2);
});
test('one-document preference replaces the previous record while split and detach remain in policy',async()=>{
 const request=api({openRecordsInTabs:false}),view=render(host(port({pageId:'items',recordId:'A-1',mode:'view'}),{},request));await screen.findByText('items view A-1');
 view.rerender(host(port({pageId:'items',recordId:'B-2',mode:'view'}),{},request));await screen.findByText('items view B-2');
 await waitFor(()=>expect(screen.queryByText('items view A-1')).toBeNull());expect(tabs()).toHaveLength(2);
 expect(defaultWorkspacePolicy({openRecordsInTabs:false}).user?.modes).toEqual(['SINGLE','SPLIT','WINDOW']);
 expect(defaultWorkspacePolicy({openRecordsInTabs:true}).platform).toMatchObject({allowDetach:true,limits:{maxWarmDocuments:3}});
});
test('dirty documents ask before closing and the host policy callback receives effective preferences',async()=>{
 const policy=vi.fn(defaultWorkspacePolicy);render(host(port({pageId:'items',recordId:'A-1',mode:'edit'}),{policy}));
 fireEvent.change(await screen.findByRole('textbox',{name:'Draft items'}),{target:{value:'Unsaved'}});
 fireEvent.click(screen.getByRole('button',{name:/^Close /}));expect(await screen.findByRole('dialog',{name:'Discard changes?'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.getByRole('textbox',{name:'Draft items'})).toBeVisible();
 expect(policy).toHaveBeenCalledWith(expect.objectContaining({openRecordsInTabs:expect.any(Boolean)}));
});
test('detach is offered only with an available window port and sends a sanitized title',async()=>{
 const windows:WindowPort={available:true,open:vi.fn(async()=>true),close:vi.fn(async()=>{}),focus:vi.fn(async()=>{}),onClosed:()=>()=>{}};
 render(host(port({pageId:'items',recordId:'A-1',mode:'view'}),{},api(),windows));await screen.findByText('items view A-1');
 fireEvent.click(screen.getByRole('button',{name:/tab options/i}));fireEvent.click(await screen.findByRole('button',{name:'Open in its own window'}));
 await waitFor(()=>expect(windows.open).toHaveBeenCalledWith(expect.objectContaining({documentKey:'t:ITEMS:view~A-1',title:'ITEMS view~A-1'})));
});
test('a detached window renders one document and refuses another tenant or a malformed key',async()=>{
 const view=render(host(port({pageId:'operations-dashboard'}),{detachedDocumentKey:'t:ITEMS:view~A-1'}));
 await screen.findByText('items view A-1');expect(screen.queryByRole('tablist')).toBeNull();
 view.rerender(host(port({pageId:'operations-dashboard'}),{detachedDocumentKey:'other:ITEMS:view~A-1'}));expect(await screen.findByText('This window belongs to another tenant')).toBeVisible();expect(screen.queryByText('items view A-1')).toBeNull();
 view.rerender(host(port({pageId:'operations-dashboard'}),{detachedDocumentKey:'not-a-key'}));expect(await screen.findByText('This window could not be opened')).toBeVisible();
});
test('wrapShell surrounds the shell and the plain routed mode is unchanged without a workspace',async()=>{
 const wrapped=vi.fn((shell:React.ReactNode)=><div data-testid="extension">{shell}</div>);render(host(port({pageId:'operations-dashboard'}),{wrapShell:wrapped}));
 expect(await screen.findByTestId('extension')).toContainElement(await screen.findByRole('tablist'));
 const plain=render(<ApplicationProviders productId="example" brand={{name:'Example',tagline:'Fictional'}} productForRole={()=>product} apiBaseUrl="/api" navigation={port({pageId:'items'})} request={api()} session={session}><p>Routed child</p></ApplicationProviders>);
 expect(await within(plain.container).findByText('Routed child')).toBeVisible();expect(within(plain.container).queryByRole('tablist')).toBeNull();
});
