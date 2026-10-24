import {fireEvent,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {render,TestHost} from '../test/render';
import {WorkflowBoard} from './index';
const item={id:'one',label:'Fictional issue',status:'New'},columns=[{id:'New',label:'New'},{id:'Done',label:'Done'}];
test('keyboard move and drag produce identical controlled commands without mutating input',()=>{
 const move=vi.fn();const {container}=render(<WorkflowBoard label="Cases" columns={columns} items={[item]} itemId={row=>row.id} itemLabel={row=>row.label} columnId={row=>row.status} onOpen={()=>{}} onMove={move}/>);
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'Done'}});expect(move).toHaveBeenLastCalledWith(item,'Done');
 fireEvent.dragStart(container.querySelector('[data-board-item]')!,{dataTransfer:{setData:vi.fn()}});fireEvent.drop(screen.getByRole('region',{name:'Done'}));expect(move).toHaveBeenCalledTimes(2);expect(move).toHaveBeenLastCalledWith(item,'Done');expect(item.status).toBe('New');
});
test('a mounted permission change disables move and fences a pending drag',()=>{
 const move=vi.fn(),open=vi.fn();const tree=(disabled:boolean)=><TestHost><WorkflowBoard label="Cases" columns={columns} items={[item]} itemId={row=>row.id} itemLabel={row=>row.label} columnId={row=>row.status} onOpen={open} onMove={move} disabled={disabled}/></TestHost>;
 const {container,rerender}=render(tree(false));fireEvent.dragStart(container.querySelector('[data-board-item]')!,{dataTransfer:{setData:vi.fn()}});rerender(tree(true));fireEvent.drop(screen.getByRole('region',{name:'Done'}));expect(move).not.toHaveBeenCalled();expect(screen.getByRole('combobox')).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Fictional issue'}));expect(open).toHaveBeenCalledWith(item);
});
