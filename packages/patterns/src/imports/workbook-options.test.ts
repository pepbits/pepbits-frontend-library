import {test,expect,vi,afterEach} from 'vitest';
import {readOptionsWorkbook} from './workbook-options';
const terminate=vi.fn(),postMessage=vi.fn();let worker:{onmessage?:({data}:{data:unknown})=>void;onerror?:()=>void};
function install(){vi.stubGlobal('Worker',class {onmessage?:({data}:{data:unknown})=>void;onerror?:()=>void;terminate=terminate;postMessage=postMessage;constructor(){worker=this;}});}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();vi.clearAllMocks();});
test('workbook cancellation terminates its isolated worker',async()=>{install();const controller=new AbortController(),result=readOptionsWorkbook(new ArrayBuffer(4),controller.signal);controller.abort();await expect(result).rejects.toThrow('designer.workbookCanceled');expect(terminate).toHaveBeenCalledOnce();});
test('workbook timeout bounds parser lifetime and successful parsing terminates the worker',async()=>{install();vi.useFakeTimers();const result=readOptionsWorkbook(new ArrayBuffer(4),new AbortController().signal);const rejection=expect(result).rejects.toThrow('designer.workbookTimeout');await vi.advanceTimersByTimeAsync(5000);await rejection;expect(terminate).toHaveBeenCalledOnce();
 const success=readOptionsWorkbook(new ArrayBuffer(4),new AbortController().signal);worker.onmessage!({data:{sheets:[{name:'Options',headers:['id','label'],rows:[['001','Name']]}]}});expect(await success).toHaveLength(1);expect(terminate).toHaveBeenCalledTimes(2);
});
