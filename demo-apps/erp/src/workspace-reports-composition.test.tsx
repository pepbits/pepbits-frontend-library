import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES,type UserPreferences} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {TestHostValue} from './test/host';
const host=(request:JsonRequest,preferences:Partial<UserPreferences>={}):TestHostValue=>({scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:{...DEFAULT_PREFERENCES,...preferences},request,navigate:vi.fn()});
const profiles=[['default',{}],['RTL',{language:'ar'}],['motion',{reducedMotion:true}],['locked',{formNavigation:'wizard',density:'spacious'}]] as const;
test.each((['erp1','erp2'] as const).flatMap(variant=>['company-settings','notifications'].flatMap(slug=>profiles.map(([profile,preferences])=>({variant,slug,profile,preferences})))))('$variant $slug: $profile uses source sections and keeps drafts across effective navigation',async({variant,slug,profile,preferences})=>{
 const context=host(mockApi().request,preferences);if(profile==='locked')context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{formNavigation:{value:'tabs',locked:true},density:{value:'compact',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant={variant} path={'/setup/'+slug} host={context}/>);
 await waitFor(()=>expect(view.container.querySelector('[data-erp-settings]')).toBeTruthy());
 const input=view.container.querySelector<HTMLInputElement>('input')!;fireEvent.change(input,{target:{value:input.type==='number'?'17':'Fictional changed value'}});const value=input.value;
 const tabs=screen.getAllByRole('tab');fireEvent.click(tabs[1]!);fireEvent.click(tabs[0]!);expect(input).toHaveValue(input.type==='number'?Number(value):value);
 if(profile==='locked'){expect(view.container.querySelector('[data-layout]')).toHaveAttribute('data-layout','tabs');expect(view.container.querySelector('[data-layout]')).toHaveAttribute('data-density','compact');}
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
test.each(['erp1','erp2'] as const)('%s settings discard, acknowledged save and ambiguous retry preserve the proper baseline',async variant=>{
 const api=mockApi();let fail=true;const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT'&&fail)throw Object.assign(new Error('Offline'),{status:503});return api.request(path,init);});
 render(<Module variant={variant} path="/setup/company-settings" host={host(request as JsonRequest)}/>);
 const input=await screen.findByRole('textbox',{name:'Legal name'}),original=(input as HTMLInputElement).value;
 fireEvent.change(input,{target:{value:'Fictional discarded'}});fireEvent.click(screen.getByRole('button',{name:'Discard'}));expect(input).toHaveValue(original);
 fireEvent.change(input,{target:{value:'Fictional accepted'}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await screen.findByRole('button',{name:'Retry'});expect(input).toHaveValue('Fictional accepted');fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Save changes'})).toBeNull());const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT');expect(writes).toHaveLength(2);expect(writes[0]![1]!.body).toBe(writes[1]![1]!.body);
 fireEvent.change(input,{target:{value:'Fictional discarded again'}});fireEvent.click(screen.getByRole('button',{name:'Discard'}));expect(input).toHaveValue('Fictional accepted');
});
test('settings conflict requires reload and mounted permission changes disable mutations',async()=>{
 const api=mockApi(),request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT')throw Object.assign(new Error('Conflict'),{status:409});return api.request(path,init);}),context=host(request as JsonRequest);
 const view=render(<Module variant="erp1" path="/setup/company-settings" host={context}/>);const input=await screen.findByRole('textbox',{name:'Legal name'});fireEvent.change(input,{target:{value:'Fictional conflict'}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await screen.findByRole('button',{name:'Reload'});expect(screen.queryByRole('button',{name:'Retry'})).toBeNull();expect(screen.getByRole('button',{name:'Save changes'})).toBeDisabled();expect(screen.getByRole('button',{name:'Discard'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Reload'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'Legal name'})).not.toHaveValue('Fictional conflict'));
 view.rerender(<Module variant="erp1" path="/setup/company-settings" host={{...context,can:()=>false}}/>);expect(screen.getByRole('textbox',{name:'Legal name'})).toBeDisabled();
});
test.each((['erp1','erp2'] as const).flatMap(variant=>['sales-register','purchase-register','stock-summary','receivables-aging'].map(slug=>({variant,slug}))))('$variant $slug puts currency-first source totals above the toolbar, preserving export and groups',async({variant,slug})=>{
 const view=render(<Module variant={variant} path={'/reports/'+slug} host={host(mockApi().request)}/>);
 await waitFor(()=>expect(view.container.querySelector('[data-report-statistics]')).toBeTruthy());const stats=view.container.querySelector('[data-report-statistics]')!,toolbar=view.container.querySelector('[data-report-toolbar]')!;
 expect(stats.compareDocumentPosition(toolbar)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(stats).toHaveTextContent('After search and filters');expect(stats).toHaveTextContent('Avg');expect(screen.getByRole('button',{name:/Export/})).toBeEnabled();
 const group=screen.getByRole('combobox',{name:'Group by'}) as HTMLSelectElement;fireEvent.change(group,{target:{value:Array.from(group.options).find(option=>option.value)!.value}});await waitFor(()=>expect(view.container.querySelector('[scope=rowgroup]')).toBeTruthy());expect(view.container.querySelector('tfoot')).toHaveTextContent('Total');
 expect(view.container.querySelector('td[data-column-type=money]')).toBeTruthy();
});
test.each(['erp1','erp2'] as const)('%s dashboard keeps source widgets and accessible chart inspection with managed cards',async variant=>{
 const context=host(mockApi().request);context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{resultView:{value:'cards',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant={variant} path="/workspace/dashboard" host={context}/>);await screen.findByRole('heading',{name:'Recent sales orders'});
 expect(view.container.querySelectorAll('[data-dashboard-kpi]')).toHaveLength(4);expect(view.container.querySelectorAll('[data-dashboard-widget]')).toHaveLength(5);expect(view.container.querySelector('table')).toBeNull();
 const select=screen.getByRole('combobox',{name:'Monthly sales and purchases for the last twelve months'});fireEvent.focus(select);expect(await screen.findByRole('status')).toHaveTextContent('Sales');fireEvent.blur(select);
 const donut=view.container.querySelector('[data-donut-chart]') as HTMLElement;fireEvent.focus(within(donut).getAllByRole('button')[0]!);expect(donut.querySelector('[aria-live]')).not.toHaveTextContent('All invoices');
});
