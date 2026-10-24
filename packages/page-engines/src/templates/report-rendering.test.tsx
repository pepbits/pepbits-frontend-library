import {fireEvent,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {createFormatters} from '@pepbits/i18n';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {render} from '../test/render';
import {TemplateReport, type TemplateEngineProps} from './template-engines';
const props:TemplateEngineProps={preferences:DEFAULT_PREFERENCES,definition:{id:'r',title:'Example report',description:'',engine:'report',group:'',view:'table',layout:'rail',sections:[],columns:[{key:'name',label:'Name'},{key:'amount',label:'Amount',type:'number'}],stages:[],tags:[],editable:false,configuration:{reportDateKey:null,reportAmountKey:null}},document:{id:'r',version:1,values:{},lines:[],rows:[{id:'1',name:'One visible row',group:'Ready',amount:5}]},update:()=>{},disabled:true,errors:{},format:createFormatters(DEFAULT_PREFERENCES),density:'comfortable',precision:2,pageSize:10,resultView:'table'};
test.each(['table','cards'] as const)('%s uses host full-result subtotals even when only one row is displayed',resultView=>{
 const view=render(<TemplateReport {...props} resultView={resultView} groupBy="group" groupTotals={{Ready:{amount:900}}}/>);
 expect(view.container.querySelector('[data-report-subtotal]')).toHaveTextContent('900');expect(screen.getByText('One visible row')).toBeVisible();
});
test('controlled header sorting announces direction and sends a column key',()=>{
 const onSort=vi.fn();render(<TemplateReport {...props} sort={{key:'amount',direction:'desc'}} onSort={onSort}/>);
 expect(screen.getByRole('columnheader',{name:'Amount ↓'})).toHaveAttribute('aria-sort','descending');fireEvent.click(screen.getByRole('button',{name:'Amount ↓'}));expect(onSort).toHaveBeenCalledWith('amount');
});
