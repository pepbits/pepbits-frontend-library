import {renderHook} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {createRequest,readJson,RequestContext,useRequest} from './http';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
test('configured origin, authenticated transport, product override and request options survive composition',async()=>{
 const fetch=vi.fn(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',fetch);localStorage.setItem('pepbits-session-token','fixture');
 const signal=new AbortController().signal,request=createRequest('http://localhost:3100','example');
 await request('/items',{method:'PUT',headers:{'X-Product-Id':'wrong','X-Custom':'value'},body:'{}',signal});
 expect(fetch).toHaveBeenCalledOnce();const [url,init]=fetch.mock.calls[0] as unknown as [string,RequestInit];
 expect(url).toBe('http://localhost:3100/items');expect(init).toMatchObject({method:'PUT',body:'{}'});expect(init.signal).toBeInstanceOf(AbortSignal);
 const headers=new Headers(init.headers);expect(headers.get('X-Product-Id')).toBe('example');expect(headers.get('X-Custom')).toBe('value');expect(headers.get('Authorization')).toBe('Bearer fixture');
});
test.each(['https://invalid.example/path','//invalid.example/path','items'])('rejects a nonrelative API path before sending: %s',path=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect(()=>createRequest('/api','example')(path)).toThrow('Invalid API path');expect(fetch).not.toHaveBeenCalled();
});
test('structured errors retain status; invalid responses and absent providers fail explicitly',async()=>{
 await expect(readJson(Response.json({error:'Revision conflict'},{status:409}))).rejects.toMatchObject({status:409,message:'Revision conflict'});
 await expect(readJson(new Response('<html>',{status:503}))).rejects.toMatchObject({status:503,message:'The service request failed.'});
 await expect(readJson(new Response('broken'))).rejects.toMatchObject({status:502});
 expect(()=>renderHook(useRequest)).toThrow('API request provider is missing');
 const request=vi.fn();expect(renderHook(useRequest,{wrapper:({children})=><RequestContext.Provider value={request}>{children}</RequestContext.Provider>}).result.current).toBe(request);
});
test('valid JSON payloads return unchanged',async()=>{expect(await readJson(Response.json({rows:[]}))).toEqual({rows:[]});});
