import React,{useState} from 'react';
import {test,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {RecordPage,RecordIdentity,RecordNotice,RecordActionBar} from './index';
function Draft(){const [text,setText]=useState('');return <input aria-label="Customer note" value={text} onChange={e=>setText(e.target.value)}/>;}
test('a non-healthcare host uses shared record chrome and preserves a draft through navigation and preference changes',()=>{
 function Host(){const [active,setActive]=useState('details'),[layout,setLayout]=useState<'tabs'|'rail'>('tabs');return <><button onClick={()=>setLayout('rail')}>Use rail</button><RecordPage sections={[{id:'details',title:'Details',heading:'Customer details'},{id:'notes',title:'Notes',heading:'Customer notes'}]} active={active} onActive={setActive} preferences={{...DEFAULT_PREFERENCES,formNavigation:layout,density:'compact'}} isDone={()=>false} identity={<RecordIdentity label="Customer" name="Synthetic customer" reference="CUS-001"/>} actions={[]} renderSection={s=>s.id==='details'?<Draft/>:<RecordNotice>Notes for this customer</RecordNotice>}/></>;}
 const {container}=render(<Host/>);fireEvent.change(screen.getByLabelText('Customer note'),{target:{value:'Keep me'}});fireEvent.click(screen.getByRole('tab',{name:'Notes'}));expect(screen.getByLabelText('Customer note')).not.toBeVisible();fireEvent.click(screen.getByRole('tab',{name:'Details'}));expect(screen.getByLabelText('Customer note')).toHaveValue('Keep me');fireEvent.click(screen.getByRole('button',{name:'Use rail'}));expect(screen.getByLabelText('Customer note')).toHaveValue('Keep me');expect(container.querySelector('[data-layout]')).toHaveAttribute('data-sizing','container');expect(container.querySelector('[data-layout]')).toHaveAttribute('data-density','compact');expect(container.querySelector('[data-layout]')).not.toHaveStyle({height:'520px'});
});
test('action permissions stay with the host and feedback has an accessible role',()=>{
 const save=vi.fn();render(<><RecordActionBar actions={[{id:'save',label:'Save customer',primary:true,disabled:true,onClick:save},{id:'delete',label:'Delete customer',hidden:true,onClick:save}]}/><RecordNotice role="status">Saved</RecordNotice></>);fireEvent.click(screen.getByRole('button',{name:'Save customer'}));expect(save).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Delete customer'})).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('Saved');
});
