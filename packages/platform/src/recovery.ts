import {reportSentinelFailure,sentinelReference} from './sentinel';
import {RequestFailure} from '@pepbits/data';
export {RequestFailure} from '@pepbits/data';
export async function recoveryRequest(fetcher:(path:string,init:RequestInit)=>Promise<Response>,path:string,init:RequestInit={},timeoutMs=30000):Promise<Response>{
 if(path.startsWith('/monitoring/'))return fetcher(path,init);
 const controller=new AbortController();let timedOut=false,streamOwnsAbort=false;
 const abort=()=>controller.abort(init.signal?.reason);
 if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
 const releaseAbort=()=>init.signal?.removeEventListener('abort',abort);
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 const report=(status?:number)=>{const id=sentinelReference();reportSentinelFailure({id,kind:'request',code:status===408?'request-timeout':'request-failed',status});return id;};
 try{
  let response=await fetcher(path,{...init,signal:controller.signal});
  // JSON consumers need the complete body. Keep their deadline active after
  // headers arrive; streaming responses retain their existing stream contract.
  if(![204,205,304].includes(response.status)&&response.headers.get('Content-Type')?.includes('application/json')) {
    const body=await response.text();const headers=new Headers(response.headers);
    headers.delete('Content-Length');headers.delete('Content-Encoding');
    response=new Response(body,{status:response.status,statusText:response.statusText,headers});
  }
  if(init.signal&&response.body&&!response.headers.get('Content-Type')?.includes('application/json')) {
    // A stream can outlive its headers. Forward cancellation until consumption
    // or explicit cancellation finishes, then release the parent listener.
    const reader=response.body.getReader();streamOwnsAbort=true;
    const body=new ReadableStream<Uint8Array>({
      async pull(target){try{const next=await reader.read();if(next.done){releaseAbort();target.close();}else target.enqueue(next.value);}catch(error){releaseAbort();target.error(error);}},
      cancel(reason){releaseAbort();return reader.cancel(reason);},
    });
    response=new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
  }
  if(response.ok)return response;
  const headers=new Headers(response.headers);headers.set('X-Sentinel-Reference',report(response.status));
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }catch(error){
  if(init.signal?.aborted)throw error;
  throw new RequestFailure(timedOut?408:undefined,report(timedOut?408:undefined));
 }finally{clearTimeout(timer);if(!streamOwnsAbort)releaseAbort();}
}
