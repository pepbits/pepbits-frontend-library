import {expect,test,vi} from 'vitest';
import {createPharmacyTransport} from './pharmacy';
import {createPharmacyClient} from '../modules/pharmacy/lib/api';
test('maps the fixed namespace through the host request, preserving abort, replay key and structured failures',async()=>{
 const request=vi.fn(async()=>Response.json({error:{code:'conflict',message:'Stock changed.',details:{product:'fictional'}}},{status:409}));
 const transport=createPharmacyTransport(request,'hq'),client=createPharmacyClient({request:transport}),controller=new AbortController();
 await expect(client.post('/sales',{items:[]},{operationKey:'demo-operation',signal:controller.signal})).rejects.toMatchObject({status:409,code:'conflict',message:'Stock changed.',details:{product:'fictional'}});
 const [path,init]=(request.mock.calls as unknown as [string,RequestInit][])[0]!;
 expect(path).toBe('/reference-modules/pharmacy/api/sales');expect(init.signal).toBe(controller.signal);
 const headers=new Headers(init.headers);expect(headers.get('Idempotency-Key')).toBe('demo-operation');expect(headers.get('X-Reference-Branch')).toBe('hq');expect(headers.get('X-Reference-Module')).toBe('reference-pharmacy');expect(headers.has('Authorization')).toBe(false);
});
test.each(['//outside','/../meta','/%2e%2e/meta','/%2fmeta','/bad\\path','/bad#path','/bad%'])('rejects unsafe module path %s before transport',async path=>{
 const request=vi.fn();await expect(createPharmacyTransport(request,'hq')(path)).rejects.toThrow('Invalid pharmacy API path');expect(request).not.toHaveBeenCalled();
});
test('accepts encoded query values and rejects malformed success responses as retryable',async()=>{
 const request=vi.fn(async()=>new Response('invalid json'));
 await expect(createPharmacyTransport(request,'hq')('/products/lookup?q=brand%2Fgeneric')).rejects.toMatchObject({status:502});expect(request).toHaveBeenCalledOnce();
});
