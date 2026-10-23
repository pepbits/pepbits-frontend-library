import React from 'react';
import {fireEvent,screen,waitFor,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {render} from './render-test';
import {ReferenceTeleconsultPatientModule} from './patient/module';
import {ReferenceTeleconsultProviderModule} from './provider/module';
import {makeHost,patient,patientHandler,providerHandler} from './test-utils';
import {productForRole} from '@pepbits/shell';
import {product,healthcareProductForRole} from '../../navigation';
it('keeps registration input and its transport mounted through effective language and density changes',async()=>{
 const {host,fetch}=makeHost(patientHandler({patients:[patient()],bound:'p8',canRegister:true}));
 const view=render(<ReferenceTeleconsultPatientModule path="/register" host={host}/>);
 const input=await screen.findByRole('textbox',{name:'First name'});fireEvent.change(input,{target:{value:'Synthetic retained'}});
 const sessions=fetch.mock.calls.filter(([path])=>path==='/api/session').length;
 view.rerender(<ReferenceTeleconsultPatientModule path="/register" host={{...host,preferences:{...host.preferences,language:'ar',density:'compact',reducedMotion:true}}}/>);
 expect(screen.getByRole('textbox',{name:'First name'})).toHaveValue('Synthetic retained');
 await waitFor(()=>expect(fetch.mock.calls.filter(([path])=>path==='/api/session')).toHaveLength(sessions));
 expect(view.container.querySelector('[data-density]')).toHaveAttribute('data-density','compact');
});
it('renders the managed page size and disables local changes when the policy locks it while mounted',async()=>{
 const {host}=makeHost(providerHandler({roles:['doctor']}));const update=vi.fn();
 const initial={...host,preferenceHost:{preferences:host.preferences,onPreferenceChange:update}};
 const view=render(<ReferenceTeleconsultProviderModule path="/patients" host={initial}/>);
 await screen.findByText("Sarah O'Connor");const select=await screen.findByRole('combobox',{name:/rows.per.page|Rows per page/i});
 fireEvent.change(select,{target:{value:'50'}});expect(update).toHaveBeenCalledWith('pageSize',50);
 const preferences={...host.preferences,pageSize:10 as const};
 view.rerender(<ReferenceTeleconsultProviderModule path="/patients" host={{...host,preferences,preferenceHost:{preferences,preferencePolicy:{revision:2,rules:{pageSize:{value:10,locked:true}}},onPreferenceChange:update}}}/>);
 expect(select).toHaveValue('10');expect(select).toBeDisabled();fireEvent.change(select,{target:{value:'100'}});expect(update).toHaveBeenCalledTimes(1);
 expect(within(screen.getByRole('table')).getByText("Sarah O'Connor")).toBeInTheDocument();
});
it('keeps exactly two Teleconsult modules and filters provider/patient page grants for dedicated roles',()=>{
 expect(Object.keys(product.modules).filter(id=>id.startsWith('reference-teleconsult-'))).toHaveLength(2);
 for(const role of ['teleconsult-doctor','teleconsult-nurse','teleconsult-patient']){
  const granted=productForRole(healthcareProductForRole(role),role),variant=role==='teleconsult-patient'?'patient':'provider';
  expect(Object.keys(granted.modules).filter(id=>id.startsWith('reference-teleconsult-'))).toEqual(['reference-teleconsult-'+variant]);
  expect(Object.keys(granted.pages).filter(id=>id.startsWith('teleconsult-')).every(id=>id.startsWith('teleconsult-'+variant+'-'))).toBe(true);
 }
});
