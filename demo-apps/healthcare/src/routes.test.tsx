import React from 'react';
import {act,render,waitFor} from '@testing-library/react';
import {describe,expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {usePreferences} from '@pepbits/preferences/react';
import type {PreferencePolicy,UserPreferences} from '@pepbits/preferences';
import {HealthcareProviders} from './providers';
import {HealthcarePage} from './renderer';
import {pages,hrefFor,targetFromPath} from './navigation';
import {fixtureSession} from './test/session';
import {mockHttp} from './test/mock-http';
function DensityProbe(){return <span hidden data-effective-density={usePreferences().preferences.density}/>;}
const scenarios:{name:string;preferences:Partial<UserPreferences>;policy?:PreferencePolicy}[]=[
 {name:'default',preferences:{}},{name:'Arabic RTL',preferences:{language:'ar'}},{name:'reduced motion',preferences:{reducedMotion:true}},
 {name:'locked density',preferences:{density:'spacious'},policy:{revision:2,rules:{density:{value:'compact',locked:true}}}},
];
const cases=[...pages.map(page=>({id:page.id,target:{pageId:page.id}})),...["/lis1/orders/1", "/lis1/masters/tests", "/lis1/billing/1", "/lis1/reports/1", "/lis2/orders/1", "/lis2/masters/tests", "/lis2/patients/1", "/lis2/results/sample/1", "/lis2/print/order/1", "/lis2/print/labels?ids=1", "/ris1/patients/25", "/ris1/orders/1", "/ris1/reading/1", "/ris1/print/report/1", "/ris1/print/invoice/1", "/ris1/viewer/999"].map(path=>{const [pathname,query]=path.split('?');return {id:path,target:targetFromPath(pathname!,query)};})];
describe.each(scenarios)('$name',scenario=>{
 test.each(cases)('$id renders API data and page content passes axe',async page=>{
  const mock=mockHttp(scenario.preferences,scenario.policy),target=page.target;
  const navigation={current:target,hrefFor,open:vi.fn(),openInNewContext:vi.fn()};
  const {container}=render(<HealthcareProviders apiBaseUrl="/api" request={mock.request} session={fixtureSession} navigation={navigation}><HealthcarePage target={target}/><DensityProbe/></HealthcareProviders>);
  await waitFor(()=>expect(container.querySelector('[data-page-id]')).toBeInTheDocument(),{timeout:10000});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,50));});
  const content=container.querySelector('.healthcare-page') as HTMLElement;
  await waitFor(()=>expect(content.querySelector('[aria-busy=true]')).toBeNull());
  expect(mock.unexpected).toEqual([]);expect(content.textContent?.trim().length).toBeGreaterThan(15);
  expect(content.textContent).not.toContain('Loading Healthcare Suite');
  expect(content.textContent).not.toContain('Loading diagnostic workspace');
  expect(content.textContent).not.toContain('Something went wrong');
  expect(document.documentElement.dir).toBe(scenario.preferences.language==='ar'?'rtl':'ltr');
  expect(document.documentElement.dataset.reducedMotion).toBe(String(!!scenario.preferences.reducedMotion));
  if(scenario.policy)expect(container.querySelector('[data-effective-density]')?.getAttribute('data-effective-density')).toBe('compact');
  const result=await axe.run(content,{rules:{'color-contrast':{enabled:false}}});
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.slice(0,3).map(n=>n.html)}))).toEqual([]);
 });
});
