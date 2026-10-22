import {expect,test,vi} from 'vitest';
import {createHttpDraftCenterAdapter} from './drafts';
const item={id:'a'.repeat(64),productId:'app',kind:'form' as const,version:1,savedAt:'2026-09-08T12:00:00Z',expiresAt:'2026-09-15T12:00:00Z',status:'ready' as const,pageId:'customers',recordId:'A'};
test('malformed or cross-application responses cannot become navigation targets',async()=>{
 for(const invalid of [{...item,productId:'other'},{...item,savedAt:'invalid'},{...item,status:'unavailable'}]){
  const adapter=createHttpDraftCenterAdapter(async()=>Response.json({item:invalid}));await expect(adapter.open('app',item)).rejects.toMatchObject({status:502});
 }
});
test('discard sends only the reference and revision, and carries safe failure metadata',async()=>{
 const request=vi.fn().mockResolvedValue(new Response('{}',{status:503,headers:{'X-Sentinel-Reference':'incident-test'}}));const adapter=createHttpDraftCenterAdapter(request);
 await expect(adapter.discard('app',item,'operation')).rejects.toMatchObject({status:503,reference:'incident-test'});
 expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({action:'discard',id:item.id,version:1,operationId:'operation'});
});
