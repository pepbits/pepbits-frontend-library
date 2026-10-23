import {test,expect,vi} from 'vitest';
import {createDcpHostAdapter} from './dcp-host';
const view={initial:{title:'Host',sections:[{id:'main',title:'Main',fields:[]}]},canDesign:true,types:['text'],records:[],record:null};
test('host conversion uses injected authenticated request and validates converted responses',async()=>{
 const request=vi.fn(async(_path:string,_init:RequestInit)=>new Response(JSON.stringify({host:view}))),adapter=createDcpHostAdapter(request,{encode:c=>({path:'/api/dcp',method:'POST',body:{command:c}}),decode:v=>(v as {host:unknown}).host});
 expect(await adapter.command({action:'load'})).toEqual(view);expect(request.mock.calls[0]![0]!).toBe('/api/dcp');
 const invalid=createDcpHostAdapter(async()=>new Response('{}'),{encode:()=>({path:'/api/dcp',method:'GET'}),decode:()=>({})});await expect(invalid.command({action:'load'})).rejects.toMatchObject({status:502});
});
test('host paths cannot turn tenant metadata into arbitrary network targets and error contracts retain field paths',async()=>{
 const request=vi.fn();for(const path of ['https://other.invalid','//other.invalid','/\\other.invalid']){const adapter=createDcpHostAdapter(request,{encode:()=>({path,method:'GET'}),decode:x=>x});await expect(adapter.command({action:'load'})).rejects.toMatchObject({status:400});}expect(request).not.toHaveBeenCalled();
 const adapter=createDcpHostAdapter(async()=>new Response('{}',{status:409}),{encode:()=>({path:'/api/dcp',method:'POST'}),decode:x=>x,decodeError:()=>({fieldErrors:{score:'designer.conflict'},reference:'synthetic-incident'})});await expect(adapter.command({action:'load'})).rejects.toMatchObject({status:409,reference:'synthetic-incident',fieldErrors:{score:'designer.conflict'}});
});
