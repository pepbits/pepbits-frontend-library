import React from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {describe,expect,test} from 'vitest';
import axe from 'axe-core';
import {usePreferences} from '@pepbits/preferences/react';
import type {PreferencePolicy,UserPreferences} from '@pepbits/preferences';
import {DemoProviders} from './providers';
import {AppFrame} from './app-frame';
import {GalleryPage} from './gallery';
import {areas,type AreaId} from './areas';
const locked:PreferencePolicy={revision:1,rules:{density:{value:'compact',locked:true}}};
function Probe(){const {preferences,update}=usePreferences();return <button onClick={()=>update({density:'spacious'})} data-testid="guard">{preferences.density}</button>;}
function mount(area:AreaId,preferences:Partial<UserPreferences>={},policy?:PreferencePolicy){return render(<DemoProviders area={area} initialPreferences={preferences} initialPolicy={policy}><AppFrame area={area}><GalleryPage area={area}/><Probe/></AppFrame></DemoProviders>);}
const scenarios=[{name:'default',preferences:{}},{name:'Arabic RTL',preferences:{language:'ar' as const}},{name:'reduced motion',preferences:{reducedMotion:true}},{name:'locked density',preferences:{density:'spacious' as const},policy:locked}];
describe.each(scenarios)('$name',scenario=>{
 test.each(areas)('$id renders and passes axe',async area=>{
  const {container}=mount(area.id,scenario.preferences,scenario.policy);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
  expect(container.querySelector('.page-heading h1')).toBeVisible();
  expect(document.documentElement.dir).toBe(scenario.preferences.language==='ar'?'rtl':'ltr');
  expect(document.documentElement.dataset.reducedMotion).toBe(String(!!scenario.preferences.reducedMotion));
  if(scenario.policy){const density=screen.getAllByRole('combobox').find(element=>(element as HTMLSelectElement).value==='compact')!;expect(density).toBeDisabled();fireEvent.change(density,{target:{value:'spacious'}});fireEvent.click(screen.getByTestId('guard'));expect(screen.getByTestId('guard')).toHaveTextContent('compact');}
  const result=await axe.run(container,{rules:{'color-contrast':{enabled:false}}});
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);
 });
});
test('live locks replace values and restricted page sizes are enforced',async()=>{
 mount('playground');fireEvent.click(screen.getByRole('switch',{name:'Lock density'}));expect(screen.getByTestId('guard')).toHaveTextContent('compact');
 fireEvent.click(screen.getByRole('switch',{name:'Restrict page sizes'}));const size=screen.getByRole('combobox',{name:'pageSize'});expect(within(size).getAllByRole('option').map(option=>option.getAttribute('value'))).toEqual(['10','20']);fireEvent.change(size,{target:{value:'100'}});expect(size).toHaveValue('10');
});
test('record form saves fictional edits through the public memory adapter',async()=>{mount('page-engines');const field=await screen.findByRole('textbox',{name:/Item name/});await waitFor(()=>expect(field).toBeEnabled());fireEvent.change(field,{target:{value:'Changed fictional item'}});const form=document.querySelector('[data-example="form"]')!;fireEvent.click(within(form as HTMLElement).getByRole('button',{name:'Save'}));await waitFor(()=>expect(within(form as HTMLElement).getByText('Saved',{exact:true})).toBeVisible());expect(field).toHaveValue('Changed fictional item');});
test('overlays open, label fields, and close with Escape',async()=>{mount('components');fireEvent.click(screen.getByRole('button',{name:'Modal'}));const dialog=await screen.findByRole('dialog');expect(within(dialog).getByRole('textbox',{name:'Name'})).toBeVisible();const result=await axe.run(dialog,{rules:{'color-contrast':{enabled:false}}});expect(result.violations).toEqual([]);fireEvent.keyDown(document,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());});
