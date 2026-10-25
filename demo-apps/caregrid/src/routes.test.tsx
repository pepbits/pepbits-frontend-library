import React from 'react';
import {act,render,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import axe from 'axe-core';
import {TestHost} from './test/host';
import {FakeEventSource,mockCaregrid} from './test/mock-api';
import {pages,targetFromPath,hrefFor,to,type CaregridTarget} from './navigation';
import {CaregridScreen} from './modules/caregrid/page';

const profiles=[['default',{},undefined],['Arabic RTL',{language:'ar' as const},undefined],['reduced motion',{reducedMotion:true},undefined],['locked density',{density:'spacious' as const},{revision:1,rules:{density:{value:'compact',locked:true}}}]] as const;
/** Every destination and every source deep-link variant, each with a selector proving its API data rendered. */
const cases:[string,CaregridTarget,string[]][]=[
 ['command center',to('caregrid-dashboard'),['[data-command-center] [data-tour="cg-busiest"] li']],
 ['book',to('caregrid-book'),['[data-patient-option]','[data-service-option]']],
 ['book deep link',to('caregrid-book',{patient:1,type:1,date:'2026-10-24',waitlist:2}),['[data-selected-patient]','[data-selected-service]','[data-slot]']],
 ['schedule',to('caregrid-schedule'),['[data-row-timeline] [data-row-event]']],
 ['schedule with appointment',to('caregrid-schedule',{date:'2026-10-24',department:4,appt:3967}),['[data-row-event]','[data-appointment-actions]']],
 ['front desk flow',to('caregrid-frontdesk'),['[data-flow-card]']],
 ['front desk waitlist',to('caregrid-frontdesk',{tab:'waitlist'}),['[data-waitlist] li']],
 ['front desk reminders',to('caregrid-frontdesk',{tab:'reminders'}),['[data-reminders] li']],
 ['availability and blocks',to('caregrid-exceptions'),['[data-queue-item]','[data-block]']],
 ['blocks preset resource',to('caregrid-exceptions',{resource:1}),['[data-queue-item]','[data-impact="2"]']],
 ['resources',to('caregrid-resources'),['[data-resource-detail] [data-hours-editor]']],
 ['resource deep link',to('caregrid-resources',{id:1}),['[data-resource-detail="1"]']],
 ['service catalog',to('caregrid-catalog'),['tbody tr']],
 ['service deep link',to('caregrid-catalog',{type:1}),['[data-type-drawer="1"] input']],
 ['patients',to('caregrid-patients'),['[data-patient-profile]']],
 ['patient deep link',to('caregrid-patients',{id:1}),['[data-patient-profile="1"]']],
 ['pharmacy desk',to('caregrid-pharmacy'),['[data-pharmacy-queue] li','[data-tour="cg-counters"] li']],
 ['insights durations',to('caregrid-insights'),['tbody tr']],
 ['insights utilization',to('caregrid-insights',{tab:'util'}),['[data-utilization] li']],
 ['help center',to('caregrid-help'),['[data-concept]']],
];
afterEach(()=>{FakeEventSource.all=[];});
describe.each(profiles)('%s',(profile,preferences,policy)=>{it.each(cases)('%s renders API data, round-trips its route and has no axe violations',async(_,target,ready)=>{
 const api=mockCaregrid(),page=pages.find(p=>p.id===target.pageId)!;
 const {container}=render(<TestHost client={api.client} preferences={preferences} policy={policy}><main dir={profile==='Arabic RTL'?'rtl':'ltr'}><CaregridScreen page={page} target={target}/></main></TestHost>);
 for(const selector of ready)await waitFor(()=>expect(document.querySelector(selector)).toBeTruthy());
 await waitFor(()=>expect(container.querySelector('[aria-busy="true"]')).toBeNull());
 if(policy)expect(container.querySelector('[data-row-timeline]')?.getAttribute('data-density')??'compact').toBe('compact');
 expect(targetFromPath(hrefFor(target).split('?')[0]!,hrefFor(target).split('?')[1]??'')).toEqual(target);
 await act(async()=>{expect((await axe.run(document.body,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);});
});});
