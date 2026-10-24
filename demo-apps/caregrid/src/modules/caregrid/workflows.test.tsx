import React from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,describe,expect,test,vi} from 'vitest';
import {TestHost} from '../../test/host';
import {FakeEventSource,mockCaregrid} from '../../test/mock-api';
import {pages,to,type CaregridTarget} from '../../navigation';
import {CaregridScreen} from './page';

afterEach(()=>{FakeEventSource.all=[];});
function mount(target:CaregridTarget,options:{writable?:boolean;fail?:Record<string,{status:number;body?:unknown}>;preferences?:Record<string,unknown>}={}){
 const api=mockCaregrid({fail:options.fail}),notify=vi.fn(),navigate=vi.fn(),page=pages.find(p=>p.id===target.pageId)!;
 const view=render(<TestHost client={api.client} notify={notify} navigate={navigate} can={()=>options.writable!==false} preferences={options.preferences as never}><main><CaregridScreen page={page} target={target}/></main></TestHost>);
 return {api,notify,navigate,view,write:(path:string)=>api.writes().filter(c=>c.path.startsWith(path))};
}
const find=(selector:string)=>waitFor(()=>{const element=document.querySelector(selector);expect(element).toBeTruthy();return element as HTMLElement;});

describe('booking',()=>{
 test('patient, service and slot book through the API with the selected assignments and source',async()=>{
  const {api,write}=mount(to('caregrid-book'));
  fireEvent.click(await find('[data-patient-option]'));await find('[data-selected-patient]');
  fireEvent.click(await find('[data-service-option]'));await find('[data-selected-service]');
  const slot=await find('[data-slot]');fireEvent.click(slot);
  fireEvent.change(screen.getByRole('combobox',{name:/Booking source/}),{target:{value:'phone'}});
  fireEvent.click(screen.getByRole('button',{name:/^Book \S+/}));
  await waitFor(()=>expect(write('/appointments')).toHaveLength(1));
  const body=write('/appointments')[0]!.body as {start:string;source:string;assignments:{requirement_id:number;resource_id:number}[];patientId:number};
  const first=api.state.availability.days.find(d=>d.total>0)!.slots[0]!;
  expect(body).toMatchObject({start:first.start,source:'phone',patientId:api.state.patients[0]!.id});expect(body.assignments).toEqual(first.assignments.map(a=>({requirement_id:a.requirement_id,resource_id:a.resource_id})));
  expect(await find('[data-booking-done]')).toHaveTextContent('CG-FICTIONAL-1');
 });
 test('a taken slot reports the server alternatives and keeps the chosen time for retry',async()=>{
  const {notify,write}=mount(to('caregrid-book',{patient:1,type:1}),{fail:{'POST /appointments':{status:409,body:{error:'Slot taken',detail:{alternatives:[{start:'2026-10-24T11:15'}]}}}}});
  await find('[data-selected-patient]');await find('[data-selected-service]');fireEvent.click(await find('[data-slot]'));
  const book=screen.getByRole('button',{name:/^Book \S+/});fireEvent.click(book);
  await waitFor(()=>expect(notify).toHaveBeenCalledWith(expect.stringContaining('11:15'),{tone:'warning'}));
  expect(write('/appointments')).toHaveLength(1);expect(screen.getByRole('button',{name:/^Book \S+/})).toBeEnabled();expect(document.querySelector('[data-booking-done]')).toBeNull();
 });
 test('repeat books a course and the waitlist records a date window',async()=>{
  const {write}=mount(to('caregrid-book',{patient:1,type:1}));
  await find('[data-selected-service]');await find('[data-slot]');
  fireEvent.click(screen.getByRole('button',{name:/Waitlist/}));const form=await find('[data-waitlist-form]');
  fireEvent.click(within(form).getByRole('button',{name:'Add to waitlist'}));
  await waitFor(()=>expect(write('/waitlist')[0]?.body).toMatchObject({patientId:1,typeId:1,priority:'routine'}));
  fireEvent.click(screen.getByRole('button',{name:/Repeat/}));await find('[data-series-form]');
  fireEvent.click(screen.getByRole('button',{name:/^Book 6 sessions/}));
  await waitFor(()=>expect(write('/appointments/series')[0]?.body).toMatchObject({weekdays:[1,3,5],time:'09:00',occurrences:6}));
  expect(await find('[data-booking-done]')).toHaveTextContent('S-FICTIONAL');
 });
 test('a read-only role can search but not book or register',async()=>{
  mount(to('caregrid-book',{patient:1,type:1}),{writable:false});
  await find('[data-slot]');fireEvent.click(document.querySelector('[data-slot]')!);
  expect(screen.getByRole('button',{name:/^Book \S+/})).toBeDisabled();expect(screen.getByText('Your role can search availability but cannot book.')).toBeInTheDocument();
 });
});

