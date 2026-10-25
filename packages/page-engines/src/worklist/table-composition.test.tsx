import React from 'react';
import {screen,fireEvent,waitFor,within} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {render} from '../test/render';
import {WorklistPage} from './worklist-page';
import type {WorklistConfig,PageDefinition} from '../types';
const page:PageDefinition={id:'editable-items',title:'Items',subtitle:'',kind:'worklist',module:'records'};
const config:WorklistConfig={id:page.id,title:page.title,description:'',entity:'item',primaryKey:'id',displayKey:'name',rows:[],columns:[{key:'name',label:'Name',classification:'operational'}],basicFilters:[],advancedFilters:[]};
const adapter=(rows:Record<string,string>[])=>({request:vi.fn(async(path:string)=>Response.json(path==='/layouts'?{layouts:{}}:{rows,total:rows.length,page:1})),identity:'table-composition-test',applicationId:'app'});
test('creation rows render in empty results with current columns and selection disabled',async()=>{
 render(<WorklistPage page={page} config={config} adapter={adapter([])} personalViews={false} tableComposition={{selectable:false,beforeRows:columns=><tr><td><input aria-label={columns[0]!.label}/></td><td><button>Save new row</button></td></tr>}}/>);
 expect(await screen.findByRole('textbox',{name:'Name'})).toBeVisible();expect(screen.queryByRole('checkbox')).toBeNull();expect(screen.getAllByRole('columnheader')).toHaveLength(2);
});
test('host row editor replaces only its record and supplies row-specific actions',async()=>{
 const action=vi.fn();render(<WorklistPage page={page} config={config} adapter={adapter([{id:'A',name:'A'},{id:'B',name:'B'}])} personalViews={false} tableComposition={{renderRow:(row,columns)=>row.id==='A'?<tr key="A"><td colSpan={columns.length+2}><input aria-label="Editing A" defaultValue={String(row.name??'')}/></td></tr>:undefined,renderActions:row=><button onClick={()=>action(row.id)}>Save {row.id}</button>}}/>);
 await screen.findByRole('textbox',{name:'Editing A'});fireEvent.click(screen.getByRole('button',{name:'Save B'}));expect(action).toHaveBeenCalledWith('B');expect(within(screen.getByRole('table')).getByText('B')).toBeVisible();
});
test('leading context uses the engine filter change path and optional creation wording',async()=>{
 const current=adapter([{id:'A',name:'A'}]);render(<WorklistPage page={page} config={{...config,basicFilters:[{key:'parent',label:'Parent',type:'text',classification:'operational'}]}} adapter={current} personalViews={false} newLabel="Add row" renderLeading={controls=><button onClick={()=>controls.onChange('parent','P1')}>Choose parent</button>}/>);
 await screen.findByText('A');expect(screen.getByRole('button',{name:'Add row'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Choose parent'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'Parent'})).toHaveValue('P1'));
});
