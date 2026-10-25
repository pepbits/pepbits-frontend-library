import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES, type UserPreferences} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {TestHostValue} from './test/host';
import {PAGES} from './modules/keystone/catalog';

function host(request:JsonRequest, preferences:Partial<UserPreferences>={}):TestHostValue {
 return {scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:{...DEFAULT_PREFERENCES,...preferences},request,navigate:vi.fn()};
}
const profiles:[string,Partial<UserPreferences>][]=[['default',{}],['RTL',{language:'ar'}],['reduced motion',{reducedMotion:true}],['managed',{previewMode:'center-modal',density:'spacious',formNavigation:'wizard'}]];
test.each(profiles.flatMap(([profile,preferences])=>['appointments','room-bookings'].map(slug=>({profile,preferences,slug}))))('$slug drawer: $profile retains calendar, slot input and effective presentation',async({profile,preferences,slug})=>{
 const api=mockApi();api.rows.set(slug,[]);const context=host(api.request,preferences);
 if(profile==='managed')context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{previewMode:{value:'left-drawer',locked:true},density:{value:'compact',locked:true},formNavigation:{value:'tabs',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant="erp1" path={'/transactions/'+slug} host={context}/>);
 const timeline=await waitFor(()=>{const el=view.container.querySelector('[data-resource-timeline]');expect(el).toBeTruthy();return el!;});
 const slot=timeline.querySelector<HTMLButtonElement>('[data-timeline-resource] button')!;slot.focus();fireEvent.click(slot);
 const dialog=await screen.findByRole('dialog');await waitFor(()=>expect(dialog.querySelector('input[type=time]')).toHaveValue('08:00'));
 expect(timeline).toBeInTheDocument();expect(dialog.querySelector('[data-record-page]')).toHaveAttribute('data-record-appearance','plain');
 if(profile==='managed'){expect(dialog.querySelector('aside')).toHaveClass('left-0');expect(dialog.querySelector('[data-layout]')).toHaveAttribute('data-layout','tabs');expect(dialog.querySelector('[data-layout]')).toHaveAttribute('data-density','compact');}
 await act(async()=>{expect((await axe.run(dialog,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
 fireEvent.keyDown(window,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(slot);
});

test.each(['erp1','erp2'] as const)('%s report columns and named snapshots restore filters/order without changing locked page size',async variant=>{
 const api=mockApi(),request=vi.fn(api.request),context=host(request as JsonRequest,{rememberFilters:true,columnLayoutScope:'account',pageSize:20});
 context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{pageSize:{value:10,locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant={variant} path="/reports/sales-register" host={context}/>);
 await screen.findByRole('button',{name:'Columns'});await waitFor(()=>expect(view.container.querySelector('tbody tr')).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'Columns'}));const dialog=await screen.findByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Salesperson'}));
 fireEvent.click(within(dialog).getByRole('button',{name:'Done'}));
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT'&&JSON.parse(String(init.body)).key==='keystone.cols.sales-register'&&JSON.parse(String(init.body)).value.includes('salesperson'))).toBe(true));
 expect(screen.queryByRole('columnheader',{name:'Salesperson'})).toBeNull();
 fireEvent.change(screen.getByRole('textbox',{name:'Search'}),{target:{value:'Fictional search'}});
 fireEvent.click(screen.getByRole('button',{name:'Saved views'}));fireEvent.change(await screen.findByRole('textbox',{name:'View name'}),{target:{value:'Fictional layout'}});
 fireEvent.click(screen.getByRole('button',{name:'Save current view'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Apply Fictional layout'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Apply Fictional layout'}));fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));expect(screen.getByRole('textbox',{name:'Search'})).toHaveValue('');
 fireEvent.click(screen.getByRole('button',{name:'Saved views'}));fireEvent.click(await screen.findByRole('button',{name:'Apply Fictional layout'}));
 expect(screen.getByRole('textbox',{name:'Search'})).toHaveValue('Fictional search');expect(context.preferenceHost.onPreferenceChange).not.toHaveBeenCalled();
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT'&&JSON.parse(String(init.body)).key==='keystone.views.sales-register')).toBe(true));
});

test('report account column failures have retry and use source hidden keys',async()=>{
 const api=mockApi();let fail=true;const request=vi.fn<JsonRequest>(async(path,init)=>{if(path.includes('keystone.cols.stock-summary')&&fail)throw new Error('Layout unavailable');return api.request(path,init);});
 render(<Module variant="erp2" path="/reports/stock-summary" host={host(request as JsonRequest,{columnLayoutScope:'account'})}/>);
 await screen.findByRole('button',{name:'Retry'});fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(request.mock.calls.filter(([path])=>path.includes('keystone.cols.stock-summary'))).toHaveLength(2));await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
});

test.each(['support-tickets','maintenance-requests'])('%s source identity and stage summary match the opened record',async slug=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!,def=PAGES.find(page=>page.slug===slug)!;
 const view=render(<Module variant="erp2" path={'/transactions/'+slug+'/'+row.id} host={host(api.request)}/>);
 expect(await screen.findByText(row.subject)).toBeVisible();const current=await waitFor(()=>{const el=view.container.querySelector('[data-case-summary] [aria-current=step]');expect(el).toBeTruthy();return el!;});expect(current).toHaveTextContent(row.status);
 expect(view.container.querySelectorAll('[data-case-summary] li')).toHaveLength(def.statusFlow!.length);
});

test.each(['appointments','room-bookings'])('%s direct create supplies source date/resource/time defaults',async slug=>{
 const api=mockApi(),view=render(<Module variant="erp2" path={'/transactions/'+slug+'/new'} host={host(api.request)}/>);
 await screen.findByRole('button',{name:'Confirm booking'});expect(view.container.querySelector('input[type=time]')).toHaveValue('09:00');expect(view.container.querySelector('input[type=date]')).not.toHaveValue('');expect(screen.getByRole('spinbutton',{name:'Minutes'})).toHaveValue(30);
});

test.each(['support-tickets','maintenance-requests'])('%s ERP1 drawer retains board filters and adopts acknowledged property saves',async slug=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!,request=vi.fn(api.request),view=render(<Module variant="erp1" path={'/transactions/'+slug} host={host(request as JsonRequest)}/>);
 await waitFor(()=>expect(view.container.querySelector('[data-workflow-board]')).toBeTruthy());fireEvent.change(screen.getByRole('textbox',{name:'Search'}),{target:{value:row.subject}});
 fireEvent.click(within(view.container.querySelector('[data-workflow-board]') as HTMLElement).getByRole('button',{name:row.subject}));const dialog=await screen.findByRole('dialog');
 const stage=within(dialog).getByRole('combobox',{name:'Stage'});const next=PAGES.find(page=>page.slug===slug)!.statusFlow!.find(value=>value!==row.status)!;fireEvent.change(stage,{target:{value:next}});
 await waitFor(()=>expect(view.container.querySelector(`[data-board-column="${next}"] [data-board-item="${row.id}"]`)).toBeTruthy());
 fireEvent.keyDown(window,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(screen.getByRole('textbox',{name:'Search'})).toHaveValue(row.subject);
});

test.each(['support-tickets','maintenance-requests'])('%s ERP1 list refreshes acknowledged drawer writes without losing its search',async slug=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!,view=render(<Module variant="erp1" path={'/transactions/'+slug} host={host(api.request)}/>);
 fireEvent.click(await screen.findByRole('radio',{name:'List'}));
 const search=await screen.findByRole('textbox',{name:'Search'});fireEvent.change(search,{target:{value:row.subject}});
 const cell=await screen.findByText(row.subject,{exact:true});fireEvent.click(cell);
 const dialog=await screen.findByRole('dialog'),next=PAGES.find(page=>page.slug===slug)!.statusFlow!.find(value=>value!==row.status)!;
 fireEvent.change(within(dialog).getByRole('combobox',{name:'Stage'}),{target:{value:next}});
 await waitFor(()=>expect(within(dialog).getByRole('combobox',{name:'Stage'})).toBeEnabled());
 fireEvent.keyDown(window,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(search).toHaveValue(row.subject);expect(screen.getByRole('radio',{name:'List'})).toHaveAttribute('aria-checked','true');
 await waitFor(()=>expect(view.container.querySelector('tbody')).toHaveTextContent(next));
});