describe('appointment drawer and schedule board',()=>{
 test('opening a board event loads the appointment; check-in, cancellation reason and move are acknowledged commands',async()=>{
  const {write,notify}=mount(to('caregrid-schedule'));
  fireEvent.click(await find('[data-row-event]'));const actions=await find('[data-appointment-actions]');
  fireEvent.click(within(actions).getByRole('button',{name:'Check in'}));
  await waitFor(()=>expect(write('/appointments/').some(c=>c.path.endsWith('/status')&&(c.body as {action:string}).action==='check_in')).toBe(true));
  await waitFor(()=>expect(notify).toHaveBeenCalledWith(expect.stringContaining('Checked in'),{tone:'success'}));
  fireEvent.click(within(await find('[data-appointment-actions]')).getByRole('button',{name:'Cancel'}));
  const dialog=await screen.findByRole('dialog',{name:'Cancel this appointment?'});fireEvent.click(within(dialog).getByRole('button',{name:'Duplicate booking'}));fireEvent.click(within(dialog).getByRole('button',{name:'Cancel appointment'}));
  await waitFor(()=>expect(write('/appointments/').find(c=>c.path.endsWith('/cancel'))?.body).toEqual({reason:'Duplicate booking'}));
 });
 test('a failed status command keeps the drawer state and reports the server message',async()=>{
  const {notify}=mount(to('caregrid-schedule',{appt:3967}),{fail:{'POST /appointments/3967/status':{status:409,body:{error:'Already checked in elsewhere'}}}});
  const actions=await find('[data-appointment-actions]');fireEvent.click(within(actions).getByRole('button',{name:'Check in'}));
  await waitFor(()=>expect(notify).toHaveBeenCalledWith(expect.stringContaining('Already checked in elsewhere'),{tone:'warning'}));
  expect(within(await find('[data-appointment-actions]')).getByRole('button',{name:'Check in'})).toBeEnabled();
 });
 test('the move panel reschedules to a chosen slot with its assignments',async()=>{
  const {write}=mount(to('caregrid-schedule',{appt:3967}));
  fireEvent.click(within(await find('[data-appointment-actions]')).getByRole('button',{name:'Move'}));
  const panel=await find('[data-move-panel]');fireEvent.click(await waitFor(()=>{const slot=panel.querySelector('[data-slot]');expect(slot).toBeTruthy();return slot as HTMLElement;}));
  fireEvent.click(within(panel).getByRole('button',{name:'Move appointment'}));
  await waitFor(()=>expect(write('/appointments/3967/reschedule')[0]?.body).toMatchObject({start:expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/)}));
 });
 test('each row offers a keyboard booking command that opens a resource-scoped quick booking',async()=>{
  mount(to('caregrid-schedule'));await find('[data-row-event]');
  const book=screen.getAllByRole('button',{name:/^Book on /}).find(button=>!(button as HTMLButtonElement).disabled)!;fireEvent.click(book);
  expect(await find('[data-quick-book]')).toBeTruthy();expect(screen.getByRole('combobox',{name:/Service using this resource/})).toBeInTheDocument();
 });
 test('changing the day navigates through the shared navigation port',async()=>{
  const {navigate}=mount(to('caregrid-schedule',{date:'2026-10-24',department:4}));await find('[data-row-event]');
  fireEvent.click(screen.getByRole('button',{name:'Next day'}));
  expect(navigate).toHaveBeenCalledWith({pageId:'caregrid-schedule',query:'date=2026-10-25&department=4'});
 });
});

