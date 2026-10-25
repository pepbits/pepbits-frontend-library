/** Diagnostic allowlist. Never pass exception messages, bodies or form values. */
export type SentinelKind='runtime'|'promise'|'render'|'request'|'operation'|'native';
export interface SentinelEvent {id:string;kind:SentinelKind;code:string;pageId:string;release:string;platform:'web'|'native';status?:number;line?:number;column?:number;breadcrumbs:string[]}
const codes=new Set(['runtime-error','unhandled-rejection','render-error','request-failed','request-timeout','operation-failed','native-command-failed','native-panic']);
const kinds=new Set(['runtime','promise','render','request','operation','native']);
const route=/^[a-z][a-z0-9-]{0,79}$/;
export function sanitizeSentinelEvent(value:unknown):SentinelEvent|null {
 if(!value||typeof value!=='object')return null;const e=value as SentinelEvent;
 if(!kinds.has(e.kind)||!codes.has(e.code)||typeof e.id!=='string'||!/^[a-f0-9-]{36}$/.test(e.id)||!route.test(e.pageId)||typeof e.release!=='string'||!/^\d{4}-\d{2}-\d{2}-[a-z-]{1,40}$/.test(e.release))return null;
 const number=(n:unknown,max:number)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=max?Number(n):undefined;
 return {id:e.id,kind:e.kind,code:e.code,pageId:e.pageId,release:e.release,platform:e.platform==='native'?'native':'web',status:number(e.status,599),line:number(e.line,10000000),column:number(e.column,10000000),breadcrumbs:Array.isArray(e.breadcrumbs)?e.breadcrumbs.filter(item=>typeof item==='string'&&route.test(item)).slice(-8):[]};
}
