import React,{useEffect,useState,type ReactNode} from 'react';
import {render,renderHook,cleanup} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {ReferenceHostProvider,useReferenceSearchParams,type ReferenceHost} from './index';
afterEach(cleanup);
const host:ReferenceHost={scope:{tenantId:'synthetic',applicationId:'nexora',branchId:'hq',userId:'test',roles:['enterprise-admin']},preferences:DEFAULT_PREFERENCES,request:vi.fn(),navigate:vi.fn(),path:'/book?patient_id=42'};
describe('reference search parameter lifecycle',()=>{
 it('does not restart an effect when its own state updates without a query change',()=>{
  const effects=vi.fn();
  function Probe(){
   const params=useReferenceSearchParams();const [updates,setUpdates]=useState(0);
   useEffect(()=>{effects(params.get('patient_id'));if(updates<2)setUpdates(updates+1);},[params]);
   return <p>{updates}</p>;
  }
  render(<ReferenceHostProvider host={host}><Probe/></ReferenceHostProvider>);
  expect(effects).toHaveBeenCalledTimes(1);
  expect(effects).toHaveBeenCalledWith('42');
 });
 it('keeps the same query stable across host rerenders and updates it on navigation',()=>{
  function wrapper({children}:{children:ReactNode}){return <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>;}
  const {result,rerender}=renderHook(()=>useReferenceSearchParams(),{wrapper});
  const first=result.current;rerender();expect(result.current).toBe(first);
 });
 it('replaces the query after a route change and handles a route without parameters',()=>{
  const seen:URLSearchParams[]=[];
  function Probe(){seen.push(useReferenceSearchParams());return null;}
  const {rerender}=render(<ReferenceHostProvider host={host}><Probe/></ReferenceHostProvider>);
  rerender(<ReferenceHostProvider host={{...host,path:'/patients?patient_id=42'}}><Probe/></ReferenceHostProvider>);
  expect(seen.at(-1)).toBe(seen[0]);
  rerender(<ReferenceHostProvider host={{...host,path:'/book?patient_id=57'}}><Probe/></ReferenceHostProvider>);
  expect(seen.at(-1)?.get('patient_id')).toBe('57');expect(seen.at(-1)).not.toBe(seen[0]);
  rerender(<ReferenceHostProvider host={{...host,path:'/calendar'}}><Probe/></ReferenceHostProvider>);
  expect(seen.at(-1)?.toString()).toBe('');
 });
});
