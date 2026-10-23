import {qualityRouteReady} from './modules/quality/test-fixtures';
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
function contentText(container:HTMLElement){return container.querySelector('.healthcare-page')?.textContent??'';}
function DensityProbe(){return <span hidden data-effective-density={usePreferences().preferences.density}/>;}
const scenarios:{name:string;preferences:Partial<UserPreferences>;policy?:PreferencePolicy}[]=[
 {name:'default',preferences:{}},{name:'Arabic RTL',preferences:{language:'ar'}},{name:'reduced motion',preferences:{reducedMotion:true}},
 {name:'locked density',preferences:{density:'spacious'},policy:{revision:2,rules:{density:{value:'compact',locked:true}}}},
];
const cases=[...pages.filter(page=>!hrefFor({pageId:page.id}).includes('[id]')).map(page=>({id:page.id,target:{pageId:page.id}})),...["/surgisuite/cases/472","/quality/indicators/7","/quality/reports/3","/teleconsult-provider/consult/a1","/teleconsult-patient/visit/a1","/teleconsult-patient/visit/a1/summary","/lis1/orders/1", "/lis1/masters/tests", "/lis1/billing/1", "/lis1/reports/1", "/lis2/orders/1", "/lis2/masters/tests", "/lis2/patients/1", "/lis2/results/sample/1", "/lis2/print/order/1", "/lis2/print/labels?ids=1", "/ris1/patients/25", "/ris1/orders/1", "/ris1/reading/1", "/ris1/print/report/1", "/ris1/print/invoice/1", "/ris1/viewer/999"].map(path=>{const [pathname,query]=path.split('?');return {id:path,target:targetFromPath(pathname!,query)};})];
describe.each(scenarios)('$name',scenario=>{
 test.each(cases)('$id renders API data and page content passes axe',async page=>{
  const mock=mockHttp(scenario.preferences,scenario.policy),target=page.target;
  const navigation={current:target,hrefFor,open:vi.fn(),openInNewContext:vi.fn()};
  const {container}=render(<HealthcareProviders apiBaseUrl="/api" request={mock.request} session={fixtureSession} navigation={navigation}><HealthcarePage target={target}/><DensityProbe/></HealthcareProviders>);
  await waitFor(()=>expect(container.querySelector('[data-page-id]')).toBeInTheDocument(),{timeout:10000});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,50));});
  if(page.id.startsWith('quality-')||page.id.startsWith('/quality/'))await waitFor(()=>expect(contentText(container)).not.toContain('AllyVora Quality is not available'));// API readiness is checked below.
  if(page.id.includes('teleconsult'))await waitFor(()=>expect(contentText(container)).not.toMatch(/Loading your session|Loading workspace/));
  if(page.id.startsWith('reference-rcm'))await waitFor(()=>expect(container.querySelector('[data-rcm-stage]')).toBeInTheDocument());
  if(page.id.includes('surgisuite'))await waitFor(()=>expect(container.querySelector('[data-tour=surgisuite-workspace] h1')).toBeInTheDocument());
  const content=container.querySelector('.healthcare-page') as HTMLElement;
  const ready=qualityRouteReady[target.pageId];if(ready)await waitFor(()=>expect(content.textContent).toContain(ready),{timeout:10000});
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
