import {describe,expect,it,vi} from 'vitest';
import {createQualityTransport} from './quality';
describe('Quality configured HTTP adapter',()=>{
 it('maps reads and authenticated downloads with branch metadata and replay headers',async()=>{
  const request=vi.fn(async(_path:string,_init?:RequestInit)=>Response.json({id:4})),transport=createQualityTransport(request,'hq');
  expect(await transport.request('/authorities',{method:'POST',body:'{}',headers:{'Idempotency-Key':'operation'}})).toEqual({id:4});
  await transport.fetch('/audit/export.csv?from=2026-01-01');
  expect(request.mock.calls[0]?.[0]).toBe('/reference-modules/quality/api/authorities');
  const headers=new Headers((request.mock.calls[0] as unknown as [string,RequestInit])[1].headers);
  expect(headers.get('X-Reference-Branch')).toBe('hq');expect(headers.get('X-Reference-Module')).toBe('reference-quality');expect(headers.get('Idempotency-Key')).toBe('operation');expect(headers.has('Authorization')).toBe(false);
 });
 it.each(['//host/x','/../auth','/%2e%2e/auth','/x%2fy','/x%5cy','/bad%','/bad#x','relative'])('rejects malformed or escaping path %s before HTTP',async path=>{const request=vi.fn();await expect(createQualityTransport(request,'hq').request(path)).rejects.toThrow('Invalid Quality API path');expect(request).not.toHaveBeenCalled();});
 it('preserves structured refusals and treats malformed successful JSON as ambiguous',async()=>{
  const request=vi.fn().mockResolvedValueOnce(Response.json({error:'conflict',message:'Reload it'},{status:409})).mockResolvedValueOnce(new Response('bad'));
  const transport=createQualityTransport(request,'hq');await expect(transport.request('/results/1')).rejects.toMatchObject({status:409,details:{error:'conflict',message:'Reload it'}});await expect(transport.request('/results/1')).rejects.toMatchObject({status:502});
 });
});
