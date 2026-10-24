import React from 'react';
import {render,renderHook,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,test} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {PreferenceHost} from '@pepbits/preferences/react';
import {DESTINATIONS,hrefFor,pages,product,targetFromPath,to} from './navigation';
import {HELP,caregridTours} from './modules/caregrid/help';
import {CaregridScreen} from './modules/caregrid/page';
import {moveAction} from './modules/caregrid/pages/frontdesk';
import {copyMonday,type Win} from './modules/caregrid/pages/resources';
import {ruleErrors} from './modules/caregrid/pages/catalog';
import {splitVisits} from './modules/caregrid/pages/patients';
import {counterLoad} from './modules/caregrid/pages/pharmacy';
import {matchHelp} from './modules/caregrid/pages/help';
import {useCaregridFormat} from './modules/caregrid/format';
import {addDays,age,fromMin,lanes,minuteOfDay,toMin} from './modules/caregrid/time';
import {noticeTarget} from './modules/caregrid/chrome';
import {TestHost} from './test/host';
import {FakeEventSource,mockCaregrid} from './test/mock-api';
import fixtures from './test/fixtures.json';

afterEach(()=>{FakeEventSource.all=[];});
describe('routes',()=>{
 test('all eleven source paths and preferences resolve to registered pages; unknown and malformed paths are not found',()=>{
  expect(DESTINATIONS.map(d=>d.path)).toEqual(['/','/book','/schedule','/frontdesk','/exceptions','/resources','/catalog','/patients','/pharmacy','/insights','/help']);
  for(const d of DESTINATIONS){expect(targetFromPath(d.path)).toEqual({pageId:d.id});expect(hrefFor({pageId:d.id})).toBe(d.path);expect(product.pages[d.id]).toBeTruthy();}
  expect(targetFromPath('/preferences')).toEqual({pageId:'preferences'});expect(targetFromPath('/login')).toEqual({pageId:'caregrid-dashboard'});
  expect(targetFromPath('/book/')).toEqual({pageId:'caregrid-book'});expect(targetFromPath('/unknown')).toEqual({pageId:'not-found'});expect(targetFromPath('/book/extra')).toEqual({pageId:'not-found'});
  expect(hrefFor({pageId:'missing'})).toBe('/not-found');expect(pages).toHaveLength(12);
 });
 test('query parameters are preserved, encoded and empty values dropped',()=>{
  expect(to('caregrid-book',{patient:5,type:'',waitlist:null,date:'2026-10-24'})).toEqual({pageId:'caregrid-book',query:'patient=5&date=2026-10-24'});
  expect(hrefFor(to('caregrid-schedule',{date:'2026-10-24',department:4}))).toBe('/schedule?date=2026-10-24&department=4');
  expect(targetFromPath('/resources','id=3')).toEqual({pageId:'caregrid-resources',query:'id=3'});
  expect(noticeTarget('/frontdesk?tab=waitlist')).toEqual({pageId:'caregrid-frontdesk',query:'tab=waitlist'});expect(noticeTarget('/exceptions')).toEqual({pageId:'caregrid-exceptions'});
 });
 test('write actions are granted to scheduling roles only; the API itself performs no authorization',()=>{
  expect(product.access?.actions?.edit).toContain('enterprise-admin');expect(product.access?.actions?.edit).not.toContain('finance-manager');
 });
});

describe('contextual help',()=>{
 test('every destination has help and a tour; shared anchors merge into one spotlight',()=>{
  const tours=caregridTours();
  for(const d of DESTINATIONS){expect(HELP[d.id]?.steps.length).toBe(HELP[d.id]?.anchors.length);expect(tours[d.id]!.length).toBeGreaterThan(0);expect(new Set(tours[d.id]!.map(s=>s.target)).size).toBe(tours[d.id]!.length);}
  expect(tours['caregrid-catalog']).toHaveLength(2);expect(tours['caregrid-catalog']![1]!.text).toContain('Changes apply to new bookings only.');
 });
 const deepLinks:Record<string,Record<string,string|number>>={'caregrid-book':{patient:1,type:1},'caregrid-resources':{id:1},'caregrid-patients':{id:1}};
 test.each(DESTINATIONS.filter(d=>d.id!=='caregrid-help').map(d=>[d.id] as const))('%s renders every tour anchor',async id=>{
  const api=mockCaregrid(),target=to(id,deepLinks[id]),page=pages.find(p=>p.id===id)!;
  if(id==='caregrid-book'){render(<TestHost client={api.client}><CaregridScreen page={page} target={target}/></TestHost>);await waitFor(()=>expect(document.querySelector('[data-slot]')).toBeTruthy());}
  else render(<TestHost client={api.client}><CaregridScreen page={page} target={target}/></TestHost>);
  for(const anchor of new Set(HELP[id]!.anchors))await waitFor(()=>expect(document.querySelector(`[data-tour="${anchor}"]`)).toBeTruthy());
 });
});

