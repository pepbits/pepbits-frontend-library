import {ShellTestHost} from "../test/host";
import { LocalizationProvider } from "@pepbits/i18n/react";
import React from 'react';
import {render as renderUI, screen, fireEvent} from '@testing-library/react';
import {beforeEach, expect, test, vi} from 'vitest';
import {DEFAULT_PREFERENCES, type PreferencePolicy} from '@pepbits/preferences';
import {PreferencesPage} from './index';
const state=vi.hoisted(()=>({policy:{revision:0,rules:{}} as PreferencePolicy,available:true,update:vi.fn()}));
function Host({children}:{children:React.ReactNode}) {return <ShellTestHost settings={{preferencePolicy:state.policy,preferencesAvailable:state.available,update:state.update}}>{children}</ShellTestHost>;}
function render(ui:React.ReactNode){return renderUI(ui,{wrapper:Host});}

beforeEach(()=>{state.policy={revision:0,rules:{}};state.available=true;state.update.mockClear();});
test('record layout and all three density options use the central preference update',()=>{
 render(<PreferencesPage/>);
 fireEvent.change(screen.getByLabelText('Record form style'),{target:{value:'wizard'}});
 expect(state.update).toHaveBeenCalledWith({formNavigation:'wizard'});
 fireEvent.change(screen.getByLabelText('Quick view style'),{target:{value:'inline'}});
 expect(state.update).toHaveBeenCalledWith({previewMode:'inline'});
 fireEvent.click(screen.getByRole('tab',{name:'Page'}));
 const density=screen.getByLabelText('Density');
 for(const value of ['compact','comfortable','spacious']){
  fireEvent.change(density,{target:{value}});
  expect(state.update).toHaveBeenCalledWith({density:value});
 }
},20000);
test('live policy changes and unavailable preferences prevent layout updates',()=>{
 const view=render(<PreferencesPage/>);
 state.policy={revision:1,rules:{formNavigation:{locked:true,value:'rail'}}};
 view.rerender(<PreferencesPage/>);
 const layout=screen.getByLabelText('Record form style');
 expect(layout).toBeDisabled();
 fireEvent.change(layout,{target:{value:'wizard'}});
 expect(state.update).not.toHaveBeenCalled();
 state.policy={revision:2,rules:{}};state.available=false;
 view.rerender(<PreferencesPage/>);
 expect(layout).toBeDisabled();
 fireEvent.change(layout,{target:{value:'tabs'}});
 expect(state.update).not.toHaveBeenCalled();
});

test('Own Settings uses accessible module options and honors locks',()=>{
 const own=()=> <PreferencesPage/>;
 const view=render(own());fireEvent.click(screen.getByRole('tab',{name:'Own Settings'}));
 const select=screen.getByLabelText('Default module');
 expect(Array.from((select as HTMLSelectElement).options).map(o=>o.value)).toEqual(['','operations','resources']);
 fireEvent.change(select,{target:{value:'resources'}});expect(state.update).toHaveBeenCalledWith({defaultModule:'resources'});
 state.update.mockClear();state.policy={revision:1,rules:{defaultModule:{value:'operations',locked:true}}};view.rerender(own());
 expect(select).toBeDisabled();fireEvent.change(select,{target:{value:'resources'}});expect(state.update).not.toHaveBeenCalled();
});

test('tenant allowed options constrain the choices and reject programmatic changes',()=>{
 state.policy={revision:1,rules:{formNavigation:{value:'rail',locked:false,allowedValues:['rail','tabs']}}};
 render(<PreferencesPage/>);const layout=screen.getByLabelText('Record form style');
 expect(Array.from((layout as HTMLSelectElement).options).map(o=>o.value)).not.toContain('wizard');
 fireEvent.change(layout,{target:{value:'wizard'}});expect(state.update).not.toHaveBeenCalled();
 fireEvent.change(layout,{target:{value:'tabs'}});expect(state.update).toHaveBeenCalledWith({formNavigation:'tabs'});
});
