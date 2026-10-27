import {fireEvent,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PresentationProvider} from '@pepbits/components';
import {render} from '../test/render';
import {EntryMatrix} from './entry-matrix';
const row={id:'one',name:'Fictional person',cells:[3]};
const props={title:'Hours',rows:[row],rowKey:()=>row.id,rowLabel:()=>row.name,identity:()=>row.name,identityLabel:'Person',dimensions:[{id:'monday',label:'Monday',width:64}],values:()=>row.cells,onChange:vi.fn(),summary:()=>3,summaryLabel:'Total',totals:[3],totalsLabel:'Hours logged'};
test('numeric changes preserve blanks and clamp both bounds',()=>{
 const change=vi.fn();render(<EntryMatrix {...props} max={24} onChange={change}/>);const input=screen.getByRole('spinbutton');
 for(const [value,expected] of [['',null],['-1',0],['25',24],['6.5',6.5]] as const){fireEvent.change(input,{target:{value}});expect(change).toHaveBeenLastCalledWith(row,0,expected);}
});
test('cycles through supplied codes then blank; mounted denial fences changes',()=>{
 const change=vi.fn(),view=render(<EntryMatrix {...props} values={()=>['A']} options={[{value:'P',label:'Present'},{value:'A',label:'Absent'},{value:'',label:'Unmarked'}]} onChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'Fictional person monday: A'}));expect(change).toHaveBeenLastCalledWith(row,0,null);
 view.rerender(<EntryMatrix {...props} disabled onChange={change}/>);fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'9'}});expect(change).toHaveBeenCalledTimes(1);
});
test('managed table presentation, semantic headers and aligned totals',()=>{
 render(<PresentationProvider value={{density:'compact',zebraStripes:true,stickyTableHeader:false,wrapCellText:true,pageSize:10}}><EntryMatrix {...props}/></PresentationProvider>);
 const table=screen.getByRole('table',{name:'Hours'});expect(table).toHaveAttribute('data-density','compact');expect(table).toHaveAttribute('data-sticky','false');expect(table).toHaveAttribute('data-wrap','true');expect(table).toHaveAttribute('data-striped','true');expect(screen.getByRole('rowheader',{name:'Hours logged'}).parentElement?.children).toHaveLength(3);
});
test('empty and loading states occupy all columns and contain no controls',()=>{
 const view=render(<EntryMatrix {...props} rows={[]}/>);expect(screen.getByRole('cell')).toHaveAttribute('colspan','3');expect(screen.queryByRole('spinbutton')).toBeNull();
 view.rerender(<EntryMatrix {...props} rows={[]} loading/>);expect(screen.getByRole('table')).toHaveAttribute('aria-busy','true');
});

test('code button accessible name includes the displayed multi-letter code for voice control',()=>{
 render(<EntryMatrix {...props} values={()=>['WO']} options={[{value:'WO',label:'Week off'},{value:'',label:'Not marked'}]}/>);
 expect(screen.getByRole('button',{name:'Fictional person monday: WO'})).toHaveTextContent('WO');
});

test('opt-in skeleton rows and blank codes keep loading and editing states distinct',()=>{
 const view=render(<EntryMatrix {...props} rows={[]} loading loadingRows={12} fillHeight/>);
 expect(view.container.querySelectorAll('[data-entry-placeholder]')).toHaveLength(12);expect(screen.queryByRole('spinbutton')).toBeNull();
 view.rerender(<EntryMatrix {...props} values={()=>[null]} emptyCode="" options={[{value:'P',label:'Present'},{value:'',label:'Not marked'}]}/>);
 expect(screen.getByRole('button',{name:'Fictional person monday: Not marked'})).toBeEmptyDOMElement();expect(view.container.querySelector('[data-entry-placeholder]')).toBeNull();
 view.rerender(<EntryMatrix {...props} rows={[]} emptyState={null} showTotalsWhenEmpty/>);expect(view.container.querySelector('tbody')).toBeEmptyDOMElement();expect(screen.getByRole('rowheader',{name:'Hours logged'})).toBeInTheDocument();
});
