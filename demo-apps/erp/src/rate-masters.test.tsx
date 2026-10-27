import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import type {JsonRequest} from '@pepbits/patterns/resources';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {TestHostValue} from './test/host';
import {validity} from './modules/keystone/masters/rates';
import {PAGES} from './modules/keystone/catalog';
import type {ListResponse} from './modules/keystone/types';
const host=(request:JsonRequest):TestHostValue=>({scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'fixture',roles:['admin']},preferences:DEFAULT_PREFERENCES,request,navigate:vi.fn()});
test('rate validity includes both boundaries and allows open dates',()=>{
 expect(validity({effectiveFrom:'2026-01-01',effectiveTo:'2026-01-31'},'2026-01-01')).toBe('Active');expect(validity({effectiveFrom:'2026-01-01',effectiveTo:'2026-01-31'},'2026-01-31')).toBe('Active');expect(validity({effectiveFrom:'2026-02-01'},'2026-01-31')).toBe('Upcoming');expect(validity({effectiveTo:'2026-01-30'},'2026-01-31')).toBe('Expired');expect(validity({},'2026-01-31')).toBe('Active');
});
test.each(['erp1','erp2'].flatMap(variant=>['tax-rates','price-lists','consultation-fees'].map(slug=>({variant:variant as 'erp1'|'erp2',slug}))))('$variant $slug sends asOf, keeps inclusive returned rows and edits in place',async({variant,slug})=>{
 const api=mockApi(),def=PAGES.find(page=>page.slug===slug)!,original=api.rows.get(slug)![0]!;api.rows.set(slug,[{...original,id:'active',version:3,effectiveFrom:'2026-01-01',effectiveTo:'2026-01-31'},{...original,id:'upcoming',effectiveFrom:'2026-02-01',effectiveTo:''}]);
 const request=vi.fn<JsonRequest>(async(path,init)=>{const data=await api.request(path,init),on=new URL(path,'http://localhost').searchParams.get('asOf');if(on){const result=data as ListResponse,rows=result.rows.filter(row=>validity(row,on)==='Active');return {...result,rows,total:rows.length} as never;}return data as never;});
 const view=render(<Module variant={variant} path={'/masters/'+slug} host={host(request as JsonRequest)}/>);await screen.findByRole('button',{name:'Edit active'});expect(view.container.querySelectorAll('[data-validity-bar]')).toHaveLength(2);
 fireEvent.change(screen.getByLabelText('Valid on'),{target:{value:'2026-01-31'}});await waitFor(()=>expect(request.mock.calls.some(([path])=>path.includes('asOf=2026-01-31'))).toBe(true));await waitFor(()=>expect(screen.queryByRole('button',{name:'Edit upcoming'})).toBeNull());expect(screen.getByRole('button',{name:'Edit active'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Edit active'}));const editor=variant==='erp1'?await waitFor(()=>{const el=view.container.querySelector('[data-master-inline]');expect(el).toBeTruthy();return el as HTMLElement;}):await screen.findByRole('dialog');expect(within(editor).getByLabelText('Effective from')).toHaveValue('2026-01-01');if(slug==='tax-rates')expect(within(editor).getByRole('textbox',{name:'Tax'})).toBeVisible();
 fireEvent.change(within(editor).getByLabelText('Effective to'),{target:{value:'2026-02-28'}});await act(async()=>{expect((await axe.run(editor,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});fireEvent.click(within(editor).getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1));const payload=JSON.parse(String(request.mock.calls.find(([,init])=>init?.method==='PUT')![1]!.body));expect(payload).toMatchObject({effectiveTo:'2026-02-28',expectedVersion:3});await waitFor(()=>expect(view.container.querySelector('[data-master-inline],[data-master-form]')).toBeNull());expect(screen.getByLabelText('Valid on')).toHaveValue('2026-01-31');
 fireEvent.click(screen.getByRole('button',{name:'Show all dates'}));await screen.findByRole('button',{name:'Edit upcoming'});expect(screen.getByLabelText('Valid on')).toHaveValue('');expect(def.template).toBe('rate');
});
