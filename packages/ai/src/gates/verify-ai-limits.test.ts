import {expect,test,vi} from 'vitest';
import {createAiClientWithRequest} from '../client';
import {context,useCase} from '../ui/fixtures.test-support';
// Server admission/default counters belong to the host. These tests cover the real client's refusals.
test.each([['minute','Minute budget exhausted'],['daily','Daily token budget exhausted'],['user','User budget exhausted']])('%s refusal is preserved and cannot become an echo success',async(_kind,error)=>{
  const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({error,detail:'Retry later'}),{status:429,headers:{'Retry-After':'30'}}));
  const client=createAiClientWithRequest(request,()=> 'operational');
  expect(await client.dispatchAi(context(),useCase())).toEqual({ok:false,via:'service',error,detail:'Retry later'});
  expect(request).toHaveBeenCalledOnce();
});
test('credential verification preserves the shared-budget refusal',async()=>{
  const client=createAiClientWithRequest(async()=>new Response(JSON.stringify({error:'Budget exhausted'}),{status:429}),()=> 'operational');
  expect(await client.verifyAiCredential()).toMatchObject({ok:false,status:429,error:'Budget exhausted'});
});
test('usage carries server default flags and effective limits without inventing local limits',async()=>{
  const usage={requestsPerMinute:20,tokensPerDay:200000,limitsAreDefaults:true};
  const client=createAiClientWithRequest(async()=>new Response(JSON.stringify(usage)),()=> 'operational');
  expect((await client.fetchAiUsage()).data).toEqual(usage);
});
