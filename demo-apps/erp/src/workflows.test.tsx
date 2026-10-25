import React from 'react';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {Module} from './test/module';
import {mockApi} from './test/mock-api';
import type {JsonRequest} from '@pepbits/patterns/resources';
function fixture(request:JsonRequest){return {scope:{tenantId:'fictional',applicationId:'nexora',branchId:'head-office',userId:'admin',roles:['admin']},preferences:DEFAULT_PREFERENCES,request,navigate:()=>{}};}
test('ERP1 keeps the API-acknowledged master row after inline saving',async()=>{
 const api=mockApi(),request=vi.fn(api.request),{container}=render(<Module variant="erp1" path="/masters/countries" host={fixture(request as JsonRequest)}/>);
 await waitFor(()=>expect(container.querySelector('tbody tr td:nth-child(3)')).toBeTruthy());fireEvent.click(container.querySelector('tbody tr td:nth-child(3)')!);const field=await screen.findByRole('textbox',{name:'Country'});fireEvent.change(field,{target:{value:'Fictional saved country'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(request.mock.calls.some(([,init])=>init?.method==='PUT')).toBe(true));await waitFor(()=>expect(screen.getAllByText('Fictional saved country').length).toBeGreaterThan(0));expect(screen.queryByRole('button',{name:'Save'})).toBeNull();
});
test('failed record save retains typed values and retries the same operation identity',async()=>{
 const api=mockApi();let fail=true;const request=vi.fn<JsonRequest>(async<T,>(path:string,init?:RequestInit)=>{if(init?.method==='PUT'&&fail)throw Object.assign(new Error('Service offline'),{status:503});return api.request<T>(path,init);});
 const {container}=render(<Module variant="erp1" path="/masters/countries" host={fixture(request as JsonRequest)}/>);await waitFor(()=>expect(container.querySelector('tbody tr td:nth-child(3)')).toBeTruthy());fireEvent.click(container.querySelector('tbody tr td:nth-child(3)')!);fireEvent.change(await screen.findByRole('textbox',{name:'Country'}),{target:{value:'Retained country'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByRole('button',{name:'Retry'});expect(screen.getByRole('textbox',{name:'Country'})).toHaveValue('Retained country');fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT');expect(JSON.parse(String(writes[0]![1]?.body)).operationId).toBe(JSON.parse(String(writes[1]![1]?.body)).operationId);
});
test('a failed approval retries its intended status and operation identity',async()=>{
 const api=mockApi();let fail=true;const request=vi.fn<JsonRequest>(async<T,>(path:string,init?:RequestInit)=>{if(init?.method==='PUT'&&fail)throw Object.assign(new Error('Service offline'),{status:503});return api.request<T>(path,init);});
 const {container}=render(<Module variant="erp1" path="/workspace/approvals" host={fixture(request as JsonRequest)}/>);await waitFor(()=>expect(container.querySelector('tbody tr td:nth-child(3)')).toBeTruthy());fireEvent.click(container.querySelector('tbody tr td:nth-child(3)')!);fireEvent.click(await screen.findByRole('button',{name:'Approve'}));await screen.findByRole('button',{name:'Retry'});fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const writes=request.mock.calls.filter(([,init])=>init?.method==='PUT').map(([,init])=>JSON.parse(String(init?.body)));expect(writes.map(w=>w.status)).toEqual(['Approved','Approved']);expect(writes[0].operationId).toBe(writes[1].operationId);await waitFor(()=>expect(screen.getByRole('button',{name:'Approve'})).toBeDisabled());
});
