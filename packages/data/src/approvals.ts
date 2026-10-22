export interface ApprovalStage {name:string;roles:string[]}
export interface ApprovalItem {
 recordId:string;requesterId:string;requester:string;version:number;
 status:'pending'|'approved'|'rejected'|'changes-requested';stage:number;stages:ApprovalStage[];
 canAct:boolean;canSubmit:boolean;recordChanged?:boolean;
 history:Array<{id:string;action:string;comment:string;actor:string;at:string;stage:string}>;
}
export interface ApprovalData {
 config:{version:number;stages:ApprovalStage[]};canConfigure:boolean;items:ApprovalItem[];
 notifications:Array<{id:string;recordId:string;message:string;messageKey?:string;messageValues?:Record<string,string|number>;read:boolean;at:string}>;
 results?:Array<{recordId:string;ok:boolean;error?:string;errorMessage?:{messageKey:string;messageValues:Record<string,string|number>}}>;
}
export type ApprovalChange=
 |{action:'submit';recordId:string;version:number;comment:string}
 |{action:'configure';version:number;stages:ApprovalStage[]}
 |{action:'decide';items:Array<{recordId:string;version:number}>;decision:'approve'|'reject'|'request-changes';comment:string}
 |{action:'mark-read';ids:string[]};
export interface ApprovalAdapter {
 read(scope:[string,string],recordId?:string):Promise<ApprovalData>;
 change(scope:[string,string],change:ApprovalChange,operationId:string,recordId?:string):Promise<ApprovalData>;
}
export class ApprovalError extends Error {constructor(message:string,public status:number,public reference?:string){super(message);}}
export function createHttpApprovalAdapter(request:(path:string,init?:RequestInit)=>Promise<Response>):ApprovalAdapter {
 const call=async(body:object):Promise<ApprovalData>=>{
  const response=await request('/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new ApprovalError(data?.error??'Approval service unavailable. Retry the same action.',response.status,response.headers.get("X-Sentinel-Reference")??undefined);
  if(!data||!Array.isArray(data.items)||!Array.isArray(data.notifications)||!Array.isArray(data.config?.stages)||data.items.some((item:ApprovalItem)=>!item||!Array.isArray(item.history)||!Array.isArray(item.stages)||typeof item.recordId!=='string'||!['pending','approved','rejected','changes-requested'].includes(item.status)))throw new Error('Invalid approval service response.');
  return data;
 };
 return {read:(scope,recordId)=>call({scope,recordId,action:'read'}),change:(scope,change,operationId,recordId)=>call({scope,recordId,...change,operationId})};
}
