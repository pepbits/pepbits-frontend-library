import {expect,test} from 'vitest';
import {DEFAULT_DRAFT_POLICY,filterDraftValues,mergeDraftValues,parseDraftPolicy} from './draft-policy';
test('nested exclusions apply to every array element and preserve unrelated fields',()=>{
 const result=filterDraftValues({email:'e',lines:[{notes:'private',amount:4},{notes:'private2',amount:5}],notes:'keep'}, {...DEFAULT_DRAFT_POLICY,excludedFields:['email','lines.notes']});
 expect(result.values).toEqual({lines:[{amount:4},{amount:5}],notes:'keep'});
 expect(mergeDraftValues({name:'saved',password:'',lines:[{notes:'',amount:0}]},{lines:[{amount:4}]})).toEqual({name:'saved',password:'',lines:[{notes:'',amount:4}]});
});
test('invalid policies and prototype fields are rejected or removed',()=>{
 for(const input of [{retentionDays:0},{retentionDays:31},{retentionDays:1.5},{excludedFields:['*']},{revision:-1},{enabled:'yes'},{extra:true}])expect(()=>parseDraftPolicy({...DEFAULT_DRAFT_POLICY,...input})).toThrow();
 expect(filterDraftValues(JSON.parse('{"__proto__":{"polluted":true},"safe":"yes"}'),DEFAULT_DRAFT_POLICY).values).toEqual({safe:'yes'});
});
