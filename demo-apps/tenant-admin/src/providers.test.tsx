import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {usePreferences} from '@pepbits/preferences/react';
import {TenantAdminProviders} from './providers';
import {hrefFor} from './navigation';
import type {Request} from './adapters/http';
import {catalog,meta} from './modules/tenant-admin/test-utils';
import {fixtureSession} from './test/session';
const sharedMessages=catalog('en');
const navigation={current:{pageId:'overview'},open:vi.fn(),openInNewContext:vi.fn(),hrefFor};
function Probe(){const {preferences,update,isLocked}=usePreferences();return <div><output data-testid="snapshot">{JSON.stringify(preferences)}</output><input aria-label="Unsaved note"/><button onClick={()=>void update({density:'spacious'})} disabled={isLocked('density')}>Density</button><button onClick={()=>void update({reducedMotion:true})}>Motion</button><button onClick={()=>void update({language:'ar'})}>Arabic</button></div>;}
function service(registry:unknown=meta()){let snapshot={overrides:{},preferences:{},policy:{revision:1,rules:{}},userRevision:1,canManage:false};const writes:Record<string,any>[]=[];
 const request=vi.fn<Request>(async(path,init)=>{if(path.startsWith('/localization'))return Response.json({messages:sharedMessages,fallbackMessages:sharedMessages});
  if(path==='/reference-modules/tenant-admin/meta')return Response.json(registry);
  if(path==='/preferences'){if(init?.method==='PUT'){const body=JSON.parse(String(init.body));writes.push(body);snapshot={...snapshot,overrides:body.preferences,preferences:body.preferences,userRevision:snapshot.userRevision+1};}return Response.json(snapshot);}
  throw new Error('Unexpected request '+path);});
 return {request,writes,setPolicy:()=>{snapshot={...snapshot,policy:{revision:2,rules:{density:{value:'compact',locked:true}}}};}};}
function mount(request:Request,session=fixtureSession){return render(<TenantAdminProviders apiBaseUrl="/api" navigation={navigation} request={request} session={session}><Probe/></TenantAdminProviders>);}
test('one serialized preference path retains adjacent writes and API revisions',async()=>{const api=service();mount(api.request);fireEvent.click(await screen.findByRole('button',{name:'Density'}));fireEvent.click(screen.getByRole('button',{name:'Motion'}));await waitFor(()=>expect(api.writes).toHaveLength(2));expect(api.writes[1]).toMatchObject({userRevision:2,policyRevision:1,preferences:{density:'spacious',reducedMotion:true}});});
test('language catalog refresh preserves the mounted editor',async()=>{const api=service();mount(api.request);const note=await screen.findByRole('textbox',{name:'Unsaved note'});fireEvent.change(note,{target:{value:'Fictional unsaved text'}});fireEvent.click(screen.getByRole('button',{name:'Arabic'}));await waitFor(()=>expect(api.request).toHaveBeenCalledWith('/localization?productId=nexora&language=ar'));expect(screen.getByRole('textbox',{name:'Unsaved note'})).toBe(note);expect(note).toHaveValue('Fictional unsaved text');await waitFor(()=>expect(document.documentElement.dir).toBe('rtl'));});
test('runtime tenant locks replace effective values and block writes',async()=>{const api=service();mount(api.request);await screen.findByRole('button',{name:'Density'});api.setPolicy();act(()=>window.dispatchEvent(new Event('pepbits-preference-policy-changed')));await waitFor(()=>expect(screen.getByRole('button',{name:'Density'})).toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Density'}));expect(api.writes).toHaveLength(0);expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).toBe('compact');});
test('rejected preference writes retain accepted state and allow explicit recovery',async()=>{const api=service();const request:Request=(path,init)=>init?.method==='PUT'?Promise.resolve(Response.json({error:'Revision conflict'},{status:409})):api.request(path,init);mount(request);fireEvent.click(await screen.findByRole('button',{name:'Density'}));await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).not.toBe('spacious');});
test('the sidebar follows the API registry of the signed-in scope, with canonical labels and registry order',async()=>{
 const api=service();mount(api.request);
 const items=await screen.findByRole('link',{name:'Items and services'});expect(items.getAttribute('href')).toBe('/config/items');
 expect(screen.getByRole('link',{name:'Tax rules'}).getAttribute('href')).toBe('/config/tax-rules');expect(screen.getByRole('link',{name:'Reimbursement routes'}).getAttribute('href')).toBe('/config/reimbursement-routes');
expect(screen.getByRole('link',{name:'Approvals inbox'}).getAttribute('href')).toBe('/approvals');
 const order=[...document.querySelectorAll('a[href^="/config/"]')].map(a=>a.getAttribute('href'));expect(order).toEqual(['/config/items','/config/tax-rules','/config/reimbursement-routes']);
 const call=api.request.mock.calls.find(([path])=>path.endsWith('/meta'))!;expect(new Headers(call[1]?.headers).get('X-Reference-Branch')).toBe('hq');
});
test('a refused registry keeps only the workspace pages, and another identity starts without the previous registry',async()=>{
 const refused=vi.fn<Request>(async(path,init)=>path.endsWith('/meta')?Response.json({error:{code:'tenant-admin_forbidden',message:'Your role does not allow this action.'}},{status:403}):service().request(path,init));
 const view=mount(service().request);await screen.findByRole('link',{name:'Items and services'});
 view.rerender(<TenantAdminProviders apiBaseUrl="/api" navigation={navigation} request={refused} session={{...fixtureSession,user:{...fixtureSession.user!,id:'other-user',role:'tenant-config-viewer'}}}><Probe/></TenantAdminProviders>);
 await screen.findByRole('link',{name:'Approvals inbox'});await waitFor(()=>expect(refused).toHaveBeenCalledWith('/reference-modules/tenant-admin/meta',expect.anything()));
 await waitFor(()=>expect(document.querySelector('a[href^="/config/"]')).toBeNull());
});
