import {fireEvent,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {render,TestHost} from '../test/render';
import {ResourceRowTimeline} from './index';

const rows=[{id:'ct',label:'Scanner',group:'Imaging'},{id:'nurse',label:'Nurse',group:'Imaging'},{id:'room',label:'Room'}];
const bands=[{row:'ct',start:480,end:720,tone:'open' as const},{row:'ct',start:600,end:660,tone:'blocked' as const,label:'Maintenance'},{row:'nurse',start:480,end:600,tone:'reserved' as const}];
const events=[{id:'a',row:'ct',start:540,end:570,label:'Fictional A',detail:'09:00 to 09:30',trail:10},{id:'b',row:'ct',start:560,end:590,label:'Fictional B'},{id:'c',row:'nurse',start:500,end:520,label:'Fictional C',inactive:true}];
const rect=(element:Element)=>{Object.defineProperty(element,'getBoundingClientRect',{value:()=>({left:0,right:1000,width:1000,top:0,bottom:20,height:20,x:0,y:0,toJSON(){}})});};

test('overlapping holds receive lanes, include turnover and open their own event',()=>{
 const open=vi.fn();const {container}=render(<ResourceRowTimeline label="Board" rows={rows} bands={bands} events={events} start={360} end={1320} onOpen={open}/>);
 const a=container.querySelector('[data-row-event="a"]') as HTMLElement,b=container.querySelector('[data-row-event="b"]') as HTMLElement;
 expect(a.style.top).not.toBe(b.style.top);
 expect(Number.parseFloat(a.style.width)).toBeCloseTo(40/960*100,3);
 fireEvent.click(screen.getByRole('button',{name:'Fictional A, 09:00 to 09:30'}));
 expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'a'}));
 expect(container.querySelector('[data-row-band="blocked"]')).toHaveTextContent('Maintenance');
});

test('pointer creation snaps inside available time and refuses blocked or off-duty time',()=>{
 const create=vi.fn();const {container}=render(<ResourceRowTimeline label="Board" rows={rows} bands={bands} events={[]} start={0} end={1000} snap={15} onOpen={vi.fn()} onCreate={create}/>);
 const track=container.querySelector('[data-row-timeline-row="ct"] > div:last-child')!;rect(track);
 fireEvent.click(track,{clientX:503});expect(create).toHaveBeenLastCalledWith('ct',510);
 fireEvent.click(track,{clientX:620});fireEvent.click(track,{clientX:900});expect(create).toHaveBeenCalledTimes(1);
});

test('keyboard creation offers the first available minute and is fenced while disabled',()=>{
 const create=vi.fn(),props={label:'Board',rows,bands,events:[],start:360,end:1320,now:500,onOpen:vi.fn(),onCreate:create,createLabel:(row:{label:string})=>'Book '+row.label};
 const view=render(<ResourceRowTimeline {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Book Scanner'}));expect(create).toHaveBeenCalledWith('ct',510);
 expect(screen.getByRole('button',{name:'Book Room'})).toBeDisabled();
 view.rerender(<ResourceRowTimeline {...props} disabled/>);fireEvent.click(screen.getByRole('button',{name:'Book Scanner'}));expect(create).toHaveBeenCalledTimes(1);
});

test('groups collapse accessibly and RTL pointer positions mirror while density follows locked policy',()=>{
 const create=vi.fn();
 const {container}=render(<TestHost preferences={{density:'spacious',language:'ar'}} preferencePolicy={{revision:1,rules:{density:{value:'compact',locked:true}}}}><div dir="rtl"><ResourceRowTimeline label="Board" rows={rows} bands={bands} events={events} start={0} end={1000} onOpen={vi.fn()} onCreate={create}/></div></TestHost>);
 expect(container.querySelector('[data-row-timeline]')).toHaveAttribute('data-density','compact');
 const track=container.querySelector('[data-row-timeline-row="ct"] > div:last-child')!;rect(track);
 const style=window.getComputedStyle;vi.spyOn(window,'getComputedStyle').mockImplementation(element=>({...style(element),direction:'rtl'}) as CSSStyleDeclaration);
 fireEvent.click(track,{clientX:497});expect(create).toHaveBeenCalledWith('ct',510);
 vi.restoreAllMocks();
 const toggle=screen.getByRole('button',{name:/Imaging/});expect(toggle).toHaveAttribute('aria-expanded','true');
 fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','false');expect(container.querySelector('[data-row-timeline-row="ct"]')).toBeNull();expect(container.querySelector('[data-row-timeline-row="room"]')).not.toBeNull();
});

test('keyboard creation finds working time after a block covering the current minute',()=>{
 const create=vi.fn();
 render(<ResourceRowTimeline label="Board" rows={rows} bands={bands} events={[]} start={360} end={1320} now={620} onOpen={vi.fn()} onCreate={create} createLabel={row=>'Book '+row.label}/>);
 fireEvent.click(screen.getByRole('button',{name:'Book Scanner'}));
 expect(create).toHaveBeenCalledWith('ct',660);
 expect(screen.getByRole('button',{name:'Book Nurse'})).toBeDisabled();
});

test('invalid ranges fail explicitly and empty rows show the host label',()=>{
 expect(()=>render(<ResourceRowTimeline label="Board" rows={[]} events={[]} start={600} end={600} onOpen={vi.fn()}/>)).toThrow('Invalid timeline range');
 render(<ResourceRowTimeline label="Board" rows={[]} events={[]} onOpen={vi.fn()} emptyLabel="Nothing to show"/>);expect(screen.getByText('Nothing to show')).toBeInTheDocument();
});
