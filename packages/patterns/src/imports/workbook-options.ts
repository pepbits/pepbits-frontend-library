export interface WorkbookOptionsSheet {name:string;headers:string[];rows:string[][]}
export function readOptionsWorkbook(data:ArrayBuffer,signal:AbortSignal):Promise<WorkbookOptionsSheet[]>{return new Promise((resolve,reject)=>{
 const worker=(()=>{try{return new Worker(new URL('./workbook-options.worker.ts',import.meta.url),{type:'module'});}catch{throw new Error('designer.workbookInvalid');}})();let settled=false;
 const finish=(error?:Error,sheets?:WorkbookOptionsSheet[])=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();if(error)reject(error);else resolve(sheets!);};
 const abort=()=>finish(new Error('designer.workbookCanceled'));const timer=setTimeout(()=>finish(new Error('designer.workbookTimeout')),5000);signal.addEventListener('abort',abort,{once:true});
 if(signal.aborted){abort();return;}worker.onerror=()=>finish(new Error('designer.workbookInvalid'));worker.onmessage=e=>e.data?.error?finish(new Error(e.data.error)):Array.isArray(e.data?.sheets)?finish(undefined,e.data.sheets):finish(new Error('designer.workbookInvalid'));worker.postMessage(data,[data]);
 });}
