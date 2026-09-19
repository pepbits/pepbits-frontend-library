import {it,expect,vi} from 'vitest';
import {Blob} from 'node:buffer';
vi.stubGlobal('Blob',Blob);
import {readMasterTransfer,exportMasterTransfer} from './format';
it('verifies actual ZIP expansion before decoding compressed XLSX',async()=>{const data={columns:['code'],rows:[{code:'001'}]};expect(await readMasterTransfer('a.xlsx',exportMasterTransfer(data,'xlsx'))).toEqual(data);});
it('rejects a workbook with forged declared expanded entry length',async()=>{const bytes=exportMasterTransfer({columns:['code'],rows:[{code:'A'}]},'xlsx');const view=new DataView(bytes.buffer);for(let i=0;i<bytes.length-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,1,true);break;}await expect(readMasterTransfer('a.xlsx',bytes)).rejects.toThrow(/expanded length/);});
