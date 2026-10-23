import {test,expect} from 'vitest';
import {parseCsv} from '@pepbits/data';
import {mapCsvOptions} from './csv-options';
test('CSV mapping preserves leading zeros, Unicode and quoted commas',()=>{
 const csv=parseCsv('code,name\n001,"Accounts, India"\n002,കേരളം');
 expect(mapCsvOptions(csv.rows,'0','1')).toEqual([{row:1,value:'001',label:'Accounts, India',error:null},{row:2,value:'002',label:'കേരളം',error:null}]);
});
test('bad mappings and oversized catalogs cannot become partial datasets',()=>{
 for(const cols of [['','1'],['0','0'],['-1','1']])expect(()=>mapCsvOptions([['a','b']],...cols as [string,string])).toThrow('designer.csvMapping');
 expect(()=>mapCsvOptions(Array.from({length:1001},(_,i)=>[String(i),'Name']),'0','1')).toThrow('designer.datasetLimit');
});
test('row failures expose duplicate IDs, blanks, oversized values and editor delimiters',()=>{
 const rows=mapCsvOptions([['001','A'],['001','B'],['','C'],['a','one\ntwo'],['b','A|B'],['c'.repeat(81),'C']],'0','1');
 expect(rows.map(r=>!!r.error)).toEqual([false,true,true,true,true,true]);
 expect(mapCsvOptions([['a']],'0','1')[0]!.error).toBe('designer.csvRow');
});
