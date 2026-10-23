import {isDesignerView,type DesignerCommand,type DesignerView} from './contracts/dcp-designer';
import {WorkflowRequestFailure} from './workflow-failure';
import type {DesignerAdapter} from './dcp-designer';
/** Host-owned wire conversion. Endpoints/codecs are application code, never tenant metadata. */
export interface DcpHostContract {decodeError?:(payload:unknown,status:number)=>{fieldErrors:Record<string,string>;reference?:string};encode:(command:DesignerCommand)=>{path:string;method:'GET'|'POST'|'PUT';body?:unknown};decode:(payload:unknown,command:DesignerCommand)=>unknown}
export function createDcpHostAdapter(request:(path:string,init:RequestInit)=>Promise<Response>,contract:DcpHostContract):DesignerAdapter{return {async command(command):Promise<DesignerView>{
 const wire=contract.encode(command);if(!wire.path.startsWith('/')||wire.path.startsWith('//')||wire.path.includes('\\')||!['GET','POST','PUT'].includes(wire.method))throw new WorkflowRequestFailure(400,{form:'designer.invalid'});
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
 try{const response=await request(wire.path,{method:wire.method,headers:{'Content-Type':'application/json'},body:wire.body===undefined?undefined:JSON.stringify(wire.body),signal:abort.signal});let payload:unknown;try{payload=await response.json();}catch{throw new WorkflowRequestFailure(502,{form:'designer.invalidResponse'});}
 if(!response.ok){const error=contract.decodeError?.(payload,response.status);throw new WorkflowRequestFailure(response.status,error?.fieldErrors??{form:'designer.hostError'},error?.reference);}const value=contract.decode(payload,command);if(!isDesignerView(value))throw new WorkflowRequestFailure(502,{form:'designer.invalidResponse'});return value;
 }finally{clearTimeout(timer);}
 }};}

export * from "./contracts/dcp-designer";
