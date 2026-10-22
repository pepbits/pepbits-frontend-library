import {test,expect} from 'vitest';
import {parseCsv,mapImportRows,suggestMapping,createHttpImportAdapter} from './csv-import';
test('CSV handles BOM, CRLF, embedded newlines, quotes and a final empty field',()=>{
 const result=parseCsv('\uFEFFCode,Name,Notes\r\nA,"Example, Inc","First\nSecond ""quoted"" line"\r\nB,Other,');
 expect(result.rows).toEqual([['A','Example, Inc','First\nSecond "quoted" line'],['B','Other','']]);
});
test('malformed headers, quoting, widths and excessive row counts are rejected',()=>{
 for(const source of ['A,a\nx,y','A,,B\nx,y,z','A,B\nx','A\n"unclosed','A\n"closed"bad','A\n'+Array(501).fill('x').join('\n')])expect(()=>parseCsv(source)).toThrow();
});
test('mapping uses indices and prevents accidental column reuse',()=>{
 const mapping=suggestMapping(['Legal Name','Code'],[{id:'legalName',label:'Legal name'},{id:'customerCode',label:'Customer code'}]);expect(mapping).toEqual({legalName:'0'});
 expect(mapImportRows([['ACME','C1']],{legalName:'0',customerCode:'1'})).toEqual([{legalName:'ACME',customerCode:'C1'}]);
 expect(()=>mapImportRows([['A']],{a:'0',b:'0'})).toThrow(/at most one/);
});
test('HTTP adapter rejects malformed job results and permits null only for latest',async()=>{
 const request=async()=>new Response(JSON.stringify({job:null}),{status:200});const adapter=createHttpImportAdapter(request);
 expect(await adapter.latest('p','customer-master')).toBeNull();await expect(adapter.run('id')).rejects.toThrow(/Invalid import/);
 const malformed=createHttpImportAdapter(async()=>new Response(JSON.stringify({job:{id:'id',productId:'p',pageId:'page',confirmed:true,createdAt:'now',rows:[{row:1,status:'surprise',values:{},errors:{}}]}})));
 await expect(malformed.run('id')).rejects.toThrow(/Invalid import/);
});
