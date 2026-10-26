import React from 'react';
import {fireEvent,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PresentationProvider} from '@pepbits/components';
import {render} from '../test/render';
import {TabularFieldRows} from './tabular-field-rows';
const rows=[{id:'one',values:{name:'First',qty:2}},{id:'two',values:{name:'Second',qty:3}}];
const props={title:'Items',columns:[{id:'name',label:'Name',type:'text' as const,suggestions:['First','Second']},{id:'qty',label:'Quantity',type:'number' as const}],rows,createRow:()=>({id:'three',values:{name:'Third',qty:1}}),formatValue:(_:unknown,value:unknown)=>String(value),onChange:vi.fn()};
test('table edits address stable row IDs and retain empty numeric input',()=>{
 const change=vi.fn();render(<TabularFieldRows {...props} onChange={change}/>);
 fireEvent.change(screen.getByRole('spinbutton',{name:'Quantity 2'}),{target:{value:''}});
 expect(change).toHaveBeenLastCalledWith([rows[0],{id:'two',values:{name:'Second',qty:''}}]);
 fireEvent.click(screen.getByRole('button',{name:'Remove line 1'}));expect(change).toHaveBeenLastCalledWith([rows[1]]);
 fireEvent.click(screen.getByRole('button',{name:'Add line'}));expect(change).toHaveBeenLastCalledWith([...rows,props.createRow()]);
});
test('read-only table formats values and host totals without mutation controls',()=>{
 render(<TabularFieldRows {...props} readOnly totals={{name:'Total',qty:'5 units'}}/>);
 expect(screen.getByRole('table',{name:'Items'})).toHaveTextContent('5 units');expect(screen.queryByRole('spinbutton')).toBeNull();expect(screen.queryByRole('button')).toBeNull();
});
test('mounted disabled state fences field changes, additions and removals',()=>{
 const change=vi.fn(),view=render(<TabularFieldRows {...props} onChange={change}/>);
 view.rerender(<TabularFieldRows {...props} onChange={change} disabled/>);
 fireEvent.change(screen.getByRole('spinbutton',{name:'Quantity 1'}),{target:{value:'8'}});fireEvent.click(screen.getByRole('button',{name:'Add line'}));fireEvent.click(screen.getByRole('button',{name:'Remove line 1'}));expect(change).not.toHaveBeenCalled();
});
test('managed presentation applies to the table and empty state has one spanning cell',()=>{
 render(<PresentationProvider value={{density:'spacious',zebraStripes:true,stickyTableHeader:false,wrapCellText:true,pageSize:10}}><TabularFieldRows {...props} rows={[]}/></PresentationProvider>);
 const table=screen.getByRole('table');expect(table).toHaveAttribute('data-density','spacious');expect(table).toHaveAttribute('data-striped','true');expect(table).toHaveAttribute('data-wrap','true');expect(table).toHaveAttribute('data-sticky','false');expect(screen.getByRole('cell')).toHaveAttribute('colspan','4');
});
test('computed columns remain read-only while other columns are editable',()=>{
 render(<TabularFieldRows {...props} columns={[props.columns[0]!,{...props.columns[1]!,readOnly:true}]}/>);
 expect(screen.queryByRole('spinbutton')).toBeNull();expect(screen.getAllByRole('combobox')).toHaveLength(2);
});
test('typed boolean and multiline fields preserve their value contracts',()=>{
 const change=vi.fn();render(<TabularFieldRows {...props} rows={[{id:'one',values:{active:false,note:'First'}}]} columns={[{id:'active',label:'Active',type:'checkbox'},{id:'note',label:'Note',type:'textarea'}]} onChange={change}/>);
 fireEvent.click(screen.getByRole('checkbox',{name:'Active 1'}));expect(change).toHaveBeenLastCalledWith([{id:'one',values:{active:true,note:'First'}}]);
 fireEvent.change(screen.getByRole('textbox',{name:'Note 1'}),{target:{value:'Two\nlines'}});expect(change).toHaveBeenLastCalledWith([{id:'one',values:{active:false,note:'Two\nlines'}}]);
});
