import React from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {describe,expect,test,vi} from 'vitest';
import axe from 'axe-core';
import {useNavigation} from '@pepbits/platform';
import type {PreferencePolicy,UserPreferences} from '@pepbits/preferences';
import {DemoProviders} from './providers';
import {AppFrame} from './app-frame';
import {areas,type AreaId} from './areas';
import {createAiSimulation} from './ai-simulation';
const mount=(area:AreaId='foundations',options:Partial<React.ComponentProps<typeof DemoProviders>>={})=>render(<DemoProviders area={area} {...options}><AppFrame/></DemoProviders>);
const gallery=(area:string)=>document.getElementById('gallery-'+area)!;
const header=()=>within(document.querySelector('header')!);
const rail=()=>screen.getByRole('complementary',{name:'Primary navigation'});
async function openPalette(){fireEvent.click(header().getByRole('button',{name:/Search/}));return screen.findByRole('dialog',{name:'Open page or command'});}

describe.each([true,false])('navigation with shortcuts %s',keyboardShortcuts=>{
 test.each(areas)('sidebar reaches $id',async area=>{
  const navigate=vi.fn();mount('foundations',{navigate,initialPreferences:{sidebarPinned:true,keyboardShortcuts}});
  fireEvent.click(within(rail()).getByRole('link',{name:area.title}));
  await waitFor(()=>expect(gallery(area.id)).toBeVisible());
  expect(document.querySelector('header')).toBeVisible();expect(document.querySelector('footer')).toBeVisible();
  if(area.id!=='foundations')expect(navigate).toHaveBeenLastCalledWith('/'+area.id);
 });
 test.each(areas)('command palette reaches $id',async area=>{
  mount('foundations',{initialPreferences:{keyboardShortcuts}});
  const dialog=await openPalette();fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:area.id}});
  fireEvent.click(within(dialog).getByRole('button',{name:new RegExp('^'+area.title)}));
  await waitFor(()=>expect(gallery(area.id)).toBeVisible());expect(screen.queryByRole('dialog')).toBeNull();
 });
});
test('quick pages, keyboard toggle and browser route changes share one workspace',async()=>{
 const view=mount('foundations');fireEvent.click(header().getByRole('button',{name:'Shell'}));expect(gallery('shell')).toBeVisible();
 fireEvent.keyDown(window,{key:'k',code:'KeyK',ctrlKey:true});expect(await screen.findByRole('dialog')).toBeVisible();fireEvent.keyDown(document,{key:'Escape'});
 fireEvent.click(within(gallery('shell')).getByRole('switch',{name:'Keyboard shortcuts'}));
 fireEvent.keyDown(window,{key:'k',code:'KeyK',ctrlKey:true});expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(header().getByRole('button',{name:'AI'}));expect(gallery('ai')).toBeVisible();
 view.rerender(<DemoProviders area="components"><AppFrame/></DemoProviders>);await waitFor(()=>expect(gallery('components')).toBeVisible());
 expect(within(gallery('components')).getByRole('switch',{name:'Keyboard shortcuts'})).not.toBeChecked();
});
test('playground sidebar settings drive actual hover, click, pin, focus and live locks',async()=>{
 mount('playground');const side=rail();fireEvent.mouseEnter(side);expect(within(side).getByRole('link',{name:'Shell'})).toBeVisible();fireEvent.mouseLeave(side);
 const controls=within(gallery('playground'));
 fireEvent.change(controls.getByRole('combobox',{name:'sidebarPlacement'}),{target:{value:'right'}});
 expect(side.className).toContain('right-0');
 fireEvent.change(controls.getByRole('combobox',{name:'sidebarExpandOn'}),{target:{value:'click'}});
 fireEvent.click(controls.getByRole('switch',{name:'Expand sidebar on focus'}));
 fireEvent.click(within(side).getByRole('button',{name:'Expand navigation'}));expect(within(side).getByRole('link',{name:'Shell'})).toBeVisible();
 fireEvent.click(controls.getByRole('switch',{name:'Pin sidebar'}));expect(within(side).getByTitle('Unpin sidebar')).toBeEnabled();
 fireEvent.click(controls.getByRole('switch',{name:'Lock sidebar preferences'}));
 expect(controls.getByRole('combobox',{name:'sidebarPlacement'})).toBeDisabled();expect(controls.getByRole('switch',{name:'Pin sidebar'})).not.toBeChecked();expect(within(side).getByTitle('Pin sidebar')).toBeDisabled();
 fireEvent.click(controls.getByRole('switch',{name:'Lock sidebar preferences'}));fireEvent.click(controls.getByRole('switch',{name:'Expand sidebar on focus'}));
 const collapse=within(side).queryByRole('button',{name:'Collapse navigation'});if(collapse)fireEvent.click(collapse);fireEvent.focus(within(side).getByRole('button',{name:'Expand navigation'}));expect(within(side).getByRole('link',{name:'Shell'})).toBeVisible();
});
test('workspace examples split, reattach fictional windows and arrange MDI frames',async()=>{
 mount('shell');fireEvent.click(screen.getByRole('button',{name:'Split with Foundations'}));expect(gallery('shell')).toBeVisible();expect(gallery('foundations')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Exit split canvas'}));
 fireEvent.click(screen.getByRole('button',{name:'Simulate detach Foundations'}));await waitFor(()=>expect(screen.getByText('Detached documents: 1')).toBeVisible());
 fireEvent.click(screen.getByRole('button',{name:'Reattach Foundations'}));fireEvent.click(header().getByRole('button',{name:'Shell'}));await waitFor(()=>expect(screen.getByText('Detached documents: 0')).toBeVisible());
 fireEvent.click(screen.getByRole('switch',{name:'Floating workspace windows'}));expect(screen.getAllByRole('button',{name:/Minimise/}).length).toBeGreaterThan(0);
});
test('documentation, help, toast and controlled session lock use shell layers',async()=>{
 mount('shell');fireEvent.click(screen.getByRole('button',{name:'Open fictional guide'}));expect(await screen.findByText('Fictional showcase guide')).toBeVisible();fireEvent.keyDown(document,{key:'Escape'});
 fireEvent.click(screen.getByRole('button',{name:'Open help and tours'}));const help=await screen.findByRole('dialog',{name:'Help'});fireEvent.click(within(help).getByRole('button',{name:'Tour'}));fireEvent.click(within(help).getByRole('button',{name:'Play tour'}));expect(within(help).getByRole('button',{name:'Pause'})).toBeVisible();fireEvent.click(within(help).getByRole('button',{name:'Stop'}));fireEvent.click(within(help).getByRole('button',{name:'Close help'}));
 fireEvent.click(screen.getByRole('button',{name:'Show success toast'}));expect(await screen.findByText('Fictional change saved')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Lock demo session'}));const lock=await screen.findByRole('dialog',{name:'Your session has ended'});
 expect(lock).toHaveAttribute('open');fireEvent.change(within(lock).getByLabelText(/^Username/),{target:{value:'fictional'}});fireEvent.change(within(lock).getByLabelText(/^Password/),{target:{value:'ignored'}});fireEvent.click(within(lock).getByRole('button',{name:'Sign in'}));await waitFor(()=>expect(lock).not.toBeInTheDocument());expect(gallery('shell')).toBeVisible();
});
test('public login preview submits only to the controlled demo session',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch');mount('shell');fireEvent.click(screen.getByRole('button',{name:'Preview login'}));
 const preview=within(document.querySelector('[data-example="shell-login"]')! as HTMLElement);
 fireEvent.change(preview.getByLabelText(/^Username/),{target:{value:'fictional'}});fireEvent.change(preview.getByLabelText(/^Password/),{target:{value:'ignored'}});fireEvent.click(preview.getByRole('button',{name:'Sign in'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Preview login'})).toBeVisible());expect(fetch).not.toHaveBeenCalled();
});
test('AI starts off: no AI surfaces or transport calls, including policy and administration',async()=>{
 const requests=vi.fn(),fetch=vi.spyOn(globalThis,'fetch');mount('ai',{aiHost:createAiSimulation(requests)});
 await act(async()=>{});expect(requests).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Open the AI assistant'})).toBeNull();expect(screen.queryByRole('button',{name:'Summarize fictional item'})).toBeNull();expect(screen.queryByLabelText('Set the key')).toBeNull();
});
test('playground enables and disables AI across navigation with no network egress',async()=>{
 const requests=vi.fn(),fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw new Error('Unexpected browser network request');});
 mount('playground',{aiHost:createAiSimulation(requests)});fireEvent.click(screen.getByRole('switch',{name:'Enable AI simulation'}));fireEvent.click(header().getByRole('button',{name:'AI'}));
 const allowed=await screen.findByRole('button',{name:'Summarize fictional item'});
 await waitFor(()=>expect(screen.getByTestId('blocked-ai-action')).toBeEmptyDOMElement());
 fireEvent.click(allowed);await waitFor(()=>expect(screen.getByText(/Mock reply for/)).toBeVisible());
 expect(screen.getByText(/Mock reply for/)).toHaveTextContent('••••••••');expect(screen.getByText(/Mock reply for/)).not.toHaveTextContent('Fictional Owner');
 fireEvent.click(screen.getByRole('button',{name:'Open the AI assistant'}));const dialog=await screen.findByRole('dialog',{name:'AI assistant'});
 expect(within(dialog).queryByRole('button',{name:/Blocked export/})).toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'Terminal mode'}));expect(within(dialog).getByRole('button',{name:'Panel mode'})).toBeVisible();
 fireEvent.click(within(dialog).getByRole('button',{name:'Panel mode'}));fireEvent.click(within(dialog).getByRole('button',{name:/^Summarize fictional item/}));
 fireEvent.click(within(dialog).getByRole('button',{name:/mock transport.*2/i}));await waitFor(()=>expect(within(dialog).getByText(/Mock reply for/)).toBeVisible());
 expect(requests.mock.calls.map(call=>call[0])).not.toContain('/ai/dispatch');expect(requests.mock.calls.every(call=>['/ai/policy','/ai/config','/ai/usage'].includes(call[0]))).toBe(true);
 expect(fetch.mock.calls.filter(([url])=>!String(url).startsWith('/'))).toEqual([]);expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(within(dialog).getByRole('button',{name:'Close'}));fireEvent.click(within(rail()).getByTitle('My Preferences'));
 await waitFor(()=>expect(gallery('playground')).toBeVisible());fireEvent.click(within(gallery('playground')).getByRole('switch',{name:'Enable AI simulation'}));requests.mockClear();
 fireEvent.click(header().getByRole('button',{name:'AI'}));await act(async()=>{});expect(screen.queryByRole('button',{name:'Open the AI assistant'})).toBeNull();expect(requests).not.toHaveBeenCalled();
});
const locked:PreferencePolicy={revision:1,rules:{density:{value:'compact',locked:true}}};
test.each([{name:'default',preferences:{}},{name:'Arabic RTL',preferences:{language:'ar'}},{name:'reduced motion',preferences:{reducedMotion:true}},{name:'locked',preferences:{density:'spacious'},policy:locked}])('enabled AI surfaces pass axe: $name',async scenario=>{
 const {container}=mount('ai',{initialAiEnabled:true,initialPreferences:scenario.preferences as Partial<UserPreferences>,initialPolicy:scenario.policy});
 await waitFor(()=>expect(screen.queryByText('Waiting for the simulation policy.')).toBeNull());await waitFor(()=>expect(document.querySelector('[data-example="ai-administration"] input')).toBeTruthy());
 const result=await axe.run(container,{rules:{'color-contrast':{enabled:false}}});expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);
});
test('existing form remains usable with the AI extension enabled inside the workspace',async()=>{
 mount('page-engines',{initialAiEnabled:true});const field=await screen.findByRole('textbox',{name:/Item name/});await waitFor(()=>expect(field).toBeEnabled());fireEvent.change(field,{target:{value:'Fictional enabled-extension edit'}});expect(field).toHaveValue('Fictional enabled-extension edit');expect(screen.queryByRole('button',{name:'Open the AI assistant'})).toBeNull();
});

