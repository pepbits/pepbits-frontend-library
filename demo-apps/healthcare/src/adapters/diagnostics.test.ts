import {expect,it,vi} from 'vitest';
import {createDiagnosticTransport} from './diagnostics';
it.each(['lis1','lis2','ris1'] as const)('scopes %s reads and writes through the configured host request',async variant=>{
 const request=vi.fn().mockResolvedValue(Response.json({id:1}));
 const fetch=createDiagnosticTransport(request,variant,'hq');
 const controller=new AbortController();
 await fetch('/api/patients',{method:'POST',body:JSON.stringify({firstName:'Synthetic'}),signal:controller.signal,headers:{'X-Reference-Branch':'other','X-Reference-Module':'other'}});
 expect(request).toHaveBeenCalledOnce();const [path,init]=request.mock.calls[0]!;
 expect(path).toBe('/reference-modules/'+variant+'/api/patients');expect(init.signal).toBe(controller.signal);
 expect(init.headers.get('X-Reference-Branch')).toBe('hq');expect(init.headers.get('X-Reference-Module')).toBe('reference-'+variant);
 expect(JSON.parse(init.body)).toEqual({firstName:'Synthetic'});
});
it.each(['//elsewhere/api','../patients','/api/../patients','/api/%2e%2e/patients','/api/a%2fb','/api/%','/api/a\\b'])('rejects an invalid adapter path %s',async path=>{
 const request=vi.fn();await expect(createDiagnosticTransport(request,'lis1','hq')(path)).rejects.toThrow('Invalid diagnostic API path');expect(request).not.toHaveBeenCalled();
});