describe('front desk',()=>{
 test('card commands and accessible board moves map to lifecycle actions; invalid moves are refused locally',async()=>{
  const {write,notify}=mount(to('caregrid-frontdesk'));
  const card=await find('[data-flow-card]');const id=card.getAttribute('data-flow-card')!;
  fireEvent.click(within(card).getByRole('button',{name:'Check in'}));
  await waitFor(()=>expect(write(`/appointments/${id}/status`)[0]?.body).toEqual({action:'check_in'}));
  const item=await find(`[data-board-item="${id}"]`);const move=within(item).getByRole('combobox');
  await waitFor(()=>expect(move).toHaveValue('arrived'));
  fireEvent.change(move,{target:{value:'session'}});
  await waitFor(()=>expect(write(`/appointments/${id}/status`)[1]?.body).toEqual({action:'start'}));
  fireEvent.change(within(await find(`[data-board-item="${id}"]`)).getByRole('combobox'),{target:{value:'expected'}});
  await waitFor(()=>expect(notify).toHaveBeenCalledWith(expect.stringContaining('not a step'),{tone:'warning'}));expect(write(`/appointments/${id}/status`)).toHaveLength(2);
 });
 test('waitlist offers booking deep links and removal; reminders switch days',async()=>{
  const {write,navigate}=mount(to('caregrid-frontdesk',{tab:'waitlist'}));
  const entry=(await find('[data-waitlist] li'));fireEvent.click(within(entry).getByRole('button',{name:'Find a slot'}));
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({pageId:'caregrid-book',query:expect.stringContaining('waitlist=')}));
  fireEvent.click(within(entry).getByRole('button',{name:/^Remove .* from waitlist$/}));
  await waitFor(()=>expect(write('/waitlist/')[0]).toMatchObject({method:'PATCH',body:{status:'removed'}}));
 });
});

describe('availability, blocks and queue',()=>{
 test('failed queue suggestions can be retried without closing the entry',async()=>{
  const {api}=mount(to('caregrid-exceptions'),{fail:{'GET /queue/':{status:503}}});
  const queued=await find('[data-queue-item]');fireEvent.click(within(queued).getByRole('button',{name:/New times/}));
  const retry=await within(queued).findByRole('button',{name:/Retry/});
  delete api.fail['GET /queue/'];fireEvent.click(retry);
  await waitFor(()=>expect(queued.querySelector('[data-suggestion]')).toBeTruthy());
 });
 test('impact preview, block save, queue suggestion move, fix-all and holiday commands',async()=>{
  const {api,write}=mount(to('caregrid-exceptions',{resource:1}));
  await find('[data-impact="2"]');expect(api.calls.some(c=>c.path==='/exceptions/preview'&&(c.body as {resource_id:number}).resource_id===1)).toBe(true);
  fireEvent.click(screen.getByRole('radio',{name:'Weekly'}));
  await waitFor(()=>expect(api.calls.filter(c=>c.path==='/exceptions/preview').at(-1)?.body).toMatchObject({recur_weeks:1}));
  fireEvent.click(screen.getByRole('button',{name:/^Block and queue 2/}));
  await waitFor(()=>expect(api.writes().find(c=>c.path==='/exceptions')?.body).toMatchObject({resource_id:1,type:'leave',recur_weeks:1}));
  const queued=await find('[data-queue-item]');fireEvent.click(within(queued).getByRole('button',{name:/New times/}));
  const suggestion=await waitFor(()=>{const el=queued.querySelector('[data-suggestion]');expect(el).toBeTruthy();return el as HTMLElement;});fireEvent.click(suggestion);
  await waitFor(()=>expect(write(`/appointments/${api.state.queue[0]!.appointment_id}/reschedule`)).toHaveLength(1));
  fireEvent.click(screen.getByRole('button',{name:/Fix all automatically/}));await waitFor(()=>expect(write('/queue/auto')).toHaveLength(1));
  fireEvent.change(screen.getByLabelText('Holiday date'),{target:{value:'2026-12-25'}});fireEvent.change(screen.getByLabelText('Holiday name'),{target:{value:'Fictional closure'}});
  fireEvent.click(screen.getByRole('button',{name:'Add holiday'}));await waitFor(()=>expect(write('/holidays')[0]?.body).toEqual({date:'2026-12-25',name:'Fictional closure'}));
 });
});

