import React from 'react';
import {fireEvent,render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Table,TableBody,TableRow,TableCell,TableContainer} from './table';
afterEach(cleanup);
it('activates row actions with Enter/Space without double-activating nested controls',()=>{
 const onClick=vi.fn(),onKeyDown=vi.fn();render(<Table><TableBody><TableRow onClick={onClick} onKeyDown={onKeyDown}><TableCell><button>Nested</button></TableCell></TableRow></TableBody></Table>);
 const row=screen.getByRole('row');expect(row).toHaveAttribute('tabindex','0');fireEvent.keyDown(row,{key:'Enter'});fireEvent.keyDown(row,{key:' '});expect(onClick).toHaveBeenCalledTimes(2);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});expect(onClick).toHaveBeenCalledTimes(2);expect(onKeyDown).toHaveBeenCalledTimes(3);
});
it('respects explicit focus/keyboard handling and only gives scroll containers a default tab stop',()=>{
 const onClick=vi.fn();const view=render(<TableContainer data-testid="scroll"><Table><TableBody><TableRow tabIndex={-1} onClick={onClick} onKeyDown={e=>e.preventDefault()}><TableCell>Demo</TableCell></TableRow></TableBody></Table></TableContainer>);
 expect(screen.getByTestId('scroll')).toHaveAttribute('tabindex','0');expect(screen.getByRole('row')).toHaveAttribute('tabindex','-1');fireEvent.keyDown(screen.getByRole('row'),{key:'Enter'});expect(onClick).not.toHaveBeenCalled();view.rerender(<TableContainer data-testid="scroll" overflow="hidden"/>);expect(screen.getByTestId('scroll')).not.toHaveAttribute('tabindex');view.rerender(<TableContainer data-testid="scroll" tabIndex={-1}/>);expect(screen.getByTestId('scroll')).toHaveAttribute('tabindex','-1');
});
