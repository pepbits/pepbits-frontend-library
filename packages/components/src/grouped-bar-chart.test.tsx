import {render,screen,fireEvent} from './test/render';
import {test,expect} from 'vitest';
import {GroupedBarChart} from './grouped-bar-chart';
test('grouped bars carry titles, a legend and native keyboard inspection',() => {
  const {container}=render(<GroupedBarChart label="Revenue" labels={['North','South']} series={[{id:'net',label:'Net',values:[10,20]},{id:'tax',label:'Tax',values:[2,4]}]} formatValue={String}/>);
  expect(screen.getByRole('img',{name:'Revenue'})).toBeInTheDocument();
  expect(container.querySelectorAll('rect title')).toHaveLength(4);
  expect(container.querySelector('rect title')?.textContent).toBe('North · Net: 10');
  expect(screen.getByRole('list',{name:'Legend'})).toHaveTextContent('Tax');
  fireEvent.change(screen.getByRole('combobox',{name:'Revenue'}),{target:{value:'1'}});
  expect(screen.getByText('20',{selector:'dd'})).toBeVisible();expect(screen.getByText('4',{selector:'dd'})).toBeVisible();
});
test('negative, empty and single-series data stay finite',() => {
  const {container}=render(<><GroupedBarChart label="Variance" labels={['A','B']} series={[{id:'v',label:'Variance',values:[-5,Number.NaN]}]} formatValue={String}/><GroupedBarChart label="Empty" labels={[]} series={[]} formatValue={String}/></>);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  expect(screen.queryByRole('list',{name:'Legend'})).toBeNull();
  expect(screen.getByText('No data')).toBeInTheDocument();
});
