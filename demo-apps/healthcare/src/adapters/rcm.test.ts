import {expect,test,vi} from 'vitest';
import {createRcmTransport} from './rcm';
import {createRcmClient} from '../modules/rcm/lib/api';
test('maps the fixed namespace through the host request, preserving abort, replay key and structured failures',async()=>{
 const request=vi.fn(async()=>Response.json({error:{code:'conflict',message:'Balance changed.',fieldErrors:{amount:'Changed'}}},{status:409}));
 const transport=createRcmTransport(request,'hq'),client=createRcmClient({request:transport}),controller=new AbortController();
 await expect(client.post('/records/receipts',{items:[]},{operationKey:'demo-operation',signal:controller.signal})).rejects.toMatchObject({status:409,code:'conflict',message:'Balance changed.',fieldErrors:{amount:'Changed'}});
 const [path,init]=(request.mock.calls as unknown as [string,RequestInit][])[0]!;
 expect(path).toBe('/reference-modules/rcm/api/records/receipts');expect(init.signal).toBe(controller.signal);
 const headers=new Headers(init.headers);expect(headers.get('Idempotency-Key')).toBe('demo-operation');expect(headers.get('X-Reference-Branch')).toBe('hq');expect(headers.get('X-Reference-Module')).toBe('reference-rcm');expect(headers.has('Authorization')).toBe(false);
});
test.each(['//outside','/../meta','/%2e%2e/meta','/%2fmeta','/bad\\path','/bad#path','/bad%'])('rejects unsafe module path %s before transport',async path=>{
 const request=vi.fn();await expect(createRcmTransport(request,'hq')(path)).rejects.toThrow('Invalid rcm API path');expect(request).not.toHaveBeenCalled();
});
test('accepts encoded query values and rejects malformed success responses as retryable',async()=>{
 const request=vi.fn(async()=>new Response('invalid json'));
 await expect(createRcmTransport(request,'hq')('/products/lookup?q=brand%2Fgeneric')).rejects.toMatchObject({status:502});expect(request).toHaveBeenCalledOnce();
});
