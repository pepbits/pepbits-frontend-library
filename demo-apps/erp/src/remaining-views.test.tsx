import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {JsonRequest} from '@pepbits/patterns/resources';
import type {TestHostValue} from './test/host';
import {localDay} from './modules/keystone/dates';
import {ledgerStatement,matrixPeriod,moveMatrixPeriod,matrixSummary} from './modules/keystone/analysis-model';
import {invoiceTotals} from './modules/keystone/invoice';
import type {Row} from './modules/keystone/types';
function fixture(request:JsonRequest):TestHostValue {return {scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:DEFAULT_PREFERENCES,request,navigate:vi.fn()};}
test('ledger opening and closing include prior entries and preserve order',() => {
  const result=ledgerStatement([{id:'later',date:'2026-02-03',debit:0,credit:20},{id:'prior',date:'2026-01-01',debit:100,credit:0},{id:'first',date:'2026-02-01',debit:50,credit:0}] as Row[],'2026-02-01','2026-02-28');
  expect(result).toMatchObject({opening:100,debit:50,credit:20,closing:130});expect(result.lines.map(row=>row.balance)).toEqual([150,130]);
});
test('matrix periods cross years, normalize Mondays and preserve source summary semantics',() => {
  expect(matrixPeriod('hours','2026-10-24')).toBe('2026-10-19');expect(moveMatrixPeriod('attendance','2026-12',1)).toBe('2027-01');expect(moveMatrixPeriod('hours','2026-12-28',1)).toBe('2027-01-04');
  expect(matrixSummary('attendance',['P','H','A','L','WO',null])).toMatchObject({total:1.5,percent:38,absent:1,leave:1});expect(matrixSummary('hours',[20,24])).toEqual({total:44,overtime:4});expect(matrixSummary('marks',[95,85])).toEqual({total:180,percent:90,grade:'A+'});
});
test('invoice tax includes deductions and rounds the completed totals',() => {expect(invoiceTotals([{amount:100,tax:5},{amount:20,tax:5,kind:'Deduction'}])).toEqual({subtotal:80,tax:4,total:84});});
test.each(['erp1','erp2'] as const)('%s booking opens a free slot with resource, date and time defaults',async variant => {
  const api=mockApi();api.rows.set('room-bookings',[]);const host=fixture(api.request),view=render(<Module variant={variant} path="/transactions/room-bookings" host={host}/>);
  await waitFor(()=>expect(view.container.querySelector('[data-resource-timeline]')).toBeTruthy());fireEvent.click(view.container.querySelector('[data-timeline-resource] button')!);
  if(variant==='erp1'){expect(await within(await screen.findByRole('dialog')).findByLabelText('Date')).toHaveValue(localDay());expect(screen.getByLabelText('Time')).toHaveValue('08:00');expect(screen.getByLabelText('Minutes')).toHaveValue(30);}
  else await waitFor(()=>expect(host.navigate).toHaveBeenCalledWith(expect.stringContaining('/erp2/transactions/room-bookings/new?resource=')));
});
test('booking date navigation and resource visibility keep a complete schedule and list switch',async () => {
  const api=mockApi(),request=vi.fn(api.request),view=render(<Module variant="erp1" path="/transactions/room-bookings" host={fixture(request as JsonRequest)}/>);
  await waitFor(()=>expect(view.container.querySelector('[data-resource-timeline]')).toBeTruthy());const resource=view.container.querySelector('[data-timeline-resource]')!.getAttribute('data-timeline-resource')!;fireEvent.click(screen.getByRole('button',{name:resource}));expect(view.container.querySelector(`[data-timeline-resource="${resource}"]`)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Next day'}));await waitFor(()=>expect(request.mock.calls.some(([path])=>path.includes('room-bookings?')&&!path.includes(encodeURIComponent(localDay())))).toBe(true));fireEvent.click(screen.getByRole('radio',{name:'List'}));await waitFor(()=>expect(view.container.querySelector('tbody')).toBeTruthy());
});
test('a newly detected booking clash preserves input and never sends a mutation',async () => {
  const api=mockApi(),row=api.rows.get('appointments')![0]!;row.status='Booked';const request=vi.fn(api.request);render(<Module variant="erp2" path={'/transactions/appointments/new?'+new URLSearchParams({person:'Fictional visitor',resource:row.resource,date:row.date,start:row.start,duration:'30',status:'Booked'})} host={fixture(request as JsonRequest)}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Confirm booking'}));await screen.findByText('This resource is already booked at this time');expect(screen.getByLabelText('Patient')).toHaveValue('Fictional visitor');expect(request.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
});
test('booking status failures retain their operation and a mounted denial disables actions',async () => {
  const api=mockApi(),row=api.rows.get('room-bookings')![0]!;row.status='Checked in';let fail=true;const request=vi.fn<JsonRequest>(async<T,>(path:string,init?:RequestInit)=>{if(init?.method==='PUT'&&fail)throw new Error('Offline');return api.request<T>(path,init);}),host=fixture(request as JsonRequest),view=render(<Module variant="erp2" path={'/transactions/room-bookings/'+row.id} host={host}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Complete'}));await screen.findByRole('button',{name:'Retry'});fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT');expect(writes[0]![1]!.body).toBe(writes[1]![1]!.body);
  view.rerender(<Module variant="erp2" path={'/transactions/room-bookings/'+row.id} host={{...host,can:()=>false}}/>);expect(await screen.findByRole('button',{name:'Complete'})).toBeDisabled();
});
test.each(['erp1','erp2'] as const)('%s invoice loads company data and controls the physical document',async variant => {
  const api=mockApi(),row=api.rows.get('sales-invoices')![0]!,print=vi.spyOn(window,'print').mockImplementation(()=>{});const view=render(<Module variant={variant} path={'/reports/invoice-print'+(variant==='erp2'?'/'+row.id:'')} host={fixture(api.request)}/>);
  await waitFor(()=>expect(view.container.querySelector('[data-invoice-pages] .erp-invoice')).toBeTruthy());expect(within(view.container.querySelector('[data-invoice-pages]') as HTMLElement).getByText('Fictional Company',{exact:true})).toBeVisible();fireEvent.click(screen.getByRole('radio',{name:'Duplicate'}));expect(view.container.querySelector('[data-invoice-pages] .erp-invoice')).toHaveTextContent('Duplicate copy');fireEvent.click(screen.getByRole('checkbox',{name:'Show terms'}));expect(view.container.querySelector('.invoice-terms')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Print or save PDF'}));expect(print).toHaveBeenCalledTimes(1);expect(document.querySelector('.ops-print-document .erp-invoice')).toBeTruthy();print.mockRestore();
});
test('invoice printing stays disabled after a failed company-profile read and retries',async () => {
  const api=mockApi();let fail=true;const request:JsonRequest=async<T,>(path:string,init?:RequestInit)=>{if(path==='/api/company-profile'&&fail)throw new Error('Company unavailable');return api.request<T>(path,init);};render(<Module variant="erp2" path={'/reports/invoice-print/'+api.rows.get('sales-invoices')![0]!.id} host={fixture(request as JsonRequest)}/>);
  expect(await screen.findByRole('button',{name:'Print or save PDF'})).toBeDisabled();fireEvent.click(await screen.findByRole('button',{name:'Retry'}));fail=false;fireEvent.click(await screen.findByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Print or save PDF'})).toBeEnabled());
});
test('ledger search leaves balances intact, custom ranges calculate opening, export follows a managed preference',async () => {
  const api=mockApi(),party=api.rows.get('customers')![0]!.name;api.rows.set('ledger-entries',[{id:'prior',party,date:'2026-01-01',debit:100,credit:0,code:'Prior'},{id:'first',party,date:'2026-02-01',debit:50,credit:0,code:'First'},{id:'later',party,date:'2026-02-03',debit:0,credit:20,code:'Later'}] as Row[]);
  const host=fixture(api.request);host.preferenceHost={preferences:DEFAULT_PREFERENCES,preferencePolicy:{revision:1,rules:{exportFormat:{value:'csv',locked:true}}},onPreferenceChange:vi.fn()};const view=render(<Module variant="erp1" path="/reports/customer-ledger" host={host}/>);
  fireEvent.change(await screen.findByRole('combobox',{name:'Period'}),{target:{value:'custom'}});fireEvent.change(screen.getByLabelText('From'),{target:{value:'2026-02-01'}});fireEvent.change(screen.getByLabelText('To'),{target:{value:'2026-02-28'}});await screen.findByText('Later');fireEvent.change(screen.getByRole('textbox',{name:'Search'}),{target:{value:'Later'}});await waitFor(()=>expect(view.container.querySelector('tbody')).not.toHaveTextContent('First'));expect(view.container.querySelector('tbody')).toHaveTextContent('130');expect(await screen.findByRole('button',{name:'Export CSV'})).toBeEnabled();
});
test('report groups by source fields, filters the API and opens the owning ERP2 record',async () => {
  const api=mockApi(),host=fixture(api.request),view=render(<Module variant="erp2" path="/reports/sales-register" host={host}/>);await waitFor(()=>expect(view.container.querySelector('tbody tr td')).toBeTruthy());fireEvent.change(screen.getByRole('combobox',{name:'Group by'}),{target:{value:'status'}});expect(view.container.querySelector('[scope=rowgroup]')).toBeTruthy();fireEvent.click(view.container.querySelector('tbody tr td')!);await waitFor(()=>expect(host.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/erp2\/transactions\/sales-invoices\//)));
});
test('attendance fills only blanks, blocks period changes, and retains failed rows after partial save',async () => {
  const api=mockApi(),date=localDay(),rows=api.rows.get('attendance')!;rows.forEach((row,index)=>{row.columns=[date];row.cells=[index?'A':null];row.version=1;});const request=vi.fn(api.request),view=render(<Module variant="erp1" path="/transactions/attendance" host={fixture(request as JsonRequest)}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Mark all present today'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Mark all present today'}));expect(screen.getByRole('button',{name:'Next period'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1));expect(JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='PUT')![1]!.body)).cells).toEqual(['P']);await waitFor(()=>expect(screen.getByRole('button',{name:'Next period'})).toBeEnabled());expect(view.container.querySelectorAll('select')[1]).toHaveValue('A');
});
test('matrix partial saves retry only the unacknowledged row with identical operation identity',async () => {
  const api=mockApi(),rows=api.rows.get('timesheets')!;let fail=true;const request=vi.fn<JsonRequest>(async<T,>(path:string,init?:RequestInit)=>{if(init?.method==='PUT'&&path.includes('/'+rows[1]!.id+'?')&&fail)throw Object.assign(new Error('Offline'),{status:503});return api.request<T>(path,init);});render(<Module variant="erp1" path="/transactions/timesheets" host={fixture(request as JsonRequest)}/>);
  await waitFor(()=>expect(document.querySelectorAll('[data-erp-matrix] tbody tr input[type=number]').length).toBeGreaterThan(7));const inputs=document.querySelectorAll('[data-erp-matrix] tbody tr input[type=number]');fireEvent.change(inputs[0]!,{target:{value:String(Number(rows[0]!.cells[0])===6?5:6)}});fireEvent.change(inputs[rows[0]!.cells.length]!,{target:{value:String(Number(rows[1]!.cells[0])===7?6:7)}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByRole('button',{name:'Retry'});expect(screen.getByRole('button',{name:'Next period'})).toBeDisabled();fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(3));const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT');expect(writes[1]![1]!.body).toBe(writes[2]![1]!.body);await waitFor(()=>expect(screen.getByRole('button',{name:'Next period'})).toBeEnabled());
});
test.each(['erp1','erp2'] as const)('%s dashboard exposes all source panels and module-owned drill-downs',async variant => {
  const host=fixture(mockApi().request),view=render(<Module variant={variant} path="/workspace/dashboard" host={host}/>);
  for(const name of ['Sales and purchases, last 12 months','Invoice value by status','Recent sales orders','Largest receivables'])await screen.findByRole('heading',{name});expect(view.container.querySelector('[data-donut-chart]')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'All orders'}));expect(host.navigate).toHaveBeenCalledWith('/'+variant+'/transactions/sales-orders');
});
test.each(['appointments','room-bookings'] as const)('%s calendar has no axe violations in Arabic RTL',async slug => {
  const host=fixture(mockApi().request);host.preferences={...DEFAULT_PREFERENCES,language:'ar',reducedMotion:true};const view=render(<Module variant="erp1" path={'/transactions/'+slug} host={host}/>);await waitFor(()=>expect(view.container.querySelector('[data-resource-timeline]')).toBeTruthy());await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
test('ledger customer lookup failure has a retry instead of an endless loading state',async () => {
  const api=mockApi();let fail=true;const request=vi.fn<JsonRequest>(async<T,>(path:string,init?:RequestInit)=>{if(path.startsWith('/api/entities/customers?')&&fail)throw new Error('Lookup unavailable');return api.request<T>(path,init);});
  const view=render(<Module variant="erp1" path="/reports/customer-ledger" host={fixture(request as JsonRequest)}/>);await screen.findByRole('button',{name:'Retry'});expect(view.container.querySelector('[aria-busy="true"]')).toBeNull();fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([path])=>path.startsWith('/api/entities/customers?'))).toHaveLength(2));await waitFor(()=>expect(view.container.querySelector('[data-recovery-kind],[aria-busy="true"]')).toBeNull());
});
