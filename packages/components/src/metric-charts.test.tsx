import React from 'react';
import {render,screen,fireEvent} from './test/render';
import {test,expect} from 'vitest';
import {BarChart,HorizontalBars,ProgressRing} from './metric-charts';
test('bar inspection exposes host-formatted metrics and comparison to keyboard users',()=>{
 render(<BarChart data={[{label:'Fictional cohort',value:12.5,compare:10}]} compareLabel="Cohort average" formatValue={value=>value.toFixed(1)+'%'}/>);
 const bar=screen.getByRole('img',{name:'Fictional cohort: 12.5% · Cohort average 10.0%'});bar.focus();fireEvent.focus(bar);expect(bar).toHaveFocus();
});
test('empty and degenerate metric inputs never produce invalid or overflowing geometry',()=>{
 const view=render(<><BarChart data={[]} formatValue={String}/><BarChart data={[{label:'Missing',value:NaN},{label:'Large',value:12}]} max={0} formatValue={String}/><HorizontalBars data={[{label:'Low',value:-5},{label:'High',value:12}]} max={0} formatValue={String}/></>);
 const bars=[...view.container.querySelectorAll<HTMLElement>('[data-metric-bar]')];expect(bars.map(bar=>bar.style.height||bar.style.width)).toEqual(['0%','100%','0%','100%']);expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);
});
test('percentage ring clamps geometry and uses the supplied formatter or authored label',()=>{
 const view=render(<ProgressRing value={150} formatValue={value=>value+' percent'}/>);expect(screen.getByText('100 percent')).toBeVisible();const ring=view.container.querySelector('[data-progress-ring]')!;expect(ring.getAttribute('stroke-dasharray')?.split(' ')[0]).toBe(ring.getAttribute('stroke-dasharray')?.split(' ')[1]);view.rerender(<ProgressRing value={NaN} label="Not assessed" formatValue={String}/>);expect(screen.getByText('Not assessed')).toBeVisible();expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);
});
