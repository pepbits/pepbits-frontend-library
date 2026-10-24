import React from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import axe from 'axe-core';
import type {PreferencePolicy,UserPreferences} from '@pepbits/preferences';
import {usePreferences} from '@pepbits/preferences/react';
import type {SessionValue} from '@pepbits/platform/auth';
import {CaregridProviders} from './providers';
import type {Request} from './adapters/http';
import {sharedMessages} from './test/host';
import {fixtureSession,readOnlySession} from './test/session';
import {FakeEventSource,createFakeEventSource,mockCaregrid} from './test/mock-api';
import {CaregridPage} from './renderer';
import {to} from './navigation';

afterEach(()=>{FakeEventSource.all=[];});
function Probe(){const {preferences,update,isLocked}=usePreferences();return <div><output data-testid="snapshot">{JSON.stringify(preferences)}</output><input aria-label="Unsaved note"/><button onClick={()=>void update({density:'spacious'})} disabled={isLocked('density')}>Density</button><button onClick={()=>void update({reducedMotion:true})}>Motion</button><button onClick={()=>void update({language:'ar'})}>Arabic</button><button onClick={()=>void update({keyboardShortcuts:false})}>Shortcuts off</button></div>;}
function service(preferences:Partial<UserPreferences>={},policy:PreferencePolicy={revision:1,rules:{}}){let snapshot={overrides:preferences,preferences,policy,userRevision:1,canManage:false};const writes:Record<string,unknown>[]=[];const request=vi.fn<Request>(async(path,init)=>{if(path.startsWith('/localization'))return Response.json({messages:sharedMessages,fallbackMessages:sharedMessages});if(path==='/preferences'){if(init?.method==='PUT'){const body=JSON.parse(String(init.body));writes.push(body);snapshot={...snapshot,overrides:body.preferences,preferences:body.preferences,userRevision:snapshot.userRevision+1};}return Response.json(snapshot);}throw new Error('Unexpected request '+path);});return {request,writes,setPolicy:()=>{snapshot={...snapshot,policy:{revision:2,rules:{density:{value:'compact',locked:true}}}};}};}
function mount(request:Request,children:React.ReactNode=<Probe/>,session:SessionValue=fixtureSession){
 const api=mockCaregrid(),navigation={current:to('caregrid-dashboard'),open:vi.fn(),openInNewContext:vi.fn(),hrefFor:()=>'/'};
 const view=render(<CaregridProviders apiBaseUrl="/api" navigation={navigation} request={request} session={session} client={api.client} createEventSource={createFakeEventSource}>{children}</CaregridProviders>);
 return {api,navigation,view};
}

