import {test,expect,vi} from 'vitest';
import {isDcpLoaded,isDcpRuntimeView,isDcpRevision,dcpWritablePatch} from './contracts/dcp-runtime';
import {createDcpRuntimeAdapter} from './dcp-runtime';
import loaded from './fixtures/dcp-v1/loaded.json';
import validation from './fixtures/dcp-v1/validation.json';

test('actual-engine fixture preserves required false, null, row identities and exact long revisions',()=>{
 expect(isDcpLoaded(loaded)).toBe(true);expect(isDcpRevision('9223372036854775807')).toBe(true);expect(isDcpRevision('9223372036854775808')).toBe(false);
 expect(isDcpLoaded({...loaded,version:0})).toBe(false);
 expect(isDcpLoaded({...loaded,view:{...loaded.view,values:{rating:9007199254740992}}})).toBe(false);
 const view=structuredClone(loaded.view);view.sections[0]!.fields[0]!.type='EXECUTABLE';expect(isDcpRuntimeView(view)).toBe(false);
});
test('patches omit hidden/read-only/masked fields and require per-row authorization',()=>{
 if(!isDcpLoaded(loaded))throw Error('Fixture');const view:import('./contracts/dcp-runtime').DcpRuntimeView=structuredClone(loaded.view);view.sections[0]!.fields.find(f=>f.code==='name')!.writable=false;view.sections[0]!.fields.find(f=>f.code==='amount')!.masked=true;
 expect(dcpWritablePatch(view,{name:'forged',hidden:'forged',amount:44,consent:false,notes:null,observations:[{_id:'row-1',note:'changed'},{_localKey:'private-ui-key',note:'new'}]})).toEqual({consent:false,notes:null,observations:[{_id:'row-1',note:'changed'},{note:'new'}]});
 view.rowFields={};expect(dcpWritablePatch(view,{observations:[{_id:'row-1',note:'forged'}]})).toEqual({observations:[]});
});
test('422 is filtered validation, revisions stay strings, and saves are never auto-retried',async()=>{
 const request=vi.fn().mockResolvedValue(new Response(JSON.stringify(validation),{status:422}));const adapter=createDcpRuntimeAdapter(request,{load:'/owner/form',preview:'/owner/form/preview',save:'/owner/form/save'});
 const command={expectedVersion:'9007199254740993',checksum:loaded.view.checksum,mode:'PINNED' as const,patch:{consent:false,rating:11}};
 const result=await adapter.save(command);expect(result.view.violations[0]!.code).toBe('MAXIMUM');expect(JSON.parse(request.mock.calls[0]![1]!.body).expectedVersion).toBe(command.expectedVersion);expect(request).toHaveBeenCalledTimes(1);
 request.mockResolvedValue(new Response('{}',{status:409}));await expect(adapter.save(command)).rejects.toMatchObject({status:409});expect(request).toHaveBeenCalledTimes(2);
});
test('caller cancellation reaches transport and endpoints must remain host-relative',async()=>{
 const request=vi.fn(async(_p:string,init:RequestInit)=>{expect(init.signal?.aborted).toBe(true);throw new DOMException('Aborted','AbortError');});const signal=new AbortController();signal.abort();
 await expect(createDcpRuntimeAdapter(request,{load:'/load',preview:'/preview',save:'/save'}).load(signal.signal)).rejects.toThrow('Aborted');
 await expect(createDcpRuntimeAdapter(request,{load:'//external',preview:'/preview',save:'/save'}).load()).rejects.toMatchObject({status:400});
});
