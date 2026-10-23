import * as XLSX from 'xlsx';
/** Isolated parser: bounded ZIP metadata, no formula evaluation, terminated by the host on timeout. */
self.onmessage=async(event:MessageEvent<ArrayBuffer>)=>{try{
 const data=event.data;if(data.byteLength>2*1024*1024)throw Error('designer.workbookInvalid');const view=new DataView(data);let end=-1;
 for(let i=data.byteLength-22;i>=Math.max(0,data.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)throw Error('designer.workbookInvalid');
 const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true),expanded=0;if(count>1000||count===0)throw Error('designer.workbookInvalid');
 const names=new Set<string>();
 for(let i=0;i<count;i++){
  if(offset+46>data.byteLength||view.getUint32(offset,true)!==0x02014b50)throw Error('designer.workbookInvalid');
  const expected=view.getUint32(offset+24,true),compressed=view.getUint32(offset+20,true),method=view.getUint16(offset+10,true),flags=view.getUint16(offset+8,true),local=view.getUint32(offset+42,true),n=view.getUint16(offset+28,true);
  expanded+=expected;if(expanded>16*1024*1024||offset+46+n>data.byteLength||flags&9||![0,8].includes(method)||local+30>data.byteLength||view.getUint32(local,true)!==0x04034b50)throw Error('designer.workbookInvalid');
  const name=new TextDecoder().decode(new Uint8Array(data,offset+46,n));if(/vbaProject|externalLinks|\.bin$/i.test(name)||name.includes('..')||names.has(name))throw Error('designer.workbookInvalid');names.add(name);
  const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);if(start+compressed>data.byteLength||view.getUint32(local+18,true)!==compressed||view.getUint32(local+22,true)!==expected||view.getUint16(local+8,true)!==method)throw Error('designer.workbookInvalid');
  if(method===0){if(compressed!==expected)throw Error('designer.workbookInvalid');}
  else {const stream=new Blob([data.slice(start,start+compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const reader=stream.getReader();let actual=0;try{while(true){const chunk=await reader.read();if(chunk.done)break;actual+=chunk.value.byteLength;if(actual>expected||actual>16*1024*1024){await reader.cancel();throw Error('designer.workbookInvalid');}}}finally{reader.releaseLock();}if(actual!==expected)throw Error('designer.workbookInvalid');}
  offset+=46+n+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
 }
 const workbook=XLSX.read(data,{type:'array',cellFormula:true,cellHTML:false,sheetRows:1002});if(workbook.SheetNames.length>10||!workbook.SheetNames.length)throw Error('designer.workbookInvalid');
 const sheets=workbook.SheetNames.map(name=>{const sheet=workbook.Sheets[name]!,range=XLSX.utils.decode_range(sheet['!fullref']??sheet['!ref']??'A1');if(range.e.r>1000||range.e.c>79)throw Error('designer.workbookInvalid');
  for(const [key,value]of Object.entries(sheet))if(!key.startsWith('!')&&value&&typeof value==='object'&&('f'in value||'F'in value))throw Error('designer.workbookFormula');
  const rows=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1,raw:false,defval:'',blankrows:false});if(rows.length<2)throw Error('designer.workbookInvalid');const headers=rows.shift()!.map(String).map(s=>s.trim());if(headers.some(h=>!h)||new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)throw Error('designer.workbookInvalid');
  return {name,headers,rows:rows.map(row=>headers.map((_,i)=>String(row[i]??'')))};
 });self.postMessage({sheets});
 }catch(e){self.postMessage({error:e instanceof Error&&e.message.startsWith('designer.')?e.message:'designer.workbookInvalid'});}};
