import {act,renderHook,waitFor} from '@testing-library/react';
import {ReferenceHostProvider,createReferenceTransport,type ReferenceHost} from '@pepbits/reference-host';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {ApiProvider,useApiClient} from './lib/api';
import {useApi} from './lib/hooks';
import {useLookup,useLookupInvalidation} from './lib/lookups';
import type {ReactNode} from 'react';
const scope={moduleId:'reference-healthcare-suite',tenantId:'fictional-tenant',applicationId:'fictional-product',branchId:'fictional-branch',userId:'fictional-user',roles:['enterprise-admin']};
function host(fetch:ReferenceHost['fetch']):ReferenceHost{return {scope,preferences:{...DEFAULT_PREFERENCES},fetch,request:vi.fn(),navigate:vi.fn()};}
function harness(initial:ReferenceHost){let current=initial,facilityId='F001',canWrite=true;return {setHost:(next:ReferenceHost)=>current=next,setFacility:(next:string)=>facilityId=next,setCanWrite:(next:boolean)=>canWrite=next,wrapper:({children}:{children:ReactNode})=><ReferenceHostProvider host={current}><ApiProvider facilityId={facilityId} canWrite={canWrite}>{children}</ApiProvider></ReferenceHostProvider>};}
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
test('uses the real host namespace once and preserves facility/auth scope headers',async()=>{
 const wire=vi.fn(async(_path:string,_init?:RequestInit)=>response({id:'P001'}));const transport=createReferenceTransport({namespace:'/reference-modules/healthcare-suite',moduleId:scope.moduleId,applicationId:scope.applicationId,branchId:scope.branchId,fetch:wire,failureMessage:()=> 'Request failed'});
 const h=harness({...host(transport.fetch),request:transport.request});const {result}=renderHook(useApiClient,{wrapper:h.wrapper});await result.current('/patients',{method:'POST',body:{firstName:'Fictional'}});
 const [path,init]=wire.mock.calls[0];expect(path).toBe('/reference-modules/healthcare-suite/api/patients');const headers=new Headers(init?.headers);expect(headers.get('X-Reference-Facility')).toBe('F001');expect(headers.get('X-Product-Id')).toBe(scope.applicationId);expect(headers.get('X-Reference-Branch')).toBe(scope.branchId);expect(headers.get('Idempotency-Key')).toBeTruthy();
});
test('keeps a failed operation key across facility changes and retires it after success',async()=>{
 const keys:string[]=[];let fail=true;const fetch=vi.fn(async(_path:string,init?:RequestInit)=>{keys.push(new Headers(init?.headers).get('Idempotency-Key')!);if(fail)throw new Error('offline');return response({id:'E001'});});const h=harness(host(fetch));const {result,rerender}=renderHook(useApiClient,{wrapper:h.wrapper});
 await expect(result.current('/encounters',{method:'POST',body:{patientId:'P001'}})).rejects.toThrow('offline');h.setFacility('F002');rerender();h.setFacility('F001');rerender();fail=false;await result.current('/encounters',{method:'POST',body:{patientId:'P001'}});await result.current('/encounters',{method:'POST',body:{patientId:'P001'}});expect(keys[1]).toBe(keys[0]);expect(keys[2]).not.toBe(keys[0]);
});
test('explicit split keys survive successful calls for a whole-operation retry',async()=>{
 const keys:string[]=[];const fetch=vi.fn(async(_path:string,init?:RequestInit)=>{keys.push(new Headers(init?.headers).get('Idempotency-Key')!);return response({paid:10});});const h=harness(host(fetch));const {result}=renderHook(useApiClient,{wrapper:h.wrapper});for(let i=0;i<2;i++)await result.current('/billing/invoices/I001/payments',{method:'POST',body:{mode:'Cash',amount:10},operationId:'same-intent:0'});expect(keys).toEqual(['same-intent:0','same-intent:0']);
});
test('stable client identity survives preference changes and uses latest transport',async()=>{
 const first=vi.fn(async()=>response({source:'first'})),second=vi.fn(async()=>response({source:'second'}));const initial=host(first),h=harness(initial);const {result,rerender}=renderHook(useApiClient,{wrapper:h.wrapper});const before=result.current;h.setHost({...initial,preferences:{...initial.preferences,language:'ar'},fetch:second});rerender();expect(result.current).toBe(before);expect(await result.current('/session')).toEqual({source:'second'});expect(first).not.toHaveBeenCalled();
});
test('preserves source fields and host boundary error strings',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({message:'Fix highlighted fields',fields:{firstName:'Required'}},422)).mockResolvedValueOnce(response({error:'Not signed in.'},401));const h=harness(host(fetch));const {result}=renderHook(useApiClient,{wrapper:h.wrapper});await expect(result.current('/patients',{method:'POST',body:{}})).rejects.toMatchObject({status:422,fields:{firstName:'Required'}});await expect(result.current('/session')).rejects.toThrow('Not signed in.');
});
test('read-only capability blocks writes before transport and permits reads',async()=>{
 const fetch=vi.fn(async()=>response({data:[]}));const h=harness(host(fetch));h.setCanWrite(false);const {result}=renderHook(useApiClient,{wrapper:h.wrapper});await expect(result.current('/patients',{method:'POST',body:{}})).rejects.toMatchObject({status:403});expect(fetch).not.toHaveBeenCalled();await result.current('/patients');expect(fetch).toHaveBeenCalledTimes(1);
});
test('ignores stale responses when injected transport ignores abort',async()=>{
 let resolveFirst:(value:Response)=>void=()=>{};const pending=new Promise<Response>(resolve=>resolveFirst=resolve);const fetch=vi.fn((path:string)=>path.endsWith('/patients/P001')?pending:Promise.resolve(response({id:'P002'})));const h=harness(host(fetch));const {result,rerender}=renderHook(({path})=>useApi<{id:string}>(path),{wrapper:h.wrapper,initialProps:{path:'/patients/P001'}});rerender({path:'/patients/P002'});await waitFor(()=>expect(result.current.data?.id).toBe('P002'));await act(async()=>resolveFirst(response({id:'P001'})));expect(result.current.data?.id).toBe('P002');
});
test('lookup cache is isolated to host/facility and supports master invalidation',async()=>{
 const fetch=vi.fn(async()=>response([{value:'D001',label:'Fictional department'}]));const initial=host(fetch),h=harness(initial);const {result,rerender}=renderHook(()=>({one:useLookup('departments',{}),two:useLookup('departments',{}),invalidate:useLookupInvalidation()}),{wrapper:h.wrapper});await waitFor(()=>expect(result.current.one.options).toHaveLength(1));expect(fetch).toHaveBeenCalledTimes(1);act(()=>result.current.invalidate());h.setFacility('F002');rerender();await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));h.setHost({...initial,scope:{...scope,userId:'second-user'}});rerender();await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
});