test('fictional record targets resolve to the catalog without duplicate gallery documents',async()=>{
 function RecordLink(){const navigation=useNavigation();return <button onClick={()=>navigation.openInNewContext({pageId:'items',recordId:'fictional-item',mode:'edit'})}>Open fictional record target</button>;}
 render(<DemoProviders area="page-engines"><AppFrame><RecordLink/></AppFrame></DemoProviders>);
 fireEvent.click(screen.getByRole('button',{name:'Open fictional record target'}));await waitFor(()=>expect(gallery('page-engines')).toBeVisible());expect(document.querySelectorAll('#gallery-page-engines')).toHaveLength(1);
});

test('workspace example controls honor single-document mode and managed MDI preferences',async()=>{
 mount('shell',{initialPreferences:{openRecordsInTabs:false},initialPolicy:{revision:1,rules:{floatingWindows:{value:false,locked:true}}}});
 expect(screen.getByRole('switch',{name:'Floating workspace windows'})).toBeDisabled();expect(screen.getByRole('button',{name:'Split with Foundations'})).toBeDisabled();expect(screen.getByRole('button',{name:'Simulate detach Foundations'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Open Foundations tab'}));await waitFor(()=>expect(gallery('foundations')).toBeVisible());expect(gallery('shell')).toBeNull();
});
