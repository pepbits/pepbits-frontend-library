import {NextRequest} from 'next/server';
import {afterEach,expect,it,vi} from 'vitest';
import {GET} from '../app/api/[...segments]/route';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('forwards operational RCM scope, authenticated transport headers and query through the configured proxy',async()=>{
 vi.stubEnv('HEALTHCARE_API_URL','http://127.0.0.1:3330');const send=vi.fn(async()=>Response.json({rows:[]}));vi.stubGlobal('fetch',send);
 const response=await GET(new NextRequest('http://localhost/api/reference-modules/rcm/api/records/invoices?q=INV-1',{headers:{'X-Rcm-Scope':'ALL:AED','X-Reference-Branch':'hq','X-Unrelated':'ignored'}}),{params:Promise.resolve({segments:['reference-modules','rcm','api','records','invoices']})});
 expect(response.status).toBe(200);const [url,init]=(send.mock.calls as unknown as [string,RequestInit][])[0]!;expect(url).toBe('http://127.0.0.1:3330/reference-modules/rcm/api/records/invoices?q=INV-1');const headers=new Headers(init.headers);expect(headers.get('X-Rcm-Scope')).toBe('ALL:AED');expect(headers.get('X-Reference-Branch')).toBe('hq');expect(headers.has('X-Unrelated')).toBe(false);
});
it('forwards Teleconsult role, patient and replay headers without interpreting their grants',async()=>{
 vi.stubEnv('HEALTHCARE_API_URL','http://127.0.0.1:3330');const send=vi.fn(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',send);
 await GET(new NextRequest('http://localhost/api/reference-modules/teleconsult-patient/api/session',{headers:{'X-Teleconsult-Role':'nurse','X-Teleconsult-Patient':'p8','Idempotency-Key':'synthetic-operation'}}),{params:Promise.resolve({segments:['reference-modules','teleconsult-patient','api','session']})});
 const headers=new Headers((send.mock.calls as unknown as [string,RequestInit][])[0]![1].headers);expect(headers.get('X-Teleconsult-Role')).toBe('nurse');expect(headers.get('X-Teleconsult-Patient')).toBe('p8');expect(headers.get('Idempotency-Key')).toBe('synthetic-operation');
});
