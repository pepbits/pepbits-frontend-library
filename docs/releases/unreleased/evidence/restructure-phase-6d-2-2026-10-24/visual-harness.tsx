/** Test-only paired source renderer. This file is never imported by the Next application. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ReferenceSchoolModule as OriginalSchool} from '../../../../../desktop-clients/packages/reference-school/src/module';
import {createFakeBackend as originalBackend, fakeHost as originalHost} from '../../../../../desktop-clients/packages/reference-school/src/test-support/fake-host.test-support';
import {LocalizationProvider as OriginalLocalization} from '../../../../../desktop-clients/packages/ops-ui/src/localization';
import {ReferenceSchoolModule as DemoSchool} from '../../../../../demo-apps/school/src/modules/school/module';
import {createFakeBackend as demoBackend, fakeHost as demoHost} from '../../../../../demo-apps/school/src/modules/school/test-support/fake-host.test-support';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {PreferenceHost} from '@pepbits/preferences/react';
import {ScreenHostProvider} from '@pepbits/patterns/screen-host';
const roots=new Map();
window.renderParity=async function(side,path,role,preferences,catalog){
  let root=roots.get(side);if(!root){root=createRoot(document.getElementById(side));roots.set(side,root);}
  const backend=side==='source'?originalBackend():demoBackend();
  const host=(side==='source'?originalHost:demoHost)(backend,{roles:[role],preferences});
  const language=host.preferences.language,loc={language,direction:language==='ar'?'rtl':'ltr',dateTime:String,t:(key,values)=>String(catalog[key]??key).replace(/\{(\w+)\}/g,(match,key)=>values?.[key]===undefined?match:String(values[key]))};
  const Provider=side==='source'?OriginalLocalization:LocalizationProvider;
  const Module=side==='source'?OriginalSchool:DemoSchool;
  root.render(<Provider value={loc}><PreferenceHost preferences={host.preferences} preferencePolicy={host.preferenceHost?.preferencePolicy} update={patch=>{for(const [key,value] of Object.entries(patch))host.preferenceHost?.onPreferenceChange?.(key,value);}}><ScreenHostProvider value={{can:()=>true}}><main key={path+role+JSON.stringify(preferences)}><Module path={path} host={host}/></main></ScreenHostProvider></PreferenceHost></Provider>);
  await new Promise(resolve=>setTimeout(resolve,200));
  while(backend.pending)await new Promise(resolve=>setTimeout(resolve,50));
  return host.preferences;
};
