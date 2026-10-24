import {fireEvent, screen} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {render} from '../test/render';
import {ReportFilterField, activeReportFilter, validReportFilters} from './report-filters';
test('zero and false remain active while empty conditions are omitted', () => {
  for (const value of [false, {min: 0}, ['Paid']]) expect(activeReportFilter(value)).toBe(true);
  for (const value of [undefined, '', [], {min: undefined}, {from: ''}]) expect(activeReportFilter(value)).toBe(false);
});
test('open ranges are valid and inverted or nonfinite bounds are rejected', () => {
  expect(validReportFilters({amount: {min: 0}, date: {to: '2026-10-24'}})).toBe(true);
  expect(validReportFilters({amount: {min: 2, max: 1}})).toBe(false);
  expect(validReportFilters({amount: {max: Infinity}})).toBe(false);
  expect(validReportFilters({date: {from: '2026-10-24', to: '2026-01-01'}})).toBe(false);
});
test('choice conditions retain selected values outside the search result', () => {
  const onChange = vi.fn();render(<ReportFilterField definition={{key:'status',label:'Status',type:'choice',options:['Paid','Unpaid']}} value={['Paid']} onChange={onChange}/>);
  fireEvent.change(screen.getByRole('textbox'), {target:{value:'Unpaid'}});fireEvent.click(screen.getByRole('checkbox',{name:'Unpaid'}));expect(onChange).toHaveBeenLastCalledWith(['Paid','Unpaid']);
});
test('range clearing and boolean values preserve their typed contracts', () => {
  const onChange = vi.fn(), view = render(<ReportFilterField definition={{key:'amount',label:'Amount',type:'number'}} value={{min:0,max:10}} onChange={onChange}/>);
  fireEvent.change(screen.getByRole('spinbutton',{name:'Amount Min'}),{target:{value:''}});expect(onChange).toHaveBeenLastCalledWith({min:undefined,max:10});
  view.rerender(<ReportFilterField definition={{key:'active',label:'Active',type:'boolean'}} onChange={onChange}/>);fireEvent.change(screen.getByRole('combobox'),{target:{value:'no'}});expect(onChange).toHaveBeenLastCalledWith(false);
});
