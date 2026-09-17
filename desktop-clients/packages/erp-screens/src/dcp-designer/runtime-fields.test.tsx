import React from 'react';
import {test,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import type {DcpRuntimeField,DcpRuntimeView} from '@pepbits/erp-config';
import {DcpRuntimeFields,DcpSectionFields} from './runtime-fields';
const field=(code:string,extra:Partial<DcpRuntimeField>={}):DcpRuntimeField=>({code,label:code,type:'TEXT',required:false,writable:true,masked:false,maxLength:100,minimum:null,maximum:null,options:[],children:[],maxItems:2,...extra});
const view:DcpRuntimeView={contractVersion:1,label:'Synthetic',definitionVersion:1,checksum:'synthetic',sections:[],values:{},violations:[],rowFields:{}};
test('host renderer receives only writable unmasked fields and cannot mutate a disabled control',()=>{
 const change=vi.fn(),renderer=vi.fn(({field,change:write})=><button onClick={()=>write('changed')}>{field.code}</button>);
 render(<DcpRuntimeFields fields={[field('secret',{masked:true}),field('system',{writable:false}),field('reference')]} values={{secret:'private',system:'fixed',reference:1}} view={view} disabled change={change} renderField={renderer}/>);
 expect(renderer).toHaveBeenCalledTimes(1);expect(renderer.mock.calls[0][0].disabled).toBe(true);expect(screen.queryByText('private')).toBeNull();expect(screen.getByText('fixed')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'reference'}));expect(change).not.toHaveBeenCalled();
});
test('nested host reference control preserves row identity and required collection cannot lose its last row',()=>{
 const change=vi.fn(),child=field('reference'),parent=field('rows',{type:'COLLECTION',required:true,children:[child]});
 const renderer=vi.fn(({path,change:write})=><button onClick={()=>write(7)}>{path}</button>);
 render(<DcpRuntimeFields fields={[parent]} values={{rows:[{_id:'one',reference:1}]}} view={{...view,rowFields:{'rows[one]':[child]}}} change={change} renderField={renderer}/>);
 fireEvent.click(screen.getByRole('button',{name:'rows[one].reference'}));expect(change).toHaveBeenCalledWith('rows',[{_id:'one',reference:7}]);expect(screen.getByRole('button',{name:'Remove row'})).toBeDisabled();
});
test('missing per-row authorization metadata never invokes a custom renderer',()=>{
 const renderer=vi.fn();render(<DcpRuntimeFields fields={[field('rows',{type:'COLLECTION',children:[field('reference')]})]} values={{rows:[{_id:'unknown',reference:1}]}} view={view} change={vi.fn()} renderField={renderer}/>);
 expect(renderer).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Remove row'})).toBeDisabled();
});

test('section projection requires row authorization and never leaks a masked parent',()=>{
 const change=vi.fn(),renderer=vi.fn(),parent=field('customer',{type:'COLLECTION',children:[field('name')]});
 const props={primaryCollection:'customer',fieldCodes:['name'],collectionCodes:[],values:{customer:[{_id:'one',name:'Hidden customer'}]},change,renderField:renderer};
 const {rerender}=render(<DcpSectionFields {...props} view={{...view,sections:[{code:'details',label:'Details',fields:[parent]}]}}/>);
 expect(screen.queryByDisplayValue('Hidden customer')).toBeNull();expect(renderer).not.toHaveBeenCalled();
 rerender(<DcpSectionFields {...props} view={{...view,sections:[{code:'details',label:'Details',fields:[{...parent,masked:true}]}],rowFields:{'customer[one]':[field('name')]}}}/>);
 expect(screen.queryByDisplayValue('Hidden customer')).toBeNull();expect(renderer).not.toHaveBeenCalled();
});
test('section projection edits only its selected active row and excludes other fields',()=>{
 const change=vi.fn(),name=field('name'),parent=field('customer',{type:'COLLECTION',children:[name,field('secret')]});
 const rows=[{_id:'deleted',_delete:true,name:'Removed'},{_id:'one',name:'Synthetic',secret:'Do not project'},{_id:'two',name:'Other'}];
 render(<DcpSectionFields primaryCollection="customer" fieldCodes={['name']} collectionCodes={[]} values={{customer:rows}} view={{...view,sections:[{code:'details',label:'Details',fields:[parent]}],rowFields:{'customer[one]':[name,field('secret')]}}} change={change}/>);
 expect(screen.queryByDisplayValue('Do not project')).toBeNull();fireEvent.change(screen.getByRole('textbox',{name:'name'}),{target:{value:'Updated'}});expect(change).toHaveBeenCalledWith('customer',[rows[0],{...rows[1],name:'Updated'},rows[2]]);
});
