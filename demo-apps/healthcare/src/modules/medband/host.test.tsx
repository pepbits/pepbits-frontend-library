import React from 'react';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {hrefFor,targetFromPath,healthcareProductForRole} from '../../navigation';
import {ReferenceMedbandModule} from './module';
import {makeHost,sessionHandler} from './test-utils';
import {medbandRoutes} from './routes';
describe('MedBand independent host',()=>{
 it.each(medbandRoutes)('$path round trips with query and dynamic identifiers',route=>{
  const path='/medband'+(route.path==='/'?'':route.path.replace('[id]','patient-123'));
  const target=targetFromPath(path,'type=IP&patientId=patient-123');
  expect(target.pageId).toBe('medband-'+route.kind);expect(hrefFor(target)).toBe(path+'?type=IP&patientId=patient-123');
 });
 it.each(['/medband/unknown','/medband/patients/%2f','/medband/%2e%2e','/medband/patients/%00'])('refuses %s',path=>expect(targetFromPath(path).pageId).toBe('not-found'));
 it('shows the header only for the API role grants and never adds Tenant Admin',()=>{
  for(const role of ['enterprise-admin','medband-admin','medband-reception','medband-admissions','medband-clinician','medband-viewer'])expect(healthcareProductForRole(role).modules['reference-medband']).toBeDefined();
  for(const role of ['operations-analyst','teleconsult-patient'])expect(healthcareProductForRole(role).modules['reference-medband']).toBeUndefined();
  expect(healthcareProductForRole('enterprise-admin').modules['reference-tenant-admin']).toBeUndefined();
 });
 it('preserves a registration editor through effective preference changes and disables shortcuts while mounted',async()=>{
  const first=makeHost(sessionHandler(),{path:'/patients/new'}),view=render(<ReferenceMedbandModule path="/patients/new" host={first.host}/>);
  fireEvent.change(await screen.findByLabelText(/^First name/),{target:{value:'Retained fictional name'}});
  view.rerender(<ReferenceMedbandModule path="/patients/new" host={{...first.host,preferences:{...first.host.preferences,language:'ar',density:'compact',theme:'midnight',keyboardShortcuts:false}}}/>);
  await waitFor(()=>expect(view.container.querySelector('.reference-medband')).toHaveAttribute('data-density','compact'));
  expect(screen.getByLabelText(/^First name/)).toHaveValue('Retained fictional name');fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('uses the shared asynchronous patient lookup and keyboard selection after loading results',async()=>{
  const h=makeHost(sessionHandler(),{path:'/encounters/new'});render(<ReferenceMedbandModule path="/encounters/new" host={h.host}/>);
  const input=await screen.findByRole('combobox',{name:'Search patient'});fireEvent.change(input,{target:{value:'MRN-A-001'}});
  await within(await screen.findByRole('listbox',{name:'Search patient'})).findByRole('option');fireEvent.keyDown(input,{key:'Enter'});
  await waitFor(()=>expect(screen.getAllByText('Asha TesterA').length).toBeGreaterThan(0));expect(screen.queryByRole('listbox',{name:'Search patient'})).toBeNull();
 });
});
