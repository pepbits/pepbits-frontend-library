import {useState} from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES,type UserPreferences} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {TestHostValue} from './test/host';
import {blankStructureLine,computeStructureLine,structureTotals} from './modules/keystone/masters/structure-lines';
import {PAGES} from './modules/keystone/catalog';
const host=(request:JsonRequest,preferences:Partial<UserPreferences>={}):TestHostValue=>({scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:{...DEFAULT_PREFERENCES,...preferences},request,navigate:vi.fn()});
const structures=['bill-of-materials','salary-structures','fee-structures'],profiles=['customers','suppliers','items','employees','patients','doctors','students','vehicles'];
test('structure lines round amounts, subtract deductions and retain source choice/quantity defaults',()=>{
 expect(computeStructureLine({qty:3,rate:1.115})).toEqual({qty:3,rate:1.115,amount:3.35});
 expect(structureTotals([{amount:100,tax:10},{amount:20,tax:10,kind:'Deduction'}])).toEqual({earnings:100,deductions:20,tax:8,subtotal:80,total:88});
 expect(structureTotals([{amount:0.014,tax:30}]).total).toBe(0.02);
 expect(blankStructureLine([{key:'kind',label:'Kind',type:'select',options:['Earning','Deduction']},{key:'qty',label:'Qty',type:'number'},{key:'rate',label:'Rate',type:'currency'}])).toEqual({kind:'Earning',qty:1,rate:0,amount:0});
});
test.each(['erp1','erp2'] as const)('%s structure writes computed totals and retains failed input/retry identity',async variant=>{
 const api=mockApi(),row=api.rows.get('salary-structures')![0]!;row.version=4;row.lines=[{item:'Base',kind:'Earning',qty:1,rate:100,amount:100},{item:'Tax',kind:'Deduction',qty:1,rate:20,amount:20}];let fail=true;
 const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT'&&path.includes('/entities/')&&fail)throw Object.assign(new Error('Offline'),{status:503});return api.request(path,init);});
 render(<Module variant={variant} path={'/masters/salary-structures'+(variant==='erp2'?'/'+row.id+'/edit':'')} host={host(request as JsonRequest)}/>);
 const amount=await screen.findByRole('spinbutton',{name:'Monthly 1'});fireEvent.change(amount,{target:{value:'125'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByRole('button',{name:'Retry'});expect(amount).toHaveValue(125);fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const payload=request.mock.calls.filter(([,init])=>init?.method==='PUT').map(([,init])=>JSON.parse(String(init!.body)));expect(payload[0]).toEqual(payload[1]);expect(payload[1]).toMatchObject({total:105,expectedVersion:4});
});
test.each((['erp1','erp2'] as const).flatMap(variant=>[...structures,...profiles].map(slug=>({variant,slug}))))('$variant $slug composition and axe',async({variant,slug})=>{
 const api=mockApi(),row=api.rows.get(slug)![0]!,view=render(<Module variant={variant} path={'/masters/'+slug+(variant==='erp2'?'/'+row.id:'')} host={host(api.request)}/>);
 await waitFor(()=>expect(view.container.querySelector('[data-structure-record],[data-profile-summary]')).toBeTruthy());await waitFor(()=>expect(view.container.querySelector('[aria-busy=true]')).toBeNull());
 if(structures.includes(slug)){expect(view.container.querySelector('[data-structure-lines]')).toBeTruthy();expect(view.container.querySelector('tfoot')).toBeTruthy();if(variant==='erp1')expect(view.container.querySelector('[data-master-split]')).toHaveAttribute('data-split','true');else expect(view.container.querySelector('[data-structure-aside]')).toBeTruthy();}
 else if(variant==='erp1'){fireEvent.click(screen.getByRole('tab',{name:'Activity'}));expect(await screen.findByText('No activity recorded for this record yet.')).toBeVisible();fireEvent.click(screen.getByRole('tab',{name:/^Documents/}));expect(await screen.findByText('No documents are stored for this record.')).toBeVisible();fireEvent.click(screen.getByRole('tab',{name:'Details'}));}
 else expect(view.container.querySelector('[data-layout] nav')).toBeTruthy();
 await act(async()=>expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]));
});
test('ERP1 profile full table and narrow drawer retain worklist and effective preview placement',async()=>{
 const api=mockApi(),context=host(api.request,{previewMode:'center-modal'});context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{previewMode:{value:'left-drawer',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant="erp1" path="/masters/customers" host={context}/>);await screen.findByRole('heading',{name:'Record details'});fireEvent.click(screen.getByRole('radio',{name:'Full table'}));const dialog=await screen.findByRole('dialog');expect(dialog.querySelector('aside')).toHaveClass('left-0');expect(view.container.querySelector('tbody')).toBeTruthy();fireEvent.keyDown(window,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
test.each(['ar','hi','ml'] as const)('%s profile fields and structure controls keep managed presentation',async language=>{
 const api=mockApi(),row=api.rows.get('bill-of-materials')![0]!,context=host(api.request,{language,density:'spacious',keyboardShortcuts:false});context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{density:{value:'compact',locked:true},zebraStripes:{value:true,locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant="erp2" path={'/masters/bill-of-materials/'+row.id+'/edit'} host={context}/>);await waitFor(()=>expect(view.container.querySelector('[data-structure-lines] table')).toHaveAttribute('data-density','compact'));expect(view.container.querySelector('[data-structure-lines] table')).toHaveAttribute('data-striped','true');await act(async()=>expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]));
});
test('mounted denial fences structure edits and shortcuts',async()=>{
 const api=mockApi(),request=vi.fn(api.request),row=api.rows.get('bill-of-materials')![0]!,context=host(request as JsonRequest),view=render(<Module variant="erp2" path={'/masters/bill-of-materials/'+row.id+'/edit'} host={context}/>);await screen.findByRole('button',{name:'Add line'});view.rerender(<Module variant="erp2" path={'/masters/bill-of-materials/'+row.id+'/edit'} host={{...context,can:()=>false}}/>);expect(screen.queryByRole('button',{name:'Save'})).toBeNull();fireEvent.keyDown(window,{key:'s',ctrlKey:true});expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(0);
});
test('profile status uses acknowledged version and duplicate supplies source identity',async()=>{
 const api=mockApi(),row=api.rows.get('customers')![0]!;row.version=7;const request=vi.fn(api.request),context=host(request as JsonRequest);render(<Module variant="erp2" path={'/masters/customers/'+row.id} host={context}/>);fireEvent.click(await screen.findByRole('button',{name:'More actions'}));const next=PAGES.find(def=>def.slug==='customers')!.fields.find(field=>field.type==='status')!.options!.find(value=>value!==row.status)!;fireEvent.click(screen.getByRole('button',{name:'Mark as '+next}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1));expect(JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='PUT')![1]!.body))).toMatchObject({status:next,expectedVersion:7});
 fireEvent.click(await screen.findByRole('button',{name:'More actions'}));fireEvent.click(screen.getByRole('button',{name:'Duplicate'}));await waitFor(()=>expect(context.navigate).toHaveBeenCalledWith('/erp2/masters/customers/new?copy='+row.id));
});
test('ERP2 empty structure rejects save until a line is added',async()=>{
 const api=mockApi(),row=api.rows.get('bill-of-materials')![0]!;row.lines=[];const request=vi.fn(api.request);render(<Module variant="erp2" path={'/masters/bill-of-materials/'+row.id+'/edit'} host={host(request as JsonRequest)}/>);fireEvent.click(await screen.findByRole('button',{name:'Save'}));expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one line first');expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'Add line'}));fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1));
});
test('ERP2 profile creation saves then requests a fresh form without a copied identifier',async()=>{
 const api=mockApi(),request=vi.fn(api.request),context=host(request as JsonRequest);render(<Module variant="erp2" path="/masters/customers/new" host={context}/>);fireEvent.change(await screen.findByRole('textbox',{name:'Customer'}),{target:{value:'Fictional fresh customer'}});fireEvent.click(screen.getByRole('button',{name:'Save and add another'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1));await waitFor(()=>expect(context.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/erp2\/masters\/customers\/new\?fresh=/)));
});
test('ERP2 duplicate clears code and version and applies the source copy suffix',async()=>{
 const api=mockApi(),row=api.rows.get('customers')![0]!;render(<Module variant="erp2" path={'/masters/customers/new?copy='+row.id} host={host(api.request)}/>);expect(await screen.findByRole('textbox',{name:'Customer'})).toHaveValue(row.name+' (copy)');expect(screen.getByRole('button',{name:'Create'})).toBeEnabled();
});
test('profile delete is confirmed, preserves retry and honors mounted denial',async()=>{
 const api=mockApi(),row=api.rows.get('customers')![0]!;let fail=true;const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='DELETE'&&fail)throw new Error('Offline');return api.request(path,init);});const context=host(request as JsonRequest),view=render(<Module variant="erp2" path={'/masters/customers/'+row.id} host={context}/>);fireEvent.click(await screen.findByRole('button',{name:'More actions'}));fireEvent.click(screen.getByRole('button',{name:'Delete'}));const dialog=await screen.findByRole('dialog');expect(request.mock.calls.filter(([,init])=>init?.method==='DELETE')).toHaveLength(0);fireEvent.click(within(dialog).getByRole('button',{name:'Delete'}));await within(dialog).findByRole('button',{name:'Retry'});view.rerender(<Module variant="erp2" path={'/masters/customers/'+row.id} host={{...context,can:()=>false}}/>);fireEvent.click(within(dialog).getByRole('button',{name:'Retry'}));expect(request.mock.calls.filter(([,init])=>init?.method==='DELETE')).toHaveLength(1);fail=false;view.rerender(<Module variant="erp2" path={'/masters/customers/'+row.id} host={context}/>);fireEvent.click(within(dialog).getByRole('button',{name:'Retry'}));await waitFor(()=>expect(context.navigate).toHaveBeenCalledWith('/erp2/masters/customers'));
});
test('denied direct structure creation resolves without an endless loader',async()=>{
 const api=mockApi(),context={...host(api.request),can:()=>false},view=render(<Module variant="erp2" path="/masters/bill-of-materials/new" host={context}/>);expect(await screen.findByText('You do not have permission to create this record.')).toBeVisible();expect(view.container.querySelector('[aria-busy=true]')).toBeNull();expect(screen.queryByRole('button',{name:'Create'})).toBeNull();
});
test('ERP1 Documents badge comes from support metadata and ERP2 status choices update the draft',async()=>{
 const api=mockApi(),row=api.rows.get('customers')![0]!,request:JsonRequest=async(path,init)=>path.includes('/support')?{activities:[],documents:[{name:'Fictional terms',size:'1 KB'}]} as never:api.request(path,init);
 const first=render(<Module variant="erp1" path="/masters/customers" host={host(request)}/>);expect(await screen.findByRole('tab',{name:/^Documents\s*1$/})).toBeVisible();first.unmount();
 render(<Module variant="erp2" path={'/masters/customers/'+row.id+'/edit'} host={host(api.request)}/>);const choices=await screen.findByRole('group',{name:'Status'}),next=PAGES.find(def=>def.slug==='customers')!.fields.find(field=>field.type==='status')!.options!.find(value=>value!==row.status)!;fireEvent.click(within(choices).getByRole('button',{name:next}));expect(within(choices).getByRole('button',{name:next})).toHaveAttribute('aria-pressed','true');
});

