import React from 'react';
import {render,screen,act} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import axe from 'axe-core';
import {SchoolProviders} from './providers';
import {SchoolPage} from './renderer';
import {catalogs} from './test/host';
import {fixtureSession} from './test/session';
import type {Request} from './adapters/http';
const profiles=[['default',{}],['Arabic RTL',{language:'ar'}],['reduced motion',{reducedMotion:true}],['locked preference',{density:'spacious'}]] as const;
it.each(profiles)('preferences route: %s',async(name,preferences)=>{
 const policy={revision:1,rules:name==='locked preference'?{density:{value:'compact',locked:true}}:{}};
 const request:Request=async path=>Response.json(path==='/preferences'?{overrides:preferences,preferences,policy,userRevision:1,canManage:false}:{messages:catalogs[name==='Arabic RTL'?'ar':'en'],fallbackMessages:catalogs.en});
 const {container}=render(<SchoolProviders session={fixtureSession} request={request} apiBaseUrl="/api" navigation={{current:{pageId:'preferences'},hrefFor:()=>'/preferences',open:vi.fn(),openInNewContext:vi.fn()}}><SchoolPage target={{pageId:'preferences'}}/></SchoolProviders>);
 await screen.findByRole('combobox',{name:name==='Arabic RTL'?catalogs.ar['Column layout is saved']??'Column layout is saved':'Column layout is saved'});
 await act(async()=>expect((await axe.run(container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]));
});
