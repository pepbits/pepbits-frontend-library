import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {TestHostValue} from './test/host';
import {PAGES} from './modules/keystone/catalog';
import {nounOf} from './modules/keystone/registry';
const masters=PAGES.filter(page=>page.section==='masters'&&['grid','dependent'].includes(page.template));
const host=(request:JsonRequest):TestHostValue=>({scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:DEFAULT_PREFERENCES,request,navigate:vi.fn()});

test.each(['erp1','erp2'].flatMap(variant=>masters.map(def=>({variant:variant as 'erp1'|'erp2',def}))))('$variant $def.slug edits in the source composition, saves with version and retains search',async({variant,def})=>{
 const api=mockApi(),request=vi.fn(api.request),context=host(request as JsonRequest),row=api.rows.get(def.entity)![0]!;
 const view=render(<Module variant={variant} path={'/masters/'+def.slug} host={context}/>);
 await waitFor(()=>expect(view.container.querySelector('tbody tr')).toBeTruthy());
 const search=screen.getByRole('textbox',{name:'Search'});fireEvent.change(search,{target:{value:String(row.code??row.name)}});
 const edit=await screen.findByRole('button',{name:'Edit '+row.id});fireEvent.click(edit);
 const editor=variant==='erp1'?await waitFor(()=>{const node=view.container.querySelector('[data-master-inline]');expect(node).toBeTruthy();return node as HTMLElement;}):await screen.findByRole('dialog');
 expect(view.container.querySelector('table')).toBeInTheDocument();expect(view.container.querySelector('[data-record-page]')).toBeNull();expect(context.navigate).not.toHaveBeenCalled();
 const field=def.fields.find(field=>field.primary&&!field.readOnly)??def.fields.find(field=>field.key==='name')!;
 const control=within(editor).getByRole('textbox',{name:field.label});fireEvent.change(control,{target:{value:'Fictional master changed'}});
 await act(async()=>{expect((await axe.run(editor,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
 fireEvent.click(within(editor).getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT')).toBe(true));
 const body=JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='PUT')![1]!.body));expect(body.expectedVersion).toBe(row.version);expect(body.operationId).toBeTruthy();
 await waitFor(()=>expect(view.container.querySelector('[data-master-inline], [data-master-form]')).toBeNull());expect(search).toHaveValue(String(row.code??row.name));
});

test.each(['erp1','erp2'] as const)('%s creation works with an empty list and enforces required fields',async variant=>{
 const api=mockApi();api.rows.set('countries',[]);const request=vi.fn(api.request),view=render(<Module variant={variant} path="/masters/countries" host={host(request as JsonRequest)}/>);
 fireEvent.click(await screen.findByRole('button',{name:variant==='erp1'?'Add row':'New country'}));
 const editor=variant==='erp1'?await waitFor(()=>{const el=view.container.querySelector('[data-master-inline]');expect(el).toBeTruthy();return el as HTMLElement;}):await screen.findByRole('dialog');
 fireEvent.click(within(editor).getByRole('button',{name:variant==='erp1'?'Save':'Add'}));expect(request.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
 fireEvent.change(within(editor).getByRole('textbox',{name:'ISO code'}),{target:{value:'ZZ'}});fireEvent.change(within(editor).getByRole('textbox',{name:'Country'}),{target:{value:'Fictional country'}});
 fireEvent.click(within(editor).getByRole('button',{name:variant==='erp1'?'Save':'Add'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1));
});

test('ERP2 save another resets only after acknowledgement and confirmed delete retries without losing fields',async()=>{
 const api=mockApi();let rejectDelete=true;const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='DELETE'){if(rejectDelete)throw Object.assign(new Error('Offline'),{status:503});const rows=api.rows.get('countries')!;rows.splice(rows.findIndex(row=>path.endsWith('/'+row.id)),1);return {deleted:'created'} as never;}return api.request(path,init);});
 const view=render(<Module variant="erp2" path="/masters/countries" host={host(request as JsonRequest)}/>);fireEvent.click(await screen.findByRole('button',{name:'New country'}));let dialog=await screen.findByRole('dialog');
 fireEvent.change(within(dialog).getByRole('textbox',{name:'ISO code'}),{target:{value:'ZZ'}});fireEvent.change(within(dialog).getByRole('textbox',{name:'Country'}),{target:{value:'Fictional another'}});fireEvent.click(within(dialog).getByRole('button',{name:'Save and add another'}));
 await waitFor(()=>expect(within(dialog).getByRole('textbox',{name:'Country'})).toHaveValue(''));expect(dialog).toHaveTextContent('1 added so far');fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));
 fireEvent.click(await screen.findByRole('button',{name:'Edit created'}));dialog=await screen.findByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Delete'}));expect(request.mock.calls.filter(([,init])=>init?.method==='DELETE')).toHaveLength(0);fireEvent.click(within(dialog).getByRole('button',{name:'Delete'}));await within(dialog).findByRole('button',{name:'Retry'});expect(within(dialog).getByRole('textbox',{name:'Country'})).toHaveValue('Fictional another');rejectDelete=false;fireEvent.click(within(dialog).getByRole('button',{name:'Retry'}));await waitFor(()=>expect(view.container.querySelector('[data-master-form]')).toBeNull());
});