describe('scheduling helpers',()=>{
 test('facility minute arithmetic is calendar-safe and lanes separate overlapping holds',()=>{
  expect(fromMin(toMin('2026-10-24T23:50')+20)).toBe('2026-10-25T00:10');expect(addDays('2026-12-31',1)).toBe('2027-01-01');expect(minuteOfDay('2026-10-25T01:00','2026-10-24')).toBe(1500);
  expect(age('2000-10-25','2026-10-24')).toBe(25);expect(age(null)).toBe('');
  const result=lanes([{id:1,hold_start:'2026-10-24T09:00',hold_end:'2026-10-24T10:00'},{id:2,hold_start:'2026-10-24T09:30',hold_end:'2026-10-24T09:45'},{id:3,hold_start:'2026-10-24T10:00',hold_end:'2026-10-24T10:30'}]);
  expect(result.count).toBe(2);expect([result.map.get(1),result.map.get(2),result.map.get(3)]).toEqual([0,1,0]);
 });
 test('board moves map only to valid lifecycle commands',()=>{
  expect(moveAction('booked','arrived')).toBe('check_in');expect(moveAction('confirmed','done')).toBe('no_show');expect(moveAction('checked_in','session')).toBe('start');
  expect(moveAction('in_progress','done')).toBe('complete');expect(moveAction('checked_in','expected')).toBe('undo');expect(moveAction('no_show','expected')).toBe('undo');
  expect(moveAction('booked','session')).toBeNull();expect(moveAction('completed','expected')).toBeNull();expect(moveAction('in_progress','arrived')).toBeNull();
 });
 test('copying Monday replaces Tuesday to Friday and keeps weekends',()=>{
  const win=(weekday:number,start_min:number):Win=>({weekday,start_min,end_min:start_min+60,tag:'general',release_hours:0,week_parity:null});
  const rows=copyMonday([win(1,480),win(1,840),win(3,600),win(6,540)]);
  expect(rows.filter(r=>r.weekday===3).map(r=>r.start_min)).toEqual([480,840]);expect(rows.filter(r=>r.weekday===6)).toHaveLength(1);expect(rows).toHaveLength(11);
 });
 test('service rule bounds mirror the API schema',()=>{
  const ok={duration_min:'20',slot_step_min:'15',min_notice_min:'0',max_advance_days:'90',window_start:'',window_end:'',prep_instructions:''};
  expect(ruleErrors(ok)).toEqual({});expect(Object.keys(ruleErrors({...ok,duration_min:'4',slot_step_min:'241',min_notice_min:'-1',max_advance_days:'366'}))).toEqual(['duration_min','slot_step_min','min_notice_min','max_advance_days']);
  expect(ruleErrors({...ok,duration_min:'12.5'})).toHaveProperty('duration_min');
 });
 test('patient visits split, counter load and help matching follow the source rules',()=>{
  const visits=[{id:1,ref:'a',status:'booked',start_at:'2026-10-30T09:00',type_name:'x',category_icon:'',dept_color:'',at_risk:0},{id:2,ref:'b',status:'completed',start_at:'2026-10-30T08:00',type_name:'x',category_icon:'',dept_color:'',at_risk:0},{id:3,ref:'c',status:'booked',start_at:'2026-10-01T09:00',type_name:'x',category_icon:'',dept_color:'',at_risk:0}];
  const split=splitVisits(visits,'2026-10-24T09:00');expect(split.upcoming.map(v=>v.id)).toEqual([1]);expect(split.past.map(v=>v.id)).toEqual([2,3]);
  const load=counterLoad(fixtures.schedule as never);expect(load).toHaveLength(fixtures.schedule.resources.length);expect(load.every(r=>r.pct>=0&&r.pct<=100)).toBe(true);
  expect(matchHelp('').concepts).toHaveLength(6);expect(matchHelp('fasting').concepts.map(c=>c.id)).toEqual(['courses']);expect(matchHelp('zzzz').pages).toHaveLength(0);
 });
 test('durations, relative days and times use the effective formatter preferences',()=>{
  const wrapper=({children}:{children:React.ReactNode})=><PreferenceHost preferences={{...DEFAULT_PREFERENCES,timeFormat:'12h',dateFormat:'dmy'}} update={()=>{}}>{children}</PreferenceHost>;
  const {result}=renderHook(()=>useCaregridFormat(),{wrapper});const f=result.current;
  expect(f.dur(45)).toBe('45 min');expect(f.dur(90)).toBe('1 h 30 min');expect(f.dur(120)).toBe('2 h');expect(f.dur(1440)).toBe('1 day');expect(f.dur(3000)).toBe('2 d 2 h');
  expect(f.niceDate('2026-10-25','2026-10-24')).toBe('Tomorrow');expect(f.niceDate('2026-10-27')).toMatch(/^Tue 27\/10$/);
  expect(f.time('2026-10-24T14:05')).toBe('2:05 PM');expect(f.ago('2026-10-24T08:00','2026-10-24T10:30')).toBe('2 h ago');
 });
});
