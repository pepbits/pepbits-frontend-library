import React from 'react';
import {renderHook,waitFor,act} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {ReferenceHostProvider,type ReferenceHost} from '@pepbits/reference-host';
import {useDiagnosticClient,useDiagnosticResource} from './index';
const host=(fetch:ReferenceHost['fetch']):ReferenceHost=>({scope:{tenantId:'tenant',applicationId:'nexora',branchId:'hq',moduleId:'reference-lis1',userId:'user',roles:['enterprise-admin']},preferences:DEFAULT_PREFERENCES,fetch,request:vi.fn(),navigate:vi.fn()});
it('sends structured writes through authenticated host and retains server errors',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response('{"id":12}',{status:201})).mockResolvedValueOnce(new Response('{"message":["Required name"]}',{status:422}));
 const h=host(fetch),{result}=renderHook(useDiagnosticClient,{wrapper:({children})=><ReferenceHostProvider host={h}>{children}</ReferenceHostProvider>});
 expect(await result.current.post('/patients',{firstName:'Synthetic'})).toEqual({id:12});
 expect(fetch.mock.calls[0][0]).toBe('/api/patients');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({firstName:'Synthetic'});
 await expect(result.current.post('/patients',{})).rejects.toMatchObject({status:422,message:'Required name'});
});
it('ignores the previous branch response after its transport is replaced',async()=>{
 let complete!:(r:Response)=>void;const old=host(vi.fn(()=>new Promise<Response>(resolve=>{complete=resolve;})));
 let current=old;
 const {result,rerender}=renderHook(()=>useDiagnosticResource('/api/patients'),{wrapper:({children})=><ReferenceHostProvider host={current}>{children}</ReferenceHostProvider>});
 current={...old,scope:{...old.scope,branchId:'other'},fetch:vi.fn().mockResolvedValue(new Response('[{"id":"new-branch"}]'))};rerender();
 await waitFor(()=>expect(result.current.data).toEqual([{id:'new-branch'}]));
 await act(async()=>complete(new Response('[{"id":"old-branch"}]')));
 expect(result.current.data).toEqual([{id:'new-branch'}]);
});
