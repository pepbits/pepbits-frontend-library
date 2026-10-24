import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {createFormatters} from '@pepbits/i18n';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import * as exports from '@pepbits/page-engines/worklist';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {TestHostValue} from './test/host';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {PAGES} from './modules/keystone/catalog';
import {invoiceTotals} from './modules/keystone/invoice';
function fixture(request:JsonRequest):TestHostValue {return {scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:DEFAULT_PREFERENCES,request,navigate:vi.fn()};}
const reports = PAGES.filter(page => page.template === 'report');
for (const variant of ['erp1','erp2'] as const) test.each(reports)('$slug '+variant+' advanced conditions, sorting and full export', async def => {
  const api=mockApi(),request=vi.fn(api.request),download=vi.spyOn(exports,'downloadGrid').mockImplementation(()=> 'fixture.csv'),host=fixture(request as JsonRequest);
  host.preferenceHost={preferences:DEFAULT_PREFERENCES,preferencePolicy:{revision:1,rules:{exportFormat:{value:'csv',locked:true},pageSize:{value:10,locked:true}}},onPreferenceChange:vi.fn()};
  const view=render(<Module variant={variant} path={'/reports/'+def.slug} host={host}/>);
  await waitFor(()=>expect(view.container.querySelector('tbody td')).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Advanced filter'}));const panel=screen.getByRole('region',{name:'Advanced filter'});
  const numeric=def.fields.find(field=>field.type==='currency'||field.type==='number')!;
  fireEvent.change(within(panel).getByRole('spinbutton',{name:numeric.label+' Min'}),{target:{value:'0'}});
  const text=def.fields.find(field=>field.type==='person');if(text)fireEvent.change(within(panel).getByRole('textbox',{name:text.label}),{target:{value:'fictional'}});
  fireEvent.click(within(panel).getByRole('button',{name:'Apply filters'}));
  await waitFor(()=>expect(request.mock.calls.some(([path])=>{const filters=JSON.parse(new URL(path,'http://localhost').searchParams.get('filters')??'{}');return filters[numeric.key]?.min===0&&(!text||filters[text.key]==='fictional');})).toBe(true));
  fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));await waitFor(()=>expect(view.container.querySelector('tbody td')).toBeTruthy());
  const first=def.fields[0]!;fireEvent.click(screen.getByRole('button',{name:first.label}));
  await waitFor(()=>expect(request.mock.calls.some(([path])=>{const url=new URL(path,'http://localhost');return url.searchParams.get('sort')===first.key&&url.searchParams.get('dir')==='asc';})).toBe(true));
  fireEvent.click(screen.getByRole('button',{name:first.label+' ↑'}));await waitFor(()=>expect(view.container.querySelector('[aria-sort=descending]')).toBeTruthy());
  const group=def.fields.find(field=>['ref','person','status','select'].includes(field.type))!;fireEvent.change(screen.getByRole('combobox',{name:'Group by'}),{target:{value:group.key}});
  await waitFor(()=>expect(view.container.querySelector('[data-report-subtotal]')).toBeTruthy());
  await waitFor(()=>expect(screen.getByRole('button',{name:'Export CSV'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Export CSV'}));
  await waitFor(()=>expect(download).toHaveBeenCalled());expect(download.mock.calls[0]![1]).toHaveLength(api.rows.get(def.entity)!.length+1);expect(download.mock.calls[0]![2]).toBe('csv');download.mockRestore();
});
test('advanced choices apply multiple statuses and reference values with cancel/reset and invalid-range guards', async()=>{
 const api=mockApi(),request=vi.fn(api.request);render(<Module variant="erp1" path="/reports/sales-register" host={fixture(request as JsonRequest)}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Advanced filter'}));const panel=screen.getByRole('region',{name:'Advanced filter'});
 fireEvent.click(within(panel).getByRole('checkbox',{name:'Paid'}));fireEvent.click(within(panel).getByRole('checkbox',{name:'Unpaid'}));
 fireEvent.click(await within(panel).findByRole('checkbox',{name:String(api.rows.get('customers')![0]!.name)}));
 fireEvent.change(within(panel).getByLabelText('Total Min'),{target:{value:'20'}});fireEvent.change(within(panel).getByLabelText('Total Max'),{target:{value:'10'}});expect(within(panel).getByRole('button',{name:'Apply filters'})).toBeDisabled();
 fireEvent.change(within(panel).getByLabelText('Total Max'),{target:{value:'30'}});fireEvent.click(within(panel).getByRole('button',{name:'Apply filters'}));
 await waitFor(()=>expect(request.mock.calls.some(([path])=>JSON.parse(new URL(path,'http://localhost').searchParams.get('filters')??'{}').status?.length===2)).toBe(true));
 fireEvent.click(screen.getByRole('button',{name:'Advanced filter'}));fireEvent.click(screen.getByRole('button',{name:'Reset'}));fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.getByText(/Applied filters/)).toHaveTextContent('Status');
});
test('truncated reports hide subtotals and fence exports, including mounted permission denial',async()=>{
 const api=mockApi(),request:JsonRequest=async<T,>(path:string,init?:RequestInit)=>{const result=await api.request<any>(path,init);return (path.startsWith('/api/entities/sales-invoices?')?{...result,total:5001}:result) as T;};
 const host=fixture(request),view=render(<Module variant="erp2" path="/reports/sales-register" host={host}/>);await screen.findByRole('alert');fireEvent.change(screen.getByRole('combobox',{name:'Group by'}),{target:{value:'status'}});expect(view.container.querySelector('[data-report-subtotal]')).toBeNull();expect(screen.getByRole('button',{name:/^Export /})).toBeDisabled();
 view.rerender(<Module variant="erp2" path="/reports/sales-register" host={{...host,can:()=>false}}/>);expect(screen.getByRole('button',{name:/^Export /})).toBeDisabled();
});
for(const variant of ['erp1','erp2'] as const) test.each(reports)('$slug '+variant+' expanded filters pass Arabic RTL axe and mounted table policies',async def=>{
 const host=fixture(mockApi().request);host.preferences={...DEFAULT_PREFERENCES,language:'ar',reducedMotion:true};host.preferenceHost={preferences:host.preferences,preferencePolicy:{revision:1,rules:{density:{value:'compact',locked:true},pageSize:{value:10,locked:true},exportFormat:{value:'csv',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant={variant} path={'/reports/'+def.slug} host={host}/>);await waitFor(()=>expect(view.container.querySelector('tbody td')).toBeTruthy());const button=view.container.querySelector('button[aria-expanded]')!;fireEvent.click(button);await waitFor(()=>expect(view.container.querySelector('[role=region] [aria-busy=true]')).toBeNull());
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
test.each(['erp1','erp2'] as const)('%s long invoice has contiguous pages, carry totals and one final summary',async variant=>{
 const api=mockApi(),row=api.rows.get('sales-invoices')![0]!;row.lines=Array.from({length:75},(_,index)=>({item:'Fictional line '+(index+1),qty:1,rate:10,amount:10,tax:5,kind:index===30?'Deduction':'Item'}));
 const host=fixture(api.request),view=render(<Module variant={variant} path={'/reports/invoice-print'+(variant==='erp2'?'/'+row.id:'')} host={host}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Print or save PDF'})).toBeEnabled());const preview=view.container.querySelector('[data-invoice-pages]')!;
 expect(preview.querySelectorAll('[data-invoice-page]').length).toBeGreaterThan(2);expect(preview.querySelectorAll('[data-print-line]')).toHaveLength(75);expect(preview.querySelectorAll('[data-print-final]')).toHaveLength(1);
 const sheets=[...preview.querySelectorAll('[data-invoice-page]')];sheets.slice(0,-1).forEach((sheet,index)=>{expect(sheet.querySelector('[data-print-carried]')!.textContent!.split('·')[1]).toBe(sheets[index+1]!.querySelector('[data-print-brought]')!.textContent!.split('·')[1]);});
 expect(sheets.at(-1)).toHaveTextContent(createFormatters(host.preferences).money(invoiceTotals(row.lines).total).replace(/\s/g,' '));
 const printButton=screen.getByRole('button',{name:'Print or save PDF'}),pagesBefore=sheets.length;view.rerender(<Module variant={variant} path={'/reports/invoice-print'+(variant==='erp2'?'/'+row.id:'')} host={{...host,preferences:{...host.preferences,language:'ar',fontSizeResult:16}}}/>);await waitFor(()=>expect(printButton).toBeEnabled());expect(document.querySelector('.erp-invoice-print')).toHaveStyle({direction:'rtl'});expect(preview.querySelectorAll('[data-invoice-page]').length).toBe(pagesBefore);
});
test('advanced open dates replace an invalid custom period without blocking the report',async()=>{
 const api=mockApi(),request=vi.fn(api.request);render(<Module variant="erp1" path="/reports/sales-register" host={fixture(request as JsonRequest)}/>);
 fireEvent.change(await screen.findByRole('combobox',{name:'Period'}),{target:{value:'custom'}});fireEvent.change(screen.getByLabelText('From'),{target:{value:''}});expect(screen.getByRole('alert')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Advanced filter'}));const panel=screen.getByRole('region',{name:'Advanced filter'});fireEvent.click(within(panel).getByRole('button',{name:'Reset'}));fireEvent.change(within(panel).getByLabelText('Invoice date To'),{target:{value:'2099-12-31'}});fireEvent.click(within(panel).getByRole('button',{name:'Apply filters'}));
 await waitFor(()=>expect(request.mock.calls.some(([path])=>JSON.parse(new URL(path,'http://localhost').searchParams.get('filters')??'{}').date?.to==='2099-12-31')).toBe(true));expect(screen.getByRole('combobox',{name:'Period'})).toHaveValue('advanced');await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 fireEvent.change(screen.getByRole('combobox',{name:'Period'}),{target:{value:'all'}});await waitFor(()=>expect(screen.getByRole('button',{name:/^Export /})).toBeEnabled());
});
