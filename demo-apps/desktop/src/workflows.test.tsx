import {act,fireEvent,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import type {WindowPort} from '@pepbits/platform/windows';
import {renderDesktop} from './test/render';
import {customerRows,mockApi,readOnlySession} from './test/mock-api';

const tabs=()=>within(screen.getByRole('tablist',{name:'Open documents'})).getAllByRole('tab');
const savedKey=(id:string)=>JSON.stringify(['nexora','form:customer-master:'+id]);
const fullRecord={customerCode:'CUS-1',legalName:'Fictional Atlas Trading',tradeName:'Atlas',customerType:'Corporate',segment:'Enterprise',status:'Active',contactName:'Fictional Contact One',email:'contact@example.invalid',phone:'',address1:'Fictional street 1',city:'Dubai',country:'AE',postalCode:'',creditLimit:50000,paymentTerms:'30',creditHold:false,riskRating:'Low',collectionNotes:''};
function seeded(){const api=mockApi();api.records.set(savedKey('CUS-1'),{record:{values:fullRecord,version:1,savedAt:'2026-10-01T08:00:00.000Z'},draftVersion:0});return api;}

test('anonymous sessions see the shared sign-in screen and load no workspace data',async()=>{
 const api=mockApi();renderDesktop('/finance/customers',{api,session:{status:'anonymous',user:null,login:async()=>null,logout:async()=>{}}});
 expect(await screen.findByRole('button',{name:/sign in/i})).toBeVisible();expect(api.request).not.toHaveBeenCalled();
});

test('a missing API base URL is reported instead of guessing a server',async()=>{
 const {DesktopApp}=await import('./app');const {render}=await import('@testing-library/react');
 render(<DesktopApp apiBaseUrl={undefined}/>);expect(screen.getByRole('alert')).toHaveTextContent('VITE_API_URL');
});

test('worklist rows come from the classified search API and open records in their own tabs',async()=>{
 const {container,api}=renderDesktop('/finance/customers');
 await waitFor(()=>expect(container.querySelectorAll('tbody tr')).toHaveLength(customerRows.length));
 await waitFor(()=>expect(api.request).toHaveBeenCalledWith('/worklists/search',expect.objectContaining({method:'POST'})));
 const search=api.request.mock.calls.find(([path])=>path==='/worklists/search')!;expect(JSON.parse(String(search[1]!.body))).toMatchObject({pageId:'customer-master',entity:'customer',productId:'nexora'});
 fireEvent.click(within(container.querySelector('tbody tr')!).getByText('Fictional Atlas Trading'));
 await waitFor(()=>expect(window.location.pathname).toBe('/finance/customers/CUS-1'));
 await waitFor(()=>expect(tabs()).toHaveLength(3));expect(screen.getByRole('tab',{selected:true})).toHaveTextContent('Fictional Atlas Trading');
 fireEvent.click(screen.getByRole('tab',{name:/^Customer Master$/}));await waitFor(()=>expect(window.location.pathname).toBe('/finance/customers'));
});

test('editing a saved record writes the record store through the shared editor and keeps the tab',async()=>{
 const api=seeded();renderDesktop('/finance/customers/CUS-1/edit',{api});
 const name=await screen.findByRole('textbox',{name:/Legal name/});await waitFor(()=>expect(name).toHaveValue('Fictional Atlas Trading'));
 fireEvent.change(name,{target:{value:'Fictional Atlas Holdings'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(api.writes().some(write=>write.path==='/records/'+encodeURIComponent(savedKey('CUS-1'))&&write.method==='PUT'&&write.body?.values?.legalName==='Fictional Atlas Holdings')).toBe(true));
 await waitFor(()=>expect(api.records.get(savedKey('CUS-1'))?.record?.version).toBe(2));expect(screen.getByRole('textbox',{name:/Legal name/})).toHaveValue('Fictional Atlas Holdings');
});

test('a failed save keeps typed values for an explicit retry',async()=>{
 const api=mockApi({failSaves:1});api.records.set(savedKey('CUS-1'),{record:{values:fullRecord,version:1,savedAt:'2026-10-01T08:00:00.000Z'},draftVersion:0});renderDesktop('/finance/customers/CUS-1/edit',{api});
 const name=await screen.findByRole('textbox',{name:/Legal name/});await waitFor(()=>expect(name).toHaveValue('Fictional Atlas Trading'));
 fireEvent.change(name,{target:{value:'Retained fictional name'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(api.writes().filter(write=>write.method==='PUT'&&!write.path.endsWith('/draft')&&write.path.startsWith('/records/'))).toHaveLength(1));
 expect(screen.getByRole('textbox',{name:/Legal name/})).toHaveValue('Retained fictional name');expect(api.records.get(savedKey('CUS-1'))?.record?.version).toBe(1);
 fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(api.records.get(savedKey('CUS-1'))?.record?.version).toBe(2));
});

test('a created record absent from the generated worklist reloads through its saved record key',async()=>{
 const api=mockApi();api.records.set(savedKey('new-id'),{record:{values:{...fullRecord,legalName:'Fictional New Customer'},version:1,savedAt:'2026-10-01T08:00:00.000Z'},draftVersion:0});
 renderDesktop('/finance/customers/new-id/edit',{api});
 await waitFor(()=>expect(screen.getByRole('textbox',{name:/Legal name/})).toHaveValue('Fictional New Customer'));
 expect(window.location.pathname).toBe('/finance/customers/new-id/edit');
});

test('a record absent from both worklist and saved store shows not-found',async()=>{
 renderDesktop('/finance/customers/missing');
 expect(await screen.findByText('Not found')).toBeVisible();
 expect(screen.queryByRole('textbox',{name:/Legal name/})).toBeNull();
});

test('overview creation shortcut respects account grants',async()=>{
 renderDesktop('/overview',{session:readOnlySession});
 expect(await screen.findByRole('button',{name:'New customer'})).toBeDisabled();
});

test('an unqualified launch uses the effective default module while explicit deep links stay put',async()=>{
 const view=renderDesktop('/',{api:mockApi({preferences:{defaultModule:'finance'},rules:{defaultModule:{value:'hr',locked:true}}})});
 await waitFor(()=>expect(window.location.pathname).toBe('/hr/employees'));
 expect(await screen.findByRole('tab',{name:'Employee Worklist'})).toBeVisible();view.unmount();
 renderDesktop('/finance/customers',{api:mockApi({preferences:{defaultModule:'hr'}})});
 expect(await screen.findByRole('tab',{name:'Customer Master'})).toBeVisible();expect(window.location.pathname).toBe('/finance/customers');
});

test('closing a record with unsaved changes asks first and cancelling keeps the value',async()=>{
 renderDesktop('/finance/customers/CUS-1/edit',{api:seeded()});
 const name=await screen.findByRole('textbox',{name:/Legal name/});await waitFor(()=>expect(name).toHaveValue('Fictional Atlas Trading'));
 fireEvent.change(name,{target:{value:'Unsaved fictional name'}});
 await waitFor(()=>expect(screen.getByRole('tab',{selected:true})).toHaveAccessibleName(/unsaved changes/));
 fireEvent.click(screen.getAllByRole('button',{name:/^Close /})[0]!);expect(await screen.findByRole('dialog',{name:'Discard changes?'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.getByRole('textbox',{name:/Legal name/})).toHaveValue('Unsaved fictional name');
});

test('two records can be compared in split view and returned to one pane',async()=>{
 const {container}=renderDesktop('/finance/customers');await waitFor(()=>expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(1));
 fireEvent.click(within(container.querySelectorAll<HTMLElement>('tbody tr')[0]!).getByText('Fictional Atlas Trading'));await waitFor(()=>expect(window.location.pathname).toBe('/finance/customers/CUS-1'));
 fireEvent.click(screen.getByRole('tab',{name:/^Customer Master$/}));await waitFor(()=>expect(window.location.pathname).toBe('/finance/customers'));
 fireEvent.click(within(container.querySelectorAll<HTMLElement>('tbody tr')[1]!).getByText('Fictional Bluecrest Retail'));await waitFor(()=>expect(window.location.pathname).toBe('/finance/customers/CUS-2'));
 fireEvent.click(screen.getByRole('button',{name:'Tab options'}));fireEvent.click(await screen.findByRole('button',{name:/^Split with the last document/}));
 expect(await screen.findByRole('separator',{name:'Resize the split'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Tab options'}));await screen.findAllByRole('button',{name:/^Make full screen/});fireEvent.click(screen.getAllByRole('button',{name:/^Make full screen/}).at(-1)!);
 await waitFor(()=>expect(screen.queryByRole('separator',{name:'Resize the split'})).toBeNull());expect(tabs()).toHaveLength(4);
});

test('separate windows are offered only by an available window port and receive the document key',async()=>{
 const view=renderDesktop('/finance/customers/CUS-1');await screen.findByRole('tab',{name:/CUS-1/});
 fireEvent.click(screen.getByRole('button',{name:'Tab options'}));await screen.findByRole('button',{name:'Close other tabs'});expect(screen.queryByRole('button',{name:'Open in its own window'})).toBeNull();
 view.unmount();
 const windows:WindowPort={available:true,open:vi.fn(async()=>true),close:vi.fn(async()=>{}),focus:vi.fn(async()=>{}),onClosed:()=>()=>{}};
 renderDesktop('/finance/customers/CUS-1',{windows});await screen.findByRole('tab',{name:/CUS-1/});
 fireEvent.click(screen.getByRole('button',{name:'Tab options'}));fireEvent.click(await screen.findByRole('button',{name:'Open in its own window'}));
 await waitFor(()=>expect(windows.open).toHaveBeenCalledWith(expect.objectContaining({documentKey:'fictional-tenant:CUSTOMER-MASTER:view~CUS-1',title:'CUSTOMER-MASTER view~CUS-1'})));
 await waitFor(()=>expect(screen.getByRole('tab',{name:/in its own window/})).toBeVisible());
});

test('a detached window shows one record without tabs and refuses a key for another tenant',async()=>{
 const view=renderDesktop('/index.html',{detachedDocumentKey:'fictional-tenant:CUSTOMER-MASTER:view~CUS-1',api:seeded()});
 await waitFor(()=>expect(screen.getByRole('textbox',{name:/Legal name/})).toHaveValue('Fictional Atlas Trading'));expect(screen.queryByRole('tablist',{name:'Open documents'})).toBeNull();
 view.unmount();renderDesktop('/index.html',{detachedDocumentKey:'another-tenant:CUSTOMER-MASTER:view~CUS-1'});
 expect(await screen.findByText('This window belongs to another tenant')).toBeVisible();
});

test('read-only destinations narrow create and edit without widening the account grants',async()=>{
 const {container}=renderDesktop('/hr/employees');await waitFor(()=>expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
 expect(screen.getByRole('button',{name:'New'})).toBeDisabled();
 fireEvent.click(within(container.querySelector('tbody tr')!).getByText('Fictional Employee One'));
 await waitFor(()=>expect(window.location.pathname).toBe('/hr/employees/EMP-1'));const record=await waitFor(()=>{const element=document.querySelector('[data-record-page]');expect(element).toBeTruthy();return element as HTMLElement;});expect(within(record).getAllByText('Fictional Employee One')[0]).toBeVisible();expect(within(record).getAllByText('Finance').length).toBeGreaterThan(0);
 expect(screen.queryByRole('button',{name:'Edit'})).toBeNull();
});

test('an account without write grants cannot create or edit customers',async()=>{
 const {container}=renderDesktop('/finance/customers',{session:readOnlySession});await waitFor(()=>expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
 expect(screen.getByRole('button',{name:'New'})).toBeDisabled();
});

test('cross-module navigation from the address replaces the tab set around the module home',async()=>{
 renderDesktop('/finance/customers');await screen.findByRole('tab',{name:/^Customer Master$/});
 act(()=>{window.history.pushState(null,'','/hr/employees');window.dispatchEvent(new PopStateEvent('popstate'));});
 await waitFor(()=>expect(tabs().map(tab=>tab.textContent)).toEqual(['Employee Worklist']));
});

test('preference changes go through the single host update path with accepted revisions',async()=>{
 const api=mockApi();renderDesktop('/preferences',{api});
 const layout=await screen.findByLabelText('Record form style');fireEvent.change(layout,{target:{value:'wizard'}});
 await waitFor(()=>expect(api.writes().filter(write=>write.path==='/preferences')).toHaveLength(1));
 expect(api.writes().find(write=>write.path==='/preferences')!.body).toMatchObject({userRevision:1,policyRevision:1,preferences:{formNavigation:'wizard'}});
});

test('a tenant lock disables the preference control and keeps the managed value',async()=>{
 const api=mockApi({preferences:{formNavigation:'wizard'},rules:{formNavigation:{value:'rail',locked:true}}});renderDesktop('/preferences',{api});
 const layout=await screen.findByLabelText('Record form style');expect(layout).toBeDisabled();expect(layout).toHaveValue('rail');fireEvent.change(layout,{target:{value:'tabs'}});
 expect(api.writes()).toHaveLength(0);
});

test('a policy change while mounted replaces a conflicting preference and disables its control',async()=>{
 const api=mockApi({preferences:{formNavigation:'wizard'}});renderDesktop('/preferences',{api});
 const layout=await screen.findByLabelText('Record form style');expect(layout).toHaveValue('wizard');
 api.setPolicy({formNavigation:{value:'rail',locked:true}});
 act(()=>window.dispatchEvent(new Event('pepbits-preference-policy-changed')));
 await waitFor(()=>expect(layout).toBeDisabled());expect(layout).toHaveValue('rail');
 fireEvent.change(layout,{target:{value:'tabs'}});expect(api.writes()).toHaveLength(0);
});

test('AI stays off unless configured, and the configured assistant asks the demo API for policy',async()=>{
 const off=renderDesktop('/finance/customers');await waitFor(()=>expect(off.container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
 expect(screen.queryByRole('button',{name:'Open the AI assistant'})).toBeNull();expect(off.api.request.mock.calls.some(([path])=>path.startsWith('/ai/'))).toBe(false);off.unmount();
 const on=renderDesktop('/finance/customers',{aiEnabled:true});await waitFor(()=>expect(on.container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
 expect(await screen.findByRole('button',{name:'Open the AI assistant'})).toBeVisible();
 await waitFor(()=>expect(on.api.request.mock.calls.some(([path])=>path.startsWith('/ai/policy'))).toBe(true));
});