test('ERP2 structure view uses the acknowledged save after routed edit completion',async()=>{
 const api=mockApi(),row=api.rows.get('salary-structures')![0]!,context=host(api.request);
 function Routed(){const [path,setPath]=useState('/masters/salary-structures/'+row.id+'/edit');return <Module variant="erp2" path={path} host={{...context,navigate:next=>setPath(next.replace(/^\/erp2/,''))}}/>;}
 render(<Routed/>);fireEvent.change(await screen.findByRole('textbox',{name:'Structure'}),{target:{value:'Fictional structure accepted'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByRole('button',{name:'Edit'});expect(await screen.findByRole('heading',{name:/^Fictional structure accepted/})).toBeVisible();
});

test('ERP2 creation identity and separate status section follow locked form navigation',async()=>{
 const api=mockApi(),context=host(api.request,{formNavigation:'rail'});
 context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{formNavigation:{value:'tabs',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant="erp2" path="/masters/customers/new" host={context}/>);
 expect(await screen.findByText('Number assigned on save')).toBeVisible();
 expect(view.container.querySelector('.erp-profile-stats')).toBeNull();
 const status=await screen.findByRole('group',{name:'Status'});
 expect(status.closest('[data-clinical-section]')).toHaveTextContent('Status');
 expect(within(status.closest('[data-clinical-section]') as HTMLElement).queryByRole('textbox')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Create'}));
 const details=screen.getByRole('tab',{name:/General/});await waitFor(()=>expect(details).toHaveAttribute('aria-selected','true'));
 fireEvent.change(await screen.findByRole('textbox',{name:'Customer'}),{target:{value:'Fictional tabbed profile'}});
 fireEvent.click(screen.getByRole('tab',{name:/Status/}));
 expect(await screen.findByRole('group',{name:'Status'})).toBeVisible();
 fireEvent.click(details);expect(await screen.findByRole('textbox',{name:'Customer'})).toHaveValue('Fictional tabbed profile');
 fireEvent.click(screen.getByRole('tab',{name:/Status/}));
 view.rerender(<Module variant="erp2" path="/masters/customers/new" host={{...context,can:()=>false}}/>);
 await waitFor(()=>expect(screen.getByRole('tab',{name:/General/})).toHaveAttribute('aria-selected','true'));
 expect(screen.queryByRole('group',{name:'Status'})).toBeNull();
});
