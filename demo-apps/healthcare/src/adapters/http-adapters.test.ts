import {describe,expect,test,vi} from 'vitest';
import {createClinicalTemplateAdapter} from './clinical-templates';
import {createClinicalTriageAdapter} from './clinical-triage';
import {createClinicalConsultationAdapter} from './clinical-consultation';
import {createComprehensiveConsultationAdapter} from './comprehensive-consultation';
import {createClinicBillingAdapter} from './clinic-billing';
import {createRegistrationAdapter} from './op-registration';
import {createCareAdapter} from './care-pages';
import type {Request} from './http';
const cases:[string,(request:Request)=>Promise<unknown>][]=[
 ['/clinical-templates',r=>createClinicalTemplateAdapter(r,'demo').load('PT-0001')],
 ['/clinical-triage',r=>createClinicalTriageAdapter(r,'demo').load('PT-0001')],
 ['/clinical-consultation',r=>createClinicalConsultationAdapter(r,'demo').load('PT-0001')],
 ['/comprehensive-consultation',r=>createComprehensiveConsultationAdapter(r,'demo').load('PT-0001')],
 ['/clinic-billing',r=>createClinicBillingAdapter(r,'demo').load('PT-0001')],
 ['/op-registration',r=>createRegistrationAdapter(r,'demo').load('PT-0001')],
 ['/care-pages',r=>createCareAdapter(r,'demo').command({pageId:'inpatient-admission',action:'load'})],
];
describe.each(cases)('%s HTTP adapter',(path,invoke)=>{
 test('passes the product scope and read command to the supplied client',async()=>{const request=vi.fn<Request>().mockResolvedValue(Response.json({fixture:true}));expect(await invoke(request)).toEqual({fixture:true});const [url,init]=request.mock.calls[0]!;expect(url).toBe(path);expect(init?.method).toBe('POST');expect(new Headers(init?.headers).get('X-Product-Id')).toBe('demo');expect(JSON.parse(String(init?.body)).action).toBe('load');});
 test.each([403,409,422,503])('preserves failure status %s and validation details',async status=>{const request=vi.fn<Request>().mockResolvedValue(Response.json({fieldErrors:{name:'Required'},reference:'fictional-reference'},{status}));await expect(invoke(request)).rejects.toMatchObject({status,fieldErrors:{name:'Required'}});});
 test('rejects malformed successful responses',async()=>{const request=vi.fn<Request>().mockResolvedValue(new Response('broken'));await expect(invoke(request)).rejects.toMatchObject({status:502});});
});
test('patient search forwards cancellation',async()=>{const request=vi.fn<Request>().mockResolvedValue(Response.json({rows:[]}));const controller=new AbortController();await createClinicalTemplateAdapter(request,'demo').search({q:'fictional'},{signal:controller.signal});expect(request.mock.calls[0]![1]?.signal).toBe(controller.signal);});
