import {expect,test,vi} from 'vitest';
import {createAiClientWithRequest} from '../client';
import {context,useCase} from '../ui/fixtures.test-support';
// The old launcher starts a protected backend and writes a credential. This checks client isolation only.
test('independent host clients never share request or policy state',async()=>{
  const first=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'Budget exhausted'}),{status:429}));
  const second=vi.fn().mockResolvedValue(new Response(JSON.stringify({text:'Accepted'})));
  const a=createAiClientWithRequest(first,()=> 'operational'),b=createAiClientWithRequest(second,()=> 'operational');
  expect((await a.dispatchAi(context(),useCase())).ok).toBe(false);
  expect((await b.dispatchAi(context(),useCase())).text).toBe('Accepted');
  expect(first).toHaveBeenCalledOnce();expect(second).toHaveBeenCalledOnce();
});
