import {readFileSync} from 'node:fs';
const registry=JSON.parse(readFileSync(new URL('./config/api-messages.json',import.meta.url),'utf8'));
/** Language-neutral display metadata. Keep original text for old clients and diagnostics. */
export function describeMessage(message) {
 if(typeof message!=='string')return undefined;
 if(Object.hasOwn(registry,message))return {messageKey:registry[message],messageValues:{}};
 for(const [prefix,key] of [['Submitted for ','api.approval.submitted'],['Advanced to ','api.approval.advanced']])if(message.startsWith(prefix))return {messageKey:key,messageValues:{stage:message.slice(prefix.length)}};
 return undefined;
}
export function messageMetadata(message) {
 return describeMessage(message)??{messageKey:'api.error.unknown',messageValues:{detail:String(message)}};
}
export function withMessageMetadata(body) {
 if(!body||typeof body!=='object'||Array.isArray(body))return body;
 const result={...body};
 if(typeof body.error==='string')result.errorMessage=messageMetadata(body.error);
 if(Array.isArray(body.results))result.results=body.results.map(withMessageMetadata);
 if(Array.isArray(body.notifications))result.notifications=body.notifications.map(item=>({...item,...messageMetadata(item.message)}));
 if(Array.isArray(body.activity))result.activity=body.activity.map(item=>({...item,...messageMetadata(item.detail)}));
 return result;
}
