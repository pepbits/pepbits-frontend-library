import React from 'react';import {render,screen,fireEvent,cleanup} from '@testing-library/react';import {afterEach,it,expect,vi} from 'vitest';
import {subscribeSentinel} from '@pepbits/platform';import {SentinelBoundary} from './sentinel';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('render failures expose a safe reference and recover when navigation changes',()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});const received:unknown[]=[];const stop=subscribeSentinel(event=>received.push(event));
 function Broken():React.ReactNode{throw Error('RECORD SECRET');}
 const view=render(<SentinelBoundary resetKey="a"><Broken /></SentinelBoundary>);
 expect(screen.getByRole('alert').textContent).not.toContain('SECRET');expect(screen.getByRole('button',{name:'Retry'})).toBeDefined();expect(received).toHaveLength(1);expect(JSON.stringify(received)).not.toContain('SECRET');
 view.rerender(<SentinelBoundary resetKey="b"><p>Recovered</p></SentinelBoundary>);expect(screen.getByText('Recovered')).toBeDefined();stop();
});
