import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {usePresentationPreferences} from '@pepbits/components';
import {ReferenceHostProvider,ReferenceLink,referenceScopeKey,useReferenceFormat,useReferenceHost,useReferencePathname,useReferenceRouter,useReferenceSearchParams,type ReferenceHost} from './reference-host';

const host=(over:Partial<ReferenceHost>={}):ReferenceHost=>({scope:{tenantId:'fictional',applicationId:'example',branchId:'hq',moduleId:'reference-example',userId:'u1',roles:['b','a']},preferences:{...DEFAULT_PREFERENCES},request:vi.fn(),navigate:vi.fn(),path:'/items?open=7',...over});

describe('reference module host',()=>{
 it('throws without a host instead of rendering a module with no transport',()=>{
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  function Probe(){useReferenceHost();return null;}
  expect(()=>render(<Probe/>)).toThrow('Reference module host is missing');spy.mockRestore();
 });
 it('derives one scope key from tenant, application, branch, module, user and sorted roles',()=>{
  const a=host(),b=host({scope:{...host().scope,roles:['a','b']}}),c=host({scope:{...host().scope,branchId:'other'}});
  expect(referenceScopeKey(a.scope)).toBe(referenceScopeKey(b.scope));expect(referenceScopeKey(a.scope)).not.toBe(referenceScopeKey(c.scope));
 });
 it('exposes the module-relative path, a stable query and effective presentation',()=>{
  const seen:URLSearchParams[]=[];let path='',density='';
  function Probe(){path=useReferencePathname();seen.push(useReferenceSearchParams());density=usePresentationPreferences()!.density;return null;}
  const h=host();const view=render(<ReferenceHostProvider host={h}><Probe/></ReferenceHostProvider>);
  view.rerender(<ReferenceHostProvider host={{...h,preferences:{...h.preferences,density:'compact'}}}><Probe/></ReferenceHostProvider>);
  expect(path).toBe('/items');expect(seen[0]).toBe(seen[1]);expect(seen[0]!.get('open')).toBe('7');expect(density).toBe('compact');
 });
 it('routes plain clicks through the host navigator and keeps modified clicks native',()=>{
  const h=host({hrefFor:path=>'/app'+path});
  render(<ReferenceHostProvider host={h}><ReferenceLink href="/items?open=7">Open</ReferenceLink></ReferenceHostProvider>);
  const link=screen.getByRole('link',{name:'Open'});expect(link.getAttribute('href')).toBe('/app/items?open=7');
  fireEvent.click(link);expect(h.navigate).toHaveBeenCalledWith('/items?open=7');
  fireEvent.click(link,{ctrlKey:true});expect(h.navigate).toHaveBeenCalledTimes(1);
 });
 it('maps router push/replace to the navigator and formats with the effective preferences and translator',()=>{
  const h=host({preferences:{...DEFAULT_PREFERENCES,dateFormat:'dmy'}});let format!:ReturnType<typeof useReferenceFormat>,router!:ReturnType<typeof useReferenceRouter>;
  function Probe(){format=useReferenceFormat();router=useReferenceRouter();return null;}
  render(<LocalizationProvider value={{language:'en',direction:'ltr',dateTime:String,t:key=>key==='hello'?'Hello fixture':key}}><ReferenceHostProvider host={h}><Probe/></ReferenceHostProvider></LocalizationProvider>);
  router.replace('/a');router.push('/b');expect(h.navigate).toHaveBeenNthCalledWith(1,'/a');expect(h.navigate).toHaveBeenNthCalledWith(2,'/b');
  expect(format.t('hello')).toBe('Hello fixture');expect(format.date('2026-10-01')).toBe('01/10/2026');
 });
});
