import {act,waitFor} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import axe from 'axe-core';
import {renderDesktop} from './test/render';
import {mockApi} from './test/mock-api';
import {hrefFor,targetFromPath} from './navigation';

/* Every desktop route through the full host: session, API preferences/policy, runtime catalog, shell and workspace. */
const routes:Array<[path:string,pageId:string,ready:string]>=[
 ['/','desktop-overview','[data-desktop-overview]'],
 ['/overview','desktop-overview','[data-desktop-overview]'],
 ['/finance/customers','customer-master','tbody tr'],
 ['/finance/customers/CUS-1','customer-master','[data-page-id="customer-master"] input[disabled]'],
 ['/finance/customers/CUS-1/edit','customer-master','[data-page-id="customer-master"] input:not([disabled])'],
 ['/finance/customers/new','customer-master','[data-page-id="customer-master"] input:not([disabled])'],
 ['/library/components','component-examples','[data-library-examples] dl'],
 ['/hr/employees','employee-worklist','tbody tr'],
 ['/hr/employees/EMP-1','employee-worklist','[data-record-page] dl'],
 ['/preferences','preferences','[data-page-id="preferences"] select'],
 ['/finance/unknown-page','not-found','[data-page-id="not-found"]'],
];
const profiles=[
 ['default',{},{},()=>expect(document.documentElement.dir).toBe('ltr')],
 ['Arabic RTL',{language:'ar'},{},()=>expect(document.documentElement.dir).toBe('rtl')],
 ['reduced motion',{reducedMotion:true},{},()=>expect(document.documentElement.dataset.reducedMotion).toBe('true')],
 ['locked density',{density:'spacious'},{density:{value:'compact',locked:true}},()=>expect(document.documentElement.style.getPropertyValue('--row-py')).toBe('6px')],
] as const;

describe.each(profiles)('%s',(_profile,preferences,rules,applied)=>{
 it.each(routes)('%s renders %s without axe violations',async(path,pageId,ready)=>{
  const {container}=renderDesktop(path,{api:mockApi({preferences,rules})});
  await waitFor(()=>expect(container.querySelector(`[data-page-id="${pageId}"]`)).toBeTruthy());
  await waitFor(()=>expect(container.querySelector(ready)).toBeTruthy());
  await waitFor(()=>expect(container.querySelector('[aria-busy="true"]')).toBeNull());
  await waitFor(applied);
  expect(targetFromPath(window.location.pathname)).toEqual(targetFromPath(path));
  await act(async()=>{expect((await axe.run(container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
 });
});

describe('address mapping',()=>{
 it.each(routes)('%s round-trips through hrefFor',(path)=>{const target=targetFromPath(path);expect(targetFromPath(hrefFor(target))).toEqual(target);});
 it('rejects malformed, nested and unsupported record addresses',()=>{
  for(const path of ['/finance/customers/a/b','/finance/customers/%E0%A4%A','/finance/customers/%2F','/hr/employees/new','/hr/employees/EMP-1/edit','/library/components/x'])expect(targetFromPath(path)).toEqual({pageId:'not-found'});
  expect(targetFromPath('/index.html')).toEqual({pageId:'desktop-overview'});
  expect(hrefFor({pageId:'customer-master',recordId:'CUS 1/2',mode:'edit'})).toBe('/finance/customers/CUS%201%2F2/edit');
  expect(targetFromPath('/finance/customers/CUS%201%2F2/edit')).toEqual({pageId:'not-found'});
  expect(targetFromPath('/finance/customers/CUS%201/edit')).toEqual({pageId:'customer-master',mode:'edit',recordId:'CUS 1'});
 });
});
