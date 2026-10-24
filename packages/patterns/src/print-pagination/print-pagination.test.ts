import {expect, test} from 'vitest';
import {paginatePrintRows} from './index';
const options = {capacity: 100, broughtForward: 10, carriedForward: 10, finalHeight: 30};
test('empty and exact-fit invoices have one final page', () => {
  expect(paginatePrintRows([], options)).toEqual([{start: 0, end: 0, final: true}]);
  expect(paginatePrintRows([5], {...options, finalHeight:95})).toEqual([{start:0,end:1,final:true}]);
  expect(paginatePrintRows([30, 40], options)).toEqual([{start: 0, end: 2, final: true}]);
});
test('variable-height rows retain their order and reserve both carry rows', () => {
  expect(paginatePrintRows([40, 35, 20, 40, 30], options)).toEqual([{start: 0, end: 2, final: false}, {start: 2, end: 4, final: false}, {start: 4, end: 5, final: true}]);
});
test('a final summary may occupy a separate page without duplicating rows', () => {
  expect(paginatePrintRows([80], options)).toEqual([{start: 0, end: 1, final: false}, {start: 1, end: 1, final: true}]);
});
test('unprintable rows, summary and invalid dimensions fail explicitly', () => {
  expect(() => paginatePrintRows([101], options)).toThrow('row');
  expect(() => paginatePrintRows([30], {...options, finalHeight: 101})).toThrow('summary');
  expect(() => paginatePrintRows([NaN], options)).toThrow('measurements');
});
