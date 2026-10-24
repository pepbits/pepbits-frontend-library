import {expect,test,vi} from 'vitest';
import {loadPreferences,savePreferences,type PreferenceSnapshot} from './preference-service';
const snapshot:PreferenceSnapshot={preferences:{density:'spacious'},overrides:{density:'spacious',reducedMotion:true},policy:{revision:7,rules:{density:{value:'compact',locked:true},theme:{value:'sand',allowedValues:['sand','nord'],locked:false}}},userRevision:4,canManage:false};
test('load validates policy while retaining revisions and capabilities',async()=>{
 const request=vi.fn(async()=>Response.json(snapshot));expect(await loadPreferences(request)).toEqual(snapshot);expect(request).toHaveBeenCalledWith('/preferences');
});
test('save merges accepted overrides, enforces locks/allowed values and includes both revisions',async()=>{
 const request=vi.fn(async()=>Response.json({...snapshot,userRevision:5}));const next=await savePreferences(request,snapshot,{density:'comfortable',theme:'midnight',pageSize:50});
 const [path,init]=request.mock.calls[0] as unknown as [string,RequestInit];expect(path).toBe('/preferences');expect(init.method).toBe('PUT');
 const body=JSON.parse(String(init.body));expect(body).toMatchObject({policyRevision:7,userRevision:4,preferences:{pageSize:50,reducedMotion:true}});expect(body.preferences).not.toHaveProperty('density');expect(body.preferences).not.toHaveProperty('theme');expect(next.userRevision).toBe(5);expect(snapshot.overrides.density).toBe('spacious');
});
test('policy and HTTP failures are not accepted as preference snapshots',async()=>{
 await expect(loadPreferences(async()=>Response.json({...snapshot,policy:{revision:-1,rules:{}}}))).rejects.toThrow();
 await expect(savePreferences(async()=>Response.json({error:'Stale revision'},{status:409}),snapshot,{})).rejects.toMatchObject({status:409,message:'Stale revision'});
});
