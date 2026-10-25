import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {Module} from './test/module';
import {mockApi,fixturePages} from './test/mock-api';
import {canWriteEntity,FINANCE_ENTITIES} from './modules/keystone/access';
import type {TestHostValue} from './test/host';
function fixture(request:JsonRequest,role='admin',permissions:string[]=[]):TestHostValue{return {scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:[role],permissions},preferences:DEFAULT_PREFERENCES,request,navigate:vi.fn()};}
test.each(['finance','finance-manager','accountant'])('%s gets all eight finance entities and only explicit additional grants',role=>{
 for(const entity of FINANCE_ENTITIES)expect(canWriteEntity({role},entity)).toBe(true);
 expect(canWriteEntity({role},'sales-invoices')).toBe(false);expect(canWriteEntity({role},'departments')).toBe(false);
 expect(canWriteEntity({role,permissions:['erp:write:departments']},'departments')).toBe(true);
 expect(canWriteEntity({role,permissions:['erp:write:*','erp:write:sales']},'sales-invoices')).toBe(false);
});
test.each(['admin','enterprise-admin','operations','operations-analyst'])('%s retains broad write presentation',role=>{expect(canWriteEntity({role},'departments')).toBe(true);});
test('unknown and absent roles never inherit finance grants',()=>{expect(canWriteEntity(undefined,'tax-rates')).toBe(false);expect(canWriteEntity({role:'viewer',permissions:['erp:write:tax-rates']},'tax-rates')).toBe(false);});
test.each(['erp1','erp2'] as const)('%s finance creation follows entity grants',async variant=>{
 const api=mockApi(),host=fixture(api.request,'finance');const view=render(<Module variant={variant} path="/masters/tax-rates" host={host}/>);expect(await screen.findByRole('button',{name:'New'})).toBeEnabled();
 view.rerender(<Module variant={variant} path="/masters/departments" host={host}/>);await screen.findByRole('heading',{name:'Department master',level:1});await waitFor(()=>expect(view.container.querySelector('tbody tr')).toBeTruthy());expect(screen.getByRole('button',{name:variant==='erp1'?'Add row':'New department'})).toBeDisabled();
 view.rerender(<Module variant={variant} path="/masters/departments" host={fixture(api.request,'finance',['erp:write:departments'])}/>);expect(await screen.findByRole('button',{name:variant==='erp1'?'Add row':'New department'})).toBeEnabled();
});
test('ERP2 direct edit for a non-granted entity has no save or editable fields',async()=>{
 const api=mockApi(),row=api.rows.get('departments')![0]!;render(<Module variant="erp2" path={'/masters/departments/'+row.id+'/edit'} host={fixture(api.request,'accountant')}/>);await screen.findByRole('heading',{name:'Record details'});expect(screen.queryByRole('button',{name:'Save'})).toBeNull();expect(screen.queryByRole('textbox',{name:'Department'})).toBeNull();
});
test('ERP1 tree searches ancestors, adds a child, and adopts the acknowledged record',async()=>{
 const api=mockApi(),request=vi.fn(api.request),host=fixture(request as JsonRequest,'accountant');const view=render(<Module variant="erp1" path="/masters/chart-of-accounts" host={host}/>);
 await waitFor(()=>expect(view.container.querySelector('[data-hierarchy]')).toBeTruthy());const root=api.rows.get('chart-of-accounts')![0]!;await screen.findByRole('button',{name:'Add child'});fireEvent.click(screen.getByRole('button',{name:'Add child'}));
 fireEvent.change(await screen.findByRole('textbox',{name:'Account'}),{target:{value:'Fictional child account'}});fireEvent.click(screen.getByRole('button',{name:'Create'}));
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true));const write=request.mock.calls.find(([,init])=>init?.method==='POST')!;expect(JSON.parse(String(write[1]?.body))).toMatchObject({parentId:root.id,level:root.level+1,name:'Fictional child account'});
 await screen.findByRole('heading',{name:'Record details'});fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:'Fictional child account'}});await screen.findByRole('button',{name:'Fictional child account'});
});
test('ERP2 hierarchy records visible neighbour order and navigates to selected records',async()=>{
 const api=mockApi(),host=fixture(api.request),view=render(<Module variant="erp2" path="/masters/chart-of-accounts" host={host}/>);await waitFor(()=>expect(view.container.querySelector('[data-hierarchy]')).toBeTruthy());fireEvent.click(screen.getByRole('button',{name:'Expand all'}));const root=api.rows.get('chart-of-accounts')![0]!;fireEvent.click(screen.getByRole('button',{name:String(root.name)}));expect(host.navigate).toHaveBeenCalledWith('/erp2/masters/chart-of-accounts/'+root.id);
});
test.each(['erp1','erp2'] as const)('%s board moves retain the original status on failure and retry the same operation',async variant=>{
 const api=mockApi();for(const row of api.rows.get('support-tickets')!)row.version=3;let fail=true;const request=vi.fn<JsonRequest>(async<T,>(path:string,init?:RequestInit)=>{if(init?.method==='PUT'&&fail)throw Object.assign(new Error('Service offline'),{status:503});return api.request<T>(path,init);});
 const view=render(<Module variant={variant} path="/transactions/support-tickets" host={fixture(request as JsonRequest)}/>);await waitFor(()=>expect(view.container.querySelector('[data-board-item]')).toBeTruthy());const card=view.container.querySelector('[data-board-item]')!,id=card.getAttribute('data-board-item')!,row=api.rows.get('support-tickets')!.find(row=>row.id===id)!;
 const move=within(card as HTMLElement).getByRole('combobox'),status=row.status==='Resolved'?'Open':'Resolved';fireEvent.change(move,{target:{value:status}});await screen.findByRole('button',{name:'Retry'});expect(move).toHaveValue(row.status);fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT').map(([,init])=>JSON.parse(String(init?.body)));expect(writes[0]).toEqual(writes[1]);expect(writes[0]).toMatchObject({expectedVersion:row.version,status});await waitFor(()=>expect(view.container.querySelector(`[data-board-item="${id}"]`)?.parentElement).toHaveAttribute('data-board-column',status));
});
test('finance cannot drag or move cases without a matching entity grant',async()=>{
 const api=mockApi(),view=render(<Module variant="erp1" path="/transactions/support-tickets" host={fixture(api.request,'finance')}/>);await waitFor(()=>expect(view.container.querySelector('[data-board-item]')).toBeTruthy());expect(within(view.container.querySelector('[data-board-item]') as HTMLElement).getByRole('combobox')).toBeDisabled();expect(view.container.querySelector('[data-board-item]')).toHaveAttribute('draggable','false');expect(screen.queryByRole('button',{name:'New'})).toBeNull();
});
test('a mounted shell denial fences writes even with a matching finance entity grant',async()=>{
 const api=mockApi(),request=vi.fn(api.request),host={...fixture(request as JsonRequest,'finance',['erp:write:support-tickets']),can:()=>true};
 const view=render(<Module variant="erp1" path="/transactions/support-tickets" host={host}/>);await waitFor(()=>expect(view.container.querySelector('[data-board-item]')).toBeTruthy());
 const card=view.container.querySelector('[data-board-item]') as HTMLElement;expect(within(card).getByRole('combobox')).toBeEnabled();expect(screen.getByRole('button',{name:'New'})).toBeEnabled();
 view.rerender(<Module variant="erp1" path="/transactions/support-tickets" host={{...host,can:()=>false}}/>);
 expect(within(card).getByRole('combobox')).toBeDisabled();expect(card).toHaveAttribute('draggable','false');expect(screen.queryByRole('button',{name:'New'})).toBeNull();
 fireEvent.change(within(card).getByRole('combobox'),{target:{value:'Resolved'}});expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(0);
});
test('ERP1 profile keeps the worklist beside selection and persists the accepted layout choice',async()=>{
 const api=mockApi(),request=vi.fn(api.request),host=fixture(request as JsonRequest);host.preferences={...host.preferences,rememberFilters:true};const view=render(<Module variant="erp1" path="/masters/customers" host={host}/>);await screen.findByRole('heading',{name:'Record details'});expect(view.container.querySelector('[data-erp-profile] tbody')).toBeTruthy();
 fireEvent.click(screen.getByRole('radio',{name:'Full table'}));await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT'&&JSON.parse(String(init.body)).key==='keystone.mode.customers')).toBe(true));expect(view.container.querySelector('[data-erp-profile] tbody')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Back'}));await waitFor(()=>expect(view.container.querySelector('[data-erp-profile] tbody')).toBeTruthy());
});
test('effective rememberFilters policy prevents profile layout persistence',async()=>{
 const api=mockApi(),request=vi.fn(api.request),host=fixture(request as JsonRequest);host.preferences={...host.preferences,rememberFilters:true};host.preferenceHost={preferences:host.preferences,preferencePolicy:{revision:1,rules:{rememberFilters:{value:false,locked:true}}},onPreferenceChange:vi.fn()};render(<Module variant="erp1" path="/masters/customers" host={host}/>);await screen.findByRole('heading',{name:'Record details'});fireEvent.click(screen.getByRole('radio',{name:'Full table'}));expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(0);
});
