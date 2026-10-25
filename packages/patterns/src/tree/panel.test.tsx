import {fireEvent,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {render} from '../test/render';
import {HierarchyPanel} from './index';
const nodes=[{id:'a',label:'Assets',code:'1000'},{id:'b',parentId:'a',label:'Bank',code:'1001'},{id:'c',parentId:'b',label:'Cash',code:'1002'}];
test('panel opens roots, searches codes with ancestors and reports visible order',async()=>{
 const visible=vi.fn(),select=vi.fn();render(<HierarchyPanel label="Accounts" nodes={nodes} code={node=>node.code} onSelect={select} onVisibleChange={visible}/>);
 expect(screen.getByRole('button',{name:'Bank'})).toBeVisible();expect(screen.queryByRole('button',{name:'Cash'})).toBeNull();
 fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:'1002'}});fireEvent.click(screen.getByRole('button',{name:'Cash'}));expect(select).toHaveBeenCalledWith(nodes[2]);
 await waitFor(()=>expect(visible).toHaveBeenLastCalledWith(['a','b','c']));
 fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Collapse all'}));expect(screen.queryByRole('button',{name:'Bank'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Expand all'}));expect(screen.getByRole('button',{name:'Cash'})).toBeVisible();
});
test('selection and row actions are separate controls; disabled selection cannot navigate',()=>{
 const select=vi.fn(),add=vi.fn();const view=render(<HierarchyPanel label="Accounts" nodes={nodes} onSelect={select} actions={node=><button onClick={()=>add(node.id)}>Add {node.label}</button>}/>);
 fireEvent.click(screen.getByRole('button',{name:'Add Bank'}));expect(add).toHaveBeenCalledWith('b');expect(select).not.toHaveBeenCalled();
 view.rerender(<HierarchyPanel label="Accounts" nodes={nodes} onSelect={select} disabled/>);expect(screen.getByRole('button',{name:'Assets'})).toBeDisabled();
 fireEvent.change(screen.getByRole('textbox',{name:'Search the tree'}),{target:{value:'missing'}});expect(within(screen.getByRole('list')).getByRole('status')).toHaveTextContent('No results');
});
