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
