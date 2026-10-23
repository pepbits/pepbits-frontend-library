import {isDesignerView,type DesignerCommand,type DesignerView} from './contracts/dcp-designer';
import {WorkflowRequestFailure} from './workflow-failure';
export interface DesignerAdapter {command(input:DesignerCommand):Promise<DesignerView>}
export function createDesignerAdapter(request:(path:string,init?:RequestInit)=>Promise<Response>,product:string,path:string):DesignerAdapter{return {async command(input){const r=await request(path,{method:'POST',headers:{'Content-Type':'application/json','X-Product-Id':product},body:JSON.stringify(input)});const body=await r.json();if(!r.ok)throw new WorkflowRequestFailure(r.status,body.fieldErrors??{form:body.error});if(!isDesignerView(body))throw new WorkflowRequestFailure(502,{form:'designer.invalidResponse'});return body;}};}

export * from "./contracts/dcp-designer";
export * from "./contracts/dcp-rules";
export * from "./contracts/dcp-lifecycle";
export * from "./contracts/dcp-catalog";
export * from "./contracts/designer-fields";
