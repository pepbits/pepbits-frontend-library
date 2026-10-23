import React,{useState} from 'react';
import {test,expect} from 'vitest';
import {screen,fireEvent} from '@testing-library/react';
import {render,TestHost} from '../test/render';
import {RecordSectionLayout,RecordSectionCard} from './index';
function Draft(){const [value,setValue]=useState('');return <input aria-label="Notes draft" value={value} onChange={e=>setValue(e.target.value)}/>;}
function Host(){const [active,setActive]=useState('notes');return <TestHost preferences={{formNavigation:"tabs"}}><RecordSectionLayout sections={[{id:'personal',title:'Personal'},{id:'notes',title:'Notes'}]} active={active} onActive={setActive} keepMounted isDone={()=>false} railHeader="Record" footer="Save" renderSection={s=>s.id==='notes'?<Draft/>:<p>Personal details</p>}/></TestHost>;}
test('tab navigation preserves host-owned notes draft while hiding inactive controls',()=>{
 render(<Host/>);fireEvent.change(screen.getByLabelText('Notes draft'),{target:{value:'Synthetic decision'}});fireEvent.click(screen.getByRole('tab',{name:'Personal'}));expect(screen.getByLabelText('Notes draft')).not.toBeVisible();fireEvent.click(screen.getByRole('tab',{name:'Notes'}));expect(screen.getByLabelText('Notes draft')).toHaveValue('Synthetic decision');expect(screen.getByLabelText('Notes draft')).toBeVisible();
});
test('numbered card exposes the shared reference heading and read action',()=>{
 let read=false;render(<RecordSectionCard id="personal" index={1} title="Personal information" subtitle="Core details" icon={<span/>} onRead={()=>{read=true;}}><p>Fields</p></RecordSectionCard>);expect(screen.getByRole('heading',{name:'Personal information'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Read'}));expect(read).toBe(true);
});
