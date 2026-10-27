import {render,screen} from '@testing-library/react';
import {expect,test} from 'vitest';
import {ProgressBar} from './progress-bar';

test.each([[135,100],[-4,0],[NaN,0],[31.4,31]])('bounds and names progress %s', (value,expected)=>{
  render(<ProgressBar value={value} label="Leave used" tone="warning"/>);
  expect(screen.getByRole('progressbar',{name:'Leave used'})).toHaveAttribute('aria-valuenow',String(expected));
});