describe('resources, catalog and insights',()=>{
 test('working hours copy Monday, block invalid windows and save through PUT',async()=>{
  const {write}=mount(to('caregrid-resources',{id:1}));
  const editor=await find('[data-hours-editor]');
  fireEvent.click(screen.getByRole('button',{name:'Copy Monday to weekdays'}));
  fireEvent.click(screen.getByRole('button',{name:'Save hours'}));
  await waitFor(()=>expect(write('/resources/1/templates')).toHaveLength(1));
  const rows=write('/resources/1/templates')[0]!.body as {weekday:number;start_min:number}[];const monday=rows.filter(r=>r.weekday===1).map(r=>r.start_min);
  for(const day of [2,3,4,5])expect(rows.filter(r=>r.weekday===day).map(r=>r.start_min)).toEqual(monday);
  const start=within(editor).getAllByLabelText('Start')[0]!;fireEvent.change(start,{target:{value:'23:00'}});
  expect(await screen.findByRole('alert')).toHaveTextContent('Each working window must end after it starts.');expect(screen.getByRole('button',{name:'Save hours'})).toBeDisabled();
 });
 test('service rules validate locally and PATCH accepted values',async()=>{
  const {write}=mount(to('caregrid-catalog',{type:1}));
  const drawer=await find('[data-type-drawer="1"]');const duration=await within(drawer).findByLabelText(/Patient duration/);
  fireEvent.change(duration,{target:{value:'2'}});expect(screen.getByRole('button',{name:'Save rules'})).toBeDisabled();
  fireEvent.change(duration,{target:{value:'25'}});fireEvent.click(screen.getByRole('button',{name:'Save rules'}));
  await waitFor(()=>expect(write('/types/1')[0]).toMatchObject({method:'PATCH',body:{duration_min:25}}));
 });
 test('slot length advice applies the suggested duration',async()=>{
  const {api,write}=mount(to('caregrid-insights'));
  const advice=api.state.durations.find(d=>d.action!=='keep')!;
  const button=await screen.findAllByRole('button',{name:/^Set /});fireEvent.click(button[0]!);
  await waitFor(()=>expect(write(`/types/${advice.type_id}`)[0]?.body).toEqual({duration_min:advice.suggested}));
 });
 test('pharmacy desk marks arrival and routes one-click booking',async()=>{
  const {write,navigate}=mount(to('caregrid-pharmacy'));
  const queue=await find('[data-pharmacy-queue]');fireEvent.click(await within(queue).findAllByRole('button',{name:'Arrived'}).then(b=>b[0]!));
  await waitFor(()=>expect(write('/appointments/').some(c=>(c.body as {action?:string})?.action==='check_in')).toBe(true));
  const book=await find('[data-tour="cg-pharmacy-book"] button');fireEvent.click(book);expect(navigate).toHaveBeenCalledWith(expect.objectContaining({pageId:'caregrid-book'}));
 });
 test('help search narrows concepts and screen guides',async()=>{
  mount(to('caregrid-help'));await find('[data-concept]');
  fireEvent.change(screen.getByRole('textbox',{name:'Search help'}),{target:{value:'breakdown'}});
  await waitFor(()=>expect(document.querySelectorAll('[data-concept]').length).toBeLessThan(6));
  expect(document.querySelector('[data-concept="exceptions"]')).toBeTruthy();expect(document.querySelector('[data-guide="caregrid-exceptions"]')).toBeTruthy();
 });
});

describe('live updates',()=>{
 test('reconnecting refreshes missed changes without discarding an unsaved working-hours edit',async()=>{
  const {api}=mount(to('caregrid-resources',{id:1}));
  const editor=await find('[data-hours-editor]');
  const start=within(editor).getAllByLabelText('Start')[0]!;
  fireEvent.change(start,{target:{value:'08:15'}});
  const before=api.calls.filter(c=>c.path==='/resources/1').length;
  act(()=>FakeEventSource.latest().emit('hello',{time:'2026-10-24T09:05'}));
  await waitFor(()=>expect(api.calls.filter(c=>c.path==='/resources/1').length).toBeGreaterThan(before));
  await waitFor(()=>expect(start).toHaveValue('08:15'));
  expect(screen.getByRole('button',{name:'Save hours'})).toBeEnabled();
 });
 test('schedule-changed events re-read live queries; notifications reach the host toast path',async()=>{
  const {api,notify}=mount(to('caregrid-dashboard'));await find('[data-tour="cg-busiest"] li');
  const before=api.calls.filter(c=>c.path==='/analytics/summary').length;
  act(()=>FakeEventSource.latest().emit('hello',{time:'2026-10-24T09:00'}));
  act(()=>FakeEventSource.latest().emit('schedule-changed',{}));
  await waitFor(()=>expect(api.calls.filter(c=>c.path==='/analytics/summary').length).toBeGreaterThan(before));
  act(()=>FakeEventSource.latest().emit('notification',{id:999,created_at:'2026-10-24T09:01',level:'warning',category:'exception',title:'Fictional breakdown',body:'Two bookings need a new time',read:0}));
  await waitFor(()=>expect(notify).toHaveBeenCalledWith('Fictional breakdown. Two bookings need a new time',{tone:'warning'}));
 });
 test('reference data failure shows recovery and retries',async()=>{
  const {api}=mount(to('caregrid-dashboard'),{fail:{'GET /meta':{status:503}}});
  const retry=await screen.findByRole('button',{name:/Retry/});delete api.fail['GET /meta'];fireEvent.click(retry);
  await find('[data-command-center]');
 });
});
