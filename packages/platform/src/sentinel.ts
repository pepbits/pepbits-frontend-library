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
export class SentinelQueue {
 private pending:SentinelEvent[]=[];private busy=false;private failures=0;private next=0;private stopped=false;
 private send:(events:SentinelEvent[])=>Promise<void>;private now:()=>number;
 constructor(send:(events:SentinelEvent[])=>Promise<void>,now=()=>Date.now()){this.send=send;this.now=now;}
 capture(event:unknown){try{const safe=sanitizeSentinelEvent(event);if(!safe||this.stopped)return;const duplicate=safe.kind!=='request'&&safe.kind!=='render'&&this.pending.some(e=>e.kind===safe.kind&&e.code===safe.code&&e.pageId===safe.pageId&&e.line===safe.line&&e.column===safe.column&&e.status===safe.status);if(!duplicate)this.pending=[...this.pending,safe].slice(-50);}catch{/* Monitoring must never interrupt an application operation. */}}
 async flush(){if(this.busy||this.stopped||!this.pending.length||this.now()<this.next)return;this.busy=true;const batch=this.pending.slice(0,10);try{await this.send(batch);this.pending=this.pending.filter(e=>!batch.some(sent=>sent.id===e.id));this.failures=0;this.next=0;}catch{this.failures=Math.min(this.failures+1,6);this.next=this.now()+Math.min(60000,1000*2**this.failures);}finally{this.busy=false;}}
 stop(){this.stopped=true;this.pending=[];}
 get size(){return this.pending.length;}
}
/** Explicit operation failures from imports, exports or native adapters. */
export function reportOperationFailure(kind:'operation'|'native'='operation'){
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('pepbits-sentinel',{detail:{kind,code:kind==='native'?'native-command-failed':'operation-failed'}}));
}
let sink:((detail:Partial<SentinelEvent>)=>void)|undefined;
let early:Partial<SentinelEvent>[]=[];
export function reportSentinelFailure(detail:Partial<SentinelEvent>){
 try{const safe={kind:detail.kind,code:detail.code,id:detail.id,status:detail.status,line:detail.line,column:detail.column};
 if(sink)sink(safe);else early=[...early,safe].slice(-10);
 }catch{/* A broken observer must not replace the original application error. */}
}
export function subscribeSentinel(listener:(detail:Partial<SentinelEvent>)=>void){sink=listener;const held=early;early=[];held.forEach(listener);return()=>{if(sink===listener){sink=undefined;early=[];}};}

export function sentinelReference():string {
 try{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();}catch{}
 // A diagnostic reference, never an authentication credential.
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16);});
}
