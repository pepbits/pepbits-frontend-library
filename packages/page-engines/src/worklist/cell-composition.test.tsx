import React from 'react';
import {screen,within} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {render} from '../test/render';
import {WorklistPage} from './worklist-page';
import type {WorklistConfig,PageDefinition} from '../types';
test('optional cell presentation preserves other formatting and selection',async()=>{
 const page:PageDefinition={id:'rates',title:'Rates',subtitle:'',kind:'worklist',module:'records'};
 const config:WorklistConfig={id:'rates',title:'Rates',description:'',entity:'rates',primaryKey:'id',displayKey:'name',rows:[],columns:[{key:'name',label:'Name'},{key:'end',label:'End date'}],basicFilters:[],advancedFilters:[]};
 const adapter={request:vi.fn(async(path:string)=>Response.json(path==='/layouts'?{layouts:{}}:{rows:[{id:'one',name:'Fictional rate',end:''}],total:1,page:1})),identity:'cell-composition',applicationId:'app'};
 render(<WorklistPage page={page} config={config} adapter={adapter} personalViews={false} tableComposition={{renderCell:(_row,column)=>column.key==='end'?<span>Open-ended</span>:undefined}}/>);
 const table=await screen.findByRole('table');expect(await within(table).findByText('Open-ended')).toBeVisible();expect(within(table).getByText('Fictional rate')).toBeVisible();expect(within(table).getAllByRole('checkbox')).toHaveLength(2);
});
