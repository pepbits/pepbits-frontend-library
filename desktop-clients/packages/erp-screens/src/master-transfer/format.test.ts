import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {parseMasterTransfer,exportMasterTransfer} from './format';
const bytes=(text:string)=>new TextEncoder().encode(text);
describe('master transfer formats',()=>{
 it('preserves string identifiers and quoted multiline CSV',()=>expect(parseMasterTransfer('a.csv',bytes('code,name\r\n001,"a,b\nsecond"')).rows).toEqual([{code:'001',name:'a,b\nsecond'}]));
 it('rejects formula injection, duplicates and unknown formats',()=>{for(const value of ['=1+1','+CMD','@A1','-CALL()'])expect(()=>parseMasterTransfer('a.csv',bytes('code\n'+value))).toThrow(/formulas/);expect(()=>parseMasterTransfer('a.csv',bytes('code,CODE\na,b'))).toThrow();expect(()=>parseMasterTransfer('a.xls',bytes('a'))).toThrow();});
 it('accepts negative numeric values for server policy validation',()=>expect(parseMasterTransfer('a.csv',bytes('amount\n-12.50')).rows[0].amount).toBe('-12.50'));
 it('round trips XLSX with literal identifiers and percentages',()=>{const data={columns:['code','price'],rows:[{code:'001',price:'12.50'}]};expect(parseMasterTransfer('a.xlsx',exportMasterTransfer(data,'xlsx'))).toEqual(data);});
 it('rejects formulas even with cached numeric values',()=>{const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,{'!ref':'A1:A2',A1:{t:'s',v:'price'},A2:{t:'n',v:2,f:'1+1'}},'Records');expect(()=>parseMasterTransfer('a.xlsx',new Uint8Array(XLSX.write(b,{type:'array',bookType:'xlsx'})))).toThrow(/formulas/);});
 it('rejects excessive declared worksheet range and multiple worksheets',()=>{const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([['code'],['one']]),'One');XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([['code'],['two']]),'Two');expect(()=>parseMasterTransfer('a.xlsx',new Uint8Array(XLSX.write(b,{type:'array',bookType:'xlsx'})))).toThrow(/one worksheet/);});
 it('round trips signed pricing percentages through CSV and XLSX',()=>{const data={columns:['code','percent'],rows:[{code:'DISCOUNT',percent:'-5.25'}]};for(const f of ['csv','xlsx'] as const)expect(parseMasterTransfer('a.'+f,exportMasterTransfer(data,f))).toEqual(data);});
 it('neutralizes spreadsheet commands in exported CSV',()=>expect(new TextDecoder().decode(exportMasterTransfer({columns:['name'],rows:[{name:'=HYPERLINK("x")'}]},'csv'))).toContain("'=HYPERLINK"));
});
