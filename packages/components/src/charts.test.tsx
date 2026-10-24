import {render,screen,fireEvent} from './test/render';
import {test,expect} from 'vitest';
import {LineChart,DonutChart,Sparkline} from './charts';
test('trend values can be inspected with a native keyboard control',() => {
  render(<LineChart label="Trend" labels={['Jan','Feb']} series={[{id:'sales',label:'Sales',values:[10,20]},{id:'orders',label:'Orders',values:[4,8]}]} formatValue={String}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Trend'}),{target:{value:'1'}});expect(screen.getByText('20',{selector:'dd'})).toBeVisible();expect(screen.getByText('8',{selector:'dd'})).toBeVisible();
});
test('zero, single point and absent series produce finite SVG geometry',() => {
  const {container}=render(<><LineChart label="Trend" labels={['Jan']} series={[{id:'one',label:'One',values:[0]}]} formatValue={String}/><DonutChart label="Status" parts={[{label:'Empty',value:0}]} formatValue={String}/><Sparkline values={[]}/></>);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);expect(screen.getByText('0 · Total')).toBeVisible();fireEvent.focus(screen.getByRole('button',{name:'Empty · 0'}));expect(screen.getByText('0 · Empty')).toBeVisible();
});
test('compact trend preserves authored bounds, height and area while keyboard inspection remains available',()=>{
  const {container}=render(<LineChart layout="compact" label="Attendance" labels={['Mon','Tue']} height={150} min={85} max={100} series={[{id:'present',label:'Present',values:[85,100]}]} formatValue={n=>`${n}%`}/>);
  expect(container.querySelector('[data-chart-plot]')).toHaveStyle({height:'150px'});
  expect(container.querySelector('polyline')).toHaveAttribute('points','0,100 100,0');
  expect(container.querySelector('polygon')).toHaveAttribute('points','0,100 0,100 100,0 100,100');
  const selector=screen.getByRole('combobox',{name:'Attendance'});
  fireEvent.focus(selector);fireEvent.change(selector,{target:{value:'1'}});
  expect(screen.getByRole('status')).toHaveTextContent('TuePresent:100%');
  fireEvent.blur(selector);expect(screen.queryByRole('status')).toBeNull();
});
test('compact charts sanitize empty and invalid geometry and preserve donut color, diameter and center',()=>{
  const {container}=render(<><LineChart layout="compact" label="Empty" labels={[]} series={[]} min={0} max={0} formatValue={String}/><DonutChart layout="compact" size={84} thickness={11} center="42" totalLabel="students" label="Students" parts={[{label:'Group A',value:42,color:'#8a3563'},{label:'Empty',value:NaN}]} formatValue={String}/></>);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  const circle=container.querySelector('[data-donut-chart] circle:nth-child(2)');
  expect(circle).toHaveAttribute('r','36.5');expect(circle).toHaveAttribute('stroke-width','11');expect(circle).toHaveAttribute('stroke','#8a3563');
  expect(screen.getByRole('img',{name:'Students'})).toHaveAttribute('width','84');
  fireEvent.focus(screen.getByRole('button',{name:'Group A 42'}));expect(container.querySelector('[aria-live]')).toHaveTextContent('Group A: 42');
});
