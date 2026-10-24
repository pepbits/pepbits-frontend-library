import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {targetFromPath,hrefFor,healthcareProductForRole,product} from '../../navigation';
import {ReferenceMedslotModule} from './module';
import {ReferenceHostProvider,useReferenceSearchParams,type ReferenceHost} from './host';
import {MedslotApiProvider,useSourceApi} from './lib/api';
import {useMedslotFormat} from './lib/format';
import {medslotRoutes,resolveMedslotRoute,medslotPageRoles} from './routes';
import fixtures from './__fixtures__/api.json';
const data=fixtures as Record<string,any>;
const host=(handler?:(path:string,init?:RequestInit)=>Promise<any>):ReferenceHost=>({scope:{tenantId:'synthetic',applicationId:'nexora',moduleId:'reference-medslot',branchId:'hq',userId:'test',roles:['enterprise-admin']},preferences:{...DEFAULT_PREFERENCES},navigate:vi.fn(),request:vi.fn(async(path,init)=>handler?handler(path,init):structuredClone(data[path.split('?')[0]!])),path:'/'});
describe('MedSlot navigation, effective presentation and failure recovery',()=>{
 it.each(medslotRoutes)('round trips $path and preserves query identity',route=>{const path='/medslot'+(route.path==='/'?'':route.path.replace('[id]','42')),target=targetFromPath(path,'date=2026-10-23');expect(target.pageId).toBe('medslot-'+route.kind);expect(hrefFor(target)).toBe(path+'?date=2026-10-23');});
 it.each(['/medslot/nope','/medslot/patients/0','/medslot/resources/1/extra','/medslot/patients/%2F','/medslot/patients/not-a-number'])('rejects malformed route %s',path=>expect(targetFromPath(path).pageId).toBe('not-found'));
 it('exposes twelve menu destinations and role-scoped pages',()=>{expect(product.modules['reference-medslot']!.navigation[0]!.items).toHaveLength(12);expect(healthcareProductForRole('medslot-scheduler').modules['reference-medslot']).toBeTruthy();expect(healthcareProductForRole('medband-viewer').modules['reference-medslot']).toBeUndefined();expect(medslotPageRoles('audit')).not.toContain('medslot-scheduler');expect(medslotPageRoles('book')).not.toContain('medslot-provider');expect(resolveMedslotRoute('/calendar')?.kind).toBe('calendar');});
 it('keeps search parameters stable across preference rerenders',()=>{const seen:URLSearchParams[]=[];function Probe(){seen.push(useReferenceSearchParams());return null;}const h=host();h.path='/book?patient_id=1';const view=render(<ReferenceHostProvider host={h}><Probe/></ReferenceHostProvider>);view.rerender(<ReferenceHostProvider host={{...h,preferences:{...h.preferences,density:'compact'}}}><Probe/></ReferenceHostProvider>);expect(seen[0]).toBe(seen[1]);});
 it('retains a registration editor and transports while effective policy changes',async()=>{const h=host();const view=render(<ReferenceMedslotModule path="/patients" host={h}/>);fireEvent.click(await screen.findByRole('button',{name:'Register patient'}));const first=await screen.findByRole('textbox',{name:/First name/});fireEvent.change(first,{target:{value:'Fictional retained'}});await waitFor(()=>expect(h.request).toHaveBeenCalled());const count=vi.mocked(h.request).mock.calls.length;
  const changed:ReferenceHost={...h,preferences:{...h.preferences,density:'compact',language:'ar',fontFamily:'inter',reducedMotion:true,keyboardShortcuts:false}};
  changed.preferenceHost={preferences:changed.preferences,preferencePolicy:{revision:2,rules:{density:{value:'compact',locked:true}}}};
  view.rerender(<ReferenceMedslotModule path="/patients" host={changed}/>);
  expect(screen.getByRole('textbox',{name:/First name/})).toHaveValue('Fictional retained');expect(document.querySelector('table')).toHaveAttribute('data-density','compact');expect(vi.mocked(h.request).mock.calls.length).toBe(count);
 });
 it('preserves failed form values and backend field errors for explicit retry',async()=>{let fail=true;const h=host(async(path,init)=>{if(init?.method==='POST'){if(fail)throw Object.assign(Error('Validation'),{status:400,details:{error:'Check the form',fields:{phone:'Enter a valid number'}}});return {id:91,mrn:'FICT-91'};}return data[path.split('?')[0]!];});render(<ReferenceMedslotModule path="/patients" host={h}/>);fireEvent.click(await screen.findByRole('button',{name:'Register patient'}));fireEvent.change(await screen.findByRole('textbox',{name:/First name/}),{target:{value:'Fictional'}});expect(await screen.findByRole('textbox',{name:'Mobile number'})).toBeInTheDocument();fireEvent.click(screen.getAllByRole('button',{name:'Register patient'}).at(-1)!);await screen.findByText('Enter a valid number');expect(screen.getByRole('textbox',{name:/First name/})).toHaveValue('Fictional');fail=false;fireEvent.click(screen.getAllByRole('button',{name:'Register patient'}).at(-1)!);await waitFor(()=>expect(h.navigate).toHaveBeenCalledWith('/patients/91'));});
 it('supports patient lookup keyboard selection through the shared combobox',async()=>{const h=host();render(<ReferenceMedslotModule path="/book" host={h}/>);const search=await screen.findByRole('combobox',{name:'Search patients'});fireEvent.focus(search);await screen.findAllByRole('option');fireEvent.keyDown(search,{key:'Enter'});await screen.findByRole('textbox',{name:'Search services and resources'});expect(screen.getAllByText(new RegExp(data['/patients'][0].first_name)).length).toBeGreaterThan(0);});
 it('uses effective page size in appointment and audit queries',async()=>{const h=host();h.preferences={...h.preferences,pageSize:10};const view=render(<ReferenceMedslotModule path="/appointments" host={h}/>);await waitFor(()=>expect(h.request).toHaveBeenCalledWith(expect.stringContaining('limit=10'),expect.any(Object)));view.rerender(<ReferenceMedslotModule path="/audit" host={{...h,preferences:{...h.preferences,pageSize:20}}}/>);await waitFor(()=>expect(h.request).toHaveBeenCalledWith(expect.stringMatching(/^\/audit\?.*limit=20/),expect.any(Object)));});
 it('removes the global accelerator when shortcuts are disabled',async()=>{
  const h=host();const view=render(<ReferenceMedslotModule path="/patients" host={h}/>);
  await screen.findByRole('button',{name:'Register patient'});
  // The input can become queryable before the authenticated shell's shortcut effect is ready.
  // Focusing is idempotent; wait for the actual accelerator rather than only its input markup.
  await waitFor(()=>{fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getByRole('combobox',{name:'Search patients and appointments'})).toHaveFocus();});
  screen.getByRole('combobox',{name:'Search patients and appointments'}).blur();
  view.rerender(<ReferenceMedslotModule path="/patients" host={{...h,preferences:{...h.preferences,keyboardShortcuts:false}}}/>);
  const shortcut=new KeyboardEvent('keydown',{key:'k',ctrlKey:true,cancelable:true});fireEvent(window,shortcut);
  expect(shortcut.defaultPrevented).toBe(false);
  expect(screen.getByRole('combobox',{name:'Search patients and appointments'})).not.toHaveFocus();
 });
});
describe('MedSlot operation lifecycle',()=>{
 it('releases definitive failure keys after an ambiguous retry and fences unmounted replies',async()=>{const keys:string[]=[],h=host(async(_p,init)=>{keys.push(new Headers(init?.headers).get('Idempotency-Key')!);throw Object.assign(Error('Synthetic failure'),{status:keys.length===1?503:409});});let api:ReturnType<typeof useSourceApi>;function Probe(){api=useSourceApi();return null;}const view=render(<ReferenceHostProvider host={h}><MedslotApiProvider><Probe/></MedslotApiProvider></ReferenceHostProvider>);
  for(let i=0;i<3;i++)await act(async()=>{await api('/appointments',{json:{reason:'Fictional'}}).catch(()=>{});});expect(keys[0]).toBe(keys[1]);expect(keys[1]).not.toBe(keys[2]);view.unmount();
 });
 it('aborts caller-cancelled reads and rejects late replies after disposal',async()=>{let finish!:(value:unknown)=>void,signal:AbortSignal|undefined|null;const h=host((_p,init)=>{signal=init?.signal;return new Promise(resolve=>{finish=resolve;});});let api!:ReturnType<typeof useSourceApi>;function Probe(){api=useSourceApi();return null;}const view=render(<ReferenceHostProvider host={h}><MedslotApiProvider><Probe/></MedslotApiProvider></ReferenceHostProvider>);const caller=new AbortController(),promise=api('/patients',{signal:caller.signal}).catch(error=>error);caller.abort();expect(signal?.aborted).toBe(true);view.unmount();finish([]);expect(await promise).toMatchObject({name:'AbortError'});});
});

