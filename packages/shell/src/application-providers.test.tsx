import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {useSession,type SessionValue} from '@pepbits/platform/auth';
import {useRequest,type Request} from '@pepbits/platform/http';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {ApplicationProviders,useSettingsServices} from './application-providers';
import {useShell} from './shell-context';
import {product,port,session} from './test/host';
import {messages} from './test/messages';
import {preferenceMessages} from './test/preference-messages';
import type {PreferenceSnapshot} from '@pepbits/platform/preference-service';
const catalogs={...messages,...preferenceMessages,hello:'Hello fixture'};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
function service(){
 let snapshot:PreferenceSnapshot={preferences:{},overrides:{},policy:{revision:1,rules:{}},userRevision:1,canManage:true};
 const request=vi.fn<Request>(async(path,init)=>{
  if(path.startsWith('/localization'))return Response.json({messages:{...catalogs,hello:path.includes('language=ar')?'Arabic fixture':'Hello fixture'},fallbackMessages:catalogs});
  if(path==='/preferences'){if(init?.method==='PUT'){const body=JSON.parse(String(init.body));snapshot={...snapshot,overrides:body.preferences,preferences:body.preferences,userRevision:snapshot.userRevision+1};}return Response.json(snapshot);}
  throw new Error('Unexpected request '+path);
 });return {request,get:()=>snapshot,set:(next:Partial<PreferenceSnapshot>)=>{snapshot={...snapshot,...next};}};
}
function Probe(){
 const identity=useSession(),p=usePreferences(),locale=useLocalization(),shell=useShell(),request=useRequest(),settings=useSettingsServices()!;
 return <><output data-testid="wiring">{JSON.stringify({user:identity.user?.id,density:p.preferences.density,motion:p.preferences.reducedMotion,language:locale.language,direction:locale.direction,module:shell.currentModule,request:request===settings.request,canManage:settings.canManagePreferencePolicy,available:p.preferencesAvailable})}</output><p>{locale.t('hello')}</p><input aria-label="Unsaved note"/><button disabled={p.isLocked('density')} onClick={()=>void p.update({density:'spacious'})}>Density</button><button onClick={()=>void p.update({reducedMotion:true})}>Motion</button><button onClick={()=>void p.update({language:'ar'})}>Arabic</button><button onClick={()=>void settings.reload()}>Reload settings</button><output data-testid="save-error">{settings.saveError}</output></>;
}
const state=()=>JSON.parse(screen.getByTestId('wiring').textContent!);
function tree(request:Request,identity:SessionValue=session,productForRole=()=>product){return <ApplicationProviders productId="example" brand={{name:'Example',tagline:'Fictional'}} productForRole={productForRole} apiBaseUrl="/api" navigation={port} request={request} session={identity}><Probe/></ApplicationProviders>;}
test('gates descendants on session, preferences then catalog; binds every provider to the accepted identity',async()=>{
 const api=service(),preferences=deferred<Response>(),catalog=deferred<Response>(),roles=vi.fn(()=>product);
 const request=vi.fn<Request>((path)=>path==='/preferences'?preferences.promise:catalog.promise);
 const view=render(tree(request,{...session,status:'loading',user:null},roles));expect(request).not.toHaveBeenCalled();expect(screen.queryByTestId('wiring')).toBeNull();
 view.rerender(tree(request,session,roles));await waitFor(()=>expect(request).toHaveBeenCalledWith('/preferences'));expect(request).toHaveBeenCalledTimes(1);
 await act(async()=>preferences.resolve(Response.json(api.get())));await waitFor(()=>expect(request).toHaveBeenCalledWith('/localization?productId=example&language=en'));expect(screen.queryByTestId('wiring')).toBeNull();
 await act(async()=>catalog.resolve(Response.json({messages:catalogs,fallbackMessages:catalogs})));await screen.findByTestId('wiring');expect(state()).toMatchObject({user:session.user!.id,language:'en',direction:'ltr',module:'operations',request:true,canManage:true});expect(roles).toHaveBeenCalledWith('editor');
});
test('anonymous session shows sign-in without loading authenticated services',async()=>{
 const request=vi.fn();render(tree(request,{...session,status:'anonymous',user:null}));await screen.findByRole('button',{name:/sign in/i});expect(request).not.toHaveBeenCalled();expect(screen.queryByTestId('wiring')).toBeNull();
});
test('preference load error offers retry before mounting children',async()=>{
 const api=service();api.request.mockRejectedValueOnce(new Error('Offline'));render(tree(api.request));fireEvent.click(await screen.findByRole('button',{name:'Retry'}));await screen.findByTestId('wiring');await waitFor(()=>expect(api.request.mock.calls.filter(([path])=>path==='/preferences')).toHaveLength(2));
});
test('initial catalog error offers retry without exposing an unlocalized shell',async()=>{
 const api=service();let fail=true;const request:Request=(path,init)=>path.startsWith('/localization')&&fail?Promise.reject(new Error('Catalog unavailable')):api.request(path,init);render(tree(request));await screen.findByRole('button',{name:'Retry'});expect(screen.queryByTestId('wiring')).toBeNull();fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByTestId('wiring');
});
test('serializes adjacent writes against accepted revisions and merges overrides',async()=>{
 const api=service();render(tree(api.request));fireEvent.click(await screen.findByRole('button',{name:'Density'}));fireEvent.click(screen.getByRole('button',{name:'Motion'}));
 await waitFor(()=>expect(api.request.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(2));const writes=api.request.mock.calls.filter(([,init])=>init?.method==='PUT').map(([,init])=>JSON.parse(String(init?.body)));expect(writes[1]).toMatchObject({userRevision:2,policyRevision:1,preferences:{density:'spacious',reducedMotion:true}});await waitFor(()=>expect(state().motion).toBe(true));
});
test('rejected write leaves accepted state, exposes error, and reload restores availability',async()=>{
 const api=service();const request:Request=(path,init)=>init?.method==='PUT'?Promise.resolve(Response.json({error:'Revision conflict'},{status:409})):api.request(path,init);render(tree(request));fireEvent.click(await screen.findByRole('button',{name:'Density'}));await waitFor(()=>expect(screen.getByTestId('save-error')).toHaveTextContent('Revision conflict'));expect(state().density).not.toBe('spacious');expect(state().available).toBe(false);fireEvent.click(screen.getByRole('button',{name:'Reload settings'}));await waitFor(()=>expect(state().available).toBe(true));
});
test('policy refresh replaces effective values, rejects stale snapshots, and removes subscriptions on unmount',async()=>{
 const api=service(),remove=vi.spyOn(window,'removeEventListener');const view=render(tree(api.request));await screen.findByTestId('wiring');api.set({policy:{revision:2,rules:{density:{value:'compact',locked:true}}},userRevision:2});act(()=>window.dispatchEvent(new Event('pepbits-preference-policy-changed')));await waitFor(()=>expect(screen.getByRole('button',{name:'Density'})).toBeDisabled());expect(state().density).toBe('compact');
 api.set({policy:{revision:1,rules:{}},userRevision:1});fireEvent.click(screen.getByRole('button',{name:'Reload settings'}));await waitFor(()=>expect(api.request.mock.calls.filter(([path])=>path==='/preferences')).toHaveLength(3));expect(state().density).toBe('compact');view.unmount();expect(remove).toHaveBeenCalledWith('pepbits-preference-policy-changed',expect.any(Function));remove.mockRestore();
});
test('language refresh preserves unsaved controls and switches localization and direction',async()=>{
 const api=service();render(tree(api.request));const note=await screen.findByRole('textbox',{name:'Unsaved note'});fireEvent.change(note,{target:{value:'Keep fictional text'}});fireEvent.click(screen.getByRole('button',{name:'Arabic'}));await screen.findByText('Arabic fixture');expect(screen.getByRole('textbox',{name:'Unsaved note'})).toBe(note);expect(note).toHaveValue('Keep fictional text');expect(state()).toMatchObject({language:'ar',direction:'rtl'});
});
test('a changed session fences late preference responses and resets editor state',async()=>{
 const api=service(),late=deferred<Response>();api.request.mockImplementationOnce(()=>late.promise);const view=render(tree(api.request));await waitFor(()=>expect(api.request).toHaveBeenCalledOnce());view.rerender(tree(api.request,{...session,user:{...session.user!,id:'second'}}));await screen.findByTestId('wiring');expect(state().user).toBe('second');await act(async()=>late.resolve(Response.json({...api.get(),overrides:{density:'spacious'},userRevision:99})));expect(state().density).not.toBe('spacious');
});
