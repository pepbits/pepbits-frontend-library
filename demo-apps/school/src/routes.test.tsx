import React from 'react';
import {act,render,waitFor} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import axe from 'axe-core';
import {createTranslator,directionOf} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {readFileSync} from 'node:fs';
import {ReferenceSchoolModule} from './modules/school/test-support/module';
import {SCHOOL_ROUTES} from './modules/school/routes';
import {SCHOOL_ROLE_VIEWS} from './modules/school/role-views';
import {createFakeBackend,fakeHost} from './modules/school/test-support/fake-host.test-support';
const catalogs=Object.fromEntries(['en','ar'].map(language=>[language,JSON.parse(readFileSync(process.cwd()+`/../../dummy-api/config/localization/shared/${language}.json`,'utf8')).messages]));
const profiles=[['default',{},{}],['Arabic RTL',{language:'ar'},{}],['reduced motion',{reducedMotion:true},{}],['locked density',{density:'spacious'},{density:{value:'compact',locked:true}}]] as const;
const cases=[...SCHOOL_ROUTES.map(route=>({name:route.path,path:route.path.replace(':id',route.id==='quiz-player'?'qz-1':'lv-1'),role:'admin'})),...SCHOOL_ROLE_VIEWS.filter(view=>view.role!=='admin').map(view=>({name:view.role+' dashboard',path:'/dashboard',role:view.role}))];
describe.each(profiles)('%s route rendering',(profile,preferences,rules)=>{
 it.each(cases)('$name',async({path,role})=>{
  const backend=createFakeBackend(),host=fakeHost(backend,{roles:[role],preferences,policy:{revision:1,rules}}),language=host.preferences.language;
  const {container}=render(<LocalizationProvider value={{language,direction:directionOf(language),t:createTranslator({language,catalogs}),dateTime:String}}><main><ReferenceSchoolModule path={path} host={host}/></main></LocalizationProvider>);
  await waitFor(()=>expect(container.querySelector('.reference-school-root')).toHaveAttribute('data-role',role));
  await waitFor(()=>expect(backend.pending).toBe(0));
  await waitFor(()=>expect(container.querySelector('.reference-school-root')!.textContent!.length).toBeGreaterThan(120));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});
  expect(container.querySelector('[role="alert"]')).toBeNull();
  if(profile==='Arabic RTL')expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
  if(profile==='reduced motion')expect(container.querySelector('.reference-school-root')).toHaveAttribute('data-reduced-motion','true');
  // The controlled test host projects effective policy exactly as the application host does.
  await act(async()=>expect((await axe.run(container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]));
 });
});
