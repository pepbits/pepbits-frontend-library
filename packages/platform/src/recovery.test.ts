import {it,expect,vi,afterEach} from 'vitest';
import {recoveryRequest} from './recovery';
import {subscribeSentinel} from './sentinel';
afterEach(()=>{vi.useRealTimers();subscribeSentinel(()=>{})();});
it('aborts a stalled request, reports one traceable timeout, and never retries a write automatically',async()=>{
 vi.useFakeTimers();const events:unknown[]=[];const stop=subscribeSentinel(e=>events.push(e));
 const send=vi.fn((_path,init)=>new Promise<Response>((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('SECRET','AbortError')))));
 const pending=recoveryRequest(send,'/records',{method:'PUT',body:'PRIVATE'},50).catch(e=>e);
 await vi.advanceTimersByTimeAsync(50);const error=await pending;
 expect(error.status).toBe(408);expect(error.reference).toMatch(/^[a-f0-9-]{36}$/);expect(send).toHaveBeenCalledOnce();expect(events).toHaveLength(1);expect(JSON.stringify(events)).not.toMatch(/SECRET|PRIVATE/);expect(events[0]).toMatchObject({id:error.reference,code:'request-timeout'});stop();
});
it.each([401,403,422,429,503])('preserves HTTP %i and returns the collected reference',async status=>{
 const events:unknown[]=[];const stop=subscribeSentinel(e=>events.push(e));const response=await recoveryRequest(async()=>new Response('{}',{status}),'/records');
 expect(response.status).toBe(status);expect(events[0]).toMatchObject({id:response.headers.get('X-Sentinel-Reference'),status});stop();
});
it('caller cancellation is not a service timeout and does not produce an incident',async()=>{
 const events:unknown[]=[];const stop=subscribeSentinel(e=>events.push(e));const controller=new AbortController();controller.abort();
 await expect(recoveryRequest(async()=>{throw new DOMException('Cancelled','AbortError');},'/records',{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(events).toHaveLength(0);stop();
});
it('keeps the JSON deadline active after response headers arrive',async()=>{
 vi.useFakeTimers();const send=async(_path:string,init:RequestInit)=>new Response(new ReadableStream({start(controller){init.signal?.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')));}}),{headers:{'Content-Type':'application/json'}});
 const result=recoveryRequest(send,'/records',{},50).catch(error=>error);await vi.advanceTimersByTimeAsync(50);expect(await result).toMatchObject({status:408});
});
it('caller cancellation still reaches a streaming body after headers are returned',async()=>{
 const parent=new AbortController();const send=async(_path:string,init:RequestInit)=>new Response(new ReadableStream({start(controller){init.signal?.addEventListener('abort',()=>controller.error(new DOMException('Cancelled','AbortError')));}}),{headers:{'Content-Type':'text/event-stream'}});
 const response=await recoveryRequest(send,'/stream',{signal:parent.signal});const result=response.text().catch(error=>error);parent.abort();expect(await result).toMatchObject({name:'AbortError'});
});

it('exports the data failure class and never reports monitoring requests recursively', async () => {
 const {RequestFailure: dataFailure} = await import('@pepbits/data');
 const {RequestFailure: platformFailure} = await import('./auth');
 expect(platformFailure).toBe(dataFailure);
 const events: unknown[] = []; const stop = subscribeSentinel(event => events.push(event));
 try {
  const send = vi.fn(async () => new Response('{}', {status: 503}));
  expect((await recoveryRequest(send, '/monitoring/events')).status).toBe(503);
  expect(send).toHaveBeenCalledOnce(); expect(events).toEqual([]);
 } finally { stop(); }
});
