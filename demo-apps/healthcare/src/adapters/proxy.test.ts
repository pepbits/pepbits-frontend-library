import {NextRequest} from 'next/server';
import {afterEach,expect,it,vi} from 'vitest';
import {GET} from '../app/api/[...segments]/route';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('forwards operational RCM scope, authenticated transport headers and query through the configured proxy',async()=>{
 vi.stubEnv('HEALTHCARE_API_URL','http://127.0.0.1:3330');const send=vi.fn(async()=>Response.json({rows:[]}));vi.stubGlobal('fetch',send);
 const response=await GET(new NextRequest('http://localhost/api/reference-modules/rcm/api/records/invoices?q=INV-1',{headers:{'X-Rcm-Scope':'ALL:AED','X-Reference-Branch':'hq','X-Unrelated':'ignored'}}),{params:Promise.resolve({segments:['reference-modules','rcm','api','records','invoices']})});
 expect(response.status).toBe(200);const [url,init]=(send.mock.calls as unknown as [string,RequestInit][])[0]!;expect(url).toBe('http://127.0.0.1:3330/reference-modules/rcm/api/records/invoices?q=INV-1');const headers=new Headers(init.headers);expect(headers.get('X-Rcm-Scope')).toBe('ALL:AED');expect(headers.get('X-Reference-Branch')).toBe('hq');expect(headers.has('X-Unrelated')).toBe(false);
});
