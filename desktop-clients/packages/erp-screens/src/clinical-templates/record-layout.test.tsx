import React,{useState} from 'react';
import {test,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {RecordSectionLayout,RecordSectionCard} from './record-layout';
function Draft(){const [value,setValue]=useState('');return <input aria-label="Consent draft" value={value} onChange={e=>setValue(e.target.value)}/>;}
function Host(){const [active,setActive]=useState('consent');return <RecordSectionLayout sections={[{id:'personal',title:'Personal'},{id:'consent',title:'Consent'}]} active={active} onActive={setActive} preferences={{...DEFAULT_PREFERENCES,formNavigation:'tabs'}} keepMounted isDone={()=>false} railHeader="Patient" footer="Save" renderSection={s=>s.id==='consent'?<Draft/>:<p>Personal details</p>}/>;}
test('tab navigation preserves host-owned consent draft while hiding inactive controls',()=>{
 render(<Host/>);fireEvent.change(screen.getByLabelText('Consent draft'),{target:{value:'Synthetic decision'}});fireEvent.click(screen.getByRole('tab',{name:'Personal'}));expect(screen.getByLabelText('Consent draft')).not.toBeVisible();fireEvent.click(screen.getByRole('tab',{name:'Consent'}));expect(screen.getByLabelText('Consent draft')).toHaveValue('Synthetic decision');expect(screen.getByLabelText('Consent draft')).toBeVisible();
});
test('numbered card exposes the shared reference heading and read action',()=>{
 let read=false;render(<RecordSectionCard id="personal" index={1} title="Personal information" subtitle="Core details" icon={<span/>} onRead={()=>{read=true;}}><p>Fields</p></RecordSectionCard>);expect(screen.getByRole('heading',{name:'Personal information'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Read'}));expect(read).toBe(true);
});
