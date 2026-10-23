import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {DynamicRecordForm} from '@pepbits/page-engines/forms';
import {RecordAdapterProvider} from '@pepbits/page-engines/records';
import {createMemoryRecordAdapter} from '@pepbits/data';
import {ShellTestHost,product,session} from '../test/host';
import {useShell} from '../shell-context';

test('a direct edit target cannot bypass action permissions',async()=>{
 const adapter=createMemoryRecordAdapter(),save=vi.spyOn(adapter,'save');
 render(<ShellTestHost session={{...session,user:{...session.user!,role:'viewer'}}}><RecordAdapterProvider value={{adapter,identity:'t:u',applicationId:'example',sessionAvailable:true}}>
  <DynamicRecordForm page={product.pages.items!} target={{pageId:'items',mode:'edit',recordId:'one'}} schema={{id:'item',singular:'Item',plural:'Items',description:'Records',sections:[{id:'main',title:'Main',description:'',fields:[{id:'name',label:'Name',type:'text'}]}]}}/>
 </RecordAdapterProvider></ShellTestHost>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save'})).toBeDisabled());
 fireEvent.click(screen.getByRole('button',{name:'Save'}));expect(save).not.toHaveBeenCalled();
});
test('a direct page target cannot restore a page excluded by the role-filtered shell catalog',()=>{
 let pages:typeof product.pages={};function Probe(){pages=useShell().product.pages;return null;}
 render(<ShellTestHost navigation={{current:{pageId:'items'},open:()=>{},openInNewContext:()=>{},hrefFor:()=> '#'}} product={{...product,access:{pages:{items:['editor']}}}} session={{...session,user:{...session.user!,role:'viewer'}}}><Probe/></ShellTestHost>);
 expect(pages.items).toBeUndefined();
});
