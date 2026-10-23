import {render,TestHost} from '../test';
import {describe,test,expect} from 'vitest';
import {exportAudit} from './export-policy';
import {importSheet,SHEET_COLUMNS,reviewSheetExport} from './model';
describe('costing import/export boundary',()=>{
 test('maps reordered known headers while preserving business text',()=>{
  const headers=[...SHEET_COLUMNS].reverse();
  const row=['ITM-1','Customer-specific description',2,10,0,5,21,'Supplier'];
  expect(importSheet([headers,[...row].reverse()])).toEqual([row]);
 });
 test('rejects unknown and duplicate columns instead of relabeling data',()=>{
  expect(()=>importSheet([['Private name',...SHEET_COLUMNS.slice(1)],['PRIVATE']])).toThrow(/column headers/);
  expect(()=>importSheet([[SHEET_COLUMNS[0],...SHEET_COLUMNS.slice(0,7)]])).toThrow(/column headers/);
  expect(()=>importSheet([SHEET_COLUMNS,['x','y',1,2,0,5,2,'z','EXTRA']])).toThrow(/outside/);
 });
 test('rejects invalid numeric data and excess rows before replacing the sheet',()=>{
  expect(()=>importSheet([SHEET_COLUMNS,['x','y','invalid']])).toThrow(/non-negative/);
  expect(()=>importSheet([SHEET_COLUMNS,['x','y',1,2,101]])).toThrow(/percentages/);
  expect(()=>importSheet([SHEET_COLUMNS,...Array.from({length:501},()=>['x'])])).toThrow(/500/);
 });
 test('export review classifies every schema key and audit contains no cell values',()=>{
  const review=reviewSheetExport();expect(review.silent).toBe(true);expect(review.carried).toHaveLength(8);
  expect(review.withheld).toEqual([]);
  const audit=exportAudit('spreadsheet-studio',review,1);
  expect(audit.columns).toContain('sheetItemCode');expect(JSON.stringify(audit)).not.toContain('Customer-specific description');
 });
});
