import {expect,test,vi} from 'vitest';
import {failureFromError} from '@pepbits/components';
import {CaregridFailure,createCaregridClient,qs} from './caregrid';

test('configured base, JSON bodies, method inference and no credential forwarding',async()=>{
 const fetch=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>Response.json({ok:true}));localStorage.setItem('pepbits-session-token','fixture');
 const client=createCaregridClient('/caregrid-api/',fetch as typeof globalThis.fetch);
 expect(client.eventsUrl).toBe('/caregrid-api/events');
 await client.request('/appointments/1/status',{body:{action:'check_in'}});
 const [url,init]=fetch.mock.calls[0]!;expect(url).toBe('/caregrid-api/appointments/1/status');
 expect(init).toMatchObject({method:'POST',body:'{"action":"check_in"}',cache:'no-store'});
 expect(new Headers(init!.headers).get('Authorization')).toBeNull();
 await client.request('/types/4',{method:'PATCH',body:{duration_min:20}});expect(fetch.mock.calls[1]![1]).toMatchObject({method:'PATCH'});
 await client.request('/meta');expect(fetch.mock.calls[2]![1]).toMatchObject({method:'GET',body:undefined});
});
test.each(['meta','//elsewhere.invalid/x','/a/../b','/a/%2e%2e/b','/a#b'])('rejects unsafe path %s before sending',async path=>{
 const fetch=vi.fn();await expect(createCaregridClient('/x',fetch).request(path)).rejects.toThrow('Invalid CareGrid API path');expect(fetch).not.toHaveBeenCalled();
});
test('server errors keep status, message and alternatives; network failures classify as retryable network recovery',async()=>{
 const conflict=createCaregridClient('/x',vi.fn(async()=>Response.json({error:'That time was just taken',detail:{alternatives:[{start:'2026-10-24T10:00'}]}},{status:409})));
 const failure=await conflict.request('/appointments',{body:{}}).catch(error=>error);
 expect(failure).toBeInstanceOf(CaregridFailure);expect(failure).toMatchObject({status:409,message:'That time was just taken',detail:{alternatives:[{start:'2026-10-24T10:00'}]}});
 const offline=await createCaregridClient('/x',vi.fn(async()=>{throw new TypeError('fetch failed');})).request<unknown>('/meta').catch((error:Error)=>error) as Error;
 expect(offline.message).toBe('Cannot reach the scheduling server.');expect(failureFromError(offline)).toMatchObject({kind:'error',retryable:true,description:'recovery.network'});
 await expect(createCaregridClient('/x',vi.fn(async()=>new Response('<html>'))).request('/meta')).rejects.toMatchObject({status:502});
 const aborted=Object.assign(new Error('aborted'),{name:'AbortError'});
 await expect(createCaregridClient('/x',vi.fn(async()=>{throw aborted;})).request('/meta')).rejects.toBe(aborted);
});
test('query strings drop empty values and encode the rest',()=>{
 expect(qs({date:'2026-10-24',department:'',kind:undefined,q:'MRI & CT'})).toBe('?date=2026-10-24&q=MRI%20%26%20CT');expect(qs({})).toBe('');
});
