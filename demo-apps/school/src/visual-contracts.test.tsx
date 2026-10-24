import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect} from 'vitest';
import axe from 'axe-core';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {ReferenceHostProvider} from './modules/school/test-support/providers';
import {fakeHost,createFakeBackend} from './modules/school/test-support/fake-host.test-support';
import {LineChart,Donut,BarChart} from './modules/school/ui/charts';
import {ReferenceSchoolModule} from './modules/school/test-support/module';
import {isoDay} from './modules/school/lib/utils';
import {DataTable} from './modules/school/ui/data-table';
const profiles=[['default',{}],['Arabic RTL',{language:'ar'}],['reduced motion',{reducedMotion:true}],['independent result scale',{fontSizeBase:12,fontSizeForm:14,fontSizeResult:16}]] as const;
it.each(profiles)('source chart options survive the shared adapter: %s',async(_,preferences)=>{
 const host=fakeHost(createFakeBackend(),{roles:['admin'],preferences});
 const {container}=render(<LocalizationProvider value={{language:host.preferences.language,direction:host.preferences.language==='ar'?'rtl':'ltr',t:key=>key,dateTime:String}}><ReferenceHostProvider host={host}><main><BarChart height={140} data={[{label:"Mon",value:100}]}/><LineChart height={150} min={85} max={100} labels={['Mon','Tue']} suffix="%" series={[{name:'Present',values:[85,100],fill:false},{name:'Filled',values:[85,100]}]}/><Donut size={84} thickness={11} center="42" sub="students" data={[{label:'Female',value:42,color:'#8a3563'}]}/></main></ReferenceHostProvider></LocalizationProvider>);
 expect(parseFloat((container.querySelector('[data-bar-chart] [data-metric-bar]') as HTMLElement).style.height)).toBeCloseTo(90.91,1);
 expect(container.querySelector('[data-chart-plot]')).toHaveStyle({height:'150px'});
 expect(container.querySelector('polyline')).toHaveAttribute('points',host.preferences.language==='ar'?'100,100 0,0':'0,100 100,0');expect(container.querySelectorAll('polygon')).toHaveLength(1);expect(container.querySelector('polygon')).toHaveAttribute('points',host.preferences.language==='ar'?'100,100 100,100 0,0 0,100':'0,100 0,100 100,0 100,100');
 expect(container.querySelector('[data-donut-chart] svg')).toHaveAttribute('width','84');
 expect(container.querySelector('[data-donut-chart] circle:nth-child(2)')).toHaveAttribute('stroke','#8a3563');
 const control=screen.getByRole('combobox');fireEvent.focus(control);fireEvent.change(control,{target:{value:'1'}});
 expect(screen.getByRole('status')).toHaveTextContent('100%');
 expect((await axe.run(container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
it('source table headers, search and three-state sorting retain locked result presentation',async()=>{
 const host=fakeHost(createFakeBackend(),{roles:['admin'],preferences:{pageSize:50,density:'spacious'},policy:{revision:1,rules:{pageSize:{value:10,locked:true},density:{value:'compact',locked:true}}}});
 const rows=Array.from({length:12},(_,i)=>({id:String(i),name:`Fictional ${String(12-i).padStart(2,'0')}`}));
 render(<ReferenceHostProvider host={host}><DataTable rows={rows} columns={[{key:'name',header:'Name',headerClassName:'school-person-heading'}]}/></ReferenceHostProvider>);
 expect(screen.getByRole('columnheader',{name:'Name'})).toHaveClass('school-person-heading');
 expect(screen.getByRole('table')).toHaveAttribute('data-density','compact');
 expect(screen.getByRole('combobox',{name:/rows per page/i})).toBeDisabled();
 const sort=screen.getByRole('button',{name:'Name'});fireEvent.click(sort);expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort','ascending');
 fireEvent.click(sort);expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort','descending');fireEvent.click(sort);expect(screen.getByRole('columnheader')).not.toHaveAttribute('aria-sort');
 fireEvent.change(screen.getByRole('textbox',{name:'Search table'}),{target:{value:'Fictional 01'}});await waitFor(()=>expect(screen.getAllByRole('row')).toHaveLength(2));
});

it('calendar exposes source overflow counts and the complete selected-day agenda',async()=>{
 const backend=createFakeBackend(),day=isoDay(new Date());
 backend.db.events=Array.from({length:4},(_,i)=>({id:`overflow-${i}`,title:`Fictional event ${i+1}`,date:day,type:'Academic' as const,location:'Fictional hall',description:''}));
 const host=fakeHost(backend,{roles:['admin']});
 const {container}=render(<ReferenceSchoolModule path="/calendar" host={host}/>);
 await screen.findByText('+1 more');
 expect(container.querySelector(`[data-date="${day}"]`)).toHaveTextContent('+1 more');
 expect(await screen.findByText('4 events')).toBeVisible();
 expect(screen.getAllByText('Fictional event 4').length).toBeGreaterThan(0);
 await waitFor(()=>expect(backend.pending).toBe(0));
 expect((await axe.run(container,{rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
