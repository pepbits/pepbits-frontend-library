import React,{useState} from 'react';
import {test,expect,vi} from 'vitest';
import {screen,fireEvent} from '@testing-library/react';
import {render,TestHost} from '@pepbits/patterns/testing';
import {RecordPage,RecordIdentity,RecordNotice,RecordActionBar} from './index';
function Draft(){const [text,setText]=useState('');return <input aria-label="Item note" value={text} onChange={e=>setText(e.target.value)}/>;}
test('a generic host uses shared record chrome and preserves a draft through navigation and preference changes',()=>{
 function Host(){const [active,setActive]=useState('details'),[layout,setLayout]=useState<'tabs'|'rail'>('tabs');return <><button onClick={()=>setLayout('rail')}>Use rail</button><TestHost preferences={{formNavigation:layout,density:"compact"}}><RecordPage sections={[{id:'details',title:'Details',heading:'Item details'},{id:'notes',title:'Notes',heading:'Item notes'}]} active={active} onActive={setActive} isDone={()=>false} identity={<RecordIdentity label="Item" name="Synthetic item" reference="ITEM-001"/>} actions={[]} renderSection={s=>s.id==='details'?<Draft/>:<RecordNotice>Notes for this item</RecordNotice>}/></TestHost></>;}
 const {container}=render(<Host/>);fireEvent.change(screen.getByLabelText('Item note'),{target:{value:'Keep me'}});fireEvent.click(screen.getByRole('tab',{name:/ Notes$/}));expect(screen.getByLabelText('Item note')).not.toBeVisible();fireEvent.click(screen.getByRole('tab',{name:/ Details$/}));expect(screen.getByLabelText('Item note')).toHaveValue('Keep me');fireEvent.click(screen.getByRole('button',{name:'Use rail'}));expect(screen.getByLabelText('Item note')).toHaveValue('Keep me');expect(container.querySelector('[data-layout]')).toHaveAttribute('data-sizing','container');expect(container.querySelector('[data-layout]')).toHaveAttribute('data-density','compact');expect(container.querySelector('[data-layout]')).not.toHaveStyle({height:'520px'});
});
test('action permissions stay with the host and feedback has an accessible role',()=>{
 const save=vi.fn();render(<><RecordActionBar actions={[{id:'save',label:'Save item',primary:true,disabled:true,onClick:save},{id:'delete',label:'Delete item',hidden:true,onClick:save}]}/><RecordNotice role="status">Saved</RecordNotice></>);fireEvent.click(screen.getByRole('button',{name:'Save item'}));expect(save).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Delete item'})).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('Saved');
});
