import {LocalizationProvider} from '@pepbits/ops-ui';
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {beforeEach, expect, test, vi} from 'vitest';
import {DEFAULT_PREFERENCES, UI_MESSAGES, type PreferencePolicy} from '@pepbits/erp-config';
import {PreferencesPage} from './index';
const state=vi.hoisted(()=>({policy:{revision:0,rules:{}} as PreferencePolicy,available:true,update:vi.fn()}));
vi.mock('@pepbits/erp-shell',()=>({TOUR_REVEAL_EVENT:'tour-reveal',useShellHost:()=>undefined,useProduct:()=>({modules:{finance:{id:'finance',label:'Finance'},library:{id:'library',label:'Library'}}}),useERP:()=>({preferences:DEFAULT_PREFERENCES,preferencePolicy:state.policy,preferencesAvailable:state.available,updatePreference:state.update,branch:'hq',t:(key:string)=>key,canManagePreferencePolicy:false})}));
beforeEach(()=>{state.policy={revision:0,rules:{}};state.available=true;state.update.mockClear();});
test('record layout and all three density options use the central preference update',()=>{
 render(<PreferencesPage/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Record form style'}),{target:{value:'wizard'}});
 expect(state.update).toHaveBeenCalledWith('formNavigation','wizard');
 fireEvent.change(screen.getByRole('combobox',{name:'Quick view style'}),{target:{value:'inline'}});
 expect(state.update).toHaveBeenCalledWith('previewMode','inline');
 fireEvent.click(screen.getByRole('tab',{name:'Page'}));
 const density=screen.getByRole('combobox',{name:'Density'});
 for(const value of ['compact','comfortable','spacious']){
  fireEvent.change(density,{target:{value}});
  expect(state.update).toHaveBeenCalledWith('density',value);
 }
});
test('live policy changes and unavailable preferences prevent layout updates',()=>{
 const view=render(<PreferencesPage/>);
 state.policy={revision:1,rules:{formNavigation:{locked:true,value:'rail'}}};
 view.rerender(<PreferencesPage/>);
 const layout=screen.getByRole('combobox',{name:'Record form style'});
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
 const own=()=> <LocalizationProvider value={{language:'en',direction:'ltr',t:key=>UI_MESSAGES.en[key]??key,dateTime:String}}><PreferencesPage/></LocalizationProvider>;
 const view=render(own());fireEvent.click(screen.getByRole('tab',{name:'Own Settings'}));
 const select=screen.getByRole('combobox',{name:'Default module'});
 expect(Array.from((select as HTMLSelectElement).options).map(o=>o.value)).toEqual(['','finance','library']);
 fireEvent.change(select,{target:{value:'library'}});expect(state.update).toHaveBeenCalledWith('defaultModule','library');
 state.update.mockClear();state.policy={revision:1,rules:{defaultModule:{value:'finance',locked:true}}};view.rerender(own());
 expect(select).toBeDisabled();fireEvent.change(select,{target:{value:'library'}});expect(state.update).not.toHaveBeenCalled();
});

test('tenant allowed options constrain the choices and reject programmatic changes',()=>{
 state.policy={revision:1,rules:{formNavigation:{value:'rail',locked:false,allowedValues:['rail','tabs']}}};
 render(<PreferencesPage/>);const layout=screen.getByRole('combobox',{name:'Record form style'});
 expect(Array.from((layout as HTMLSelectElement).options).map(o=>o.value)).not.toContain('wizard');
 fireEvent.change(layout,{target:{value:'wizard'}});expect(state.update).not.toHaveBeenCalled();
 fireEvent.change(layout,{target:{value:'tabs'}});expect(state.update).toHaveBeenCalledWith('formNavigation','tabs');
});