// The four shared host cases retained from the healthcare and ERP hosts.
test('one serialized preference path retains adjacent writes and API revisions',async()=>{const host=service();mount(host.request);fireEvent.click(await screen.findByRole('button',{name:'Density'}));fireEvent.click(screen.getByRole('button',{name:'Motion'}));await waitFor(()=>expect(host.writes).toHaveLength(2));expect(host.writes[1]).toMatchObject({userRevision:2,policyRevision:1,preferences:{density:'spacious',reducedMotion:true}});});
test('language catalog refresh preserves the mounted editor',async()=>{const host=service();mount(host.request);const note=await screen.findByRole('textbox',{name:'Unsaved note'});fireEvent.change(note,{target:{value:'Fictional unsaved text'}});fireEvent.click(screen.getByRole('button',{name:'Arabic'}));await waitFor(()=>expect(host.request).toHaveBeenCalledWith('/localization?productId=nexora&language=ar'));expect(screen.getByRole('textbox',{name:'Unsaved note'})).toBe(note);expect(note).toHaveValue('Fictional unsaved text');await waitFor(()=>expect(document.documentElement.dir).toBe('rtl'));});
test('runtime tenant locks replace effective values and block writes',async()=>{const host=service();mount(host.request);await screen.findByRole('button',{name:'Density'});host.setPolicy();act(()=>window.dispatchEvent(new Event('pepbits-preference-policy-changed')));await waitFor(()=>expect(screen.getByRole('button',{name:'Density'})).toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Density'}));expect(host.writes).toHaveLength(0);expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).toBe('compact');});
test('rejected preference writes retain accepted state',async()=>{const host=service();const request:Request=(path,init)=>init?.method==='PUT'?Promise.resolve(Response.json({error:'Revision conflict'},{status:409})):host.request(path,init);mount(request);fireEvent.click(await screen.findByRole('button',{name:'Density'}));await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});expect(JSON.parse(screen.getByTestId('snapshot').textContent!).density).not.toBe('spacious');});

test('the header inbox shows live state, unread notices and opens notice links through navigation',async()=>{
 const host=service(),{api,navigation}=mount(host.request);
 const banner=await screen.findByRole('banner');const inbox=await waitFor(()=>{const el=banner.querySelector('[data-caregrid-inbox]');expect(el).toBeTruthy();return el as HTMLElement;});
 expect(within(inbox).getByRole('status')).toHaveTextContent('Connecting');
 act(()=>FakeEventSource.latest().emit('hello',{time:'2026-10-24T09:00'}));
 await waitFor(()=>expect(within(inbox).getByRole('status')).toHaveTextContent('Live updates on'));
 const unread=api.state.notifications.filter(n=>!n.read).length;
 const bell=await within(inbox).findByRole('button',{name:new RegExp(`Notifications, ${unread} unread`)});fireEvent.click(bell);
 const panel=await screen.findByRole('region',{name:'Notifications'});
 const linked=api.state.notifications.find(n=>n.link)!;
 fireEvent.click(within(panel).getByText(linked.title).closest('button')!);
 await waitFor(()=>expect(navigation.open).toHaveBeenCalled());expect(api.writes().some(c=>c.path===`/notifications/${linked.id}/read`)).toBe(true);
 act(()=>FakeEventSource.latest().emit('notification',{id:4242,created_at:'2026-10-24T09:05',level:'critical',category:'exception',title:'Fictional scanner stopped',body:'Three bookings affected',read:0}));
 expect(await screen.findByText(/Fictional scanner stopped/)).toBeInTheDocument();
 act(()=>FakeEventSource.latest().onerror?.(new Event('error')));
 await waitFor(()=>expect(within(inbox).getByRole('status')).toHaveTextContent(/Offline/));
});

test('the command palette searches scheduling records and the B shortcut respects preferences',async()=>{
 const host=service(),{navigation}=mount(host.request);
 await screen.findByRole('button',{name:'Density'});
 // The shell binds its shortcut listener in an effect; repeat the idempotent open until it is bound.
 const dialog=await waitFor(()=>{fireEvent.keyDown(window,{key:'k',code:'KeyK',ctrlKey:true});return screen.getByRole('dialog');});fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'mri'}});
 const services=await within(dialog).findByRole('group',{name:'Book a service'});fireEvent.click(within(services).getAllByRole('button')[0]!);
 await waitFor(()=>expect(navigation.open).toHaveBeenCalledWith(expect.objectContaining({pageId:'caregrid-book',query:expect.stringMatching(/^type=\d+$/)})));
 navigation.open.mockClear();
 fireEvent.keyDown(document.body,{key:'b',code:'KeyB'});expect(navigation.open).toHaveBeenCalledWith({pageId:'caregrid-book'});
 navigation.open.mockClear();fireEvent.click(screen.getByRole('button',{name:'Shortcuts off'}));
 await waitFor(()=>expect(host.writes.at(-1)).toMatchObject({preferences:{keyboardShortcuts:false}}));
 fireEvent.keyDown(document.body,{key:'b',code:'KeyB'});expect(navigation.open).not.toHaveBeenCalled();
});

test('the routed page renders through the shell with its quick Book action; read-only roles see disabled writes',async()=>{
 const host=service();mount(host.request,<CaregridPage target={to('caregrid-frontdesk')}/>,readOnlySession);
 await waitFor(()=>expect(document.querySelector('[data-flow-card]')).toBeTruthy());
 expect(screen.getAllByRole('button',{name:'Check in'})[0]).toBeDisabled();
 expect(within(screen.getByRole('banner')).getByRole('button',{name:'Book'})).toBeInTheDocument();
});

const profiles=[['default',{},undefined],['Arabic RTL',{language:'ar' as const},undefined],['reduced motion',{reducedMotion:true},undefined],['locked density',{density:'spacious' as const},{revision:1,rules:{density:{value:'compact',locked:true}}}]] as const;
test.each(profiles)('preferences route renders under %s with no axe violations',async(profile,preferences,policy)=>{
 const host=service(preferences,policy);
 mount(host.request,<CaregridPage target={to('preferences')}/>);
 const search=await screen.findByRole('textbox',{name:'Search settings'});
 expect(search).toBeInTheDocument();
 if(profile==='Arabic RTL')await waitFor(()=>expect(document.documentElement.dir).toBe('rtl'));
 // Inspect Page settings too, including the actual managed density control.
 fireEvent.click(screen.getByRole('tab',{name:'Page'}));
 const density=await screen.findByRole('combobox',{name:/Density/});
 if(policy){expect(density).toHaveValue('compact');expect(density).toBeDisabled();}
 await act(async()=>{expect((await axe.run(document.body,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});
