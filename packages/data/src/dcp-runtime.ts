import {isDcpLoaded,isDcpSaved,isDcpRevision,isDcpValues,type DcpLoaded,type DcpSaved,type DcpSave} from './contracts/dcp-runtime';
import {WorkflowRequestFailure} from './workflow-failure';
export interface DcpRuntimeAdapter {load(signal?:AbortSignal):Promise<DcpLoaded>;preview(command:DcpSave,signal?:AbortSignal):Promise<DcpSaved>;save(command:DcpSave,signal?:AbortSignal):Promise<DcpSaved>}
/** Authenticated host request and record-bound paths. No route is installed or inferred here. */
export function createDcpRuntimeAdapter(request:(path:string,init:RequestInit)=>Promise<Response>,paths:{load:string;preview:string;save:string}):DcpRuntimeAdapter{
 async function call(action:keyof typeof paths,body?:DcpSave,signal?:AbortSignal){
  const path=paths[action];if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw new WorkflowRequestFailure(400,{form:'designer.invalid'});
  if(body&&(!isDcpRevision(body.expectedVersion)||!isDcpValues(body.patch)||!['PINNED','LIVE'].includes(body.mode)||!body.checksum))throw new WorkflowRequestFailure(400,{form:'designer.invalidValues'});
  const abort=new AbortController(),cancel=()=>abort.abort();if(signal?.aborted)cancel();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,30000);
  try{const r=await request(path,{method:action==='load'?'GET':'POST',headers:{'Content-Type':'application/json','Pepbits-Contract-Version':'1'},body:body?JSON.stringify(body):undefined,signal:abort.signal});const payload:unknown=await r.json();
   if((r.ok||r.status===422)&&(action==='load'?isDcpLoaded(payload):isDcpSaved(payload))){if(r.status===422&&!(payload as DcpSaved).view.violations.length)throw new WorkflowRequestFailure(502,{form:'designer.invalidResponse'});return payload;}
   throw new WorkflowRequestFailure(r.ok?502:r.status,{form:r.ok?'designer.invalidResponse':'designer.hostError'},r.headers.get('X-Sentinel-Reference')??undefined);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 return {load:signal=>call('load',undefined,signal) as Promise<DcpLoaded>,preview:(body,signal)=>call('preview',body,signal) as Promise<DcpSaved>,save:(body,signal)=>call('save',body,signal) as Promise<DcpSaved>};
}

export * from "./contracts/dcp-runtime";
