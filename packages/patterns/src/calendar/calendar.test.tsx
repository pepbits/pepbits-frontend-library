import {fireEvent,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {render,TestHost} from '../test/render';
import {ResourceTimeline,timelineLayout,timeMinutes,overlaps} from './index';
test('intervals are half-open and reject invalid time strings',() => {
  expect(overlaps(480,30,510,30)).toBe(false);expect(overlaps(480,60,510,30)).toBe(true);
  expect(timeMinutes('08:30')).toBe(510);expect(timeMinutes('24:01')).toBeNaN();expect(timeMinutes('8:30')).toBeNaN();
});
test('clipped and overlapping intervals receive lanes without losing identity',() => {
  const layout=timelineLayout([{id:'before',start:450,duration:60},{id:'overlap',start:490,duration:40},{id:'adjacent',start:530,duration:30},{id:'outside',start:100,duration:30}],480,550);
  expect(layout.map(item => [item.event.id,item.start,item.end,item.lane,item.lanes])).toEqual([['before',480,510,0,2],['overlap',490,530,1,2],['adjacent',530,550,0,1]]);
});
test('free slots create, occupied slots do not, and cancelled events remain accessible',() => {
  const slot=vi.fn(),open=vi.fn();render(<ResourceTimeline label="Schedule" resources={[{id:'one',label:'Room'}]} events={[{id:'booked',resource:'one',start:480,duration:30,label:'Meeting'},{id:'cancelled',resource:'one',start:510,duration:30,label:'Cancelled',inactive:true}]} start={480} end={570} slotLabel={(_,time)=>time} onSlot={slot} onOpen={open}/>);
  const slots=screen.getAllByRole('button').filter(button => !['Meeting','Cancelled'].includes(button.textContent!));expect(slots[0]).toBeDisabled();fireEvent.click(slots[1]!);expect(slot).toHaveBeenCalledWith('one',510);fireEvent.click(screen.getByRole('button',{name:'Meeting'}));expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'booked'}));
});
test('mounted authorization and density locks replace local presentation in RTL',() => {
  const slot=vi.fn(),props={label:'Schedule',resources:[{id:'one',label:'Room'}],events:[],start:480,end:510,slotLabel:()=> 'Book',onSlot:slot,onOpen:vi.fn()};
  const tree=(disabled:boolean)=><TestHost preferences={{density:'spacious',language:'ar'}} preferencePolicy={{revision:1,rules:{density:{value:'compact',locked:true}}}}><div dir="rtl"><ResourceTimeline {...props} disabled={disabled}/></div></TestHost>;
  const view=render(tree(false));expect(view.container.querySelector('[data-resource-timeline]')).toHaveAttribute('data-density','compact');view.rerender(tree(true));fireEvent.click(screen.getByRole('button',{name:'Book'}));expect(slot).not.toHaveBeenCalled();
});

test('long event accessible names include their visible detail',() => {
  render(<ResourceTimeline label="Schedule" resources={[{id:'one',label:'Room'}]} events={[{id:'long',resource:'one',start:480,duration:60,label:'Planning',detail:'Booked · 60 minutes'}]} start={480} end={570} slotLabel={(_,time)=>time} onSlot={vi.fn()} onOpen={vi.fn()}/>);
  expect(screen.getByRole('button',{name:'Planning Booked · 60 minutes'})).toBeVisible();
});
