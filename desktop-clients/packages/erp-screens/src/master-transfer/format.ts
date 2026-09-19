import {parseCsv} from '@pepbits/erp-data';
import * as XLSX from 'xlsx';
export interface MasterTransferData {columns:string[];rows:Record<string,string>[];}
export const MASTER_TRANSFER_LIMITS={bytes:2*1024*1024,expandedBytes:8*1024*1024,rows:500,columns:80,cell:16000};
const formula=(value:string)=>/^\s*[=+@]/.test(value)||/^\s*-(?!\d+(?:\.\d+)?\s*$)/.test(value)||/^[\t\r]/.test(value);
function check(data:MasterTransferData):MasterTransferData {
 const {columns,rows}=data;
 if(!columns.length||columns.length>80||columns.some(c=>!c.trim()||c.length>100)||new Set(columns.map(c=>c.toLowerCase())).size!==columns.length)throw new Error('Use 1–80 unique column headers.');
 if(rows.length>500)throw new Error('Import at most 500 records.');
 for(const row of rows)for(const c of columns){const v=row[c]??'';if(v.length>16000)throw new Error('A cell exceeds 16,000 characters.');if(formula(v))throw new Error('Spreadsheet formulas are not accepted. Use literal values.');}
 return data;
}
// Inspect ZIP central-directory metadata before allowing a workbook decoder to expand entries.
function checkZip(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Invalid XLSX archive.');
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),start=view.getUint32(end+16,true);
 if(count>1000||start+size>end||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)throw new Error('Unsupported XLSX archive.');
 let at=start,total=0;
 for(let i=0;i<count;i++){
  if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw new Error('Invalid XLSX entry.');
  const expanded=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true);
  total+=expanded;if(total>MASTER_TRANSFER_LIMITS.expandedBytes||(view.getUint16(at+8,true)&1))throw new Error('Workbook is encrypted or exceeds the expanded size limit.');
  const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nameLength));
  if(/vbaProject|externalLinks|\.bin$/i.test(name))throw new Error('Macros and external workbook links are not accepted.');
  at+=46+nameLength+extra+comment;
 }
 if(at!==start+size)throw new Error('Invalid XLSX directory.');
}
export function parseMasterTransfer(name:string,bytes:Uint8Array):MasterTransferData {
 if(bytes.byteLength>MASTER_TRANSFER_LIMITS.bytes)throw new Error('Choose a file up to 2 MB.');
 let columns:string[],values:string[][];
 if(/\.csv$/i.test(name)){const parsed=parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes));columns=parsed.headers;values=parsed.rows;}
 else if(/\.xlsx$/i.test(name)){
  checkZip(bytes);
  const book=XLSX.read(bytes,{type:'array',cellFormula:true,cellHTML:false,cellText:false,sheetRows:502});
  if(book.SheetNames.length!==1)throw new Error('Use exactly one worksheet.');
  const sheet=book.Sheets[book.SheetNames[0]];const range=XLSX.utils.decode_range(String(sheet['!fullref']??sheet['!ref']??'A1'));
  if(range.e.r>500||range.e.c>=80)throw new Error('Use at most 500 data rows and 80 columns.');
  for(const [key,cell] of Object.entries(sheet))if(!key.startsWith('!')&&cell&&typeof cell==='object'&&('f' in cell||'F' in cell))throw new Error('Spreadsheet formulas are not accepted.');
  const matrix=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1,raw:false,defval:'',blankrows:false});
  if(matrix.length<2)throw new Error('Include column headers and at least one record.');
  columns=matrix[0].map(v=>String(v).trim());values=matrix.slice(1).map(r=>columns.map((_,i)=>String(r[i]??'')));
 }else throw new Error('Choose a CSV or XLSX file.');
 return check({columns,rows:values.map(row=>Object.fromEntries(columns.map((c,i)=>[c,row[i]??'']))) });
}
export function exportMasterTransfer(data:MasterTransferData,format:'csv'|'xlsx'):Uint8Array {
 const matrix=[data.columns,...data.rows.map(row=>data.columns.map(c=>row[c]??''))];
 if(format==='csv'){const csv=matrix.map(row=>row.map(v=>'"'+(formula(v)?"'"+v:v).replaceAll('"','""')+'"').join(',')).join('\r\n');return new TextEncoder().encode('\uFEFF'+csv);}
 const sheet=XLSX.utils.aoa_to_sheet(matrix);const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Records');return new Uint8Array(XLSX.write(book,{bookType:'xlsx',type:'array',compression:true}));
}
/** Browser upload boundary: verify actual inflated bytes before the synchronous workbook decoder. */
export async function readMasterTransfer(name:string,bytes:Uint8Array):Promise<MasterTransferData>{
 if(bytes.byteLength>MASTER_TRANSFER_LIMITS.bytes)throw new Error('Choose a file up to 2 MB.');
 if(/\.xlsx$/i.test(name)){
  checkZip(bytes);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=bytes.length-22;
  while(view.getUint32(end,true)!==0x06054b50)end--;
  let at=view.getUint32(end+16,true),expandedTotal=0;const count=view.getUint16(end+10,true);
  for(let i=0;i<count;i++){
   const compression=view.getUint16(at+10,true),packed=view.getUint32(at+20,true),expected=view.getUint32(at+24,true),local=view.getUint32(at+42,true);
   if(local+30>bytes.length||view.getUint32(local,true)!==0x04034b50)throw new Error('Invalid XLSX local entry.');
   const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
   if(start+packed>bytes.length)throw new Error('Invalid XLSX content length.');
   let actual=0;
   if(compression===0){actual=packed;expandedTotal+=actual;}
   else if(compression===8){
    const stream=new Blob([bytes.slice(start,start+packed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader=stream.getReader();try{for(;;){const part=await reader.read();if(part.done)break;actual+=part.value.length;expandedTotal+=part.value.length;if(expandedTotal>MASTER_TRANSFER_LIMITS.expandedBytes){await reader.cancel();throw new Error('Workbook exceeds the expanded size limit.');}}}finally{reader.releaseLock();}
   }else throw new Error('Unsupported XLSX compression.');
   if(actual!==expected||expandedTotal>MASTER_TRANSFER_LIMITS.expandedBytes)throw new Error('Workbook expanded length is invalid.');
   at+=46+view.getUint16(at+28,true)+view.getUint16(at+30,true)+view.getUint16(at+32,true);
  }
 }
 return parseMasterTransfer(name,bytes);
}
