import React from 'react';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {ShellTestHost} from '../test/host';
import {PreferencesPage} from './index';

afterEach(()=>localStorage.clear());
test('policy administration is absent by default and disappears immediately when its host capability is removed',async()=>{
 localStorage.setItem('pepbits-session-token','test-session');
 const request=vi.fn(async(path:string)=>new Response(JSON.stringify(path==='/draft-policy'?{policy:{revision:0,enabled:true,retentionDays:7,excludedFields:[]},canManage:true}:{policy:{revision:0,rules:{}},history:[]})));
 const tree=(allowed?:boolean)=><ShellTestHost><PreferencesPage services={{request,canManagePreferencePolicy:allowed}}/></ShellTestHost>;
 const view=render(tree());expect(screen.queryByRole('tab',{name:'Preference policies'})).toBeNull();expect(request).not.toHaveBeenCalled();
 view.rerender(tree(true));fireEvent.click(screen.getByRole('tab',{name:'Preference policies'}));
 await waitFor(()=>expect(request).toHaveBeenCalledWith('/preference-policy',expect.anything()));
 expect(await screen.findByRole('button',{name:'Save policy'})).toBeVisible();
 const calls=request.mock.calls.length;view.rerender(tree(false));expect(screen.queryByRole('button',{name:'Save policy'})).toBeNull();expect(request).toHaveBeenCalledTimes(calls);
},15000);
test('restore uses the central guarded path and live managed values replace the page',()=>{
 const update=vi.fn();
 const tree=(locked:boolean)=><ShellTestHost settings={{preferences:{density:'compact'},update,preferencePolicy:{revision:1,rules:{density:{value:'spacious',locked}}}}}><PreferencesPage/></ShellTestHost>;
 const view=render(tree(false));fireEvent.click(screen.getByRole('tab',{name:'Page'}));expect(screen.getByLabelText('Density')).toHaveValue('compact');
 view.rerender(tree(true));expect(screen.getByLabelText('Density')).toHaveValue('spacious');expect(screen.getByLabelText('Density')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Restore defaults'}));expect(update).toHaveBeenCalled();expect(update.mock.calls[0]![0]).not.toHaveProperty('density');
});

test('boolean allowed values also constrain the inverse animation control',()=>{
 render(<ShellTestHost settings={{preferencePolicy:{revision:1,rules:{reducedMotion:{value:true,locked:false,allowedValues:[true]}}}}}><PreferencesPage/></ShellTestHost>);
 fireEvent.click(screen.getByRole('tab',{name:'Language & help'}));
 const controls=within(screen.getByRole('radiogroup',{name:'Animations'}));
 expect(controls.queryByRole('radio',{name:'On'})).toBeNull();expect(controls.getByRole('radio',{name:'Off'})).toHaveAttribute('aria-checked','true');
});
test('import applies only editable validated values through PreferenceHost',async()=>{
 const update=vi.fn();const view=render(<ShellTestHost settings={{update,preferencePolicy:{revision:1,rules:{density:{value:'spacious',locked:true}}}}}><PreferencesPage/></ShellTestHost>);
 const file=new File([''], 'settings.json',{type:'application/json'});Object.assign(file,{text:async()=>JSON.stringify({density:'compact',pageSize:50})});
 fireEvent.change(view.container.querySelector('input[type=file]')!,{target:{files:[file]}});
 await waitFor(()=>expect(update).toHaveBeenCalledOnce());expect(update.mock.calls[0]![0]).not.toHaveProperty('density');expect(update.mock.calls[0]![0]).toHaveProperty('pageSize',50);
});
