import {useState} from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES,type UserPreferences} from '@pepbits/preferences';
import {PresentationProvider} from '@pepbits/components';
import {usePreferences} from '@pepbits/preferences/react';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {TestHostProvider,type TestHostValue} from './test/host';
import {mockApi} from './test/mock-api';
import {Module} from './test/module';
import {RecordEditor} from './modules/keystone/record';
import {ReadyPage} from './modules/keystone/ReadyPage';
import {EntityAccess} from './modules/keystone/access';
import {PAGES} from './modules/keystone/catalog';
import {pageId,type Variant,type ErpTarget} from './navigation';
import {blankDocumentLine,computeDocumentLines,documentFlow,documentSeed,documentTotals} from './modules/keystone/transaction-document-model';
const slugs=['sales-orders','sales-invoices','purchase-orders','goods-receipts','journal-vouchers','payment-vouchers','petty-cash'];
function host(request:JsonRequest,variant:Variant='erp1',preferences:Partial<UserPreferences>={}):TestHostValue {return {scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin'],moduleId:variant},request,preferences:{...DEFAULT_PREFERENCES,...preferences},navigate:vi.fn()};}
function Presented({children}:{children:React.ReactNode}){const {preferences}=usePreferences();return <PresentationProvider value={preferences}>{children}</PresentationProvider>;}
function Record({slug='sales-orders',id,context,mode='view'}:{slug?:string;id:string;context:TestHostValue;mode?:'new'|'edit'|'view'}) {
 const def=PAGES.find(page=>page.slug===slug)!,variant=context.scope.moduleId as Variant;
 const [target,setTarget]=useState<ErpTarget>({pageId:pageId(variant,def),recordId:mode==='new'?undefined:id,mode});
 return <TestHostProvider host={context}><Presented><main dir={context.preferences.language==='ar'?'rtl':'ltr'}><ReadyPage def={def}>{ready=><EntityAccess entity={def.entity}><RecordEditor def={ready} target={target} onOpen={setTarget} onClose={vi.fn()} onSaved={row=>setTarget({pageId:target.pageId,recordId:row.id,mode:'view'})}/></EntityAccess>}</ReadyPage></main></Presented></TestHostProvider>;
}
const profiles:[string,Partial<UserPreferences>][]=[['default',{}],['RTL',{language:'ar'}],['reduced motion',{reducedMotion:true}],['managed',{density:'spacious',wrapCellText:false,formNavigation:'wizard'}]];
test.each((['erp1','erp2'] as const).flatMap(variant=>slugs.flatMap(slug=>profiles.map(([profile,preferences])=>({variant,slug,profile,preferences})))))('$variant $slug $profile document composition and axe',async({variant,slug,profile,preferences})=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!;row.status='Draft';const context=host(api.request,variant,preferences);
 if(profile==='managed')context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{density:{value:'compact',locked:true},wrapCellText:{value:true,locked:true},stickyTableHeader:{value:false,locked:true},formNavigation:{value:'tabs',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Record slug={slug} id={row.id} context={context}/>);
 const table=await screen.findByRole('table');expect(view.container.querySelector('[data-record-page]')).toHaveStyle({'--record-aside-width':variant==='erp1'?'300px':'320px'});
 const steps=[...view.container.querySelectorAll('[data-document-status] li')];expect(steps[0]).toHaveAttribute('aria-current','step');expect(view.container.querySelector('.erp-document-totals')).toBeVisible();expect(table).toHaveAccessibleName();
 expect(table.querySelector('tfoot')).toBeTruthy();
 if(profile==='managed'){expect(table).toHaveAttribute('data-density','compact');expect(table).toHaveAttribute('data-wrap','true');expect(table).toHaveAttribute('data-sticky','false');expect(view.container.querySelector('[data-layout]')).toHaveAttribute('data-layout','tabs');}
 await waitFor(()=>expect(view.container.querySelector('[aria-busy="true"]')).toBeNull());
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
test('line computations round tax, preserve zero and clear the opposite voucher side',()=>{
 const def=PAGES.find(page=>page.slug==='sales-orders')!,voucher=PAGES.find(page=>page.slug==='journal-vouchers')!;
 const lines=computeDocumentLines(def,[],[{qty:3,rate:10.25,tax:5}]);expect(lines[0]!.amount).toBe(30.75);expect(documentTotals(def,lines)).toMatchObject({subtotal:30.75,tax:1.54,total:32.29});
 expect(computeDocumentLines(voucher,[{debit:5,credit:0}],[{debit:5,credit:7}])).toEqual([{debit:0,credit:7}]);
 expect(documentTotals(voucher,[{debit:.1},{debit:.2},{credit:.3}])).toMatchObject({difference:0,balanced:true});expect(documentTotals(voucher,[]).balanced).toBe(false);
 expect(blankDocumentLine(def.lines!.fields)).toMatchObject({qty:1,rate:0,amount:0});
});
test('copy resets date, status and identity while preserving lines; terminal source states lock edits',()=>{
 const def=PAGES.find(page=>page.slug==='sales-orders')!;
 expect(documentSeed(def,'erp2','2026-10-25',{id:'old',code:'OLD',version:8,status:'Delivered',date:'2026-01-01',lines:[{amount:7}]})).toMatchObject({id:'',code:undefined,version:undefined,status:'Draft',date:'2026-10-25',lines:[{amount:7}]});
 expect(documentFlow(def,{status:'Delivered'})).toMatchObject({done:true,next:undefined});expect(documentFlow(def,{status:'Cancelled'})).toMatchObject({done:true,terminal:true});
});
test.each(['erp1','erp2'] as const)('%s edits a line, retains an offline draft and retries the identical versioned command',async variant=>{
 const api=mockApi(),row=api.rows.get('sales-orders')![0]!;row.status='Draft';row.version=4;let fail=true;
 const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT'&&fail)throw Object.assign(new Error('Offline'),{status:503});return api.request(path,init);});
 render(<Record id={row.id} context={host(request as JsonRequest,variant)} mode="edit"/>);
 fireEvent.change(await screen.findByRole('spinbutton',{name:'Qty 1'}),{target:{value:'3'}});fireEvent.change(screen.getByRole('spinbutton',{name:'Rate 1'}),{target:{value:'12.5'}});fireEvent.change(screen.getByRole('spinbutton',{name:'Tax % 1'}),{target:{value:'5'}});
 fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByRole('button',{name:'Retry'});expect(screen.getByRole('spinbutton',{name:'Qty 1'})).toHaveValue(3);
 fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));
 const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT').map(([,init])=>JSON.parse(String(init!.body)));expect(writes[0]).toEqual(writes[1]);expect(writes[0]).toMatchObject({expectedVersion:4,lines:expect.arrayContaining([expect.objectContaining({qty:3,rate:12.5,amount:37.5,tax:5})])});
});
test('voucher posting requires nonzero balance and accepted posting locks the editor',async()=>{
 const api=mockApi(),row=api.rows.get('journal-vouchers')![0]!;row.status='Draft';row.lines=[{account:'Cash',debit:5,credit:0,note:''},{account:'Bank',debit:0,credit:4,note:''}];const request=vi.fn(api.request);
 render(<Record slug="journal-vouchers" id={row.id} context={host(request as JsonRequest)}/>);
 expect(await screen.findByRole('button',{name:'Post'})).toBeDisabled();fireEvent.change(screen.getByRole('spinbutton',{name:'Credit 2'}),{target:{value:'5'}});expect(screen.getByRole('button',{name:'Post'})).toBeEnabled();fireEvent.click(screen.getByRole('button',{name:'Post'}));
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT'&&JSON.parse(String(init.body)).status==='Posted')).toBe(true));await waitFor(()=>expect(screen.queryByRole('button',{name:'Save'})).toBeNull());expect(screen.queryByRole('spinbutton')).toBeNull();
});
test('conflicts require reload; mounted host denial prevents retry and shortcuts',async()=>{
 const api=mockApi(),row=api.rows.get('sales-orders')![0]!;row.status='Draft';const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT')throw Object.assign(new Error('Version conflict'),{status:409});return api.request(path,init);});const context=host(request as JsonRequest);
 const view=render(<Record id={row.id} context={context}/>);fireEvent.change(await screen.findByRole('spinbutton',{name:'Qty 1'}),{target:{value:'8'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByRole('button',{name:'Reload'});expect(screen.queryByRole('button',{name:'Retry'})).toBeNull();expect(screen.getByRole('spinbutton',{name:'Qty 1'})).toHaveValue(8);
 view.rerender(<Record id={row.id} context={{...context,can:()=>false}}/>);fireEvent.keyDown(window,{key:'s',altKey:true});await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1));expect(screen.queryByRole('button',{name:'Submit'})).toBeNull();
});
test('new ERP1 documents reject empty lines before sending a command',async()=>{
 const api=mockApi(),request=vi.fn(api.request);render(<Record slug="goods-receipts" id="" mode="new" context={host(request as JsonRequest)}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Save draft'}));expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one line');expect(request.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
});
test.each(slugs)('ERP1 %s retains filtered worklist and refreshes an acknowledged document save',async slug=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!;row.status='Draft';const request=vi.fn(api.request);
 const view=render(<Module variant="erp1" path={'/transactions/'+slug} host={host(request as JsonRequest)}/>);
 await screen.findByText(row.code,{exact:true});await waitFor(()=>expect(view.container.querySelector('[aria-busy="true"]')).toBeNull());
 const search=screen.getByRole('textbox',{name:'Search'});fireEvent.change(search,{target:{value:row.code}});
 await waitFor(()=>expect(request.mock.calls.some(([path])=>path.startsWith('/api/entities/'+slug+'?')&&new URLSearchParams(path.split('?')[1]).get('q')===row.code)).toBe(true));
 const code=await screen.findByText(row.code,{exact:true});fireEvent.click(code.closest('tr')!.querySelectorAll('td')[2]!);
 await screen.findByRole('button',{name:'Save'});expect(search).not.toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT')).toBe(true));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Back'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Back'}));
 await waitFor(()=>expect(view.container.querySelector('[data-transaction-document]')).toBeNull());expect(search).toBeVisible();expect(search).toHaveValue(row.code);expect(await screen.findByText(row.code,{exact:true})).toBeVisible();
 await waitFor(()=>expect(request.mock.calls.filter(([path])=>path.startsWith('/api/entities/'+slug+'?')).length).toBeGreaterThan(1));
});
test.each(['erp1','erp2'] as const)('%s invoice shortcut respects the source route contract',async variant=>{
 const api=mockApi(),row=api.rows.get('sales-invoices')![0]!,context=host(api.request,variant);
 render(<Record slug="sales-invoices" id={row.id} context={context}/>);fireEvent.click(await screen.findByRole('button',{name:'Print preview'}));
 expect(context.navigate).toHaveBeenCalledWith('/'+variant+'/reports/invoice-print'+(variant==='erp2'?'/'+row.id:''));
});
test.each((['erp1','erp2'] as const).flatMap(variant=>slugs.map(slug=>({variant,slug}))))('$variant $slug cancels through the source terminal state even if filter choices omit it',async({variant,slug})=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!;row.status='Draft';row.version=3;
 if(PAGES.find(page=>page.slug===slug)!.template==='voucher')row.lines=[{account:'Cash',debit:5,credit:0},{account:'Bank',debit:0,credit:5}];
 const request=vi.fn(api.request);render(<Record slug={slug} id={row.id} context={host(request as JsonRequest,variant)}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Cancel'}));
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT'&&JSON.parse(String(init.body)).status==='Cancelled'&&JSON.parse(String(init.body)).expectedVersion===3)).toBe(true));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Cancel'})).toBeNull());expect(screen.queryByRole('button',{name:'Edit'})).toBeNull();expect(screen.queryByRole('spinbutton')).toBeNull();
});
test.each(['erp1','erp2'] as const)('%s retains its source balance rule for cancellation',async variant=>{
 const api=mockApi(),row=api.rows.get('journal-vouchers')![0]!;row.status='Draft';row.lines=[{account:'Cash',debit:5,credit:0}];const request=vi.fn(api.request);
 render(<Record slug="journal-vouchers" id={row.id} context={host(request as JsonRequest,variant)}/>);fireEvent.click(await screen.findByRole('button',{name:'Cancel'}));
 if(variant==='erp1'){expect(await screen.findByRole('alert')).toHaveTextContent('Debits and credits must match');expect(request.mock.calls.some(([,init])=>init?.method==='PUT')).toBe(false);}
 else await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT'&&JSON.parse(String(init.body)).status==='Cancelled')).toBe(true));
});
