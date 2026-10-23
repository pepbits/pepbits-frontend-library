import {expect,it,vi} from 'vitest';
import {createTeleconsultTransport} from './teleconsult';
it.each(['provider','patient'] as const)('routes %s to the configured host and preserves cancellation/replay/grant headers',async variant=>{
 const request=vi.fn(async()=>Response.json({ok:true})),signal=new AbortController().signal;
 await createTeleconsultTransport(request,variant,'hq')('/api/appointments/a1',{method:'PATCH',signal,body:'{}',headers:{'X-Reference-Module':'untrusted','X-Teleconsult-Role':'nurse','X-Teleconsult-Patient':'p8','Idempotency-Key':'synthetic-operation'}});
 expect(request).toHaveBeenCalledOnce();const [path,init]=(request.mock.calls as unknown as [string,RequestInit][])[0]!;
 expect(path).toBe('/reference-modules/teleconsult-'+variant+'/api/appointments/a1');expect(init.signal).toBe(signal);
 expect(Object.fromEntries(new Headers(init.headers))).toMatchObject({'x-reference-module':'reference-teleconsult-'+variant,'x-reference-branch':'hq','x-teleconsult-role':'nurse','x-teleconsult-patient':'p8','idempotency-key':'synthetic-operation'});
});
it.each(['/api/../session','/api/%2foutside','/api/%','//api/session','/outside','/api/a#fragment'])('rejects namespace escape %s',async path=>{
 const request=vi.fn();await expect(createTeleconsultTransport(request,'provider','hq')(path)).rejects.toThrow('Invalid Teleconsult API path');expect(request).not.toHaveBeenCalled();
});
