import React from 'react';
import {render,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import axe from 'axe-core';
import {TenantAdminProviders} from './providers';
import {TenantAdminRoute} from './renderer';
import {fixtureSession} from './test/session';
import {catalog} from './modules/tenant-admin/test-utils';
import {fixtureMeta} from './test/mock-api';
import {hrefFor} from './navigation';
import type {Request} from './adapters/http';
const messages=catalog('en'),target={pageId:'preferences'},navigation={current:target,hrefFor,open:vi.fn(),openInNewContext:vi.fn()};
test.each(['default','ar','motion','lock'])('preferences route uses the full host under %s',async profile=>{
 const request:Request=async(path)=>Response.json(path.startsWith('/localization')?{messages,fallbackMessages:messages}:path.endsWith('/meta')?fixtureMeta:{overrides:{language:profile==='ar'?'ar':'en',reducedMotion:profile==='motion'},preferences:{},policy:{revision:1,rules:profile==='lock'?{density:{value:'compact',locked:true}}:{}},userRevision:1,canManage:false});
 const {container}=render(<TenantAdminProviders apiBaseUrl="/api" navigation={navigation} request={request} session={fixtureSession}><TenantAdminRoute target={target}/></TenantAdminProviders>);
 await waitFor(()=>expect(container.querySelector('[data-page-id="preferences"]')).toBeTruthy());
 await waitFor(()=>expect(container.querySelectorAll('a[href^="/config/"]').length).toBe(fixtureMeta.resources.length));
 expect((await axe.run(container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
