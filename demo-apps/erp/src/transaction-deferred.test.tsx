import {useState} from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES,type UserPreferences} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {TestHostProvider,type TestHostValue} from './test/host';
import {mockApi} from './test/mock-api';
import {Module} from './test/module';
import {RecordEditor} from './modules/keystone/record';
import {ReadyPage} from './modules/keystone/ReadyPage';
import {PAGES} from './modules/keystone/catalog';
import {requestDays,requestTrail} from './modules/keystone/transaction-request';
import {processDefaults} from './modules/keystone/transaction-process';
import {inspectionVerdict} from './modules/keystone/transaction-inspection';
import {caseAge} from './modules/keystone/transaction-case';
import {pageId,type Variant,type ErpTarget} from './navigation';
function host(request:JsonRequest,variant:Variant='erp1',preferences:Partial<UserPreferences>={}):TestHostValue {return {scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin'],moduleId:variant},request,preferences:{...DEFAULT_PREFERENCES,...preferences},navigate:vi.fn()};}
function Request({slug='leave-requests',id='',context,mode='view'}:{slug?:string;id?:string;context:TestHostValue;mode?:'new'|'edit'|'view'}) {
 const def=PAGES.find(page=>page.slug===slug)!,variant=context.scope.moduleId as Variant;
 const [target,setTarget]=useState<ErpTarget>({pageId:pageId(variant,def),recordId:mode==='new'?undefined:id,mode});
 return <TestHostProvider host={context}><main dir={context.preferences.language==='ar'?'rtl':'ltr'}><ReadyPage def={def}>{ready=><RecordEditor def={ready} target={target} onOpen={setTarget} onClose={vi.fn()} onSaved={row=>setTarget({pageId:target.pageId,recordId:row.id,mode:'view'})}/>}</ReadyPage></main></TestHostProvider>;
}
const profiles:[string,Partial<UserPreferences>][]=[['default',{}],['RTL',{language:'ar'}],['reduced motion',{reducedMotion:true}],['managed',{density:'spacious',previewMode:'left-drawer'}]];
test.each((['erp1','erp2'] as const).flatMap(variant=>['leave-requests','expense-claims'].flatMap(slug=>profiles.map(([profile,preferences])=>({variant,slug,profile,preferences})))))('$variant $slug $profile request composition and axe',async({variant,slug,profile,preferences})=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!,context=host(api.request,variant,preferences);row.status='Pending';
 if(profile==='managed')context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{density:{value:'compact',locked:true},previewMode:{value:'right-drawer',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Request slug={slug} id={row.id} context={context}/>);
 await waitFor(()=>expect(view.container.querySelector('.erp-request-trail')).toBeTruthy());await waitFor(()=>expect(view.container.querySelector('[data-request-record]')).toBeTruthy());
 expect(view.container.querySelectorAll('.erp-request-trail li')).toHaveLength(slug==='leave-requests'?3:4);
 if(profile==='managed')expect(view.container.querySelector('[data-request-record]')).toHaveAttribute('data-density','compact');
 if(variant==='erp1')expect(screen.getByRole('dialog')).toBeVisible();else expect(view.container.querySelector('[data-record-page]')).toHaveStyle({'--record-aside-width':'360px'});
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
test('inclusive leave days are independent of DST and reject reversed or invalid dates',()=>{
 expect(requestDays('2026-03-07','2026-03-09')).toBe(3);expect(requestDays('2026-10-25','2026-10-25')).toBe(1);expect(requestDays('2026-10-26','2026-10-25')).toBe(0);expect(requestDays('2026-02-30','2026-03-01')).toBe(0);expect(requestDays('',undefined)).toBe(0);
 expect(requestTrail(['Submitted','Manager','Finance','Paid'],'Approved')).toEqual(['done','done','done','current']);expect(requestTrail(['Submitted','Manager','HR'],'Withdrawn')).toEqual(['withdrawn','waiting','waiting']);
});
test.each(['erp1','erp2'] as const)('%s creates a Pending self-service request with computed days, required/date validation and no editable identity',async variant=>{
 const api=mockApi(),request=vi.fn(api.request);render(<Request context={host(request as JsonRequest,variant)} mode="new"/>);
 const submit=await screen.findByRole('button',{name:'Submit for approval'});fireEvent.click(submit);expect(request.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
 const type=screen.getByRole('combobox',{name:'Leave type'});fireEvent.change(type,{target:{value:within(type).getAllByRole('option').find(option=>(option as HTMLOptionElement).value)?.getAttribute('value')}});
 fireEvent.change(screen.getByLabelText('From',{exact:true}),{target:{value:'2026-11-03'}});fireEvent.change(screen.getByLabelText('To',{exact:true}),{target:{value:'2026-11-01'}});fireEvent.click(submit);expect(await screen.findByText('The end date is before the start date')).toBeVisible();
 expect(screen.queryByRole('textbox',{name:'Employee'})).toBeNull();expect(screen.queryByRole('spinbutton',{name:'Days'})).toBeNull();
 fireEvent.change(screen.getByLabelText('To',{exact:true}),{target:{value:'2026-11-05'}});expect(screen.getByRole('status')).toHaveTextContent('3 days requested');fireEvent.click(submit);
 await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1));expect(JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body))).toMatchObject({status:'Pending',employee:'You',days:3});
});
test.each(['erp1','erp2'] as const)('%s decision retry preserves note and version; conflict requires reload',async variant=>{
 const api=mockApi(),row=api.rows.get('leave-requests')![0]!;row.status='Pending';row.version=5;let status=503;
 const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT')throw Object.assign(new Error('Save failed'),{status});return api.request(path,init);});
 render(<Request id={row.id} context={host(request as JsonRequest,variant)}/>);const note=await screen.findByRole('textbox',{name:'Note to the requester (optional)'});fireEvent.change(note,{target:{value:'Keep this review'}});fireEvent.click(screen.getByRole('button',{name:'Approve'}));fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT');expect(writes[0]![1]!.body).toBe(writes[1]![1]!.body);expect(JSON.parse(String(writes[0]![1]!.body))).toMatchObject({lastComment:'Keep this review',status:'Approved',expectedVersion:5});
 status=409;fireEvent.click(await screen.findByRole('button',{name:'Retry'}));await screen.findByRole('button',{name:'Reload'});expect(note).toHaveValue('Keep this review');expect(screen.queryByRole('button',{name:'Retry'})).toBeNull();expect(screen.getByRole('button',{name:'Approve'})).toBeDisabled();
});
test('ERP2 resubmission retains employee and recomputes duration; denial fences shortcuts and controls',async()=>{
 const api=mockApi(),row=api.rows.get('leave-requests')![0]!;row.status='Pending';row.version=2;const request=vi.fn(api.request),context=host(request as JsonRequest,'erp2');
 const view=render(<Request id={row.id} context={context} mode="edit"/>);fireEvent.change(await screen.findByLabelText('From',{exact:true}),{target:{value:'2026-12-01'}});fireEvent.change(screen.getByLabelText('To',{exact:true}),{target:{value:'2026-12-02'}});
 view.rerender(<Request id={row.id} context={{...context,can:()=>false}} mode="edit"/>);expect(screen.getByRole('button',{name:'Save and resubmit'})).toBeDisabled();fireEvent.keyDown(window,{altKey:true,key:'s'});expect(request.mock.calls.some(([,init])=>init?.method==='PUT')).toBe(false);
 view.rerender(<Request id={row.id} context={context} mode="edit"/>);fireEvent.click(screen.getByRole('button',{name:'Save and resubmit'}));await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT')).toBe(true));expect(JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='PUT')![1]!.body))).toMatchObject({employee:row.employee,status:'Pending',days:2,expectedVersion:2});
});
test('ERP1 request drawer keeps the searched worklist and refreshes after approval',async()=>{
 const api=mockApi(),row=api.rows.get('leave-requests')![0]!;row.status='Pending';const request=vi.fn(api.request),view=render(<Module variant="erp1" path="/transactions/leave-requests" host={host(request as JsonRequest)}/>);
 await screen.findByText(row.code,{exact:true});const search=screen.getByRole('textbox',{name:'Search'});fireEvent.change(search,{target:{value:row.code}});await waitFor(()=>expect(request.mock.calls.some(([path])=>path.includes('q='+row.code))).toBe(true));
 const code=await screen.findByText(row.code,{exact:true});fireEvent.click(code.closest('tr')!.querySelectorAll('td')[2]!);fireEvent.click(await screen.findByRole('button',{name:'Approve'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(search).toHaveValue(row.code);await waitFor(()=>expect(view.container.querySelector('tbody')).toHaveTextContent('Approved'));
});
test.each((['erp1','erp2'] as const).flatMap(variant=>['attendance','timesheets','marks-entry'].map(slug=>({variant,slug}))))('$variant $slug combines identity, dimensions, summary and totals in one managed matrix',async({variant,slug})=>{
 const api=mockApi(),context=host(api.request,variant,{language:'ar',density:'spacious'});context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{density:{value:'compact',locked:true},stickyTableHeader:{value:false,locked:true},wrapCellText:{value:true,locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant={variant} path={'/transactions/'+slug} host={context}/>);await waitFor(()=>expect(view.container.querySelector('[data-entry-matrix] tbody th[scope=row]')).toBeTruthy());
 const table=view.container.querySelector('[data-entry-matrix] table')!;expect(table).toHaveAttribute('data-density','compact');expect(table).toHaveAttribute('data-sticky','false');expect(table).toHaveAttribute('data-wrap','true');expect(table.querySelectorAll('thead th')).toHaveLength(api.rows.get(slug)![0]!.columns.length+2);expect(table.querySelectorAll('tfoot tr>*')).toHaveLength(table.querySelectorAll('thead th').length);
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
test('run defaults use first options, enabled flags and a pay date five days ahead',()=>{
 const def=PAGES.find(page=>page.slug==='payroll-run')!;expect(processDefaults({...def,params:def.params!.map(field=>field.key==='period'?{...field,options:['October','November']}:field)},'2026-12-29')).toMatchObject({period:'October',payDate:'2027-01-03',arrears:true});expect(caseAge('2026-10-24','2026-10-25')).toBe(1);
});
test.each((['erp1','erp2'] as const).flatMap(variant=>['payroll-run','depreciation-run'].map(slug=>({variant,slug}))))('$variant $slug runs server parameters, shows returned steps and fences duplicate starts',async({variant,slug})=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!,request=vi.fn<JsonRequest>(async(path,init)=>path.startsWith('/api/processes/')?{row,events:[{time:'09:00',text:'Server step accepted',step:0,progress:100,tone:'ok'}]} as never:api.request(path,init));
 const view=render(<Request slug={slug} context={host(request as JsonRequest,variant,{reducedMotion:true})} mode="new"/>);const start=await screen.findByRole('button',{name:'Start run'});fireEvent.click(start);fireEvent.click(start);
 await waitFor(()=>expect(request.mock.calls.filter(([path])=>path.startsWith('/api/processes/'))).toHaveLength(1));await screen.findByRole('button',{name:'Start new run'});expect(view.container.querySelector('[data-process-record]')).toBeTruthy();
 const body=JSON.parse(String(request.mock.calls.find(([path])=>path.startsWith('/api/processes/'))![1]!.body));expect(Object.keys(body).sort()).toEqual(PAGES.find(page=>page.slug===slug)!.params!.map(field=>field.key).sort());
});
test.each(['erp1','erp2'] as const)('%s inspection gates acceptance/rejection, retains a failed save and locks a terminal verdict',async variant=>{
 const api=mockApi(),row=api.rows.get('quality-inspections')![0]!;row.status='Pending';row.version=3;row.checks=[{parameter:'Visual',spec:'No defects',result:'',observed:'',remarks:''}];let fail=true;
 const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT'&&fail)throw Object.assign(new Error('Offline'),{status:503});return api.request(path,init);});
 render(<Request slug="quality-inspections" id={row.id} context={host(request as JsonRequest,variant)}/>);expect(await screen.findByRole('button',{name:'Accept'})).toBeDisabled();expect(screen.getByRole('button',{name:'Reject'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Pass'}));expect(screen.getByRole('textbox',{name:'Observed 1'})).toHaveValue('Within spec');expect(screen.getByRole('button',{name:'Accept'})).toBeEnabled();fireEvent.click(screen.getByRole('button',{name:'Fail'}));expect(screen.getByRole('button',{name:'Accept'})).toBeDisabled();expect(screen.getByRole('button',{name:'Reject'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Hold'}));await screen.findByRole('button',{name:'Retry'});fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT');expect(writes[0]![1]!.body).toBe(writes[1]![1]!.body);expect(JSON.parse(String(writes[0]![1]!.body))).toMatchObject({status:'On hold',expectedVersion:3});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Reject'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Reject'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'Reject'})).toBeNull());expect(screen.getByRole('textbox',{name:'Observed 1'})).toBeDisabled();
});
test('inspection requires at least one parameter and recognizes only source verdict values',()=>{expect(inspectionVerdict([]).complete).toBe(false);expect(inspectionVerdict([{parameter:'x',spec:'',observed:'',remarks:'',result:'unknown'}]).complete).toBe(false);});
test.each((['erp1','erp2'] as const).flatMap(variant=>['quality-inspections','payroll-run','depreciation-run'].flatMap(slug=>profiles.map(([profile,preferences])=>({variant,slug,profile,preferences})))))('$variant $slug $profile opened composition and axe',async({variant,slug,profile,preferences})=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!,context=host(api.request,variant,preferences);if(slug==='quality-inspections')row.status='Pending';
 if(profile==='managed')context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{density:{value:'compact',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Request slug={slug} id={row.id} context={context}/>);await waitFor(()=>expect(view.container.querySelector('[data-process-record],[data-inspection-record]')).toBeTruthy());await waitFor(()=>expect(view.container.querySelector('[aria-busy=true]')).toBeNull());
 if(profile==='managed')expect(view.container.querySelector('[data-process-record],[data-inspection-record]')).toHaveAttribute('data-density','compact');
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
