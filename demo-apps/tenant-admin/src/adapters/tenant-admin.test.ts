import {describe,expect,it,vi} from 'vitest';
import {createTenantAdminTransport} from './tenant-admin';
import type {Request} from './http';
describe('Tenant Admin configured HTTP adapter',()=>{
 it('maps module-relative paths onto the API namespace with routing metadata and keeps write identity',async()=>{
  const request=vi.fn<Request>().mockResolvedValue(Response.json({id:4})),transport=createTenantAdminTransport(request,'hq'),abort=new AbortController();
  expect(await transport.request('/resources/items',{method:'POST',body:'{}',headers:{'Idempotency-Key':'operation'},signal:abort.signal})).toEqual({id:4});
  const [path,init]=request.mock.calls[0]!;expect(path).toBe('/reference-modules/tenant-admin/resources/items');
  const headers=new Headers(init?.headers);expect(headers.get('X-Reference-Branch')).toBe('hq');expect(headers.get('X-Reference-Module')).toBe('reference-tenant-admin');expect(headers.get('Idempotency-Key')).toBe('operation');expect(headers.has('Authorization')).toBe(false);expect(headers.has('x-actor-id')).toBe(false);expect(init?.signal).toBe(abort.signal);
 });
 it.each(['//host/x','/../auth','/%2e%2e/auth','/x%2fy','/x%5cy','/bad%','/bad#x','relative'])('rejects malformed or escaping path %s before HTTP',async path=>{const request=vi.fn<Request>();await expect(createTenantAdminTransport(request,'hq').request(path)).rejects.toThrow('Invalid Tenant Admin API path');expect(request).not.toHaveBeenCalled();});
 it('keeps the structured source refusal and treats an unreadable success as ambiguous',async()=>{
  const request=vi.fn<Request>().mockResolvedValueOnce(Response.json({error:{code:'STALE_VERSION',message:'Someone changed this record.'}},{status:409})).mockResolvedValueOnce(new Response('broken')).mockResolvedValueOnce(new Response(null,{status:204}));
  const transport=createTenantAdminTransport(request,'hq');
  await expect(transport.request('/resources/items/7/submit',{method:'POST'})).rejects.toMatchObject({status:409,details:{error:{code:'STALE_VERSION'}}});
  await expect(transport.request('/meta')).rejects.toMatchObject({status:502});
  await expect(transport.request('/resources/items/7',{method:'DELETE'})).resolves.toBeNull();
 });
});
