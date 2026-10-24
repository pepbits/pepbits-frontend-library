import {fireEvent,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {render} from '../test/render';
import {HierarchyView,hierarchyEntries} from './index';
const nodes=[{id:'root',label:'Assets'},{id:'bank',parentId:'root',label:'Bank'},{id:'cash',parentId:'bank',label:'Cash'}];
test('collapsed branches, ancestors in search and orphan/cycle safety',()=>{
  expect(hierarchyEntries(nodes,new Set()).map(row=>row.node.id)).toEqual(['root']);
  expect(hierarchyEntries(nodes,new Set(),'cash').map(row=>[row.node.id,row.depth])).toEqual([['root',0],['bank',1],['cash',2]]);
  const malformed=[{id:'a',parentId:'b',label:'A'},{id:'b',parentId:'a',label:'B'},{id:'c',parentId:'absent',label:'C'}];
  expect(hierarchyEntries(malformed,new Set(['a','b'])).map(row=>row.node.id).sort()).toEqual(['a','b','c']);
});
test('expand, select, search and collapse report only visible neighbours',async()=>{
  const select=vi.fn(),visible=vi.fn();render(<HierarchyView label="Accounts" nodes={nodes} onSelect={select} onVisibleChange={visible}/>);
  fireEvent.click(screen.getByRole('button',{name:'Expand all'}));fireEvent.click(screen.getByRole('button',{name:'Cash'}));expect(select).toHaveBeenCalledWith(nodes[2]);
  await waitFor(()=>expect(visible).toHaveBeenLastCalledWith(['root','bank','cash']));
  fireEvent.click(screen.getByRole('button',{name:'Collapse all'}));expect(screen.queryByRole('button',{name:'Cash'})).toBeNull();
  fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:'cash'}});expect(screen.getByRole('button',{name:'Cash'})).toBeVisible();
  fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:'missing'}});await waitFor(()=>expect(visible).toHaveBeenLastCalledWith([]));
});
