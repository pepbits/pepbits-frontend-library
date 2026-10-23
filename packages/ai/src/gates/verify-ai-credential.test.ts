import {expect,test,vi} from 'vitest';
import {createAiClientWithRequest} from '../client';
// Synthetic bytes exist only in this test's memory. No backend vault or log acceptance is claimed.
test('a credential is sent once through the dedicated write path',async()=>{
  const request=vi.fn().mockResolvedValue(new Response(null,{status:204}));
  const client=createAiClientWithRequest(request,()=> 'operational');
  const secret=Array.from({length:16},()=>String.fromCharCode(97+Math.floor(Math.random()*26))).join('');
  const result=await client.setAiCredential(secret);
  expect(request.mock.calls[0]![0]).toBe('/ai/config/credential');
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({secret});
  expect(JSON.stringify(result).includes(secret)).toBe(false);
});
test('config reads, usage and verification request no credential value',async()=>{
  const request=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({configured:false,hint:null,fingerprint:null})));
  const client=createAiClientWithRequest(request,()=> 'operational');
  await client.fetchAiConfig();await client.fetchAiUsage();await client.verifyAiCredential();
  expect(request.mock.calls.map(call=>call[0])).toEqual(['/ai/config','/ai/usage','/ai/config/credential/verify']);
  expect(request.mock.calls.every(call=>call[1]?.body===undefined)).toBe(true);
});
test('a normal config patch contains only the host patch and removal has no body',async()=>{
  const request=vi.fn().mockResolvedValue(new Response(null,{status:204}));
  const client=createAiClientWithRequest(request,()=> 'operational');
  await client.saveAiConfig({limits:{requestsPerMinute:3,tokensPerDay:20,maxContextFields:5}});
  expect(Object.keys(JSON.parse(request.mock.calls[0]![1].body))).toEqual(['limits']);
  await client.clearAiCredential();expect(request.mock.calls[1]).toEqual(['/ai/config/credential',{method:'DELETE'}]);
});