test('inline version conflict retains the draft and requires explicit reload',async()=>{
 const api=mockApi();let reloadFails=true;const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT')throw Object.assign(new Error('Changed elsewhere'),{status:409});if(reloadFails&&/entities\/countries\/[^/?]+$/.test(path))throw Object.assign(new Error('Reload offline'),{status:503});return api.request(path,init);});
 const row=api.rows.get('countries')![0]!;render(<Module variant="erp1" path="/masters/countries" host={host(request as JsonRequest)}/>);fireEvent.click(await screen.findByRole('button',{name:'Edit '+row.id}));fireEvent.change(await screen.findByRole('textbox',{name:'Country'}),{target:{value:'Retained conflict'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await screen.findByRole('button',{name:'Reload'});expect(screen.getByRole('textbox',{name:'Country'})).toHaveValue('Retained conflict');expect(screen.getByRole('button',{name:'Save'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Reload'}));await waitFor(()=>expect(request.mock.calls.some(([path])=>/entities\/countries\/[^/?]+$/.test(path))).toBe(true));await waitFor(()=>expect(screen.getByRole('button',{name:'Reload'})).toBeEnabled());expect(screen.getByRole('button',{name:'Save'})).toBeDisabled();reloadFails=false;fireEvent.click(screen.getByRole('button',{name:'Reload'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'Country'})).toHaveValue(row.name));
});

test('mounted locks and write permission changes apply to an open inline draft',async()=>{
 const api=mockApi(),request=vi.fn(api.request),context=host(request as JsonRequest),row=api.rows.get('countries')![0]!;
 context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{density:{value:'spacious',locked:true},resultView:{value:'table',locked:true},pageSize:{value:10,locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant="erp1" path="/masters/countries" host={context}/>);fireEvent.click(await screen.findByRole('button',{name:'Edit '+row.id}));
 expect(view.container.querySelector('table')).toHaveAttribute('data-density','spacious');expect(screen.getByRole('radio',{name:'Card grid view'})).toBeDisabled();expect(screen.getByRole('combobox',{name:'Rows per page'})).toBeDisabled();
 view.rerender(<Module variant="erp1" path="/masters/countries" host={{...context,can:()=>false}}/>);expect(screen.getByRole('button',{name:'Save'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Save'}));expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(0);
});

test('states parent selection supplies the inline creation default',async()=>{
 const api=mockApi(),country=api.rows.get('countries')![0]!,view=render(<Module variant="erp1" path="/masters/states" host={host(api.request)}/>);
 const parent=await screen.findByRole('complementary',{name:'Parent records'});fireEvent.click(await within(parent).findByRole('button',{name:new RegExp(country.name)}));fireEvent.click(screen.getByRole('button',{name:'Add row'}));
 await waitFor(()=>expect(within(view.container.querySelector('[data-master-inline]') as HTMLElement).getByLabelText('Country')).toHaveValue(country.name));
});

test.each(['ar','hi','ml'] as const)('%s master dialog preserves accessible labels and effective scales',async language=>{
 const api=mockApi(),context=host(api.request);context.preferences={...context.preferences,language,fontSizeForm:14,fontSizeResult:15};
 const view=render(<Module variant="erp2" path="/masters/units" host={context}/>);await waitFor(()=>expect(view.container.querySelector('tbody tr')).toBeTruthy());fireEvent.click(view.container.querySelector('tbody tr button')!);const dialog=await screen.findByRole('dialog');
 await act(async()=>{expect((await axe.run(dialog,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
