import {fireEvent,render,screen} from '@testing-library/react';
import {expect,test} from 'vitest';
import {DonutSummary,MetricTile,RangeSparkline,TrendPlot} from '@pepbits/components/dashboard-visuals';

test('trend keyboard and pointer inspection use the same formatted series values',()=>{
 const view=render(<TrendPlot label="Monthly totals" labels={['January','February']} series={[{id:'a',label:'Sales',values:[10,30],fill:true},{id:'b',label:'Purchases',values:[20,15],dashed:true}]} formatAxis={String} formatValue={value=>`units ${value}`}/>);
 expect(screen.queryByRole('status')).toBeNull();const select=screen.getByRole('combobox',{name:'Monthly totals'});fireEvent.focus(select);fireEvent.change(select,{target:{value:'1'}});
 expect(screen.getByRole('status')).toHaveTextContent('FebruarySalesunits 30Purchasesunits 15');fireEvent.blur(select);expect(screen.queryByRole('status')).toBeNull();
 const svg=screen.getByRole('img');svg.getBoundingClientRect=()=>({left:0,width:720} as DOMRect);fireEvent.mouseMove(svg,{clientX:48});expect(screen.getByRole('status')).toHaveTextContent('JanuarySalesunits 10');fireEvent.mouseLeave(view.container.firstChild!);expect(screen.queryByRole('status')).toBeNull();
});
test('trend and spark safely handle empty, single and nonfinite data',()=>{
 const view=render(<><TrendPlot label="Empty" labels={[]} series={[]} formatAxis={String} formatValue={String}/><RangeSparkline values={[Number.NaN,10,10]}/><RangeSparkline values={[3]}/></>);
 expect(screen.getByText('No data')).toBeVisible();expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);expect(view.container.querySelector('polygon')).toHaveAttribute('fill','color-mix(in srgb, var(--success) 12%, var(--surface))');
});
test('donut keyboard focus changes the center and exposes values while percentages remain bounded',()=>{
 const view=render(<DonutSummary label="Distribution" totalLabel="All" parts={[{label:'Paid',value:30},{label:'Pending',value:10},{label:'Invalid',value:-4}]} formatValue={String} formatPercent={value=>value+'%'}/>);
 expect(view.container.querySelector('[aria-live]')).toHaveTextContent('40All');fireEvent.focus(screen.getByRole('button',{name:'Paid 75%'}));expect(view.container.querySelector('[aria-live]')).toHaveTextContent('30Paid');expect(screen.getByRole('button',{name:'Paid 75%'})).toHaveTextContent('75%');expect(screen.getByRole('button',{name:'Paid 75%'})).toHaveAccessibleDescription('30');fireEvent.blur(screen.getByRole('button',{name:'Paid 75%'}));expect(view.container.querySelector('[aria-live]')).toHaveTextContent('40All');
});
test('zero distributions have finite geometry and zero percentages',()=>{
 const view=render(<DonutSummary label="Empty" parts={[{label:'None',value:0}]} formatValue={String} formatPercent={value=>value+'%'}/>);expect(screen.getByRole('button')).toHaveTextContent('0%');expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);
});
test('metric formatting and colour are host supplied',()=>{
 const view=render(<MetricTile label="Total" value="1,234.50 units" hint="After filters" color="var(--success)"/>);expect(screen.getByText('1,234.50 units')).toBeVisible();expect(screen.getByText('After filters')).toBeVisible();expect(view.container.querySelector('[aria-hidden]')).toHaveStyle({background:'var(--success)'});
});
