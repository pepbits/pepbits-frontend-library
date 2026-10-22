export type RecordPanelScope = [productId:string,pageId:string,recordId:string];
export interface PanelItem {id:string;authorId:string;author:string;createdAt:string}
export interface AttachmentItem extends PanelItem {name:string;size:number}
export interface CommentItem extends PanelItem {text:string}
export interface RelatedItem extends PanelItem {pageId:string;recordId:string;label:string}
export interface ActivityItem extends PanelItem {detail:string;messageKey?:string;messageValues?:Record<string,string|number>}
export interface RecordPanels {permissions?:{write:boolean};attachments:AttachmentItem[];comments:CommentItem[];related:RelatedItem[];activity:ActivityItem[]}
export type PanelChange = {action:'comment';text:string}|{action:'upload';name:string;content:string}|{action:'link';pageId:string;recordId:string;label:string}|{action:'remove';collection:'attachments'|'comments'|'related';id:string};
export interface RecordPanelsAdapter {
 load(scope:RecordPanelScope,signal?:AbortSignal):Promise<RecordPanels>;
 change(scope:RecordPanelScope,change:PanelChange,operationId:string):Promise<RecordPanels>;
 download(scope:RecordPanelScope,id:string):Promise<{name:string;content:string}>;
}
export class RecordPanelsError extends Error { constructor(message:string,public status:number){super(message);} }
export function createHttpRecordPanelsAdapter(request:(path:string,init?:RequestInit)=>Promise<Response>):RecordPanelsAdapter {
 const call=async(scope:RecordPanelScope,body:object,signal?:AbortSignal)=>{
  const response=await request('/record-panels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope,...body}),signal});
  const data=await response.json().catch(()=>null);if(!response.ok)throw new RecordPanelsError(data?.error??(response.status===413?'This file exceeds the service request limit. Choose a smaller file.':'Record panels are unavailable.'),response.status);
  if(!data||typeof data!=='object')throw new Error('Invalid record panel response.');
  if ('action' in body && body.action !== 'download') {
    for(const [key,fields] of Object.entries({attachments:['name'],comments:['text'],related:['pageId','recordId','label'],activity:['detail']})) {
      if(!Array.isArray(data[key]) || data[key].some((item:Record<string,unknown>)=>!item || [...fields,'id','authorId','author','createdAt'].some(field=>typeof item[field] !== 'string'))) throw new Error('Invalid record panel response.');
    }
  }
  return data;
 };
 return {load:(scope,signal)=>call(scope,{action:'list'},signal),change:(scope,change,operationId)=>call(scope,{...change,operationId}),download:(scope,id)=>call(scope,{action:'download',id})};
}
