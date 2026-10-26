import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {TestHostValue} from './test/host';
const host=(request:JsonRequest):TestHostValue=>({scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:DEFAULT_PREFERENCES,request,navigate:vi.fn()});
const trees=[['org-structure','Name'],['chart-of-accounts','Account'],['product-categories','Category']] as const;
test.each(trees)('%s edits beside the tree and adopts versioned saves without losing search',async(slug,label)=>{
 const api=mockApi(),request=vi.fn(api.request),row=api.rows.get(slug)![0]!;row.version=4;const view=render(<Module variant="erp1" path={'/masters/'+slug} host={host(request as JsonRequest)}/>);
 const input=await screen.findByRole('textbox',{name:label});expect(input).toBeEnabled();fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:row.code}});fireEvent.change(input,{target:{value:'Fictional changed node'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1));const payload=JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='PUT')![1]!.body));expect(payload).toMatchObject({expectedVersion:row.version,name:'Fictional changed node'});expect(payload.operationId).toBeTruthy();await screen.findByRole('heading',{name:'Fictional changed node'});expect(input).toHaveValue('Fictional changed node');expect(screen.getByRole('textbox',{name:'Search the tree'})).toHaveValue(row.code);
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
test('tree failed saves preserve fields and operation identity; conflicts require explicit reload',async()=>{
 const api=mockApi();let status=503;const request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='PUT'&&status)throw Object.assign(new Error('Save failed'),{status});return api.request(path,init);});
 render(<Module variant="erp1" path="/masters/chart-of-accounts" host={host(request as JsonRequest)}/>);const input=await screen.findByRole('textbox',{name:'Account'});fireEvent.change(input,{target:{value:'Retained draft'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const payloads=request.mock.calls.filter(([,init])=>init?.method==='PUT').map(([,init])=>JSON.parse(String(init!.body)));expect(payloads[0]).toEqual(payloads[1]);expect(input).toHaveValue('Retained draft');status=409;await waitFor(()=>expect(screen.getByRole('button',{name:'Save'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByRole('button',{name:'Reload'});expect(screen.getByRole('button',{name:'Save'})).toBeDisabled();status=0;fireEvent.click(screen.getByRole('button',{name:'Reload'}));await waitFor(()=>expect(input).toHaveValue(api.rows.get('chart-of-accounts')![0]!.name));
});
test('tree child defaults, required name, leaf guard and acknowledged deletion',async()=>{
 const api=mockApi(),root=api.rows.get('chart-of-accounts')![0]!,request=vi.fn<JsonRequest>(async(path,init)=>{if(init?.method==='DELETE'){const rows=api.rows.get('chart-of-accounts')!;rows.splice(rows.findIndex(row=>path.endsWith('/'+row.id)),1);return {deleted:'created'} as never;}return api.request(path,init);});
 render(<Module variant="erp1" path="/masters/chart-of-accounts" host={host(request as JsonRequest)}/>);fireEvent.click(await screen.findByRole('button',{name:'Add child'}));fireEvent.click(screen.getByRole('button',{name:'Create'}));expect(request.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);fireEvent.change(screen.getByRole('textbox',{name:'Account'}),{target:{value:'Fictional leaf'}});fireEvent.click(screen.getByRole('button',{name:'Create'}));await screen.findByRole('heading',{name:'Fictional leaf'});const payload=JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body));expect(payload).toMatchObject({parentId:root.id,level:root.level+1,nature:root.nature});
 fireEvent.click(screen.getByRole('button',{name:'Delete'}));expect(request.mock.calls.filter(([,init])=>init?.method==='DELETE')).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'Confirm delete'}));await waitFor(()=>expect(screen.queryByRole('heading',{name:'Fictional leaf'})).toBeNull());expect(await screen.findByRole('button',{name:'Delete'})).toBeDisabled();
});
test('incomplete trees fence destructive commands and mounted permission loss disables saves',async()=>{
 const api=mockApi(),request=vi.fn<JsonRequest>(async(path,init)=>{const data=await api.request(path,init);return (path.includes('size=2000')?{...(data as object),total:5000}:data) as never;}),context=host(request as JsonRequest);
 const view=render(<Module variant="erp1" path="/masters/chart-of-accounts" host={context}/>);await screen.findByRole('textbox',{name:'Account'});expect(screen.getByRole('button',{name:'Add child'})).toBeDisabled();expect(screen.getByRole('button',{name:'Delete'})).toBeDisabled();
 view.rerender(<Module variant="erp1" path="/masters/chart-of-accounts" host={{...context,can:()=>false}}/>);expect(screen.getByRole('textbox',{name:'Account'})).toBeDisabled();expect(screen.queryByRole('button',{name:'Save'})).toBeNull();
});
test.each(['ar','hi','ml'] as const)('%s tree keeps labelled fields and effective density/table locks',async language=>{
 const api=mockApi(),context=host(api.request);context.preferences={...context.preferences,language};context.preferenceHost={preferences:context.preferences,preferencePolicy:{revision:1,rules:{density:{value:'spacious',locked:true},resultView:{value:'table',locked:true}}},onPreferenceChange:vi.fn()};
 const view=render(<Module variant="erp1" path="/masters/chart-of-accounts" host={context}/>);await waitFor(()=>expect(view.container.querySelector('.erp-tree-fields input')).toBeTruthy());expect(view.container.querySelector('[data-master-tree]')).toHaveAttribute('data-density','spacious');expect(view.container.querySelector('table')).toHaveAttribute('data-density','spacious');expect(within(view.container.querySelector('[data-tree-identity] nav') as HTMLElement).getAllByRole('button').length).toBeGreaterThan(0);
 await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});

 test.each(trees)('ERP2 %s opens a table node with visible neighbour order',async(slug)=>{
  const api=mockApi(),context=host(api.request),row=api.rows.get(slug)![0]!,view=render(<Module variant="erp2" path={'/masters/'+slug} host={context}/>);
  await waitFor(()=>expect(view.container.querySelector('[data-hierarchy-grid] table')).toBeTruthy());fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:row.code}});fireEvent.click(screen.getByRole('button',{name:row.name}));expect(context.navigate).toHaveBeenCalledWith('/erp2/masters/'+slug+'/'+row.id);
  await act(async()=>{expect((await axe.run(view.container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
 });