describe('MedSlot changing booking inputs',()=>{
 it('discards an obsolete patient-prefill reply after the query changes',async()=>{
  let finish!:(value:unknown)=>void;const second={...data['/patients/1'],id:2,first_name:'CurrentFictional'};
  const h=host(async(path)=>path==='/patients/1'?new Promise(resolve=>{finish=resolve;}):path==='/patients/2'?second:structuredClone(data[path.split('?')[0]!]));
  const view=render(<ReferenceMedslotModule path="/book?patient_id=1" host={h}/>);await waitFor(()=>expect(h.request).toHaveBeenCalledWith('/patients/1',expect.any(Object)));
  view.rerender(<ReferenceMedslotModule path="/book?patient_id=2" host={h}/>);await screen.findAllByText(/CurrentFictional/);
  await act(async()=>finish(data['/patients/1']));expect(screen.getAllByText(/CurrentFictional/).length).toBeGreaterThan(0);
 });
 it('formats counts, durations, percentages and facility clocks from host settings',()=>{
  function Probe(){const f=useMedslotFormat();return <p>{[f.fmtNumber(1234.5),f.pct(.1234),f.duration(90),f.fmtDateTime('2026-10-23T14:30')].join(' | ')}</p>;}
  const h=host();h.preferences={...h.preferences,numberLocale:'de-DE',dateFormat:'dmy',timeFormat:'24h',decimalPlaces:2};render(<ReferenceHostProvider host={h}><Probe/></ReferenceHostProvider>);
  expect(screen.getByText('1.234,5 | 12,34% | 1 h 30 min | 23/10/2026 14:30')).toBeTruthy();
 });
});
